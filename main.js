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
const request = require('request');
const axios = require('axios');
var config = require('./core/config.js');
var CronJob = require('cron').CronJob;
var ping = require('net-ping');


mongoose.Promise = global.Promise;

const {
	  MONGO_USERNAME,
	  MONGO_PASSWORD,
	  MONGO_HOSTNAME,
	  MONGO_PORT,
	  MONGO_DB
	} = process.env;

	const options = {
	  useNewUrlParser: true,
	  reconnectTries: Number.MAX_VALUE,
	  reconnectInterval: 500,
	  connectTimeoutMS: 10000,
	};

	const url = `mongodb://${MONGO_USERNAME}:${encodeURIComponent(MONGO_PASSWORD)}@${MONGO_HOSTNAME}:${MONGO_PORT}/${MONGO_DB}?authSource=admin`;

	mongoose.connect(url, options);

mongoose.connection.on('connected', function () {
  console.log('Mongoose default connection open to ' + MONGO_HOSTNAME);
});

// If the connection throws an error
mongoose.connection.on('error',function (err) {
  console.log('Mongoose default connection error: ' + err);
});

// When the connection is disconnected
mongoose.connection.on('disconnected', function () {
  console.log('Mongoose default connection disconnected');
});

// If the Node process ends, close the Mongoose connection
process.on('SIGINT', function() {
  mongoose.connection.close(function () {
    console.log('Mongoose default connection disconnected through app termination');
    process.exit(0);
  });
});

var express = require('express');
var app = express();

var Peers = require('./models/model.peer');
var Stats = require('./models/model.stats');

app.enable('trust proxy');

/*
var toobusy = require('toobusy-js');
app.use(function(req, res, next) {
    if (toobusy()) {
        //res.send(503, "Server is too busy right now, sorry.");
        res.status(503).send("Server is too busy right now, sorry.")
    } else {
        next();
    }
});
*/

var port = config.port;

var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

app.use(express.static(__dirname + '/static'));

var router = express.Router();
app.use(process.env.PUBLIC_PATH, router);

require('./routes/route.peers.js')(router);
require('./routes/route.services.js')(router);

// server = app.listen(port,'127.0.0.1');
server = app.listen(port);

cronjobs = {};


const peers = require('./controllers/control.peers');

exports.axiosInstance = axios.create({
    timeout: 5000
});

var crawlLock = false;

server.on('listening', function(){

    console.log('Listening on port '+port);
    console.log('Starting internal cron for crawl..');

	cronjobs.crawl = new CronJob({
		cronTime:'00 */7 * * * *',
		onTick: function() {
		    if (!crawlLock) {
                crawlLock = true;

                console.log("=========================\nSTART CRAWL\n=========================");

                peers.crawl()
                    .then(() => {
                        console.log("=========================\nCRAWL FINISHED\n=========================");

                        console.log("=========================\nSTART PROCESS PEERS\n=========================");
                        return peers.processPeers();
                    })
                    .then(() => {
                        console.log("=========================\nPROCESS PEERS FINISHED\n=========================");

                        console.log("=========================\nSTART BUILD STATS\n=========================");
                        return peers.buildStats();
                    })
                    .then(() => {
                        console.log("=========================\nBUILD STATS FINISHED\n=========================");

                        console.log("=========================\nSTART HEALTH CHECK AND CLEAN PEERS\n=========================");
                        return peers.healthCheckAndCleanPeers();
                    })
                    .then(() => {
                        console.log("=========================\nHEALTH CHECK AND CLEAN PEERS FINISHED\n=========================");
                    })
                    .catch((error) => {
                        console.error("Error occurred during cronjob", error);
                    })
                    .finally(() => {
                        crawlLock = false;
                    });
            } else {
		        console.info("Crawling is locked due to a running process - skipping this iteration")
            }
		},
		start:true,
        runOnInit: true,
	});

});

process.on('uncaughtException', function (err) {
    console.log('******* Unexpected Error *******', err);
});
