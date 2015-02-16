var events  = require('events'),
    Promise = require('promise'),
    async   = require('async'),
    fs      = require('fs');


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
                tracks.forEach(function (track) {
                    this.add(track, undefined, true);
                }.bind(this));
                this.emit("change");
                if (noSave) {
                    resolve();
                } else {
                    this.save().then(resolve);
                }
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
        if (this.shuffled) {
            this.shuffle(noEvent);
        } else if (!noEvent) {
            this.emit("change")
        }
        resolve();
    },
    clear: function (noEvent) {
        this.tracks = [];
        this.played = [];
        this.spotify.player.stop();
        !noEvent && this.emit("change");
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
        return this.getCurrentTrack();
    },
    previous: function () {
        this.tracks.unshift(this.played.pop());
        this.emit("change")
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
        !noEvent && this.emit("change")
    },
    getJson: function () {
        return {
            shuffled: this.shuffled,
            repeat: this.repeat,
            tracks: this.tracks.map(function (val) {
                return val.link;
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
    },
    setRepeat: function (repeat) {
        this.repeat = repeat;
        this.emit("change");
    },
    remove: function (index, url) {
        if (this.tracks[index].link == url) {
            //Remove the track
            this.tracks.splice(index, 1);
        }
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
                        me.addTracks(data.tracks, true).then(function () {
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