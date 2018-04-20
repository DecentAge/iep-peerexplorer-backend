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
const Schema = mongoose.Schema;

var Stats = new Schema({
    _id:String,
    totalNodes:{type:Number, default:0},
    activeNodes:{type:Number, default:0},
    apiSSL:{type:Number, default:0},
    apiCors:{type:Number, default:0},
    apiEnabled:{type:Number, default:0},
    withAutoFee:{type:Number, default:0},
    hallmarked:{type:Number, default:0},
    downloading:{type:Number, default:0},
    scanning:{type:Number, default:0},
    useWebsocket:{type:Number, default:0},
    gatewayIPFS:{type:Number, default:0},
    gatewayTendermint:{type:Number, default:0},
    gatewayZeroNet:{type:Number, default:0},
    proxyBTC:{type:Number, default:0},
    proxyETH:{type:Number, default:0},
    proxyLTC:{type:Number, default:0},
    proxyMarket:{type:Number, default:0},
    proxyXRP:{type:Number, default:0},
    storageElastic:{type:Number, default:0},
    storageMongodb:{type:Number, default:0},
    storageMySQL:{type:Number, default:0},
    storagePSQL:{type:Number, default:0},
    storageRethink:{type:Number, default:0}
});

module.exports = mongoose.model('nodeStats', Stats);
