var spotifyApi = new SpotifyWebApi();

$(function () {
    var socket = window.socket = io('/');
    socket.on('connect', function () {
        console.log("Connected to server");
    });
    socket.on("playState", function (playing) {
        console.log("playState", playing)
        $("footer .play").toggleClass("icon-control-play", !playing).toggleClass("icon-control-pause", !!playing);
    })

    socket.on("playQueue", function (queue) {
        $(".shuffle-button").toggleClass("active", queue.shuffled)

        if (queue.tracks.length > 0) {
            spotifyApi.getTracks(queue.tracks.map(function (val) {
                return val.split(":").pop();
            })).then(function (result) {
                var $ul = $(".play-queue ul").html("");
                result.tracks.forEach(function (track) {
                    $ul.append('<li><span class="title">' + track.name + '</span><span class="artist">' + track.artists[0].name + '</span><i class="remove-track">X</i></li>');
                })
            })
        } else {
            $(".play-queue ul").html("")
        }
    });

    socket.on("volume", function (volume) {
        $("footer .volume").val(volume);
    })

    $("body").on("click", ".shuffle-button", function () {
        socket.emit("toggleShuffle");
    })

    //spotify.setAccessToken("da9d271f3e4e48018e05e9e2ff151e41");

    $("body").on("click", "[data-nav]", function () {
        navigateTo($(this).attr("data-nav"));
        return false;
    })
    $("footer").on("click", ".play", function () {
        if ($(this).is(".icon-control-play")) {
            socket.emit("play");
        } else {
            socket.emit("pause");
        }
        return false;
    })
    $("footer").on("click", ".next", function () {
        socket.emit("skip");
        return false;
    })
    $("footer").on("input", ".volume", throttle(function () {
        socket.emit("setVolume", parseInt($(this).val()));
    }, 250));
})

function navigateTo(url) {
    $("main").html("");
    if (url == "browse") {
        spotifyApi.getFeaturedPlaylists({}, function (err, data) {
            console.log(data);
        });
    } else {

    }
}

function throttle(fn, threshhold, scope) {
    threshhold || (threshhold = 250);
    var last,
        deferTimer;
    return function () {
        var context = scope || this;

        var now = +new Date,
            args = arguments;
        if (last && now < last + threshhold) {
            // hold on to it
            clearTimeout(deferTimer);
            deferTimer = setTimeout(function () {
                last = now;
                fn.apply(context, args);
            }, threshhold);
        } else {
            last = now;
            fn.apply(context, args);
        }
    };
}