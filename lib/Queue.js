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

    this.changed = false;
    events.EventEmitter.call(this);

    this.load();
}

Queue.prototype = {
    add: function (track, index, noEvent) {
        return new Promise(function (resolve) {
            this.loadTrack(track).then(function (track) {
                this._add(track, index, resolve, noEvent);
            }.bind(this));
        }.bind(this));
    },
    loadTrack: function (track) {
        return new Promise(function (resolve) {
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
    addTracks: function (tracks, noSave) {
        return new Promise(function (resolve) {
            async.map(tracks, function (track, cb) {
                this.loadTrack(track).then(function (track) {
                    cb(undefined, track);
                });
            }.bind(this), function (err, tracks) {
                async.mapSeries(tracks, function (track, cb) {
                    this._add(track, undefined, cb, true);
                }.bind(this), function () {
                    this.emit("change");
                    if (noSave) {
                        resolve();
                    } else {
                        this.save().then(resolve);
                    }
                }.bind(this));
            }.bind(this))
        }.bind(this));
    },
    _add: function (track, index, resolve, noEvent) {
        if ("undefined" !== typeof index) {
            this.tracks.splice(index, 0, track);
        } else {
            this.tracks.push(track);
        }
        console.log("Added track %s - %s", track.artists[0].name, track.name);
        track.votes = 0;
        track.votesIps = {};
        track.uuid = uuid.v4();
        if (this.shuffled) {
            this.shuffle(noEvent);
        } else if (!noEvent) {
            this.emit("change")
        }
        this.changed = true;
        resolve();
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
        !noEvent && this.emit("change");
        this.changed = true;
    },
    getCurrentTrack: function () {
        return this.tracks.length > 0 ? this.tracks[0] : null;
    },
    /**
     * Returns shifts the current tail of the queue and returns the next item
     * @returns {Track}
     */
    next: function () {
        if (this.repeat == 1) return this.getCurrentTrack(); //Do nothing
        this.played.push(this.tracks.shift());
        if (this.repeat == 2 && this.tracks.length == 0) { //Loop all and finished
            this.tracks = this.played; //Reset the playlist
            this.played = []; //Reset the played tracks
        }
        this.emit("change")
        this.changed = true;
        return this.getCurrentTrack();
    },
    previous: function () {
        this.tracks.unshift(this.played.pop());
        this.emit("change")
        this.changed = true;
        return this.getCurrentTrack();
    },
    getTracks: function () {
        return this.tracks;
    },
    getPlayed: function () {
        this.played;
    },
    shuffle: function (noEvent) {
        this.shuffled = true;
        if (this.tracks.length <= 1) {
            !noEvent && this.emit("change"); //Some functions rely on the fact this emits an event
            return;
        }

        var temp_tracks = [this.tracks.shift(), this.tracks.shift()]; //Maintain current track and next track

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

        this.tracks.unshift(temp_tracks.pop());
        this.tracks.unshift(temp_tracks.pop());
        this.changed = true;
        !noEvent && this.emit("change")
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
        if (on) {
            this.shuffle(); //Emits change event
        } else {
            this.emit("change"); //Force change event
        }
        this.changed = true;
    },
    setRepeat: function (repeat) {
        this.repeat = repeat;
        this.changed = true;
        this.emit("change");
    },
    remove: function (index, url) {
        if (this.tracks[index].link == url) {
            //Remove the track
            this.tracks.splice(index, 1);
        }
        this.emit("change");
        this.changed = true;
    },
    vote: function (uuid, up, ip) {
        var track = this.get(uuid);
        if ("undefined" === typeof track) {
            console.log("Invalid uuid: " + uuid);
            return;
        }
        var vote = up ? 1 : -1;
        track.votesIps[ip] = vote;
        track.votes = 0;
        Object.keys(track.votesIps).forEach(function (key) {
            track.votes += track.votesIps[key];
        })
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
                        me.addTracks(data.tracks.map(function (val) {
                            return val.link;
                        }), true).then(function () {
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
            fs.writeFile("./queue.json", JSON.stringify(me.getJson()), function (err) {
                if (err) {
                    reject(err);
                } else {
                    console.log("Saved queue");
                    resolve();
                }
            })
        })
    }
}

Queue.prototype.__proto__ = events.EventEmitter.prototype;


module.exports = Queue;