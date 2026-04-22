/******************************************************************************
 * Copyright © 2017 XIN Community                                             *
 *                                                                            *
 * See the DEVELOPER-AGREEMENT.txt and LICENSE.txt files at  the top-level    *
 * directory of this distribution for the individual copyright  holder        *
 * information and the developer policies on copyright and licensing.         *
 *                                                                            *
 * Unless otherwise agreed in a custom licensing agreement, no part of the    *
 * XIN software, including this file, may be copied, modified, propagated,    *
 * or distributed except according to the terms contained in the LICENSE.txt  *
 * file.                                                                      *
 *                                                                            *
 * Removal or modification of this copyright notice is prohibited.            *
 *                                                                            *
 ******************************************************************************/

const axios = require('axios');

const { createLogger, transports, format } = require("winston");
const { combine, timestamp, errors, colorize } = format;

const config = require('../core/config.js');

const geoipServiceEndpoint = "http://ip-api.com/json/${ip}";

var Peer = require('../models/model.peer.js');
var State = require('../models/model.state.js');
var Perf = require('../models/model.perf.js');
var Stats = require('../models/model.stats.js');
var GeoIP = require('../models/model.geoip.js');

const axiosInstance = axios.create({
    timeout: 5000
});

const logMultiParams = {
    transform(info) {
        const { timestamp, message, stack } = info;
        const level = info[Symbol.for('level')];
        const args = info[Symbol.for('splat')];
        let spaces = "";
        if (level === "info" || level === "warn") spaces = " ";
        info[Symbol.for('message')] = `${timestamp} [${level}] ${spaces}| ${message} ${args ? args : ''} ${stack ? '\n' + stack : ''}`;
        return info;
    }
};

const logger = createLogger({
    transports: [new transports.Console()],
    level: config.logLevel,
    format: combine(timestamp(), errors({ stack: true }), colorize(), logMultiParams)
});

function getGeoipUrl(ip) {
    return geoipServiceEndpoint.replace("${ip}", ip);
}

async function deactivate(ip) {
    logger.info("Deactivating " + ip);
    try {
        await Peer.findOneAndUpdate({ _id: ip }, { active: false, lastFetched: new Date() });
        await State.deleteOne({ _id: ip });
        logger.info("Removed state for " + ip);
    } catch (err) {
        logger.error("Could not deactivate " + ip, err);
    }
}

function calculateRank(data) {
    if (data.isDownloading || !data.apiServerCORS || !data.apiServerEnable || !data.correctInvalidFees) {
        return 0;
    }

    const factor = config.rankFactor;
    let counter = 0;

    const numberOfActivePeers = parseInt(data.numberOfActivePeers * factor);
    counter += (numberOfActivePeers * 1);

    const availableProcessors = parseInt(data.availableProcessors * factor);
    counter += availableProcessors;

    const pTotalMemory = (data.freeMemory * 100 / data.totalMemory) * factor;

    if (data.SystemLoadAverage < 0) { data.SystemLoadAverage = 0.1; }
    if (counter < 0) { counter = 0; }

    counter = counter + (pTotalMemory / 10);
    counter = counter - (data.SystemLoadAverage / availableProcessors);

    return counter;
}

function updateHistory(history, val) {
    if (history.unshift(val) > 60) {
        history.pop();
    }
    return history;
}

exports.getPeer = async function (ip, port, peer) {
    const p = port ? port : config.nodeApiPort;
    const url = 'http://' + ip + ':' + p + '/api?requestType=getPeer&peer=' + peer;

    logger.debug('getPeer:  ' + url);

    let json = null;
    try {
        const { data } = await axiosInstance.get(url);
        json = data;
    } catch (err) {
        logger.debug("Could not get peer from " + url, err);
    }

    return json;
};

exports.getPeers = async function (ip, port) {
    const p = port ? port : config.nodeApiPort;
    const url = 'http://' + ip + ':' + p + '/api?requestType=getPeers&state=CONNECTED';

    logger.debug('getPeers:  ' + url);

    let json = null;
    try {
        const { data } = await axiosInstance.get(url);
        json = data;
    } catch (err) {
        logger.debug("Could not get peers from " + url, err);
    }

    if (json && json.peers) {
        return json.peers;
    }

    return null;
};

