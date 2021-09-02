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

const mongoose = require('mongoose');
const moment = require('moment');
const Schema = mongoose.Schema;
const config = require('../core/config')

var Peer = new Schema({
    _id:String,
    lastConnected:{type:Date, default: () => new Date()},
    active:{type:Boolean, default:true},
    apiPort:{type:Number, default:config.nodeApiPort},
    announcedAddress:{type:String},
    application:{type:String},
    downloadedVolume: {type: Number},
    inbound: {type: Boolean},
    inboundWebSocket: {type: Boolean},
    lastConnectAttempt: {type: Number},
    lastUpdated: {type: Number},
    outboundWebSocket: {type: Boolean},
    platform: {type: String},
    port: {type: Number},
    requestProcessingTime: {type: Number},
    services: {type: Array},
    shareAddress: {type: Boolean},
    state: {type: Number},
    uploadedVolume: {type: Number},
    version: {type: String},
    weight: {type: Number},
    hallmark: {type: String}
});

module.exports = mongoose.model('Peer', Peer);
