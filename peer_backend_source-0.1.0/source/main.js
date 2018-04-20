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
var config = require('./core/config.js');
var CronJob = require('cron').CronJob;

mongoose.Promise = global.Promise;

mongoose.connect(

   config.mongodb.host,
    {

    //   auth:{
    //		authdb:'admin',
    //		useMongoClient: true,
    //		user:config.mongodb.user,
    //		pass:config.mongodb.pass
    //  }
    
   }
);

mongoose.connection.on('connected', function () {
  console.log('Mongoose default connection open to ' + config.mongodb.host);
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

app.enable('trust proxy');

var toobusy = require('toobusy-js');
app.use(function(req, res, next) {
    if (toobusy()) {
        //res.send(503, "Server is too busy right now, sorry.");
        res.status(503).send("Server is too busy right now, sorry.")
    } else {
        next();
    }
});

var port = config.port;

var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

app.use(express.static(__dirname + '/static'));

var router = express.Router();
app.use(router);

require('./routes/route.peers.js')(router);
require('./routes/route.services.js')(router);

// server = app.listen(port,'127.0.0.1');
server = app.listen(port);

cronjobs = {};

server.on('listening', function(){

    console.log('Listening on port '+port);
    console.log('Starting internal cron for crawl..');

    cronjobs.crawl = new CronJob({
        cronTime:'00 */7 * * * *',
        onTick: function() {
            console.log('Initiating crawl from cronjob..');
            request('http://localhost:' + port + '/api/crawl', function(){
               setTimeout(function(){
					console.log('Initiating stats from cronjob..');
                    request('http://localhost:' + port + '/api/buildStats', function(){
						console.log('Initiating geo from cronjob..');
                    	request('http://localhost:' + port + '/api/getGeoIP', function(){
							console.log('cronjob done...');
                        });
                    });
               },5000)
            });
        },
        start:true
    });


});
