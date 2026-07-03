const { connectTestDb, disconnectTestDb } = require('./db-setup');
const nock = require('nock');

// Block all real HTTP — unmatched requests throw immediately instead of hanging
nock.disableNetConnect();

const peers = require('../controllers/control.peers');
const Peer = require('../models/model.peer');
const State = require('../models/model.state');
const Perf = require('../models/model.perf');
const Stats = require('../models/model.stats');
const GeoIP = require('../models/model.geoip');

const TEST_IP = '10.0.0.1';
const TEST_PORT = 7876;
const PEER_IP = '10.0.0.2';

beforeAll(async () => {
    await connectTestDb();
});

afterAll(async () => {
    await disconnectTestDb();
});

afterEach(async () => {
    await Promise.all([
        Peer.deleteMany({}),
        State.deleteMany({}),
        Perf.deleteMany({}),
        Stats.deleteMany({}),
        GeoIP.deleteMany({}),
    ]);
    nock.cleanAll();
});

// ─── crawl ────────────────────────────────────────────────────────────────────

describe('crawl', () => {
    it('discovers and saves a new peer from seed node', async () => {
        nock(`http://${TEST_IP}:${TEST_PORT}`)
            .get('/api')
            .query({ requestType: 'getPeers', state: 'CONNECTED' })
            .reply(200, { peers: [PEER_IP] });

        nock(`http://${TEST_IP}:${TEST_PORT}`)
            .get('/api')
            .query({ requestType: 'getPeer', peer: PEER_IP })
            .reply(200, {
                address: PEER_IP,
                apiPort: TEST_PORT,
                version: '1.11.15',
                blacklisted: false,
                state: 1,
                application: 'XIN'
            });

        // recursive call on discovered peer returns no further peers
        nock(`http://${PEER_IP}:${TEST_PORT}`)
            .get('/api')
            .query({ requestType: 'getPeers', state: 'CONNECTED' })
            .reply(200, { peers: [] });

        await Peer.create({ _id: TEST_IP, apiPort: TEST_PORT });
        await peers.crawl();

        const saved = await Peer.findOne({ _id: PEER_IP });
        expect(saved).not.toBeNull();
        expect(saved.version).toBe('1.11.15');
        expect(saved.lastConnected).toBeDefined();
    });

    it('removes a peer that has been blacklisted', async () => {
        await Peer.create({ _id: TEST_IP, apiPort: TEST_PORT });
        await Peer.create({ _id: PEER_IP, apiPort: TEST_PORT });

        nock(`http://${TEST_IP}:${TEST_PORT}`)
            .get('/api')
            .query({ requestType: 'getPeers', state: 'CONNECTED' })
            .reply(200, { peers: [PEER_IP] });

        nock(`http://${TEST_IP}:${TEST_PORT}`)
            .get('/api')
            .query({ requestType: 'getPeer', peer: PEER_IP })
            .reply(200, {
                address: PEER_IP,
                apiPort: TEST_PORT,
                blacklisted: true,
                state: 1
            });

        nock(`http://${PEER_IP}:${TEST_PORT}`)
            .get('/api')
            .query({ requestType: 'getPeers', state: 'CONNECTED' })
            .reply(200, { peers: [] });

        await peers.crawl();

        const blacklisted = await Peer.findOne({ _id: PEER_IP });
        expect(blacklisted).toBeNull();
    });

    it('uses seed node when DB is empty', async () => {
        const config = require('../core/config');
        const seedHost = config.nodeApiHost;
        const seedPort = config.nodeApiPort || 80;

        nock(`http://${seedHost}:${seedPort}`)
            .get('/api')
            .query({ requestType: 'getPeers', state: 'CONNECTED' })
            .reply(200, { peers: [] });

        await peers.crawl();
        // No error thrown is the assertion here
    });
});

// ─── processPeers ─────────────────────────────────────────────────────────────

