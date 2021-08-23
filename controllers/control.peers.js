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

const request = require('request');
const axios = require('axios');
const moment = require('moment');
const async = require('async');
const _ = require('underscore');

const config = require('../core/config.js');

const geoipServiceEndpoint = "http://ip-api.com/json/${ip}";
//const geoipServiceApiKey = "36146f7aee7b529306116797068bff18";

var Peer = require('../models/model.peer.js');
var State = require('../models/model.state.js');
var Perf = require('../models/model.perf.js');
var Stats = require('../models/model.stats.js');
var GeoIP = require('../models/model.geoip.js');

const axiosInstance = axios.create({
    timeout: 5000
});

function getGeoipUrl(ip){
    var url = geoipServiceEndpoint;
    url = url.replace("${ip}", ip);
    //url = url.replace("${apiKey}", geoipServiceApiKey);
    return url;
}

function deactivate(ip,cb){
	console.log("Deactivating " + ip);
    Peer.findOneAndUpdate({_id:ip}, {active:false, lastFetched:moment().toDate()}, function(err,res){
        if(err){
            console.log("Could not deactivate " + ip, err);
            cb(err,null);
        }else{
            remove(ip,function(err,res){
            });
            cb(null,res);
        }
    });
}

function remove(ip,cb){
	console.log("Removing " + ip);
    State.remove({_id:ip}, function(err,res){
        if(err){
            console.log("Could not remove " + ip, err);
            cb(err,null);
        }else{
        	console.log("Removed " + ip);
            cb(null,res);
        }
    });
}

function calculateRank(data){

  var factor = config.rankFactor;

  var counter = 0;

  var numberOfActivePeers = parseInt(data.numberOfActivePeers*factor);
  counter += (numberOfActivePeers * 1);

  var availableProcessors = parseInt(data.availableProcessors*factor);
  counter += availableProcessors;

  var pTotalMemory = (data.freeMemory * 100 / data.totalMemory )*factor;
  var pMaxMemory   = (data.freeMemory * 100 / data.maxMemory )*factor;
  var usedMemory   = (data.totalMemory - data.freeMemory  )*factor;

	if (data.isDownloading) {counter = 0;};
	if (!data.apiServerCORS) {counter = 0;};
	if (!data.apiServerEnable) {counter = 0;};
	if (!data.correctInvalidFees) {counter = 0;};
  if ( data.SystemLoadAverage < 0 ) { data.SystemLoadAverage = 0.1 };
	if (counter < 0) {counter = 0;};

	counter = counter + ( pTotalMemory / 10 );
	counter = counter - ( data.SystemLoadAverage / availableProcessors );

	return counter;

}

function updateHistory(history, val){

    if(history.unshift(val)>60){
        history.pop();
    }
    return history;
}

exports.getPeer = async function(ip, port, peer){

    const p = port ? port : config.nodeApiPort;
    const url = 'http://' + ip + ':' + p + '/api?requestType=getPeer&peer=' + peer;

    console.log('getPeer:  ' + url );

    var json = null;
    try {
        const {data} = await axiosInstance.get(url);
        json = data;
    } catch(err) {
        console.error("Could not get peer from " + url, err);
    }

    return json;
};

exports.getPeers = async function(ip, port){
    const p = port ? port : config.nodeApiPort;
    const url = 'http://' + ip + ':' + p + '/api?requestType=getPeers&state=CONNECTED';

    console.log('getPeers:  ' + url );

    let json = null;
    try {
        const {data} = await axiosInstance.get(url);
        json = data;
    } catch(err) {
        console.error("Could not get peers from " + url, err);
    }

    if (json && json.peers) {
        return json.peers;
    }

    return null;
};

exports.getPeerState = async function(ip, port){
    const p = port ? port : config.nodeApiPort;
    const url = 'http://' + ip + ':' + p + '/api?requestType=getPeerState';

    console.log('getPeerState:  ' + url );

    let json = null;
    try {
        const {data} = await axiosInstance.get(url);
        json = data;
    } catch(err) {
        console.error("Could not get peerState from " + url, err);
    }

    return json;
};

exports.getGeoIP = async function(ip){
    const geoip = await GeoIP.findOne({_id: ip});

    if (geoip === null) {
        let geodata = null;
        try {
            const {data} = await axiosInstance.get(getGeoipUrl(ip));
            geodata = data;
        } catch (err) {
            console.error("Could not get geoIP data for " + ip, err);
        }

        if (geodata) {
            if (geodata.status !== 'success') {
                console.log('Could not get geoip data for ' + ip + ', Service returned failed status, response: ', geodata.message);
            } else {
                return geodata;
            }
        }
    }

    return null;
};

