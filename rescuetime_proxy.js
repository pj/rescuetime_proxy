var http = require('http')
var httpProxy = require('http-proxy');
var fs = require('fs');
var request = require('request-json');
var winston = require('winston');
var moment = require('moment');

if (typeof String.prototype.startsWith != 'function') {
    String.prototype.startsWith = function(str) {
        return this.substring(0, str.length) === str;
    }
};

if (typeof String.prototype.endsWith != 'function') {
    String.prototype.endsWith = function(str) {
        return this.substring(this.length - str.length, this.length) === str;
    }
};

var logger = new(winston.Logger)({
    transports: [
        new(winston.transports.Console)({
            level: 'debug'
        }),
        new(winston.transports.File)({
            filename: 'proxy.log'
        })
    ]
});

var client = request.newClient('https://www.rescuetime.com');

function loadApiKey() {
    logger.info("Loading rescue time api key");

    var homeDir = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];

    if (!fs.existsSync(homeDir + "/.rescuetime_api.key")) {
        logger.error("Api key not found");
        process.exit(1);
    }
    var key = fs.readFileSync(homeDir + "/.rescuetime_api.key", {
        encoding: 'ascii'
    });
    return key.trim();
}

var apiKey = loadApiKey();

logger.info("Loading Initial blocked site list");

var blockedSites = [];

function loadBlockedSites() {
    var now = moment().subtract('1', 'months');

    client.get('/anapi/data?key=' + apiKey + '&format=json&restrict_begin=' + now.format("YYYY-MM-DD"), function(err, res, body) {
        if (err) {
            console.log(err);
        } else {
            logger.debug("Loading sites: ");

            blockedSites = body.rows.map(function(row) {
                if (row[5] < 0 && (row[3].endsWith(".com") || row[3].endsWith(".org"))) {
                    return row[3];
                } else {
                    return null;
                }
            }).filter(function(site) {
                return site != null;
            });
            logger.debug(typeof blockedSites);
            logger.debug("New blocked sites: " + blockedSites);
        }
    });
}

loadBlockedSites();

var blockedSiteInterval = setInterval(loadBlockedSites, 30 * 60 * 1000);

var proxy = httpProxy.createProxyServer({});


var server = require('http').createServer(function(req, res) {
    var requested_host = req.headers.host;

    logger.debug("Requested host: " + requested_host);

    //var found = false;
    var found = blockedSites.some(function(host_name) {
        logger.debug("Checking blocked host: " + host_name);
        logger.debug(requested_host.indexOf(host_name) > -1)

        return requested_host.indexOf(host_name) > -1;
    });

    if (found) {
        logger.debug("Blocking request...");

        res.writeHead(404);
        res.write("Oi! Back to work cunt!");
        res.end();
    } else {
        logger.debug("Request okay, passing along...");

        proxy.web(req, res, {
            target: req.url
        });
    }
});

logger.info("listening on port 5050");
server.listen(5050);