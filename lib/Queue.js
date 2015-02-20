var events  = require('events'),
    Promise = require('promise'),
    async   = require('async'),
    fs      = require('fs'),
    uuid    = require("node-uuid");


function Queue(spotify) {
    this.spotify = spotify;
    this.tracks = [];
    this.played = [];
    this.repeat = 0;
    /*0 - none
     1 - track
     2 - list*/
    this.shuffled = false;

    events.EventEmitter.call(this);

    this.load();

    this.on("change", function () {
        this.changed = true;
    }.bind(this))
}

Queue.prototype = {
    add: function (track) {
        return this.addTracks([track]);
    },
    loadTrack: function (track) {
        return new Promise(function (resolve) {
            if ("undefined" === typeof track) {
                resolve(track);
                return;
            }
            if ("string" === typeof track) track = this.spotify.createFromLink(track);
            if (!track.isLoaded) {
                this.spotify.waitForLoaded([track], function () {
                    resolve(track)
                }.bind(this))
            } else {
                resolve(track)
            }
        }.bind(this));
    },
    addTracks: function (tracks) {
        return new Promise(function (resolve) {
            var doPlay = this.tracks.length == 0;
            async.map(tracks, function (track, cb) {
                this.loadTrack(track).then(function (track) {
                    cb(undefined, track);
                });
            }.bind(this), function (err, tracks) {
                async.mapSeries(tracks, function (track, cb) {
                    this.tracks.push(track);
                    console.log("Added track %s - %s", track.artists[0].name, track.name);
                    track.votes = 0;
                    track.votesIps = {};
                    track.uuid = uuid.v4();
                    cb();
                }.bind(this), function () {
                    if (this.shuffled) this.shuffle(doPlay);
                    if (doPlay) this.play();
                    this.emit("change");
                    resolve();
                }.bind(this));
            }.bind(this))
        }.bind(this));
    },

    get: function (uuid) {
        var track = undefined;
        this.tracks.forEach(function (val) {
            if (val.uuid === uuid) {
                track = val;
                return false;
            }
            return true;
        });
        return track;
    },
    clear: function (noEvent) {
        this.tracks = [];
        this.played = [];
        this.spotify.player.stop();
        this.emit("changedCurrent", this.getCurrentTrack());
        !noEvent && this.emit("change");
    },
    getCurrentTrack: function () {
        return this.tracks.length > 0 ? this.tracks[0] : null;
    },
    next: function () {
        if (this.repeat == 1) return this.getCurrentTrack(); //Do nothing
        this.played.push(this.tracks.shift());
        if (this.repeat == 2 && this.tracks.length == 0) { //Loop all and finished
            this.tracks = this.played; //Reset the playlist
            this.played = []; //Reset the played tracks
        }
        this.emit("change")
        this.emit("changedCurrent", this.getCurrentTrack());
        if (this.isPlaying) this.play();
        return this.getCurrentTrack();
    },
    previous: function () {
        if (this.played.length == 0) {
            this.spotify.player.seek(0);
            return this.getCurrentTrack();
        }
        this.tracks.unshift(this.played.pop());
        this.emit("change")
        this.emit("changedCurrent", this.getCurrentTrack());
        if (this.isPlaying) this.play();
        return this.getCurrentTrack();
    },
    getTracks: function () {
        return this.tracks;
    },
    getPlayed: function () {
        this.played;
    },
    shuffle: function (noPreserverHead) {
        this.shuffled = true;
        if (this.tracks.length <= 1) return;
        if (!noPreserverHead) var temp_tracks = [this.tracks.shift(), this.tracks.shift()]; //Maintain current track and next track

        var counter = this.tracks.length, temp, index;

        // While there are elements in the array
        while (counter > 0) {
            // Pick a random index
            index = Math.floor(Math.random() * counter);

            // Decrease counter by 1
            counter--;

            // And swap the last element with it
            temp = this.tracks[counter];
            this.tracks[counter] = this.tracks[index];
            this.tracks[index] = temp;
        }

        this.tracks.sort(function (a, b) {
            return b.votes - a.votes;
        })
        if (!noPreserverHead) {
            this.tracks.unshift(temp_tracks.pop());
            this.tracks.unshift(temp_tracks.pop());
        }
    },
    getJson: function () {
        return {
            shuffled: this.shuffled,
            repeat: this.repeat,
            tracks: this.tracks.map(function (val) {
                return {
                    link: val.link,
                    votes: val.votes,
                    id: val.link.split(":").pop(),
                    uuid: val.uuid,
                    votesIps: val.votesIps
                };
            })
        }
    },
    toggleShuffle: function (on) {
        if ("undefined" === typeof on) {
            on = !this.shuffled;
        }
        this.shuffled = on;
        if (on) this.shuffle();

        this.emit("change");
    },
    setRepeat: function (repeat) {
        this.repeat = repeat;
        this.emit("change");
    },
    remove: function (index, uuid) {
        if (this.tracks[index].uuid == uuid) {
            //Remove the track
            this.tracks.splice(index, 1);
        }
        this.emit("change");
    },
    vote: function (uuid, up, ip) {
        var track = this.get(uuid);
        if ("undefined" === typeof track) {
            console.log("Invalid uuid: " + uuid);
            return;
        }
        var vote = up ? 1 : -1;
        track.votesIps[ip] = vote == track.votesIps[ip] ? 0 : vote;
        track.votes = 0;
        Object.keys(track.votesIps).forEach(function (key) {
            track.votes += track.votesIps[key];
        })
        if (track.votes <= -2) this.remove(this.tracks.indexOf(track), track.uuid);
        if (this.shuffled) this.shuffle();
        this.emit("change");
    },
    load: function () {
        var me = this;
        return new Promise(function (resolve, reject) {
            fs.readFile("./queue.json", function (err, data) {
                if (err) {
                    reject(err);
                } else {
                    try {
                        data = JSON.parse(data);
                        me.clear(true);
                        me.shuffled = false;
                        me.repeat = data.repeat;
                        me.addTracks(data.tracks).then(function () {
                            me.shuffled = data.shuffled;
                            console.log("Loaded queue");
                            resolve();
                        });
                    } catch (e) {
                        reject(e);
                    }
                }
            })
        })
    },
    save: function () {
        var me = this;
        return new Promise(function (resolve, reject) {
            if (!me.changed) {
                resolve();
                return;
            }
            me.changed = false;
            var data = me.getJson();
            data.tracks = data.tracks.map(function (val) {
                return val.link;
            })
            fs.writeFile("./queue.json", JSON.stringify(data), function (err) {
                if (err) {
                    reject(err);
                } else {
                    console.log("Saved queue");
                    resolve();
                }
            })
        })
    },
    play: function () {
        if (this.currentTrack != this.getCurrentTrack()) {
            this.spotify.player.stop();
            this.loadTrack(this.getCurrentTrack()).then(function (track) {
                if ("undefined" === typeof track) {
                    this.isPlaying = false;
                    this.emit("playState", this.isPlaying) //TODO
                    return;
                }
                try {
                    this.currentTrack = track;
                    console.log('Playing: %s - %s', track.artists[0].name, track.name);
                    this.spotify.player.play(track);
                    this.isPlaying = true;
                    this.emit("playState", this.isPlaying)
                } catch (e) {
                    console.error(e);
                    this.emit("playError", {e: e, track: this.getCurrentTrack()});
                    this.next();
                }
            }.bind(this));
        } else {
            this.spotify.player.resume();
            this.isPlaying = true;
            this.emit("playState", this.isPlaying)
        }
    },
    pause: function () {
        this.spotify.player.pause();
        this.isPlaying = false;
        this.emit("playState", this.isPlaying)
    }
}

Queue.prototype.__proto__ = events.EventEmitter.prototype;


module.exports = Queue;