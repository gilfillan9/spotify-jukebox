var spotifyApi = new SpotifyWebApi(), queue;

var trackCache = {};

$(function () {
    async.series([loadTemplates, loadPages], function () {
        console.log("Connecting...")
        var socket = window.socket = io('/');
        socket.on('connect', function () {
            console.log("Connected to server");
        });
        socket.on("playState", function (playing) {
            console.log("playState", playing)
            $("footer .play").toggleClass("icon-control-play", !playing).toggleClass("icon-control-pause", !!playing);
        })

        socket.on("playQueue", function (_queue) {
            queue = _queue;
            localStorage.setItem("queue", queue); //Save queue (saves from crashes!)
            console.log(queue);
            $(".shuffle-button").toggleClass("active", queue.shuffled)
            $(".loop-button").toggleClass("repeat-single", queue.repeat == 1).toggleClass("repeat-all ", queue.repeat == 2)

            if (queue.tracks.length > 0) {
                var tracks = queue.tracks.map(function (val) {
                    return val.split(":").pop();
                });
                var uncachedTracks = tracks.filter(function (track) {
                    return "undefined" == typeof trackCache[track]
                })
                var tracksSplit = [];
                var i, chunk = 10;
                for (i = 0; i < uncachedTracks.length; i += chunk) {
                    tracksSplit.push(uncachedTracks.slice(i, i + chunk));
                }
                async.each(tracksSplit, function (item, cb) {
                    spotifyApi.getTracks(item).then(function (result) {
                        result.tracks.forEach(function (track) {
                            trackCache[track.id] = track;
                        });
                        cb();
                    })
                }, function () {
                    tracks = queue.tracks = tracks.map(function (id) {
                        return trackCache[id];
                    });
                    $(".play-queue").html(templates.playQueue({
                        tracks: tracks
                    }));
                    $("body").removeClass("loading");
                    setTimeout(function () {
                        $("body").removeClass("showLoader");
                    }, 500)
                    if (currentPage == "nowPlaying") {
                        navigateTo(currentPage);
                    }
                });
            } else {
                $("body").removeClass("loading");
                setTimeout(function () {
                    $("body").removeClass("showLoader");
                }, 500)
                $(".play-queue ul").html("")
            }
        });

        socket.on("seek", function (time) {
            $(".duration-slider").val(time);
        })

        socket.on("volume", function (volume) {
            $("footer .volume").val(volume);
        })

        socket.on("accessToken", function (accessToken) {
            spotifyApi.setAccessToken(accessToken);
        })


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
                $("main").html(templates.trackList({
                    class: "search-results",
                    tracks: results.tracks.items
                }));
            });
        }, 1000))

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
})

function navigateTo(page) {
    $("main").html("");
    var page = pages[page];
    if ("undefined" == typeof page) return;
    currentPage = page.name;
    page.fn().then(function (data) {
        $("main").html(page.template(data));
    })
}

function registerPage(name, fn, template) {
    pages[name] = {
        name: name,
        fn: fn,
        template: template
    }
}

var pages = {};
var templates = {};
var currentPage;

function loadTemplates(cb) {
    $.getJSON("/templates.json").then(function (templatesNames) {
        async.map(templatesNames, function (name, cb) {
            $.get("/templates/" + name + ".hbs").then(function (data) {
                templates[name] = Handlebars.compile(data);
                console.log("Compiled %s", name)
                cb();
            })
        }, cb)
    });
}

function loadPages(cb) {
    $.getJSON("/pages.json").then(function (pages) {
        async.map(pages, function (name, cb) {
            $.getScript("/js/pages/" + name).then(cb);
        }, cb)
    });
}