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
const moment = require('moment');
const async = require('async');
const _ = require('underscore');

const config = require('../core/config.js');

const seed = config.seed;

const sta = '/api?requestType=getPeerState';
const suf = '/api?requestType=getPeers';

const pre = 'http://';

const geoipServiceEndpoint = "http://api.ipstack.com/${ip}?access_key=${apiKey}";
const geoipServiceApiKey = "36146f7aee7b529306116797068bff18";

var Peer = require('../models/model.peer.js');
var State = require('../models/model.state.js');
var Perf = require('../models/model.perf.js');
var Stats = require('../models/model.stats.js');
var Blacklist = require('../models/model.blacklist');

function getGeoipUrl(ip){
    var url = geoipServiceEndpoint;
    url = url.replace("${ip}", ip);
    url = url.replace("${apiKey}", geoipServiceApiKey);
    return url;
}

function deactivate(ip,cb){
    Peer.findOneAndUpdate({_id:ip}, {active:false, lastFetched:moment().toDate()}, function(err,res){
        if(err){
            cb(err,null);
        }else{
            remove(ip,function(err,res){
            });
            cb(null,res);
        }
    });
}

function remove(ip,cb){
    State.remove({_id:ip}, function(err,res){
        if(err){
            console.log(err);
            cb(err,null);
        }else{
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

exports.fetch = function(ip,cb){

    var url = pre+ip+suf;

    console.log('Fetching:  ' + url );

    request({url:url, timeout:5000}, function (error, response, body) {
        if(error){
        	console.log("Could not fetch " + url);
            cb(error,null);
        }else{
            var peers = JSON.parse(body).peers;
            cb(null, peers);
        }
    });

};

exports.seed = function(cb){
	request(seed,function(err,res,body){
    	if(err){
    		console.log("Could not fetch bootnodes", err);
            cb(err,null);
        } else {
    	
        	console.log("Get initial list of nodes");

        	var peers = JSON.parse(body);

            //An array of all blacklisted nodes is pulled here to make sure they arent checked
            //Blacklist.find({type:node, blacklisted:true }, function(err, nodes){

			Blacklist.find({ }, function(err, nodes){
                var list = {};

                nodes.map(function(node){
                    list[node._id] = 1;
                });

                async.each(peers, function(ip,cb){
                    if(!list[ip]){
                    	console.log("Saving peer " + ip + " to db");
                        var peer = new Peer({_id:ip});
                        peer.save(function(err){
                        	if(err){
                            	console.log("Could not save peer " + ip + " to db", err);
                            }
                            cb();
                        });
                    }else{
                        console.log(ip+' is blacklisted.');
                        cb();
                    }
                }, function(){
                    cb(null,res);
                });

            });
        }
    })
};

exports.populate = function(ip, cb){
    module.exports.fetch(ip,function(err,res){
        if(err){
            cb(err,null);
        }else{

            Blacklist.find({type:'node', blacklisted:true}, function(err, nodes){

                var list = {};

                nodes.map(function(node){
                    list[node._id] = 1;
                });

                async.each(res, function(ip,cb){
                    if(!list[ip]){
                    	console.log("Saving peer " + ip + " to db");
                        var peer = new Peer({_id:ip});
                        peer.save(function(err){
                        	if(err){
                            	console.log("Could not save peer " + ip + " to db", err);
                            }
                            cb();
                        });
                    }else{
                        console.log(ip+' is blacklisted.');
                        cb();
                    }
                }, function(){
                    cb(null,res);
                });

            });

        }
    })
};

exports.getstate = function(ip,cb){

    var url = pre+ip+sta;
    
    console.log("Requesting " + url);

    request({uri:url,timeout:5000}, function (error, response, body) {
        if(error){
            deactivate(ip, function(err, res){
                if(err) {
                    console.log('error:' + err);
                    cb(err,null);
                }else {
                    cb(error, null);
                }
            });
        }else{
            var data = JSON.parse(body);

            var pData = {
                lastFetched:moment().toDate()
            };

            data.rank = calculateRank(data);
            data.lastUpdated = moment().toDate();

            if(data.availableProcessors){

                pData.active = true;
                data.active = true;

                // console.log('Active');

                var perf = new Perf({
                    ip:ip,
                    timestamp:moment().toDate(),
                    numberOfActivePeers:data.numberOfActivePeers,
                    SystemLoadAverage:data.SystemLoadAverage,
                    freeMemory:data.freeMemory
                });

                perf.save();

                State.findOne({_id:ip}, function(err,doc){

                    if(doc){
                        data.history_freeMemory = updateHistory(doc.history_freeMemory, data.freeMemory);

                        data.history_SystemLoadAverage = updateHistory(doc.history_SystemLoadAverage, data.SystemLoadAverage);

                        data.history_numberOfActivePeers = updateHistory(doc.history_numberOfActivePeers, data.numberOfActivePeers);

                        data.history_requestProcessingTime = updateHistory(doc.history_requestProcessingTime, data.requestProcessingTime);
                    }

                    State.findOneAndUpdate({_id:ip}, data, {upsert:true, new: true}, function(err,res){
                        if(err)
                            console.log(err);
                    });

                });

                Peer.findOneAndUpdate({_id:ip}, pData, {upsert:true, new: true}, function(err,res){
                    if(err){
                        console.log(err);
                        cb(err,null);
                    }else{
                        // console.log(res);
                        cb(null,res);
                    }
                });

            }else{
                //console.log('Inactive');
                deactivate(ip, function(err, res){
                    cb();
                })
            }
        }
    });

};

exports.crawl = function(now, checked, cb){

    Peer.find({}, function(err, docs){

        var filtered = [];

        docs.map(function(x){
            if(!checked[x._id])
                filtered.push(x);
        });

        if(filtered.length>0){

            if(err){
                cb(err,null);
            }else{
                async.eachLimit(filtered, config.concurrent, function(obj, cb){

                    module.exports.getstate(obj._id, function(err, res){

                        checked[obj._id] = 1;

                        if(err){
                            // console.log(err);
                            cb();
                        }else{
                            module.exports.populate(obj._id, function(err, res){
                                cb();
                            });
                        }
                    });

                }, function(){

                    module.exports.crawl(now, checked, function(){
                        cb();
                    });

                });
            }
        }else{
            //console.log('Done');
            cb()
        }
    })
};

exports.clean = function(cb){
    State.find({}, function(err, docs) {
        if (docs.length > 0) {
            if (err) {
                cb(err, null);
            } else {
                async.eachLimit(docs, config.concurrent, function (obj, cb) {

                    var url = pre+obj._id+sta;

                    request({uri:url,timeout:5000}, function (error, response, body) {
                        if(error){
                            deactivate(obj._id, function(err, res){
                                if(err) {
                                    console.log('error:' + err);
                                    cb(err,null);
                                }else {
                                    cb(error, null);
                                }
                            });
                        }else {

                            var data = JSON.parse(body);

                            if(!data.availableProcessors) {
                                deactivate(obj._id, function(err, res){
                                    if(err) {
                                        console.log('error:' + err);
                                        cb(err,null);
                                    }else {
                                        cb(error, null);
                                    }
                                });
                            }

                        }
                    });
                }, function () {
                    State.find({},function(err,docs){
                        console.log(docs.length+' nodes left after cleaning.');
                        cb();
                    });
                });
            }
        } else {
            cb()
        }
    });
};

exports.buildStats = function(cb){

    Peer.find({}, function(err,peers) {
        State.aggregate([
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
        ], function (err, result) {
            if (err) {
                console.log(err);
                cb(err,null);
            } else {

                if(result.length) {

                    var data = result[0];

                    delete data._id;

                    data.totalNodes = peers.length;

                    Stats.findOneAndUpdate({_id: 'nodeStats'}, data, {upsert: true}, function (err, doc) {
                        if (err) {
                            console.log(err);
                            cb(err, null)
                        } else {
                            cb(null, doc);
                        }
                    });

                }else{

                    cb('No peers in db. No stats compiled.');

                }

            }
        });
    });

};

exports.getGeoIP = function(force, cb){

    State.find({}, function(err,nodes){

        if(err){
            console.log(err);
            cb(err,null)
        }else{
            async.eachLimit(nodes,10,function(node,cb){

                if(force || !node.geoipfetched){
                    request({uri:getGeoipUrl(node._id),timeout:5000}, function (error, response, body) {

                        console.log('Getting geoip data for '+node._id, getGeoipUrl(node._id));

                        var geodata = {};
                        
                        try {
	                        if(body)
	                            geodata = JSON.parse(body);
	
	                        var data = {};
	                        data.geoip = geodata;
	                        data.geoipfetched = true;
	
	                        State.findOneAndUpdate({_id:node._id}, data, function(err,res){
	                            if(err)
	                                console.log(err);
	                            cb();
	                        });
                        } catch(err) {
                        	console.log("Could not fetch geoip data for "+node._id, err);
                            cb(err,null)
                        }

                    });
                }else{
                    cb();
                }

            }, function(){
                cb(null, 'Done');
            })
        }

    });

};
