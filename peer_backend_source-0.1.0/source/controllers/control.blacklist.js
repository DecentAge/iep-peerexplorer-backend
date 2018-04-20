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

var Blacklist = require('../models/model.blacklist');
var Peer = require('../models/model.peer');
var State = require('../models/model.state');

var removePeer = function(ip, cb){
    console.log(ip);
    State.findOne({_id:ip}, function(err, state){
        if(err)
            return cb(err);
        if(state){
            state.remove(function(err){
                if(err)
                    return cb(err);
                Peer.findOne({_id:ip}, function(err, peer){
                    if(err)
                        return cb(err);
                    if(peer){
                        peer.remove(function(err){
                            if(err)
                                return cb(err);
                            return cb(null, true)
                        })
                    }else{
                        return cb(null, true);
                    }
                });
            })
        }else{
            Peer.findOne({_id:ip}, function(err, peer){
                if(err)
                    return cb(err);
                if(peer){
                    peer.remove(function(err){
                        if(err)
                            return cb(err);
                        return cb(null, true)
                    })
                }else{
                    return cb(null, true);
                }
            });
        }
    })
};

exports.blacklist = function (ip, type, cb) {

    ip = ip.trim();

    Blacklist.findOne({_id:ip}, function(err, obj){

        if(err)
            return cb(err);

        if(!obj){

            var item = new Blacklist({_id:ip, type:type, blacklisted:true});
            item.save();

            if(type=='node'){
                removePeer(ip, function(err, ok){
                    if(err)
                        console.log(err);
                    return cb(null, 'IP address '+ip+' has been blacklisted.')
                })
            }else{
                return cb(null, 'IP address '+ip+' has been blacklisted.')
            }

        }else{

            if(obj.blacklisted)
                return cb(null, obj.type+' with IP address '+ip+' has already been blacklisted.');

            if(!obj.blacklisted)
                obj.blacklisted = true;

            if(type=='node'){
                removePeer(ip, function(err, ok){
                    if(err)
                        console.log(err);
                })
            }

            obj.save(function(){
                return cb(null, obj.type+' with IP address '+ip+' has been blacklisted.')
            });
        }

    });

};

exports.whitelist = function(ip, cb){

    Blacklist.findOne({_id:ip}, function(err, obj){

        if(err)
            return cb(err);

        if(!obj){
            return cb(null, 'IP address '+ip+' has not been blacklisted before.');
        }else{
            if(obj.blacklisted == true)
                obj.blacklisted = false;
            obj.save();
            return cb(null, 'IP address '+ip+' has been whitelisted.')
        }

    });

};

//Returns false if IP address is not blacklisted
exports.checkUser = function(ip, cb){

    Blacklist.findOne({_id:ip, type:'user'}, function(err, obj){

        if(obj){
            if(obj.blacklisted)
                return cb(true);
            return cb(false);
        }else{
            return cb(false);
        }

    });

};

exports.checkNode = function(ip, cb){

    Blacklist.findOne({_id:ip, type:'node'}, function(err, obj){

        if(obj){
            if(obj.blacklisted)
                return cb(true);
            return cb(false);
        }else{
            return cb(false);
        }

    });

};