exports.getPeerState = async function (ip, port) {
    const p = port ? port : config.nodeApiPort;
    const url = 'http://' + ip + ':' + p + '/api?requestType=getPeerState';

    logger.debug('getPeerState:  ' + url);

    let json = null;
    try {
        const { data } = await axiosInstance.get(url);
        json = data;
    } catch (err) {
        logger.debug("Could not get peerState from " + url, err);
    }

    return json;
};

exports.getGeoIP = async function (ip) {
    const geoip = await GeoIP.findOne({ _id: ip });

    if (geoip === null) {
        let geodata = null;
        try {
            const { data } = await axiosInstance.get(getGeoipUrl(ip));
            geodata = data;
        } catch (err) {
            logger.debug("Could not get geoIP data for " + ip, err);
        }

        if (geodata) {
            if (geodata.status !== 'success') {
                logger.warn('Could not get geoip data for ' + ip + ', Service returned failed status, response: ', geodata.message);
            } else {
                return geodata;
            }
        }
    }

    return null;
};

exports.crawl = async function () {
    logger.debug("Entering crawl");

    let i = 0;
    const processedPeers = [];

    for await (const peer of Peer.find({})) {
        await module.exports.crawlPeer(peer._id, peer.apiPort, processedPeers);
        i++;
    }

    if (i === 0) {
        await module.exports.crawlPeer(config.nodeApiHost, config.nodeApiPort, processedPeers);
    }

    logger.info('Crawled ' + processedPeers.length + ' IPs');
    logger.debug("Exiting crawl");
};

exports.crawlPeer = async function (ip, port, processedPeers) {
    logger.debug("Entering crawlPeer, " + ip + ":" + port);

    if (processedPeers.includes(ip)) {
        logger.debug("Peer with IP " + ip + " already processed, skipping");
        return;
    }

    logger.debug("Crawling IP " + ip);

    const peers = await module.exports.getPeers(ip, port);
    processedPeers.push(ip);

    if (peers) {
        for (const peer of peers) {
            const peerData = await module.exports.getPeer(ip, port, peer);

            if (peerData && !peerData.errorCode) {
                const { address, blacklisted, apiPort } = peerData;

                if (!blacklisted) {
                    delete peerData.address;
                    delete peerData.blacklisted;

                    const existing = await Peer.findOne({ _id: address });
                    if (!existing || !existing.lastConnected) {
                        peerData.lastConnected = new Date();
                    }

                    await Peer.updateOne({ _id: address }, peerData, { upsert: true, new: true });
                    logger.debug("Peer successfully saved, " + address);
                } else {
                    await Peer.deleteOne({ _id: address });
                    logger.info("Peer now blacklisted, deleted " + address);
                }

                await module.exports.crawlPeer(address, apiPort, processedPeers);
            }
        }
    }
};

exports.processPeers = async function () {
    logger.debug("Entering processPeers");

    let i = 0;

    for await (const peer of Peer.find({})) {
        const ip = peer._id;
        const port = peer.apiPort;

        const peerStateData = await module.exports.getPeerState(ip, port);
        const geoIPData = await module.exports.getGeoIP(ip);

        if (peerStateData) {
            await module.exports.createUpdatePeerState(ip, peerStateData);
            await module.exports.createPerfLog(ip, peerStateData);
        }

        if (geoIPData) {
            await module.exports.createGeoIP(ip, geoIPData);
        }

        i++;
    }

    logger.info('Processed ' + i + ' peers');
    logger.debug("Exiting processPeers");
};

exports.createUpdatePeerState = async function (ip, peerStateData) {
    logger.debug("Entering createUpdatePeerState");

    peerStateData.rank = calculateRank(peerStateData);
    peerStateData.lastUpdated = new Date();

    try {
        if (peerStateData.availableProcessors) {
            peerStateData.active = true;

            const doc = await State.findOne({ _id: ip });

            if (doc) {
                peerStateData.history_freeMemory = updateHistory(doc.history_freeMemory, peerStateData.freeMemory);
                peerStateData.history_SystemLoadAverage = updateHistory(doc.history_SystemLoadAverage, peerStateData.SystemLoadAverage);
                peerStateData.history_numberOfActivePeers = updateHistory(doc.history_numberOfActivePeers, peerStateData.numberOfActivePeers);
                peerStateData.history_requestProcessingTime = updateHistory(doc.history_requestProcessingTime, peerStateData.requestProcessingTime);
            }

            await State.updateOne({ _id: ip }, peerStateData, { upsert: true, new: true });
        }
    } catch (error) {
        logger.error("Could not create or update peerState for " + ip, error);
    }

    logger.debug("Exiting createUpdatePeerState");
};

