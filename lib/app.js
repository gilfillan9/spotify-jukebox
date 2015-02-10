console.log("Starting...")

var Queue   = new require("./Queue"),
    express = require("express"), app = express(),
    server  = require("http").Server(app),
    io      = require("socket.io")(server),
    spotify = require('spotify')({
        appkeyFile: "./spotify_appkey.key"
    });
;

console.log("Loaded modules")

var queue, spotify, currentTrack;

// Spotify credentials...
var username = "gilfillan9";
var password = "***REMOVED***";

spotify.on({
    ready: function () {
        console.log("Logged in!");

        queue = new Queue(spotify);

        spotify.player.endOfTrack = playNextTrack;

        server.listen(80);
        console.log("Started on port 80");

        app.use(express.static(__dirname + "/public"));

        io.on('connection', function (socket) {
            socket.on("pause", function () {
                try {
                    spotify.player.pause();
                } catch (e) {
                }
            });
            socket.on("play", function () {
                try {
                    spotify.player.resume();
                } catch (e) {
                }
            });
            socket.on("playTrack", function (trackURI) {
                playTrack(trackURI);
            })
        });
    }
});
console.log("Logging into spotify")

spotify.login(username, password)

function playNextTrack() {
    playTrack(queue.next());
}
function playTrack(track) {
    if (!track) return;

    if ("string" === typeof track) track = spotify.createFromLink(track)
    spotify.player.stop();
    spotify.waitForLoaded([track], function () {
        currentTrack = track;
        console.log('Playing: %s - %s', track.artists[0].name, track.name);
        spotify.player.play(track);
    })
}

