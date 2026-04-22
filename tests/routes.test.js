const request = require('supertest');
const { connectTestDb, disconnectTestDb } = require('./db-setup');

const { app } = require('../app');
const BASE = require('../core/config').publicPath;
const Peer = require('../models/model.peer');
const State = require('../models/model.state');
const Stats = require('../models/model.stats');
const Perf = require('../models/model.perf');
const GeoIP = require('../models/model.geoip');

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
        Stats.deleteMany({}),
        Perf.deleteMany({}),
        GeoIP.deleteMany({}),
    ]);
});

describe('GET /api/version', () => {
    it('returns the package version', async () => {
        const res = await request(app).get(`${BASE}/api/version`);
        expect(res.status).toBe(200);
        expect(res.text).toBe(require('../package.json').version);
    });
});

describe('GET /api/nodes', () => {
    it('returns empty array when no peers exist', async () => {
        const res = await request(app).get(`${BASE}/api/nodes`);
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    it('returns seeded peers with pagination defaults', async () => {
        await Peer.create({ _id: '1.2.3.4', version: '1.0.0', active: true });
        await Peer.create({ _id: '5.6.7.8', version: '1.0.0', active: true });

        const res = await request(app).get(`${BASE}/api/nodes`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBe(2);
    });

    it('respects the results limit parameter', async () => {
        for (let i = 1; i <= 5; i++) {
            await Peer.create({ _id: `10.0.0.${i}`, version: '1.0.0' });
        }
        const res = await request(app).get(`${BASE}/api/nodes?results=2&page=1`);
        expect(res.status).toBe(200);
        expect(res.body.length).toBe(2);
    });

    it('returns empty array for page beyond available data', async () => {
        await Peer.create({ _id: '1.2.3.4', version: '1.0.0' });
        const res = await request(app).get(`${BASE}/api/nodes?results=10&page=2`);
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    it('finds peer by IP', async () => {
        await Peer.create({ _id: '1.2.3.4', version: '2.0.0' });
        const res = await request(app).get(`${BASE}/api/nodes?ip=1.2.3.4`);
        expect(res.status).toBe(200);
        expect(res.body._id).toBe('1.2.3.4');
        expect(res.body.version).toBe('2.0.0');
    });

    it('returns empty object for unknown IP', async () => {
        const res = await request(app).get(`${BASE}/api/nodes?ip=9.9.9.9`);
        expect(res.status).toBe(200);
        expect(res.body).toEqual({});
    });

    it('filters peers by service flag', async () => {
        await State.create({ _id: '1.2.3.4', apiSSL: true, rank: 10 });
        await State.create({ _id: '5.6.7.8', apiSSL: false, rank: 5 });

        const res = await request(app).get(`${BASE}/api/nodes?services=apiSSL`);
        expect(res.status).toBe(200);
        expect(res.body.length).toBe(1);
        expect(res.body[0]._id).toBe('1.2.3.4');
    });

    it('includes peerState and geoip when present', async () => {
        await Peer.create({ _id: '1.2.3.4', version: '1.0.0' });
        await State.create({ _id: '1.2.3.4', rank: 42, availableProcessors: 4 });
        await GeoIP.create({ _id: '1.2.3.4', country_code: 'DE', country_name: 'Germany' });

        const res = await request(app).get(`${BASE}/api/nodes?ip=1.2.3.4`);
        expect(res.status).toBe(200);
        expect(res.body.peerState).toBeDefined();
        expect(res.body.peerState.rank).toBe(42);
        expect(res.body.geoip).toBeDefined();
        expect(res.body.geoip.country_code).toBe('DE');
    });
});

describe('GET /api/history', () => {
    it('returns 400 when no ip is provided', async () => {
        const res = await request(app).get(`${BASE}/api/history`);
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    it('returns empty array when no perf records exist for ip', async () => {
        const res = await request(app).get(`${BASE}/api/history?ip=1.2.3.4`);
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    it('returns perf history for a known ip', async () => {
        const now = new Date();
        await Perf.create({ ip: '1.2.3.4', timestamp: now, numberOfActivePeers: 10, SystemLoadAverage: 0.5, freeMemory: 1024 });
        await Perf.create({ ip: '1.2.3.4', timestamp: new Date(now - 1000), numberOfActivePeers: 8, SystemLoadAverage: 0.3, freeMemory: 2048 });

        const res = await request(app).get(`${BASE}/api/history?ip=1.2.3.4`);
        expect(res.status).toBe(200);
        expect(res.body.length).toBe(2);
        expect(res.body[0].ip).toBe('1.2.3.4');
    });

    it('respects the results limit', async () => {
        for (let i = 0; i < 5; i++) {
            await Perf.create({ ip: '1.2.3.4', timestamp: new Date(Date.now() - i * 1000), numberOfActivePeers: i });
        }
        const res = await request(app).get(`${BASE}/api/history?ip=1.2.3.4&results=3`);
        expect(res.status).toBe(200);
        expect(res.body.length).toBe(3);
    });
});

describe('GET /api/getStats', () => {
    it('returns empty object when no stats exist', async () => {
        const res = await request(app).get(`${BASE}/api/getStats`);
        expect(res.status).toBe(200);
        expect(res.body).toEqual({});
    });

    it('returns stats when they exist', async () => {
        await Stats.create({
            _id: 'nodeStats',
            totalNodes: 5,
            activeNodes: 3,
            apiSSL: 2,
            version: '1.0.0'
        });

        const res = await request(app).get(`${BASE}/api/getStats`);
        expect(res.status).toBe(200);
        expect(res.body.totalNodes).toBe(5);
        expect(res.body.activeNodes).toBe(3);
        expect(res.body.apiSSL).toBe(2);
        expect(res.body.version).toBe('1.0.0');
        expect(res.body._id).toBeUndefined();
    });
});
