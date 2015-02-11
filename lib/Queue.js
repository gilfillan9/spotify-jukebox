var events  = require('events'),
    Promise = require('promise');


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
}

Queue.prototype = {
    add: function (track, index) {
        return new Promise(function (resolve) {
            if ("string" === typeof track) track = this.spotify.createFromLink(track);
            if (!track.isLoaded) {
                this.spotify.waitForLoaded([track], function () {
                    this._add(track, index, resolve);
                }.bind(this))
            } else {
                this._add(track, index, resolve);
            }
        }.bind(this));
    },
    _add: function (track, index, resolve) {
        if ("undefined" !== typeof index) {
            this.tracks.splice(index, 0, track);
        } else {
            this.tracks.push(track);
        }
        console.log("Added track %s - %s", track.artists[0].name, track.name);
        if (this.shuffled) {
            this.shuffle();
        } else {
            this.emit("change")
        }
        resolve();
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
    shuffle: function () {
        this.shuffled = true;
        if (this.tracks.length <= 1) {
            this.emit("change"); //Some functions rely on the fact this emits an event
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
        this.emit("change")
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
    }
}

Queue.prototype.__proto__ = events.EventEmitter.prototype;


module.exports = Queue;