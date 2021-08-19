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

var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var State = new Schema({
    _id:String,
    lastUpdated:Date,
    active:Boolean,
    correctInvalidFees:{type:Boolean, default:false},
    ledgerTrimKeep:{type:Number,default:30000},
    osArch:{type:String,default:null},
    myPlatform:{type:String,default:null},
    proxyETH:{type:Boolean, default:false},
    maxMemory:{type:Number,default:null},
    storageMongodb:{type:Boolean, default:false},
    apiServerSSLPort:{type:Number,default:9876},
    isDownloading:{type:Boolean, default:false},
    cumulativeDifficulty:{type:String,default:null},
    storageRethink:{type:Boolean, default:false},
    freeMemory:{type:Number,default:null},
    storageElastic:{type:Boolean, default:false},
    availableProcessors:{type:Number,default:null},
    apiServerIdleTimeout:{type:Number,default:30000},
    currentMinRollbackHeight:{type:Number,default:null},
    SystemLoadAverage:{type:Number,default:null},
    useWebsocket:{type:Boolean, default:false},
    requestProcessingTime:{type:Number,default:null},
    version:{type:String,default:null},
    gatewayZeroNet:{type:Boolean, default:false},
    proxyXRP:{type:Boolean, default:false},
    apiServerEnable:{type:Boolean, default:false},
    enableHallmarkProtection:{type:Boolean, default:false},
    apiServerCORS:{type:Boolean, default:false},
    maxPrunableLifetime:{type:Number,default:null},
    numberOfActivePeers:{type:Number,default:null},
    apiServerPort:{type:Number,default:9876},
    lastBlockchainFeeder:{type:String,default:null},
    numberOfPeers:{type:Number,default:null},
    storageMySQL:{type:Boolean, default:false},
    proxyBTC:{type:Boolean, default:false},
    includeExpiredPrunable:{type:Boolean, default:false},
    myAddress:{type:String,default:null},
    proxyLTC:{type:Boolean, default:false},
    myHallmark:{type:String,default:null},
    maxRollback:{type:Number,default:null},
    isScanning:{type:Boolean, default:false},
    osVersion:{type:String,default:null},
    maxUploadFileSize:{type:Number,default:null},
    Uptime:{type:Number,default:null},
    numberOfBlocks:{type:Number,default:null},
    osName:{type:String,default:null},
    gatewayTendermint:{type:Boolean, default:false},
    lastBlock:{type:String,default:null},
    totalMemory:{type:Number,default:null},
    ThreadCount:{type:Number,default:null},
    apiSSL:{type:Boolean, default:false},
    storagePSQL:{type:Boolean, default:false},
    application:{type:String,default:null},
    proxyMarket:{type:Boolean, default:false},
    lastBlockchainFeederHeight:{type:Number,default:null},
    time:{type:Number,default:null},
    maxUnconfirmedTransactions:{type:Number,default:null},
    gatewayIPFS:{type:Boolean, default:false},
    rank:{type:Number,default:null},
    history_numberOfActivePeers:[Number],
    history_SystemLoadAverage:[Number],
    history_freeMemory:[Number],
    history_requestProcessingTime:[Number],

    /*history_numberOfActivePeers:[{
        timestamp:Date,
        value:Number
    }],
    history_SystemLoadAverage:[{
        timestamp:Date,
        value:Number
    }],
    history_freeMemory:[{
        timestamp:Date,
        value:Number
    }]*/

});

State.index({ rank:-1 });

module.exports = mongoose.model('State', State);
