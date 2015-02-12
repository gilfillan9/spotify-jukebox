console.log("Starting...")

var config = require("../config.json");

var Queue    = new require("./Queue"),
    express  = require("express"), app = express(),
    http     = require("http"),
    server   = http.Server(app),
    io       = require("socket.io")(server),
    Promise  = require('promise'),
    spotify  = require('spotify')({
        appkeyFile: config.spotify.apiKeyLocation
    }),
    loudness = require('loudness'),
    request  = require("request");

console.log("Loaded modules")

var queue, spotify, currentTrack, prePhoneVolume, lastTime, accessToken, accessTokenTimeout;
var playing = false;

spotify.on({
    ready: function () {
        console.log("Logged in!");

        queue = new Queue(spotify);

        spotify.player.on({
            endOfTrack: function () {
                playTrack(queue.next());
            }
        });

        server.listen(config.http.port, config.http.ip);
        console.log("Started on port %s:%s", config.http.ip, config.http.port);

        app.use(express.static(__dirname + "/public"));

        io.on('connection', function (socket) {
            socket.on("pause", function () {
                console.log("pause")
                spotify.player.pause();
                playing = false;
                io.emit("playState", playing)
            });
            socket.on("play", function () {
                console.log("play")
                if (!currentTrack) {
                    //Not currently playing anything
                    playTrack(queue.getCurrentTrack());
                } else {
                    spotify.player.resume();
                    playing = true;
                    io.emit("playState", playing)
                }
            });
            socket.on("skip", function () {
                playTrack(queue.next());
            });
            socket.on("skipBack", function () {
                playTrack(queue.previous());
            });
            socket.on("addTrack", function (trackURI) {
                console.log("addTrack", trackURI)
                queue.add(trackURI).then(function () {
                    if (queue.getTracks().length == 1) playTrack(queue.getCurrentTrack())
                });
            })
            socket.on("addTracks", function (tracks) {
                console.log("addTracks", tracks)
                addTracks(tracks);
            })
            socket.on("addPlaylist", function (playlistURI) {
                console.log("addPlaylist", playlistURI)
                var playlist = spotify.createFromLink(playlistURI);
                if (playlist.isLoaded) {
                    addTracks(playlist.getTracks());
                } else {
                    spotify.waitForLoaded([playlist], function () {
                        addTracks(playlist.getTracks());
                    })
                }
            });
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
                loudness.setVolume(volume, function (err) {
                }); //Set power to inverse square (trying to make the slider more linear)
                io.emit("volume", volume);
            })
            socket.on("seek", function (seconds) {
                spotify.player.seek(parseInt(seconds));
            })
            socket.on("phone", function () {
                if (!prePhoneVolume) {
                    loudness.getVolume(function (err, volume) {
                        prePhoneVolume = volume;
                        loudness.setVolume(55, function () {
                        });
                    })
                } else {
                    loudness.setVolume(prePhoneVolume, function () {
                        prePhoneVolume = false;
                    });
                }
            })
            socket.emit("playQueue", queue.getJson())
            socket.emit("playState", playing)
            socket.emit("accessToken", accessToken);
            loudness.getVolume(function (err, volume) {
                socket.emit("volume", volume);
            });
        });

        queue.on("change", function () {
            io.emit("playQueue", queue.getJson())
        })

        setInterval(function () {
            if (spotify.player.currentSecond != lastTime) {
                lastTime = spotify.player.currentSecond;
                io.emit("seek", lastTime);
            }
        }, 1000);
    }
});


function addTracks(tracks) {
    var promises = [];
    tracks.forEach(function (track) {
        promises.push(queue.add(track, undefined, true));
    });

    Promise.all(promises).then(function () {
        if (queue.getTracks().length == 1) playTrack(queue.getCurrentTrack())
        queue.emit("change");
    })
}

function updateAccessToken() {
    if (accessTokenTimeout) clearTimeout(accessTokenTimeout);
    request({
        url: "https://accounts.spotify.com/api/token",
        method: "POST",
        headers: {
            Authorization: "Basic " + (new Buffer(config.spotify.clientId + ":" + config.spotify.clientSecret)).toString("base64")
        },
        form: {
            grant_type: "client_credentials"
        }
    }, function (err, message, response) {
        response = JSON.parse(response);
        io.emit("accessToken", response.access_token);
        accessToken = response.access_token;
        accessTokenTimeout = setTimeout(updateAccessToken, (response.expires_in - 60) * 1000); //Update 60 seconds before this one expires (about 59 minutes)
        console.log("Got access token %s", accessToken);
    });
}

console.log("Logging into spotify")

spotify.login(config.spotify.username, config.spotify.password)
updateAccessToken();

function playTrack(track) {
    currentTrack = track;
    if (!track) {
        spotify.player.stop();
        playing = false;
        io.emit("playState", playing)
        return;
    }

    if ("string" === typeof track) track = spotify.createFromLink(track)
    spotify.player.stop();
    if (track.isLoaded) {
        console.log('Playing: %s - %s', track.artists[0].name, track.name);
        spotify.player.play(track);
        playing = true;
        io.emit("playState", playing)
    } else {
        spotify.waitForLoaded([track], function () {
            playTrack(track);
        })
    }
}

