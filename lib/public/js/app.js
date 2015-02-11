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
        console.log(queue);
        $(".shuffle-button").toggleClass("active", queue.shuffled)
        $(".loop-button").toggleClass("repeat-single", queue.repeat == 1).toggleClass("repeat-all ", queue.repeat == 2)

        if (queue.tracks.length > 0) {
            spotifyApi.getTracks(queue.tracks.map(function (val) {
                return val.split(":").pop();
            })).then(function (result) {
                var $ul = $(".play-queue ul").html("");
                result.tracks.forEach(function (track, index) {
                    if (index == 0) {
                        //Current track
                        $(".duration-slider").attr("max", Math.ceil(track.duration_ms / 1000));
                    }
                    $ul.append('<li><span class="title">' + track.name + '</span><span class="artist">' + track.artists[0].name + '</span></li>');
                });
            })
        } else {
            $(".play-queue ul").html("")
        }
    });

    socket.on("seek", function (time) {
        $(".duration-slider").val(time);
    })

    socket.on("volume", function (volume) {
        $("footer .volume").val(volume);
    })

    //spotify.setAccessToken("da9d271f3e4e48018e05e9e2ff151e41");

    $("body").on("click", "[data-nav]", function () {
        navigateTo($(this).attr("data-nav"));
        return false;
    });
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
    });
    $("footer").on("click", ".back", function () {
        socket.emit("skipBack");
        return false;
    })
    $("footer").on("change", ".volume", function () {
        socket.emit("setVolume", parseInt($(this).val()));
    });
    $("footer").on("click", ".shuffle-button", function () {
        socket.emit("toggleShuffle", !$(this).hasClass("active"));
    });
    $("footer").on("click", ".loop-button", function () {
        var repeat = 1;
        if ($(this).hasClass("repeat-single")) repeat = 2;
        if ($(this).hasClass("repeat-all")) repeat = 0;
        socket.emit("repeat", repeat);
    });

    $("body").on("change", ".duration-slider", function () {
        socket.emit("seek", parseInt($(this).val()));
    });
    $("body").on("change keypress", ".search", _.debounce(function () {
        spotifyApi.searchTracks($(this).val()).then(function (results) {
            $("main").html("<ul class='search-results'></ul>");
            $.each(results.tracks.items, function (_, track) {
                //TODO handlebars-ify
                $("main ul").append("<li data-uri='" + track.uri + "' data-action='play'><img src='" + track.album.images[2].url + "' />" + track.name + " <span class='artist'>" + track.artists[0].name + "</span></li>");
            });
        });
    }, 1000)) //TODO Should be debounce

    $("body").on("click", "[data-uri][data-action]", function () {
        if ($(this).attr("data-action") == "play") {
            //TODO make more flexible
            socket.emit("addTrack", $(this).attr("data-uri"));
        }
    })
    $("body").on("click", ".phone-call", function () {
        socket.emit("phone");
        return false;
    })
})

function navigateTo(url) {
    $("main").html("");
    if (url == "browse") {
        spotifyApi.getFeaturedPlaylists(function (err, data) {
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

function addPlaylist(url) {
    var split = url.split(":");
    spotifyApi.getPlaylistTracks(split[2], split[4]).then(function (tracks) {
        socket.emit("addTracks", tracks.map(function (val) {
            return val.uri;
        }))
    })
}