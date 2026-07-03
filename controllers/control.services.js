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

exports.getnodes = async function () {
    return State.find({}).sort({ rank: -1 });
};

exports.getpaged = async function (params) {
    const result = await Peer.aggregate([
        {
            $lookup: {
                from: State.collection.name,
                localField: '_id',
                foreignField: '_id',
                as: 'peerState'
            }
        },
        {
            $unwind: {
                path: "$peerState",
                preserveNullAndEmptyArrays: true
            }
        },
        { $sort: { 'peerState.rank': -1 } },
        { $skip: params.page * params.results },
        { $limit: params.results }
    ]);

    const list = [];
    for (const peer of result) {
        const peerState = await State.findOne({ _id: peer._id });
        const geoip = await GeoIP.findOne({ _id: peer._id });
        list.push({ ...peer, peerState, geoip });
    }
    return list;
};

exports.findByIP = async function (ip) {
    const doc = await Peer.findOne({ _id: ip });
    if (!doc) return {};

    const peerState = await State.findOne({ _id: doc._id });
    const geoip = await GeoIP.findOne({ _id: doc._id });
    return { ...doc.toJSON(), peerState, geoip };
};

exports.findByService = async function (services, params) {
    const q = {};
    const sort = {};
    sort[params.filter] = params.order === 'desc' ? -1 : 1;

    [].concat(services).forEach(function (service) {
        q[service] = true;
    });

    return State.find(q, "_id rank").sort(sort);
};

exports.getPerfLog = async function (data) {
    return Perf.find({ ip: data.ip }).sort({ timestamp: -1 }).limit(data.results);
};

exports.getStats = async function () {
    const doc = await Stats.findOne({ _id: 'nodeStats' });
    if (!doc) return {};
    const obj = doc.toObject();
    delete obj._id;
    return obj;
};
