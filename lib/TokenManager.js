var events = require('events'),
    Promise = require('promise'),
    request = require("request");


function TokenManager(config, io) {
    events.EventEmitter.call(this);
    this.config = config;
    this.io = io;
    this.token = false;
    this.expires = 0;
}


TokenManager.prototype = {
    get: function () {
        return new Promise(function (resolve) {
            var time = (new Date).getTime();

            if (this.expires - 60000 < time) {
                //Expires before 60 secs in future
                this.updateToken().then(resolve)
            } else {
                resolve(this.token);
            }

        }.bind(this))
    },
    updateToken: function () {
        return new Promise(function (resolve) {
            if (this.io.sockets.sockets.length == 0) {
                //No one connected
                resolve(this.token);
                return;
            }
            request({
                url: "https://accounts.spotify.com/api/token",
                method: "POST",
                headers: {
                    Authorization: "Basic " + (new Buffer(this.config.spotify.clientId + ":" + this.config.spotify.clientSecret)).toString("base64") //Get base64 encoded string of the API key
                },
                form: {
                    grant_type: "client_credentials"
                }
            }, function (err, message, response) {
                response = JSON.parse(response);
                this.token = response.access_token;
                this.emit("token", this.token);
                var duration = response.expires_in;
                this.expires = (new Date).getTime() + duration * 1000;
                console.log("Got access token %s", this.token);
                resolve(this.token)

                setTimeout(this.updateToken.bind(this), (duration - 30) * 1000); //Renew 30 secs before expires
            }.bind(this));
        }.bind(this))
    }
}

TokenManager.prototype.__proto__ = events.EventEmitter.prototype;


module.exports = TokenManager;