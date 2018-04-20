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

var Perf = new Schema({
    ip:String,
    timestamp:{type:Date, default:moment().toDate()},
    numberOfActivePeers:Number,
    SystemLoadAverage:Number,
    freeMemory:Number
});

Perf.index({ ip: -1 });
Perf.index({ timestamp: -1 });

module.exports = mongoose.model('Perf', Perf);
