console.log("Starting...")

var config = require("../config.json");

var Queue    = new require("./Queue"),
    Player   = new require("./Player"),
    express  = require("express"), app = express(),
    http     = require("http"),
    server   = http.Server(app),
    io       = require("socket.io")(server),
    Promise  = require('promise'),
    spotify  = require('spotify')({
        appkeyFile: config.spotify.apiKeyLocation
    }),
    loudness = require('loudness'),
    request  = require("request"),
    async    = require("async"),
    fs       = require("fs"),
    CronJob  = require('cron').CronJob;

console.log("Loaded modules")

var queue, player, normalVolume, phoneVolume = 75, isPhone = false, lastTime, accessToken, accessTokenTimeout;

spotify.on({
    ready: function () {
        console.log("Logged in!");

        queue = new Queue(spotify);
        player = new Player(spotify.player, queue);

        spotify.player.on({
            endOfTrack: function () {
                queue.next();
            }
        });

        server.listen(config.http.port, config.http.ip);
        console.log("Started on port %s:%s", config.http.ip, config.http.port);

        app.get("/templates.json", function (req, res) {
            async.map([__dirname + "/public/templates", __dirname + "/public/templates/partials"],
                function (path, cb) {
                    fs.readdir(path, function (err, files) {
                        cb(null, files.filter(function (val) {
                            return val != "." && val != ".."
                        }).map(function (val) {
                            var arr = val.split(".");
                            arr.pop(); //Remove extension
                            return arr.join(".");
                        }).filter(function (val) {
                            return val != "";
                        }))
                    })
                }, function (err, data) {
                    res.json({
                        templates: data[0],
                        partials: data[1]
                    });
                });
        });
        app.get("/pages.json", function (req, res) {
            fs.readdir(__dirname + "/public/js/pages", function (err, files) {
                res.json(files.filter(function (val) {
                    return val != "." && val != ".."
                }));
            })
        });


        app.use(express.static(__dirname + "/public"));

        io.on('connection', function (socket) {
            var ip = socket.request.connection.remoteAddress;

            socket.on("pause", function () {
                console.log("pause")
                player.pause();
            });
            socket.on("play", function () {
                console.log("play")
                player.play();
            });
            socket.on("stop", function () {
                console.log("stop");
                player.stop();
            })
            socket.on("skip", function () {
                console.log("skip")
                queue.next();
            });
            socket.on("skipBack", function () {
                console.log("skipBack")
                queue.previous();
            });
            socket.on("addTrack", function (trackURI) {
                console.log("addTrack", trackURI)
                queue.add([trackURI]);
            })
            socket.on("add", function (tracks) {
                console.log("add", tracks)
                queue.add(tracks);
            })
            socket.on("addPlaylist", function (playlistURI) {
                console.log("addPlaylist", playlistURI)
                var playlist = spotify.createFromLink(playlistURI);
                if (playlist.isLoaded) {
                    queue.add(playlist.getTracks());
                } else {
                    spotify.waitForLoaded([playlist], function () {
                        queue.add(playlist.getTracks());
                    })
                }
            });
            socket.on("addAlbum", function (albumUri) {
                console.log("addAlbum", albumUri)
                spotify.createFromLink(albumUri).browse(function (err, album) {
                    queue.add(album.tracks);
                });
            });
            socket.on("clearQueue", function () {
                console.log("clearQueue")
                queue.clear();
            })
            socket.on("save", function () {
                queue.save();
            })
            socket.on("load", function () {
                queue.load();
            })
            socket.on("getQueue", function () {
                socket.emit("playQueue", queue.getJson()) //No validation needed
            })
            socket.on("toggleShuffle", function (on) {
                queue.toggleShuffle(on); //Validation done in toggleShuffle
            })
            socket.on("repeat", function (repeat) {
                queue.setRepeat(repeat); //TODO add some validation
            })
            socket.on("setVolume", function (volume) {
                volume = parseInt(volume);
                loudness.setVolume(volume, function (err) {
                    if (isPhone) {
                        phoneVolume = volume;
                    } else {
                        normalVolume = volume;
                    }
                    io.emit("volume", volume);
                });
            })
            socket.on("seek", function (seconds) {
                spotify.player.seek(parseInt(seconds));
            })
            socket.on("phoneOn", function () {
                isPhone = true;
                loudness.setVolume(phoneVolume, function () {
                    socket.emit("isPhone", true)
                    socket.emit("volume", phoneVolume)
                });
            })
            socket.on("phoneOff", function () {
                isPhone = false;
                loudness.setVolume(normalVolume, function () {
                    socket.emit("isPhone", false)
                    socket.emit("volume", normalVolume)
                });
            })
            socket.on("vote", function (data) {
                console.log("vote", data, ip);
                queue.vote(data.uuid, data.up, ip);
            })
            socket.emit("ip", socket.request.connection.remoteAddress);
            socket.emit("playState", player.isPlaying)
            socket.emit("accessToken", accessToken);
            player.changedCurrent();
            socket.emit("seek", lastTime);
            socket.emit("volume", normalVolume);
            socket.emit("isPhone", isPhone)
        });

        queue.on("change", function () {
            io.emit("playQueue", queue.getJson());
        })
        player.on("changedCurrent", function (track) {
            io.emit("changedCurrent", track);
        })
        player.on("playState", function (isPlaying) {
            io.emit("playState", isPlaying);
        })
        player.on("playError", function (error) {
            io.emit("error", "Can't play '" + error.track.name + "'")
        })

        setInterval(function () {
            if (spotify.player.currentSecond != lastTime) {
                lastTime = spotify.player.currentSecond;
                io.emit("seek", lastTime);
            }
        }, 1000);

        setInterval(function () {
            queue.save();
        }, 300000); // 5 Minutes

        new CronJob('0 0 19 * * *', function () {
            console.log("It's 7PM! Stopping...")
            player.stop(); //Unload the current song (may fix having to restart erry day
        });
    }
});
/**
 * Get a new access token from spotify for the clients to use
 * TODO update this to only update when people are connected (i.e not between 6PM and 8AM)
 */
function updateAccessToken() {
    if (accessTokenTimeout) clearTimeout(accessTokenTimeout);
    request({
        url: "https://accounts.spotify.com/api/token",
        method: "POST",
        headers: {
            Authorization: "Basic " + (new Buffer(config.spotify.clientId + ":" + config.spotify.clientSecret)).toString("base64") //Get base64 encoded string of the API key
        },
        form: {
            grant_type: "client_credentials"
        }
    }, function (err, message, response) {
        response = JSON.parse(response);
        //Notify the clients of the updated access token
        io.emit("accessToken", response.access_token);
        accessToken = response.access_token;
        //Update 60 seconds before this one expires (about 59 minutes)
        accessTokenTimeout = setTimeout(updateAccessToken, (response.expires_in - 60) * 1000);
        console.log("Got access token %s", accessToken);
    });
}

console.log("Logging into spotify")

spotify.login(config.spotify.username, config.spotify.password)
updateAccessToken();