describe('processPeers', () => {
    it('creates a state record and perf log when getPeerState succeeds', async () => {
        await Peer.create({ _id: TEST_IP, apiPort: TEST_PORT });

        nock(`http://${TEST_IP}:${TEST_PORT}`)
            .get('/api')
            .query({ requestType: 'getPeerState' })
            .reply(200, {
                availableProcessors: 4,
                freeMemory: 512,
                totalMemory: 1024,
                maxMemory: 2048,
                numberOfActivePeers: 10,
                SystemLoadAverage: 1.5,
                requestProcessingTime: 20,
                apiServerCORS: true,
                apiServerEnable: true,
                correctInvalidFees: true,
                isDownloading: false
            });

        // GeoIP call (first time, no cached record)
        nock('http://ip-api.com')
            .get(`/json/${TEST_IP}`)
            .reply(200, {
                status: 'success',
                country: 'Germany',
                countryCode: 'DE',
                region: 'BY',
                regionName: 'Bavaria',
                city: 'Munich',
                zip: '80331',
                timezone: 'Europe/Berlin',
                lat: 48.137,
                lon: 11.575
            });

        await peers.processPeers();

        const state = await State.findOne({ _id: TEST_IP });
        expect(state).not.toBeNull();
        expect(state.availableProcessors).toBe(4);
        expect(state.active).toBe(true);
        expect(typeof state.rank).toBe('number');

        const perf = await Perf.findOne({ ip: TEST_IP });
        expect(perf).not.toBeNull();
        expect(perf.numberOfActivePeers).toBe(10);
        expect(perf.freeMemory).toBe(512);

        const geoip = await GeoIP.findOne({ _id: TEST_IP });
        expect(geoip).not.toBeNull();
        expect(geoip.country_code).toBe('DE');
        expect(geoip.city).toBe('Munich');
    });

    it('does not create state when getPeerState fails', async () => {
        await Peer.create({ _id: TEST_IP, apiPort: TEST_PORT });

        nock(`http://${TEST_IP}:${TEST_PORT}`)
            .get('/api')
            .query({ requestType: 'getPeerState' })
            .replyWithError('connection refused');

        nock('http://ip-api.com')
            .get(`/json/${TEST_IP}`)
            .reply(200, { status: 'fail', message: 'private range' });

        await peers.processPeers();

        const state = await State.findOne({ _id: TEST_IP });
        expect(state).toBeNull();
    });

    it('skips GeoIP creation when service returns failure', async () => {
        await Peer.create({ _id: TEST_IP, apiPort: TEST_PORT });

        nock(`http://${TEST_IP}:${TEST_PORT}`)
            .get('/api')
            .query({ requestType: 'getPeerState' })
            .reply(200, { availableProcessors: 2, freeMemory: 256, totalMemory: 512, maxMemory: 1024, numberOfActivePeers: 5, SystemLoadAverage: 0.5, requestProcessingTime: 10 });

        nock('http://ip-api.com')
            .get(`/json/${TEST_IP}`)
            .reply(200, { status: 'fail', message: 'private range' });

        await peers.processPeers();

        const geoip = await GeoIP.findOne({ _id: TEST_IP });
        expect(geoip).toBeNull();
    });

    it('skips GeoIP lookup when record already exists', async () => {
        await Peer.create({ _id: TEST_IP, apiPort: TEST_PORT });
        await GeoIP.create({ _id: TEST_IP, country_code: 'US', country_name: 'United States' });

        nock(`http://${TEST_IP}:${TEST_PORT}`)
            .get('/api')
            .query({ requestType: 'getPeerState' })
            .reply(200, { availableProcessors: 2, freeMemory: 256, totalMemory: 512, maxMemory: 1024, numberOfActivePeers: 3, SystemLoadAverage: 0.2, requestProcessingTime: 5 });

        // Should NOT call ip-api.com since record exists
        await peers.processPeers();

        // GeoIP record should be unchanged (the cached one)
        const geoip = await GeoIP.findOne({ _id: TEST_IP });
        expect(geoip.country_code).toBe('US');
    });
});

// ─── buildStats ───────────────────────────────────────────────────────────────

describe('buildStats', () => {
    it('writes aggregated stats when state records exist', async () => {
        await Peer.create([
            { _id: TEST_IP, version: '1.11.15' },
            { _id: PEER_IP, version: '1.11.15' },
        ]);

        await State.create([
            { _id: TEST_IP, active: true, apiSSL: true, apiServerCORS: true, apiServerEnable: true, correctInvalidFees: true, storageMongodb: true },
            { _id: PEER_IP, active: true, apiSSL: false, apiServerCORS: false, apiServerEnable: false, correctInvalidFees: false },
        ]);

        await peers.buildStats();

        const stats = await Stats.findOne({ _id: 'nodeStats' });
        expect(stats).not.toBeNull();
        expect(stats.activeNodes).toBe(2);
        expect(stats.apiSSL).toBe(1);
        expect(stats.storageMongodb).toBe(1);
        expect(stats.totalNodes).toBe(2);
        expect(stats.version).toBe('1.11.15');
    });

    it('does not write stats when no state records exist', async () => {
        await Peer.create({ _id: TEST_IP, version: '1.0.0' });

        await peers.buildStats();

        const stats = await Stats.findOne({ _id: 'nodeStats' });
        expect(stats).toBeNull();
    });

    it('identifies the most commonly used version', async () => {
        await Peer.create([
            { _id: '10.0.0.1', version: '1.0' },
            { _id: '10.0.0.2', version: '2.0' },
            { _id: '10.0.0.3', version: '2.0' },
        ]);
        await State.create([
            { _id: '10.0.0.1' },
            { _id: '10.0.0.2' },
            { _id: '10.0.0.3' },
        ]);

        await peers.buildStats();

        const stats = await Stats.findOne({ _id: 'nodeStats' });
        expect(stats.version).toBe('2.0');
    });
});

