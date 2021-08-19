/******************************************************************************
 * Copyright © 2017 XIN Community                                             *
 *                                                                            *
 * See the DEVELOPER-AGREEMENT.txt and LICENSE.txt files at the top-level     *
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

const peers = require('../controllers/control.peers');
const moment = require('moment');
const config = require('../core/config');

function cliAddress(req) {

	var ip = (req.headers["X-Forwarded-For"] ||
            req.headers["x-forwarded-for"] ||
            '').split(',')[0] ||
           req.client.remoteAddress;

	if (ip.substr(0, 7) == "::ffff:") {
	  ip = ip.substr(7)
	}

    return ip.trim();
}

function isLocal(req) {

	return cliAddress(req) == '127.0.0.1' ;

}

module.exports = function(router) {

    router.use(function(req, res, next) {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        next();
    });

    router.route('/api/*')
        .all(function(req,res,next){

            return next();
/*
            var ip = cliAddress(req);

            blacklist.checkUser(ip, function(blacklisted){

                if(blacklisted){
                    return res.send('Your IP address has been blacklisted. Please contact an administrator');
                }else{
                    return next();
                }

            })
 */

        });

    router.route('/api/crawl/deactivate')
        .get(function (req, res) {

            console.log(req.query.key);

            if(!req.query.key && req.query.key != config.adminKey)
                return res.send({code:400, success:false, message:'Inavalid or missing key.'});

            cronjobs.crawl.stop();

            res.status(200);
            res.send({code:200, success:true, message:'Internal cron for crawl deactivated.'});

        });

    router.route('/api/crawl/activate')
        .get(function (req, res) {

            console.log(req.query.key);

            if(!req.query.key && req.query.key != config.adminKey)
                return res.send({code:400, success:false, message:'Inavalid or missing key.'});

            cronjobs.crawl.stop();
            cronjobs.crawl.start();

            res.status(200);
            res.send({code:200, success:true, message:'Internal cron for crawl activated.'});

        });

    router.route('/api/clean')
        .get(function (req, res) {

            if(!isLocal(req))
                return res.send({code:400, success:false, message:'This endpoint is not remotely accessible.'});

            peers.clean(function(){});

            res.status(200);
            res.send({code:200, success:true, message:'Checking nodes and cleaning.'})

        });
};
