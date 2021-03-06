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

module.exports = function(router) {

    router.route('/api/version')
        .get(function (req, res) {
            res.send(pjson.version);
        });

    router.route('/api/nodes')
        .get(function (req, res) {

            var page = req.query.page;
            var results = req.query.results;
            var filter = req.query.filter;
            var order = req.query.order;
            var services = req.query.services;
            var ip = req.query.ip;

            page = page ? Number(page)-1 : 0;

            results = results ? Number(results) : 10;

            filter = filter ? filter : 'rank';

            order = order ? order : 'desc';

            services = services ? services.split(',') : [];

            var params = {page:page, results:results, filter:filter, order:order};

            if(services.length) {

                service.findByService(services, params, function(err,data){
                    if (err) {
                        console.log(err);
                        res.status(500);
                        res.send({code:500, success:false, message:'An error has occurred.'});
                    } else {
                        res.send(data);
                    }
                })

            }else if(ip){

                service.findByIP(ip, params, function(err, data){
                    if(err){
                        console.log(err);
                        res.status(500);
                        res.send({code:500, success:false, message:'An error has occurred.'});
                    }else{
                        res.send(data);
                    }
                });

            }else{

                service.getpaged(params, function (err, data) {
                    if (err) {
                        console.log(err);
                        res.status(500);
                        res.send({code:500, success:false, message:'An error has occurred.'});
                    } else {
                        res.send(data);
                    }
                })

            }

        });

    router.route('/api/history')
        .get(function(req, res) {

            var ip = req.query.ip;
            var results = req.query.results;

            if (ip) {

                if(!results)
                    results = 10;

                service.getPerfLog({ip:ip, results: results}, function (err, data) {
                    if (err) {
                        console.log(err);
                        res.status(500);
                        res.send({code:500, success:false, message:'An error has occurred.'});
                    } else {
                        res.send(data);
                    }
                })

            }else{
                res.status(400);
                res.send({code:400, success:false, message:'Please provide IP address for which to return performance history.'});
            }

        });

    router.route('/api/getStats')
        .get(function(req, res) {

            service.getStats(function(err, stats){
                if(err) {
                    res.send(err);
                    res.status(500);
                    res.send({code: 500, success: false, message: 'An error has occurred.'});
                }else {
                    res.send(stats);
                }
            })

        });
};