// ─── healthCheckAndCleanPeers ─────────────────────────────────────────────────

describe('healthCheckAndCleanPeers', () => {
    it('marks an active peer as inactive when no peer confirms it is connected', async () => {
        await Peer.create({ _id: TEST_IP, apiPort: TEST_PORT, active: true });
        await Peer.create({ _id: PEER_IP, apiPort: TEST_PORT, active: true });

        // PEER_IP is asked about TEST_IP - returns unknown peer (errorCode 5, skip)
        nock(`http://${PEER_IP}:${TEST_PORT}`)
            .get('/api')
            .query({ requestType: 'getPeer', peer: TEST_IP })
            .reply(200, { errorCode: 5 });

        // TEST_IP is asked about PEER_IP - returns unknown peer (errorCode 5, skip)
        nock(`http://${TEST_IP}:${TEST_PORT}`)
            .get('/api')
            .query({ requestType: 'getPeer', peer: PEER_IP })
            .reply(200, { errorCode: 5 });

        await peers.healthCheckAndCleanPeers();

        const checkedPeer = await Peer.findOne({ _id: TEST_IP });
        expect(checkedPeer.active).toBe(false);
    });

    it('keeps an active peer active when another peer confirms state=1', async () => {
        await Peer.create({ _id: TEST_IP, apiPort: TEST_PORT, active: true });
        await Peer.create({ _id: PEER_IP, apiPort: TEST_PORT, active: true });

        nock(`http://${PEER_IP}:${TEST_PORT}`)
            .get('/api')
            .query({ requestType: 'getPeer', peer: TEST_IP })
            .reply(200, { state: 1, version: '1.0', apiPort: TEST_PORT });

        nock(`http://${TEST_IP}:${TEST_PORT}`)
            .get('/api')
            .query({ requestType: 'getPeer', peer: PEER_IP })
            .reply(200, { state: 1, version: '1.0', apiPort: TEST_PORT });

        await peers.healthCheckAndCleanPeers();

        const activePeer = await Peer.findOne({ _id: TEST_IP });
        expect(activePeer.active).toBe(true);
        expect(activePeer.lastConnected).toBeDefined();
    });

    it('deletes an inactive peer whose lastConnected exceeds the timeout', async () => {
        const oldDate = new Date(Date.now() - 200 * 60 * 1000); // 200 minutes ago
        await Peer.create({ _id: TEST_IP, apiPort: TEST_PORT, active: false, lastConnected: oldDate });

        await peers.healthCheckAndCleanPeers();

        const deleted = await Peer.findOne({ _id: TEST_IP });
        expect(deleted).toBeNull();
    });

    it('keeps an inactive peer that is within the timeout window', async () => {
        const recentDate = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
        await Peer.create({ _id: TEST_IP, apiPort: TEST_PORT, active: false, lastConnected: recentDate });

        await peers.healthCheckAndCleanPeers();

        const kept = await Peer.findOne({ _id: TEST_IP });
        expect(kept).not.toBeNull();
    });
});

// ─── calculateRank (via createUpdatePeerState) ────────────────────────────────

describe('createUpdatePeerState', () => {
    it('sets rank to 0 for downloading peers', async () => {
        const stateData = {
            availableProcessors: 4,
            freeMemory: 512,
            totalMemory: 1024,
            maxMemory: 2048,
            numberOfActivePeers: 10,
            SystemLoadAverage: 0.5,
            requestProcessingTime: 10,
            isDownloading: true,
            apiServerCORS: true,
            apiServerEnable: true,
            correctInvalidFees: true
        };

        await peers.createUpdatePeerState(TEST_IP, stateData);

        const state = await State.findOne({ _id: TEST_IP });
        expect(state.rank).toBe(0);
    });

    it('accumulates history arrays on subsequent updates', async () => {
        const base = {
            availableProcessors: 2,
            freeMemory: 256,
            totalMemory: 512,
            maxMemory: 1024,
            numberOfActivePeers: 5,
            SystemLoadAverage: 1.0,
            requestProcessingTime: 15,
            apiServerCORS: true,
            apiServerEnable: true,
            correctInvalidFees: true,
            isDownloading: false,
            history_freeMemory: [],
            history_SystemLoadAverage: [],
            history_numberOfActivePeers: [],
            history_requestProcessingTime: []
        };

        await peers.createUpdatePeerState(TEST_IP, { ...base });

        const updated = { ...base, freeMemory: 512, numberOfActivePeers: 7 };
        await peers.createUpdatePeerState(TEST_IP, updated);

        const state = await State.findOne({ _id: TEST_IP });
        expect(state.history_freeMemory.length).toBeGreaterThanOrEqual(1);
        expect(state.history_numberOfActivePeers.length).toBeGreaterThanOrEqual(1);
    });
});
