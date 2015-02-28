var events = require('events');

function Player(player, queue) {
    this.player = player;
    this.isPlaying = false;
    this.queue = queue;

    events.EventEmitter.call(this);

    queue.on("change", function () {
        var newTrack = queue.getCurrentTrack()
        if (newTrack != this.currentTrack) {
            if (newTrack == null) {
                this.stop();
                this.currentTrack = null;
                this.changedCurrent();
            } else {
                this.playTrack(newTrack);
            }
        }
    }.bind(this));
}

Player.prototype = {
    playTrack: function (track) {
        this.player.stop();
        this.queue.loadTrack(track).then(function (track) {
            if ("undefined" === typeof track) {
                this.isPlaying = false;
                this.emit("playState", this.isPlaying)
                this.changedCurrent();
                this.stop();
                return;
            }
            try {
                this.currentTrack = track;
                console.log('Playing: %s - %s', track.artists[0].name, track.name);
                this.player.play(track);
                this.isPlaying = true;
                this.emit("playState", this.isPlaying)
                this.changedCurrent();
            } catch (e) {
                console.error(e);
                this.emit("playError", {e: e, track: this.getCurrentTrack()});
                this.queue.next();
            }
        }.bind(this));
    },
    getPlayingTrack: function () {
        return this.currentTrack;
    },
    play: function () {
        this.resume();
        this.isPlaying = true;
        this.emit("playState", this.isPlaying)
    },
    pause: function () {
        this.player.pause();
        this.isPlaying = false;
        this.emit("playState", this.isPlaying)
    },
    resume: function () {
        this.player.resume();
        this.isPlaying = false;
        this.emit("playState", this.isPlaying)
    },
    stop: function () {
        this.player.seek(0);
        this.player.stop();
        this.currentTrack = null;
        this.isPlaying = false;
        this.emit("playState", this.isPlaying)
    },
    changedCurrent: function () {
        this.emit("changedCurrent", this.getPlayingTrack() == null ? null : this.getPlayingTrack().getJson());
    }
}

Player.prototype.__proto__ = events.EventEmitter.prototype;

module.exports = Player;