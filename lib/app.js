console.log("Starting...")

var Queue    = new require("./Queue"),
    express  = require("express"), app = express(),
    server   = require("http").Server(app),
    io       = require("socket.io")(server),
    spotify  = require('spotify')({
        appkeyFile: "./spotify_appkey.key"
    }),
    loudness = require('loudness');

console.log("Loaded modules")

var queue, spotify, currentTrack;
var playing = false;

// Spotify credentials...
var username = "gilfillan9";
var password = "***REMOVED***";

spotify.on({
    ready: function () {
        console.log("Logged in!");

        queue = new Queue(spotify);

        spotify.player.on({endOfTrack: playNextTrack});

        server.listen(80);
        console.log("Started on port 80");

        app.use(express.static(__dirname + "/public"));

        io.on('connection', function (socket) {
            socket.on("pause", function () {
                console.log("pause")
                spotify.player.pause();
                playing = false;
                io.emit("playState", playing)
            });
            socket.on("play", function () {
                console.log("play")
                if (!currentTrack) {
                    playNextTrack();
                } else {
                    spotify.player.resume();
                    playing = true;
                    io.emit("playState", playing)
                }
            });
            socket.on("skip", function () {
                playNextTrack();
            });
            socket.on("addTrack", function (trackURI) {
                console.log("addTrack", trackURI)
                queue.add(trackURI).then(function () {
                    if (queue.getTracks().length == 1) playTrack(queue.getCurrentTrack())
                });
            })
            socket.on("addTracks", function (tracks) {
                console.log("addTracks", tracks)
                tracks.forEach(function(track){
                    queue.add(track).then(function () {
                        if (queue.getTracks().length == 1) playTrack(queue.getCurrentTrack())
                    });
                })
            })
            socket.on("getQueue", function () {
                socket.emit("playQueue", queue.getJson())
            })
            socket.on("toggleShuffle", function (on) {
                queue.toggleShuffle(on);
            })
            socket.on("setVolume", function (volume) {
                loudness.setVolume(volume, function (err) {
                });
                io.emit("volume", volume);
            })
            socket.emit("playQueue", queue.getJson())
            socket.emit("playState", playing)
        });

        queue.on("change", function () {
            io.emit("playQueue", queue.getJson())
        })
    }
});
console.log("Logging into spotify")

spotify.login(username, password)

function playNextTrack() {
    playTrack(queue.next());
}
function playTrack(track) {
    currentTrack = track;
    if (!track) {
        spotify.player.stop();
        playing = false;
        io.emit("playState", playing)
        return;
    }

    if ("string" === typeof track) track = spotify.createFromLink(track)
    spotify.player.stop();
    if (track.isLoaded) {
        console.log('Playing: %s - %s', track.artists[0].name, track.name);
        spotify.player.play(track);
        playing = true;
        io.emit("playState", playing)
    } else {
        spotify.waitForLoaded([track], function () {
            playTrack(track);
        })
    }
}

