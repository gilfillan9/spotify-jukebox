var spotifyApi = new SpotifyWebApi(), queue;

var trackCache = {};
var loaded = false;

$(function () {
    $.ajaxSetup({
        cache: true
    });
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
            console.log("queue", queue);
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
                    if (currentPage == "nowPlaying") {
                        navigateTo(currentPage);
                    }
                });
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

        socket.on("accessToken", function (accessToken) {
            spotifyApi.setAccessToken(accessToken);
            if (!loaded) {
                //Load the current page (or default)
                if (window.location.hash != "") {
                    navigateToPath(window.location.hash.slice(1), true);
                } else {
                    navigateTo("browse");
                }
                $("body").removeClass("loading");
                setTimeout(function () {
                    $("body").removeClass("showLoader");
                }, 500)
                loaded = true;
            }
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
                $("main").html(templates.searchPage({
                    tracks: results.tracks.items
                }));
            });
        }, 1000))

        $("body").on("click", "[data-uri][data-action]", function () {
            var action = $(this).attr("data-action");
            var uri = $(this).attr("data-uri");
            if (action == "play") {
                //TODO make more flexible
                socket.emit("addTrack", uri);
            } else if (action == "view") {
                //TODO show different things (albums, artists, etc)
                //For now assuming playlist
                navigateTo("viewPlaylist", {uri: uri});
            }
        })
        $("body").on("click", ".phone-call", function () {
            socket.emit("phone");
            return false;
        })

        $("body").on("keypress", function (e) {
            var $target = $(e.target);
            if ($target.is("input,textarea,button,select")) return true;
            if (e.which == 32) { //Space
                $("button.play").click();
            }
        })

        window.addEventListener("popstate", function (e) {
            if (e.state && e.state.page) {
                navigateTo(e.state.page, e.state.args, true);
            } else {
                navigateToPath(window.location.hash.slice(1), true);
            }
        })
    })
});

function navigateToPath(path, noPush) {
    var hashSplit = path.split("?");
    var args = undefined;
    if (hashSplit.length == 2) {
        var vars = hashSplit[1].split("&");
        var args = {};
        vars.forEach(function (val) {
            var split = val.split("=");
            args[decodeURIComponent(split[0])] = decodeURIComponent(split[1]);
        })
    }
    navigateTo(hashSplit[0], args, noPush);
}

function navigateTo(_page, args, noPush) {
    console.log("Loading page %s", _page, args);
    var samePage = _page == currentPage;
    $("main").html("");

    var page = pages[_page];
    if ("undefined" == typeof page) {
        console.log("Invalid page: %s", _page);
        return;
    }
    currentPage = page.name;

    page.fn(args).then(function (data) {
        $("main").html(page.template(data));
    })

    samePage || noPush || history.pushState({
        page: _page,
        args: args
    }, false, "#" + _page + ("undefined" != typeof args ? "?" + $.param(args) : ""));
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
    $.getJSON("/templates.json").then(function (data) {
        async.map(data.templates, function (name, cb) {
            $.get("/templates/" + name + ".hbs").then(function (data) {
                templates[name] = Handlebars.compile(data);
                console.log("Compiled %s", name)
                cb();
            })
        }, cb)
        async.map(data.partials, function (name, cb) {
            $.get("/templates/partials/" + name + ".hbs").then(function (data) {
                Handlebars.registerPartial(name, data);
                console.log("Compiled fragment %s", name)
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