exports.createPerfLog = async function (ip, peerStateData) {
    logger.debug("Entering createPerfLog");
    try {
        if (peerStateData.availableProcessors) {
            const perf = new Perf({
                ip: ip,
                timestamp: new Date(),
                numberOfActivePeers: peerStateData.numberOfActivePeers,
                SystemLoadAverage: peerStateData.SystemLoadAverage,
                freeMemory: peerStateData.freeMemory
            });
            await perf.save();
        }
    } catch (error) {
        logger.error("Could not create perf for " + ip, error);
    }
    logger.debug("Exiting createPerfLog");
};

exports.createGeoIP = async function (ip, geodata) {
    logger.debug("Entering createGeoIP");

    try {
        const geoip = new GeoIP({
            _id: ip,
            country_code: geodata.countryCode,
            country_name: geodata.country,
            region_code: geodata.region,
            region_name: geodata.regionName,
            city: geodata.city,
            zip_code: geodata.zip,
            time_zone: geodata.timezone,
            latitude: geodata.lat,
            longitude: geodata.lon,
        });
        await geoip.save();
    } catch (error) {
        logger.error("Could not create geoIP for " + ip, error);
    }

    logger.debug("Exiting createGeoIP");
};

exports.buildStats = async function () {
    logger.debug("Entering buildStats");

    const peers = await Peer.find({});

    const result = await State.aggregate([
        {
            $project: {
                activeNodes: { $cond: ["$activeNodes", 1, 0] },
                apiSSL: { $cond: ["$apiSSL", 1, 0] },
                apiCors: { $cond: ["$apiServerCORS", 1, 0] },
                apiEnabled: { $cond: ["$apiServerEnable", 1, 0] },
                withAutoFee: { $cond: ["$correctInvalidFees", 1, 0] },
                hallmarked: { $cond: ["$enableHallmarkProtection", 1, 0] },
                downloading: { $cond: ["$isDownloading", 1, 0] },
                scanning: { $cond: ["$isScanning", 1, 0] },
                useWebsocket: { $cond: ["$useWebsocket", 1, 0] },
                gatewayIPFS: { $cond: ["$gatewayIPFS", 1, 0] },
                gatewayTendermint: { $cond: ["$gatewayTendermint", 1, 0] },
                gatewayZeroNet: { $cond: ["$gatewayZeroNet", 1, 0] },
                proxyBTC: { $cond: ["$proxyBTC", 1, 0] },
                proxyETH: { $cond: ["$proxyETH", 1, 0] },
                proxyLTC: { $cond: ["$proxyLTC", 1, 0] },
                proxyMarket: { $cond: ["$proxyMarket", 1, 0] },
                proxyXRP: { $cond: ["$proxyXRP", 1, 0] },
                storageElastic: { $cond: ["$storageElastic", 1, 0] },
                storageMongodb: { $cond: ["$storageMongodb", 1, 0] },
                storageMySQL: { $cond: ["$storageMySQL", 1, 0] },
                storagePSQL: { $cond: ["$storagePSQL", 1, 0] },
                storageRethink: { $cond: ["$storageRethink", 1, 0] }
            }
        },
        {
            $group: {
                _id: "nodeStats",
                activeNodes: { $sum: 1 },
                apiSSL: { $sum: "$apiSSL" },
                apiCors: { $sum: "$apiCors" },
                apiEnabled: { $sum: "$apiEnabled" },
                withAutoFee: { $sum: "$withAutoFee" },
                hallmarked: { $sum: "$hallmarked" },
                downloading: { $sum: "$downloading" },
                scanning: { $sum: "$scanning" },
                useWebsocket: { $sum: "$useWebsocket" },
                gatewayIPFS: { $sum: "$gatewayIPFS" },
                gatewayTendermint: { $sum: "$gatewayTendermint" },
                gatewayZeroNet: { $sum: "$gatewayZeroNet" },
                proxyBTC: { $sum: "$proxyBTC" },
                proxyETH: { $sum: "$proxyETH" },
                proxyLTC: { $sum: "$proxyLTC" },
                proxyMarket: { $sum: "$proxyMarket" },
                proxyXRP: { $sum: "$proxyXRP" },
                storageElastic: { $sum: "$storageElastic" },
                storageMongodb: { $sum: "$storageMongodb" },
                storageMySQL: { $sum: "$storageMySQL" },
                storagePSQL: { $sum: "$storagePSQL" },
                storageRethink: { $sum: "$storageRethink" }
            }
        }
    ]);

    if (result.length) {
        const data = result[0];

        const versionMap = {};
        let mostUsedVersion = "";
        let mostUsedVersionCount = 0;

        for (const peer of peers) {
            if (versionMap[peer.version]) {
                versionMap[peer.version]++;
            } else {
                versionMap[peer.version] = 1;
            }
        }

        Object.keys(versionMap).forEach((key) => {
            const value = versionMap[key];
            if (value > mostUsedVersionCount) {
                mostUsedVersion = key;
                mostUsedVersionCount = value;
            }
        });

        delete data._id;
        data.totalNodes = peers.length;
        data.version = mostUsedVersion;

        await Stats.findOneAndUpdate({ _id: 'nodeStats' }, data, { upsert: true });

        logger.info("Stats successfully updated!");
    } else {
        logger.info('No peers in db. No stats compiled.');
    }

    logger.debug("Exiting buildStats");
};