exports.crawl = async function() {
    console.log("Entering crawl");

    let i = 0;
    const processedPeers = [];

    // iterate through all peers in db
    for await (const peer of Peer.find({})) {
        await module.exports.crawlPeer(peer._id, peer.apiPort, processedPeers);
        i++;
    }

    // if no peers in db, use default host and port (master node / seed)
    if (i === 0) {
        await module.exports.crawlPeer(config.nodeApiHost, config.nodeApiPort, processedPeers);
    }

    console.log('---- Crawled ' + processedPeers.length + ' IPs ----');
    console.log("Exiting crawl");
    return Promise.resolve();
};

exports.crawlPeer = async function(ip, port, processedPeers) {
    console.log("Entering crawlPeer, " + ip + ":" + port);

    if (processedPeers.includes(ip)) {
        console.log("Peer with IP " + ip + " already processed, skipping");
    } else {
        console.log("Crawling IP " + ip);

        const peers = await module.exports.getPeers(ip);

        // mark this ip as already processed to avoid duplicate processing
        processedPeers.push(ip);

        if (peers) {
            for await (const peer of peers) {
                const peerData = await module.exports.getPeer(ip, port, peer);

                if (peerData && !peerData.errorCode) {
                    const {
                        address,
                        announcedAddress,
                        apiPort,
                        application,
                        blacklisted,
                        downloadedVolume,
                        inbound,
                        inboundWebSocket,
                        lastConnectionAttempt,
                        lastUpdated,
                        outboundWebSocket,
                        platform,
                        port,
                        requestProcessingTime,
                        services,
                        shareAddress,
                        state,
                        uploadedVolume,
                        version,
                        weight,
                        hallmark
                    } = peerData;

                    // if peer is connected
                    if (state === 1) {
                        // only add non-blacklisted peers, delete if an existing peer gets blacklisted
                        if (!blacklisted) {
                            // delete fields that should not be saved and update last connect time
                            delete peerData.address;
                            delete peerData.blacklisted;
                            peerData.active = true;
                            peerData.lastConnected = new Date();

                            await Peer.updateOne({_id: address}, peerData, {upsert: true, new: true});

                            console.log("Peer successfully saved, " + address);
                        } else {
                            await Peer.deleteOne({_id: address});

                            console.log("Peer now blacklisted, deleted " + address);
                        }
                    } else {
                        // delete fields that should not be saved and set to inactive because not connected state
                        delete peerData.address;
                        delete peerData.blacklisted;
                        peerData.active = false;

                        await Peer.updateOne({_id: address}, peerData, {upsert: true, new: true});

                        console.log("Peer successfully saved, " + address);
                    }

                    // recursively crawl this peer
                    await module.exports.crawlPeer(address, apiPort, processedPeers);
                }
            }
        }
    }
};



exports.processPeers = async function() {
    console.log("Entering processPeers");

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

    console.log('---- Processed ' + i + ' peers ----');
    console.log("Exiting processPeers");
};

exports.createUpdatePeerState = async function(ip, peerStateData) {
    console.log("Entering createUpdatePeerState");

    peerStateData.rank = calculateRank(peerStateData);
    peerStateData.lastUpdated = moment().toDate();

    try {
        if (peerStateData.availableProcessors) {

            peerStateData.active = true;

            const doc = await State.findOne({_id: ip});

            if (doc) {
                peerStateData.history_freeMemory = updateHistory(doc.history_freeMemory, peerStateData.freeMemory);

                peerStateData.history_SystemLoadAverage = updateHistory(doc.history_SystemLoadAverage, peerStateData.SystemLoadAverage);

                peerStateData.history_numberOfActivePeers = updateHistory(doc.history_numberOfActivePeers, peerStateData.numberOfActivePeers);

                peerStateData.history_requestProcessingTime = updateHistory(doc.history_requestProcessingTime, peerStateData.requestProcessingTime);
            }

            await State.updateOne({_id: ip}, peerStateData, {upsert: true, new: true});
        }
    } catch (error) {
        console.error("Could not create or update peerState for " + ip, error);
    }

    console.log("Exiting createUpdatePeerState");
};

exports.createPerfLog = async function(ip, peerStateData) {
    console.log("Entering createUpdatePeerState");
    try {
        if (peerStateData.availableProcessors) {
            const perf = new Perf({
                ip: ip,
                timestamp: moment().toDate(),
                numberOfActivePeers: peerStateData.numberOfActivePeers,
                SystemLoadAverage: peerStateData.SystemLoadAverage,
                freeMemory: peerStateData.freeMemory
            });

            perf.save();
        }
    } catch (error) {
        console.error("Could not create perf for " + ip, error);
    }

    console.log("Exiting createUpdatePeerState");
};

