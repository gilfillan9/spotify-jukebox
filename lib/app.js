console.log("Starting...")

var config = require("../config.json");

var spotifyConfig = {appkeyFile: config.spotify.apiKeyLocation};
if ("string" === typeof config.spotify.traceFileLocation) spotifyConfig['traceFile'] = config.spotify.traceFileLocation;

var Queue = new require("./Queue"),
    Player = new require("./Player"),
    TokenManager = new require("./TokenManager"),
    express = require("express"), app = express(),
    http = require("http"),
    server = http.Server(app),
    io = require("socket.io")(server),
    Promise = require('promise'),
    spotify = require('node-spotify')(spotifyConfig),
    loudness = require('loudness'),
    async = require("async"),
    fs = require("fs"),
    Datastore = require("nedb"),
    prompt = require("prompt"),
    exec = require('child_process').exec;

var db = {
    history: new Datastore({filename: 'data/history.db', autoload: true}),
    votes: new Datastore({filename: 'data/votes.db', autoload: true})
};

console.log("Loaded modules")

var queue, player, tokenManager, normalVolume, phoneVolume = 75, isPhone = false, lastTime, authFiles;

var lastUsed = new Date;

spotify.on({
    ready: function () {
        console.log("Logged in!");

        queue = new Queue(spotify);
        player = new Player(spotify.player, queue);
        tokenManager = new TokenManager(config, io);

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
        io.set('transports', ['websocket']);
        io.on('connection', function (socket) {
            var ip = socket.request.connection.remoteAddress;
            console.log("Connection from: " + ip)

            socket.on("disconnect", function () {
                console.log(ip + " disconnected: " + JSON.stringify(arguments));
            })
            socket.on("pause", function () {
                console.log("pause")
                lastUsed = new Date;
                player.pause();
            });
            socket.on("play", function () {
                console.log("play")
                lastUsed = new Date;
                player.play();
            });
            socket.on("stop", function () {
                console.log("stop");
                lastUsed = new Date;
                player.stop();
            })
            socket.on("skip", function () {
                console.log("skip")
                lastUsed = new Date;
                queue.next();
            });
            socket.on("skipBack", function () {
                console.log("skipBack")
                lastUsed = new Date;
                queue.previous();
            });
            socket.on("addTrack", function (data) {
                console.log("addTrack", data)
                queue.add([data.uri], data.source);
                lastUsed = new Date;
            })
            socket.on("add", function (tracks) {
                console.log("add", tracks)
                queue.add(tracks);
                lastUsed = new Date;
            })
            socket.on("addNext", function (track) {
                console.log("addNext", track);
                if ("string" === typeof track) {
                    queue.addNext(track);
                } else {
                    queue.addNext(track.uri, track.source);
                }
                lastUsed = new Date;
            })
            socket.on("addPlaylist", function (playlistURI) {
                console.log("addPlaylist", playlistURI)
                var playlist = spotify.createFromLink(playlistURI);
                queue.loadItem(playlist).then(function () {
                    queue.add(playlist.getTracks(), playlistURI);
                })
                lastUsed = new Date;
            });
            socket.on("addAlbum", function (albumURI) {
                console.log("addAlbum", albumURI)
                spotify.createFromLink(albumURI).browse(function (err, album) {
                    queue.add(album.tracks, albumURI);
                });
                lastUsed = new Date;
            });
            socket.on("clearQueue", function () {
                console.log("clearQueue")
                queue.clear();
                lastUsed = new Date;
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
                lastUsed = new Date;
            })
            socket.on("setVolume", function (volume) {
                volume = volume;
                loudness.setVolume(parseInt(volume), function (err) {
                    if (isPhone) {
                        phoneVolume = volume;
                    } else {
                        normalVolume = volume;
                    }
                    io.emit("volume", volume);
                });
                lastUsed = new Date;
            })
            socket.on("seek", function (seconds) {
                spotify.player.seek(parseInt(seconds));
                lastUsed = new Date;
            })
            socket.on("phoneOn", function () {
                isPhone = true;
                io.emit("isPhone", true)
                io.emit("volume", phoneVolume)
                loudness.setVolume(phoneVolume, function () {

                });
                lastUsed = new Date;
            })
            socket.on("phoneOff", function () {
                isPhone = false;
                io.emit("isPhone", false)
                io.emit("volume", normalVolume)
                loudness.setVolume(normalVolume, function () {

                });
                lastUsed = new Date;
            })
            socket.on("vote", function (data) {
                console.log("vote", data, ip);
                queue.vote(data.uuid, data.up, ip);
                lastUsed = new Date;
            })
            socket.on("getHistory", function (page) {
                if ("undefined" === typeof page) page = 0;
                var skip = page * 50;
                db.history.find({}).sort({time: -1}).skip(skip).limit(50).exec(function (err, docs) {
                    if (err) {
                        console.log(err);
                        return;
                    }
                    socket.emit("history", docs);
                })
            });
            socket.on("reboot", function () {
                exec("sudo reboot");
            });
            socket.on("getHistory", function () {
                db.history.find({}, function (err, docs) {
                    if (err) {
                        console.error(err);
                        return;
                    }
                    socket.emit("history", docs);
                })
            });
            socket.on("getAuthFiles", function () {
                socket.emit("authFiles", {
                    files: authFiles,
                    selected: selectedFile
                })
            })
            socket.on("addAuthFile", function (data) {

                if (!data.name || !data.username || !data.password) {
                    socket.emit("toast", "Couldn't add spotify account. Enter name, username and password")
                    return;
                }

                console.log("Adding auth file: " + data.name)
                fs.writeFile(config.spotify.authDir + data.name, JSON.stringify(data), function (err) {
                    if (err) {
                        socket.emit("error", err);
                    } else {
                        authFiles.push(data.name)
                        socket.emit("toast", "Auth file added")
                        socket.emit("authFiles", {
                            files: authFiles,
                            selected: selectedFile
                        })
                    }
                });
            })
            socket.on("switchAuthFile", function (file) {
                console.log("Switching auth file: " + file)
                if (authFiles.indexOf(file) == -1) {
                    //No valid files selected choose first file
                    console.log("Invalid auth file selected!")
                } else {
                    selectedFile = file;
                    fs.writeFile(config.spotify.authDir + ".selected", file, function (err) {
                        if (err) {
                            socket.emit("error", err);
                        } else {
                            console.log("Logging out of spotify")
                            player.stop();
                            spotify.logout(function () {
                                var data = JSON.parse(fs.readFileSync(config.spotify.authDir + authFiles[authFiles.indexOf(file)]), {encoding: 'utf8'})
                                spotify.on({
                                    ready: function () {
                                        console.log("Logged in");
                                        io.emit("toast", "Now using " + file + " spotify account")
                                        player.play();
                                    },
                                    playTokenLost: function () {
                                        io.emit("error", "This spotify account is being used elsewhere. Pausing playback...");
                                        player.pause();
                                    }
                                })
                                console.log("Logging into spotify")
                                spotify.login(data.username, data.password)
                            })
                        }
                    })
                }
            })

            socket.emit("ip", ip);
            socket.emit("playState", player.isPlaying);
            tokenManager.get().then(function (token) {
                socket.emit("accessToken", token);
            })
            socket.emit("changedCurrent", player.getCurrentTrackJson())
            socket.emit("seek", lastTime);
            socket.emit("volume", normalVolume);
            socket.emit("isPhone", isPhone)
        });

        tokenManager.on("token", function (token) {
            io.emit("accessToken", token);
        })

        queue.on("change", function () {
            io.emit("playQueue", queue.getJson());
        })
        queue.on("save", function () {
            io.emit("toast", {
                text: "Queue Saved",
                timeout: 2000
            });
        })
        queue.on("vote", function (e) {
            db.votes.update({uri: e.track.link, ip: e.ip}, {
                uri: e.track.link,
                ip: e.ip,
                up: e.up,
                time: (new Date).getTime()
            }, {upsert: true});
        })
        player.on("changedCurrent", function (track) {
            io.emit("changedCurrent", track);
            if (!track) return;
            db.history.insert({
                uri: track.link,
                time: (new Date).getTime()
            })
        })
        player.on("playState", function (isPlaying) {
            io.emit("playState", isPlaying);
        })
        player.on("playError", function (error) {
            console.error(error);
            io.emit("error", "Can't play '" + error.track.name + "'")
        })
        queue.on("error", function (error) {
            console.error(error);
            io.emit("error", "Can't add '" + error.track.name + "' " + error.message);
        })

        loudness.getVolume(function (err, volume) {
            normalVolume = volume;
        })

        setInterval(function () {
            if (spotify.player.currentSecond != lastTime) {
                lastTime = spotify.player.currentSecond;
                io.emit("seek", lastTime);
            }
        }, 1000);

        setInterval(function () {
            queue.save();
            if ((new Date).getTime() - lastUsed.getTime() > 3 * 60 * 60 * 1000) {
                //3 Hours since the last action was taken, unload the track
                player.stop();
            }
        }, 300000); // 5 Minutes
    },
    playTokenLost: function () {
        io.emit("error", "This spotify account is being used elsewhere. Pausing playback...");
        player.pause();
    }
});


