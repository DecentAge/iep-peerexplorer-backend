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

var GeoIP = new Schema({
    _id:String,
    country_code:{type:String,default:'N/A'},
    country_name:{type:String,default:'N/A'},
    region_code:{type:String,default:'N/A'},
    region_name:{type:String,default:'N/A'},
    city:{type:String,default:'N/A'},
    zip_code:{type:String,default:'N/A'},
    time_zone:{type:String,default:'N/A'},
    latitude:{type:Number,default:null},
    longitude:{type:Number,default:null},
    metro_code:{type:Number,default:null}
});

module.exports = mongoose.model('GeoIP', GeoIP);
