var events  = require('events'),
    Promise = require('promise');


function Queue(spotify) {
    this.spotify = spotify;
    this.tracks = [];
    this.played = [];
    this.shuffled = false;
    events.EventEmitter.call(this);
}

Queue.prototype = {
    add: function (track, index) {
        return new Promise(function (resolve) {
            if ("string" === typeof track) track = this.spotify.createFromLink(track);
            this.spotify.waitForLoaded([track], function () {
                if ("undefined" !== typeof index) {
                    this.tracks.splice(index, 0, track);
                } else {
                    this.tracks.push(track);
                }
                if (this.shuffled) {
                    this.shuffle();
                } else {
                    this.emit("change")
                }
                resolve();
            }.bind(this))
        }.bind(this));
    },
    getCurrentTrack: function () {
        return this.tracks.length > 0 ? this.tracks[0] : null;
    },
    /**
     * Returns shifts the current tail of the queue and returns the next item
     * @returns {Track}
     */
    next: function () {
        this.played.push(this.tracks.shift());
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
        if (this.tracks.length <= 1)
            return;

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
        if (on) this.shuffle();
    }
}

Queue.prototype.__proto__ = events.EventEmitter.prototype;


module.exports = Queue;