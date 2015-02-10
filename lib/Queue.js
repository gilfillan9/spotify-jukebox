var events = require('events');


function Queue(spotify) {
    this.spotify = spotify;
    this.tracks = [];
    this.played = [];
    this.shuffled = false;
    events.EventEmitter.call(this);
}

Queue.prototype = {
    add: function (track, index) {
        if ("undefined" !== typeof index) {
            this.tracks.splice(index, 0, track);
        } else {
            this.tracks.push(track, index);
        }
        if (this.shuffled) {
            this.shuffle();
        } else {
            this.emit("changed")
        }
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
        this.emit("changed")
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
        this.emit("changed")
    }
}

Queue.prototype.__proto__ = events.EventEmitter.prototype;


module.exports = Queue;