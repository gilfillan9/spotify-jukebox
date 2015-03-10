var events = require('events');

function Player(player, queue) {
    this.player = player;
    this.isPlaying = false;
    this.queue = queue;
    this.currentTrack = null;

    events.EventEmitter.call(this);

    queue.on("change", function () {
        var newTrack = queue.getCurrentTrack()
        console.log("Queue changed: ", newTrack, "Old track", this.currentTrack);
        if (newTrack != this.currentTrack) {
            if (newTrack == null) {
                //Queue is empty, so unload the current track and update
                this.stop();
                this.currentTrack = null;

                //Set play state to false and update clients
                this.setIsPlaying(false);
                this.changedCurrent();
            } else {
                //Play the new current track
                this.playTrack(newTrack);
            }
        }
    }.bind(this));
}

Player.prototype = {
    /**
     * Load the provided track into the player and start playing
     * @param track
     */
    playTrack: function (track) {
        //Unload the current track
        this.player.stop();
        //Make sure the next track is loaded
        this.queue.loadItem(track).then(function (track) {
            //If it's empty (invalid)
            if ("undefined" === typeof track || track == null) {
                console.log("undefined track", track);
                this.stop();
                return;
            }
            try {
                //Update the current track
                console.log('Playing: %s - %s', track.artists[0].name, track.name);
                //Load the track into the player
                this.player.play(track);
                this.currentTrack = track;

                //Update the current state
                this.setIsPlaying(true);
                this.changedCurrent();
            } catch (e) {
                console.log(e);
                this.emit("playError", {e: e, track: track});
                this.queue.next();
            }
        }.bind(this));
    },
    /**
     * Get the current loaded track
     * @returns {null|*}
     */
    getPlayingTrack: function () {
        return this.currentTrack;
    },
    /**
     * Resume playing the current track (or load a new one if not already playing a track)
     */
    play: function () {
        if (this.currentTrack === null) {
            this.playTrack(this.queue.getCurrentTrack());
        } else {
            this.player.resume();
            this.setIsPlaying(true);
        }
    },
    /**
     * Set the current playing state and notify the clients
     * @param Booleans isPlaying
     */
    setIsPlaying: function (isPlaying) {
        if (isPlaying != this.isPlaying) {
            this.isPlaying = isPlaying;
            this.emit("playState", this.isPlaying);
        }
    },
    /**
     * Pause the current track
     */
    pause: function () {
        this.player.pause();
        this.setIsPlaying(false);
    },
    /**
     * Unload the current track and notify the clients
     */
    stop: function () {
        this.player.seek(0);
        this.player.stop();
        this.currentTrack = null;
        this.changedCurrent();
        this.setIsPlaying(false);
    },
    /**
     * Notify the currently connected clients
     */
    changedCurrent: function () {
        this.emit("changedCurrent", this.getCurrentTrackJson());
    },
    getCurrentTrackJson: function () {
        return this.getPlayingTrack() == null ? null : this.getPlayingTrack().getJson();
    }
}

Player.prototype.__proto__ = events.EventEmitter.prototype;

module.exports = Player;