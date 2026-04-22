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

const service = require('../controllers/control.services.js');
var pjson = require('../package.json');

module.exports = function (router) {

    router.route('/api/version')
        .get(function (req, res) {
            res.send(pjson.version);
        });

    router.route('/api/nodes')
        .get(async function (req, res) {
            try {
                let page = req.query.page ? Number(req.query.page) - 1 : 0;
                let results = req.query.results ? Number(req.query.results) : 10;
                let filter = req.query.filter || 'rank';
                let order = req.query.order || 'desc';
                let services = req.query.services ? req.query.services.split(',') : [];
                let ip = req.query.ip;

                const params = { page, results, filter, order };

                let data;
                if (services.length) {
                    data = await service.findByService(services, params);
                } else if (ip) {
                    data = await service.findByIP(ip);
                } else {
                    data = await service.getpaged(params);
                }
                res.send(data);
            } catch (err) {
                console.error(err);
                res.status(500).send({ code: 500, success: false, message: 'An error has occurred.' });
            }
        });

    router.route('/api/history')
        .get(async function (req, res) {
            const ip = req.query.ip;
            if (!ip) {
                return res.status(400).send({ code: 400, success: false, message: 'Please provide IP address for which to return performance history.' });
            }

            try {
                const results = req.query.results ? Number(req.query.results) : 10;
                const data = await service.getPerfLog({ ip, results });
                res.send(data);
            } catch (err) {
                console.error(err);
                res.status(500).send({ code: 500, success: false, message: 'An error has occurred.' });
            }
        });

    router.route('/api/getStats')
        .get(async function (req, res) {
            try {
                const stats = await service.getStats();
                res.send(stats);
            } catch (err) {
                console.error(err);
                res.status(500).send({ code: 500, success: false, message: 'An error has occurred.' });
            }
        });
};
