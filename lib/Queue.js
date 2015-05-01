var events = require('events'),
    Promise = require('promise'),
    async = require('async'),
    fs = require('fs'),
    uuid = require("node-uuid");


function Queue(spotify) {
    this.spotify = spotify;
    this.tracks = [];
    this.played = [];
    this.shuffled = false;

    events.EventEmitter.call(this);

    this.load();

    this.on("change", function () {
        this.changed = true;
        this.tracks = this.tracks.filter(function (val) {
            return !!val;
        })
    }.bind(this))
}

Queue.prototype = {
    /**
     * Loads the item of the provided uri or object
     * @param item
     * @returns {Promise}
     */
    loadItem: function (item) {
        return new Promise(function (resolve) {
            if ("undefined" === typeof item) {
                resolve(item);
                return;
            }
            if ("string" === typeof item) item = this.spotify.createFromLink(item);
            if (!item.isLoaded) {
                this.spotify.waitForLoaded([item], function () {
                    resolve(item)
                }.bind(this))
            } else {
                resolve(item)
            }
        }.bind(this));
    },
    /**
     * Adds the tracks to the queue (making sure to load them first)
     * @param Array tracks
     * @returns {Promise}
     */
    add: function (tracks, source) {
        return new Promise(function (resolve) {
            //if the queue was empty shuffle it completely;
            var newQueue = this.tracks.length == 0;
            //Load all the tracks provided
            async.map(tracks, function (track, cb) {
                this.loadItem(track).then(function (track) {
                    cb(undefined, track);
                });
            }.bind(this), function (err, tracks) {
                tracks.forEach(function (track) {
                    if (this._initializeTrack(track, source)) {
                        this.tracks.push(track);
                    }
                }.bind(this));

                this.changeAndShuffle(newQueue);
                resolve(tracks);
            }.bind(this))
        }.bind(this));
    },
    /**
     * Add the passed track (single) into the playQueue as the next track to play
     * @param track
     */
    addNext: function (track, source) {
        return new Promise(function (resolve, reject) {
            this.loadItem(track).then(function (track) {
                if (this._initializeTrack(track, source, true)) {
                    this.tracks.splice(1, 0, track); //Add to the queue as the second element
                    this.changeAndShuffle();
                    resolve(track);
                } else {
                    reject(track);
                }
            }.bind(this));
        }.bind(this));
    },
    _initializeTrack: function (track, source, forcedTop) {
        if (track.availability !== 1) {
            this.emit("error", {message: "Track isn't currently available for streaming", track: track})
            return false;
        }
        //Once all the tracks are loaded loop through and add them to the queue
        console.log("Added track %s - %s", track.artists[0].name, track.name);
        //Set the default (votes, new uuid, etc)
        track.source = !source ? track.link : source;
        track.votes = 0;
        track.votesIps = {};
        track.uuid = uuid.v4();
        track.forcedTop = forcedTop === true;  //Cast to boolean (e.g from falsey to false)
        track.getJson = function () {
            return {
                link: this.link,
                votes: this.votes,
                id: this.link.split(":").pop(),
                uuid: this.uuid,
                votesIps: this.votesIps,
                source: this.source,
                forcedTop: this.forcedTop
            };
        }.bind(track)
        return true;
    },
    /**
     * Get the track for the provided UUID
     * @param uuid
     * @returns {*}
     */
    get: function (uuid) {
        var track = undefined;
        this.tracks.forEach(function (val) {
            if (val.uuid === uuid) {
                track = val;
                return false; //End the loop
            }
            return true; // Continue the loop
        });
        return track;
    },
    /**
     * Clears the current queue and history
     * @param noEvent
     */
    clear: function (noEvent) {
        //Clear the current queue and the array of played tracks
        this.tracks = [];
        this.played = [];
        //Only emit the event when noEvent is falsey (false or undefined)
        !noEvent && this.emit("change");
    },
    /**
     * Get the track at the head of the queue
     * @returns {*}
     */
    getCurrentTrack: function () {
        //Return the head of the queue or null if the queue is empty
        return this.tracks.length > 0 ? this.tracks[0] : null;
    },
    /**
     * Proceed onto the next track of the queue
     * @returns {*}
     */
    next: function () {
        //Proceed onto the next track
        this.played.push(this.tracks.shift());
        //Emit the change event to notify clients
        this.emit("change")
        //Return the new head of the queue
        return this.getCurrentTrack();
    },
    /**
     *  Takes the head of the history and adds it to the head of the queue
     * @returns {Track}
     */
    previous: function () {
        if (this.played.length == 0) {
            //If the history is empty just seek to 0 seconds and return the current head
            this.spotify.player.seek(0);
            return this.getCurrentTrack();
            //Notice no change event was called here as the queue didn't actually change
        }
        //Add the tail of the history to the head of the queue
        this.tracks.unshift(this.played.pop());
        //Notify the clients
        this.emit("change")
        //Return the new current track
        return this.getCurrentTrack();
    },
    /**
     * Returns the current queue of tracks
     * @returns {Array}
     */
    getTracks: function () {
        return this.tracks;
    },
    /**
     * Returns the history of tracks (newest at the head)
     */
    getPlayed: function () {
        this.played;
    },
    /**
     * Shuffles the current track queue using the 'Fisher-Yates Shuffle' (https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle)
     * @param noPreserverHead if falsey the two top tracks remain where they are
     */
    shuffle: function (noPreserverHead) {
        //Make sure to set shuffled to tru
        this.shuffled = true;
        if (!noPreserverHead) {
            //If there isn't any point shuffling (two or fewer tracks and preserving the head)
            if (this.tracks.length <= 1) return;

            //Remove the two top tracks and store them for later
            var temp_tracks = [this.tracks.shift(), this.tracks.shift()]; //Maintain current track and next track
        }
        /****** Begin Fisher-Yates Shuffle ******/
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
        /****** End Fisher-Yates Shuffle ******/

        //If we're preserving the head restore the two top tracks
        if (!noPreserverHead) {
            this.tracks.unshift(temp_tracks.pop());
            this.tracks.unshift(temp_tracks.pop());
        }
    },
    /**
     * Sorts the tracks by the number of votes
     */
    sortByVotes: function () {
        if (this.tracks.length <= 1) return;

        var temp_tracks = [this.tracks.shift(), this.tracks.shift()]; //Maintain current track and next track
        this.tracks.forEach(function (track, index) {
            track.sortBy = this.shuffled ? ((Math.random() - 0.5) * 1.3 + track.votes) : track.votes - (index * 0.000001);
        }.bind(this));
        this.tracks.sort(function (a, b) {
            if (a.forcedTop) return -1; //Force a to the top
            if (b.forcedTop) return 1;//Force b to the top
            return b.sortBy - a.sortBy;
        })
        this.tracks.unshift(temp_tracks.pop());
        this.tracks.unshift(temp_tracks.pop());
    },
    /**
     * Returns a simple representation of the queue ready for sending to the client
     * @returns {{shuffled: *, tracks: (Array|*)}}
     */
    getJson: function () {
        return {
            shuffled: this.shuffled,
            tracks: this.tracks.map(function (val) {
                return val.getJson();
            }),
            played: this.played.map(function (val) {
                return val.getJson()
            })
        }
    },
    /**
     * Toggles shuffle on or off
     * @param on
     */
    toggleShuffle: function (on) {
        //If no argument is provided set on to be the opposite of shuffles current value (toggles)
        if ("undefined" === typeof on) on = !this.shuffled;
        //Set the new value
        this.shuffled = on;
        //Shuffle (if required) and update clients
        this.changeAndShuffle();
    },
    /**
     * Removes the track with the specified uuid (and index) from the queue and updates the clients
     * @param index
     * @param uuid
     */
    remove: function (index, uuid) {
        //Make sure it's the correct track we're removing (may have updated)
        if (this.tracks[index].uuid == uuid) {
            //Remove the track
            this.tracks.splice(index, 1);
        }
        //Notify the clients (may change this to shuffle too)
        this.emit("change");
    },
    /**
     * Vote on a track
     * @param uuid the track to vote on
     * @param up true if an up vote false if down
     * @param ip the ip this vote came from
     */
    vote: function (uuid, up, ip) {
        //Get the wanted track
        var track = this.get(uuid);
        //If it's invalid do nothing
        if ("undefined" === typeof track) {
            console.log("Invalid uuid: " + uuid);
            return;
        }
        //Change vote from boolean to int between 1 and -1
        var vote = up ? 1 : -1;
        //If current vote matches previous vote from this ip just set the vote to 0 (toggle the vote back off)
        track.votesIps[ip] = vote == track.votesIps[ip] ? 0 : vote;
        //Reset the vote and then loop through and calculate the total
        track.votes = 0;
        //Loop through the keys of the votes and sum up the total votes
        Object.keys(track.votesIps).forEach(function (key) {
            track.votes += track.votesIps[key];
        })
        //If there's a total of -2 or less remove the track from the queue
        if (track.votes <= -2) this.remove(this.tracks.indexOf(track), track.uuid);
        //Re-Shuffle and update the clients
        this.changeAndShuffle();

        this.emit("vote", {
            track: track,
            ip: ip,
            up: up
        })
    },
    /**
     * Reshuffle (if needed) and notify the clients of the update
     */
    changeAndShuffle: function (noPreserveHead) {
        //If the queue is shuffled reshuffle
        if (this.shuffled) this.shuffle(noPreserveHead);
        //Sort the queue by the number of votes
        this.sortByVotes();
        //Notify the clients
        this.emit("change");
    },
    /**
     *  Loads the queue from the queue.json file
     * @returns {Promise}
     */
    load: function () {
        var me = this;
        //Return a promise as it's done async
        return new Promise(function (resolve, reject) {
            //Read the json file containing the data
            fs.readFile("data/queue.json", function (err, data) {
                if (err) {
                    //If there was a problem reading the file (i.e permissions or missing the file) reject the promise
                    reject(err);
                } else {
                    try {
                        //Parse the data into an object
                        data = JSON.parse(data);
                        //Make sure the queue is empty (not sending an update)
                        me.clear(true);
                        //Set shuffled to false temporarily so as to retain the current order of the tracks
                        me.shuffled = false;
                        me.add(data.tracks.map(function (track) {
                            return track.link;
                        })).then(function (tracks) {
                            //Set the shuffle values to the loaded values
                            me.shuffled = data.shuffled;
                            tracks.forEach(function (track, index) {
                                var _track = data.tracks[index];
                                track.votes = _track.votes;
                                track.votesIps = _track.votesIps;
                                track.source = _track.source;
                                track.forcedTop = _track.forcedTop;
                            });
                            me.sortByVotes();
                            console.log("Loaded queue");
                            resolve();
                        });
                    } catch (e) {
                        //A problem (like an invalid track) so reject
                        reject(e);
                    }
                }
            })
        })
    },
    /**
     * Save the current queue to the queue.json file
     * @returns {Promise}
     */
    save: function () {
        var me = this;
        //Return a promise as it's done async
        return new Promise(function (resolve, reject) {
            //If the queue hasn't actually changed don't do anything (save io usage)
            if (!me.changed) {
                resolve();
                return;
            }
            me.changed = false;
            //Get the simplified data to save
            var data = me.getJson();

            //Write the actual data to file
            fs.writeFile("data/queue.json", JSON.stringify(data), function (err) {
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