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

var State = require('../models/model.state.js');
var Peer = require('../models/model.peer.js');
var GeoIP = require('../models/model.geoip.js');
var Perf = require('../models/model.perf.js');
var Stats = require('../models/model.stats.js');

exports.getnodes = function(cb){

    State.find({}).sort({rank: -1}).exec(function(err, docs){
        if(err){
            console.log(err);
            cb(err,null);
        }else{
            cb(null,docs);
        }
    })

};

exports.getpaged = function(params, cb){

    var sort = {};
    sort[params.filter]=1;
    if(params.order=='desc')
        sort[params.filter]=-1;

    Peer.find({})
        .skip(params.page*params.results)
        .limit(params.results)
        .sort({rank: -1})
        .exec(async function(err, docs){
            if(err){
                //console.log(docs.length);
                cb(err,null);
            }else{
                const list = [];

                for (doc of docs) {
                    const peerState = await State.findOne({_id: doc._id});
                    const geoip = await GeoIP.findOne({_id: doc._id});

                    list.push({
                        ...doc.toJSON(),
                        peerState,
                        geoip
                    });
                }

                cb(null,list);
            }
        })
};

exports.findByIP = function(ip, params, cb){
    Peer.findOne({_id:ip}, async function(err, doc){
        if(err){
            console.log(err);
            cb(err,null);
        }else{
            if(!doc)
                cb(null,{});
            else {
                const peerState = await State.findOne({_id: doc._id});
                const geoip = await GeoIP.findOne({_id: doc._id});

                cb(null, {
                    ...doc.toJSON(),
                    peerState,
                    geoip
                });
            }
        }
    })
};

exports.findByService = function(services, params, cb){

    var q = {};

    var sort = {};
    sort[params.filter]=1;
    if(params.order=='desc')
        sort[params.filter]=-1;

    services = [].concat(services);

    services.map(function(service){
        q[service] = true;
    });

    State.find(q, "_id rank").sort(sort).exec(function(err, results){
        if(err){
            console.log(err);
            cb(err,null);
        }else{
            cb(null,results);
        }
    })

};

exports.getPerfLog = function(data, cb){
    Perf.find({ip:data.ip}).sort({timestamp:-1}).limit(data.results).exec(function(err, doc){
        if(err){
            console.log(err);
            cb(err,null);
        }else{
            cb(null,doc);
        }
    });
};

exports.getStats = function(cb){

    Stats.findOne({_id:'nodeStats'}, async function(err, doc){
        if(err){
            cb(err,null)
        }else{
            if(!doc) {
                cb(null, {});
            }else{
                delete doc._id;
                cb(null,doc);
            }
        }

    });

};