exports.createGeoIP = async function(ip, geodata) {
    console.log("Entering createGeoIP");

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

        geoip.save();
    } catch (error) {
        console.error("Could not create geoIP for " + ip, error);
    }

    console.log("Exiting createGeoIP");
};

exports.buildStats = async function(){
    console.log("Entering buildStats");

    const peers = await Peer.find({});

    const result = await State.aggregate([
            {
                $project: {
                    activeNodes: {$cond:["$activeNodes",1,0]},
                    apiSSL: {$cond:["$apiSSL",1,0]},
                    apiCors: {$cond:["$apiServerCORS",1,0]},
                    apiEnabled: {$cond:["$apiServerEnable",1,0]},
                    withAutoFee: {$cond:["$correctInvalidFees",1,0]},
                    hallmarked: {$cond:["$enableHallmarkProtection",1,0]},
                    downloading: {$cond:["$isDownloading",1,0]},
                    scanning: {$cond:["$isScanning",1,0]},
                    useWebsocket: {$cond:["$useWebsocket",1,0]},
                    gatewayIPFS: {$cond:["$gatewayIPFS",1,0]},
                    gatewayTendermint: {$cond:["$gatewayTendermint",1,0]},
                    gatewayZeroNet: {$cond:["$gatewayZeroNet",1,0]},
                    proxyBTC: {$cond:["$proxyBTC",1,0]},
                    proxyETH: {$cond:["$proxyETH",1,0]},
                    proxyLTC: {$cond:["$proxyLTC",1,0]},
                    proxyMarket: {$cond:["$proxyMarket",1,0]},
                    proxyXRP: {$cond:["$proxyXRP",1,0]},
                    storageElastic: {$cond:["$storageElastic",1,0]},
                    storageMongodb: {$cond:["$storageMongodb",1,0]},
                    storageMySQL: {$cond:["$storageMySQL",1,0]},
                    storagePSQL: {$cond:["$storagePSQL",1,0]},
                    storageRethink: {$cond:["$storageRethink",1,0]}
                }
            },
            {
                $group: {
                    _id: "nodeStats",
                    activeNodes: {$sum: 1},
                    apiSSL: {$sum: "$apiSSL"},
                    apiCors: {$sum: "$apiCors"},
                    apiEnabled: {$sum: "$apiEnabled"},
                    withAutoFee: {$sum: "$withAutoFee"},
                    hallmarked: {$sum: "$hallmarked"},
                    downloading: {$sum: "$downloading"},
                    scanning: {$sum: "$scanning"},
                    useWebsocket: {$sum: "$useWebsocket"},
                    gatewayIPFS: {$sum: "$gatewayIPFS"},
                    gatewayTendermint: {$sum: "$gatewayTendermint"},
                    gatewayZeroNet: {$sum: "$gatewayZeroNet"},
                    proxyBTC: {$sum: "$proxyBTC"},
                    proxyETH: {$sum: "$proxyETH"},
                    proxyLTC: {$sum: "$proxyLTC"},
                    proxyMarket: {$sum: "$proxyMarket"},
                    proxyXRP: {$sum: "$proxyXRP"},
                    storageElastic: {$sum: "$storageElastic"},
                    storageMongodb: {$sum: "$storageMongodb"},
                    storageMySQL: {$sum: "$storageMySQL"},
                    storagePSQL: {$sum: "$storagePSQL"},
                    storageRethink: {$sum:"$storageRethink"}
                }
            }
        ]);

        if(result.length) {

            var data = result[0];

            // get the most common version
            const versionMap = {};
            let mostUsedVersion = "";
            let mostUsedVersionCount = 0;

            for (peer of peers) {
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

            await Stats.findOneAndUpdate({_id: 'nodeStats'}, data, {upsert: true});

            console.log("Stats successfully updated!");
        } else {
            console.log('No peers in db. No stats compiled.');
        }
    console.log("Exiting buildStats");
};

exports.cleanInactivePeers = async function(){
    console.log("Entering cleanInactivePeers");

    let peersProcessed = 0;
    let inactivePeersProcessed = 0;
    let peersDeleted = 0;

    for await (const peer of Peer.find({})) {
        if (!peer.active) {
            const lastConnected = peer.lastConnected;

            if (new Date().getTime() - lastConnected.getTime() > (config.removeInactiveAfterMinutes * 60 * 1000)) {
                await Peer.deleteOne({_id: peer._id});

                console.log("Peer has last been connected on " + lastConnected + ", deleted " + peer._id);
                peersDeleted++;
            }
            inactivePeersProcessed++;
        }
        peersProcessed++;
    }

    console.log('---- Processed ' + peersProcessed + ' peers (' + inactivePeersProcessed + ' inactive), deleted: ' + peersDeleted + ' ----');
    console.log("Exiting cleanInactivePeers");
};