exports.healthCheckAndCleanPeers = async function () {
    logger.debug("Entering healthCheckPeers");

    const peers = await Peer.find({});

    let peersProcessed = 0;
    let peersDeactivated = 0;
    let deactivatedPeersProcessed = 0;
    let peersDeleted = 0;

    for (const peerToCheck of peers) {
        let peersIterated = 0;
        let isConnected = false;

        for (const peerToRequest of peers) {
            peersIterated++;

            if (peerToRequest._id === peerToCheck._id) continue;

            const peerData = await module.exports.getPeer(peerToRequest._id, peerToRequest.apiPort, peerToCheck._id);
            const p = peerToRequest.apiPort ? peerToRequest.apiPort : config.nodeApiPort;
            const url = 'http://' + peerToRequest._id + ':' + p + '/api?requestType=getPeer&peer=' + peerToCheck._id;

            if (peerData && peerData.errorCode) {
                if (peerData.errorCode === 5) continue;
                logger.error("Unexpected error from getPeer, request to " + url, peerData);
            } else if (peerData) {
                delete peerData.address;
                delete peerData.blacklisted;

                if (peerData.state === 1) {
                    logger.info("Peer " + peerToCheck._id + " found on iteration " + peersIterated + " (" + peerToRequest._id + "), state CONNECTED - set active=true");
                    peerData.lastConnected = new Date();
                    peerData.active = true;
                    isConnected = true;

                    try {
                        await Peer.updateOne({ _id: peerToCheck._id }, peerData);
                    } catch (e) {
                        logger.error("Could not update peer status", e);
                    }
                    break;
                }
            }
        }

        if (peerToCheck.active) {
            if (!isConnected) {
                logger.info("Peer " + peerToCheck._id + " not connected after all iterations - set active=false");
                peerToCheck.active = false;
                peersDeactivated++;

                try {
                    await Peer.updateOne({ _id: peerToCheck._id }, peerToCheck);
                } catch (e) {
                    logger.error("Could not update peer status", e);
                }
            }
        } else {
            const lastConnected = peerToCheck.lastConnected;

            if (!lastConnected || new Date().getTime() - lastConnected.getTime() > (config.removeInactiveAfterMinutes * 60 * 1000)) {
                await Peer.deleteOne({ _id: peerToCheck._id });
                logger.info("Peer has last been connected on " + lastConnected + ", deleted " + peerToCheck._id);
                peersDeleted++;
            }
            deactivatedPeersProcessed++;
        }

        peersProcessed++;
    }

    logger.info('Processed ' + peersProcessed + ' peers (' + deactivatedPeersProcessed + ' total inactive, ' + peersDeactivated + ' deactivated just now, ' + peersDeleted + ' peers deleted due to inactivity)');
    logger.debug("Exiting healthCheckPeers");
};