process.on('SIGINT', function () {
    console.log('Got SIGINT. Stopping...');
    player.stop();
    queue.save().then(function () {
        process.exit();
    })
});

console.log("Logging into spotify")

if (!fs.existsSync(config.spotify.authDir)) fs.mkdirSync(config.spotify.authDir);
if (!fs.existsSync(config.spotify.authDir + ".selected")) fs.writeFile(config.spotify.authDir + ".selected", "");

var selectedFile = fs.readFileSync(config.spotify.authDir + ".selected", {encoding: 'utf8'})
authFiles = fs.readdirSync(config.spotify.authDir).filter(function (val) {
    return [".", "..", ".selected"].indexOf(val) == -1
});

if (authFiles.length == 0) {
    //Only '.' and '..' (no auth credentials)
    //TODO prompt for username, email and name


    prompt.start();

    prompt.get(['username', 'password', 'name'], function (err, result) {
        if (err) {
            console.error(err);
            process.exit(1);
            return;
        }

        var data = {
            username: result.username,
            password: result.password,
            name: result.name
        }

        fs.writeFileSync(config.spotify.authDir + result.name, JSON.stringify(data));
        fs.writeFileSync(config.spotify.authDir + ".selected", result.name);
        spotify.login(result.username, result.password)
    })
} else {
    if (authFiles.indexOf(selectedFile) == -1) {
        //No valid files selected choose first file
        console.log("Invalid auth file selected! Using " + authFiles[0])
        selectedFile = authFiles[0];
    } else {
        console.log("Using " + selectedFile + " auth file");
    }

    var data = JSON.parse(fs.readFileSync(config.spotify.authDir + selectedFile), {encoding: 'utf8'})
    spotify.login(data.username, data.password)
}
