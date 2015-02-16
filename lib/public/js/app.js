var spotifyApi = new SpotifyWebApi(), queue;

var trackCache = {};
var loaded = false;

var searchPage;

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
        $("body").on("focus", ".search", function () {
            if ($(this).hasClass("show")) return;
            $(".search-content").html(templates.searchPage({
                emptySearch: true
            })).addClass("show");

            if ($(".search").val() != "") {
                doSearch($(".search").val());
            } else {
                searchPage = "track";
            }

            setTimeout(function () {
                $(".search-content").addClass("fadein");
            })
        });
        $("body").on("blur", ".search", function () {
            if ($(this).val() != "") return;
            $(".search-content").removeClass("fadein");
            setTimeout(function () {
                $(".search-content").removeClass("show");
            }, 500)
        });
        $("body").on("change keypress", ".search", _.debounce(function () {
            doSearch($(this).val());
        }, 1000))

        $("body").on("click", ".search-tabs .search-tab", function () {
            searchPage = $(this).attr("data-tab");
            doSearch($(".search").val())
            return false;
        })

        $("body").on("dblclick", "[data-uri][data-double-action]", function () {
            handleAction($(this).attr("data-double-action"), $(this).attr("data-uri"))
            return false;
        })
        $("body").on("mousedown", "[data-uri][data-double-action]", function () {
            return false;
        })
        $("body").on("click", "[data-uri][data-action]", function () {
            if ($(".search-content").hasClass("fadein")) {
                $(".search-content").removeClass("show fadein")
            }
            handleAction($(this).attr("data-action"), $(this).attr("data-uri"))
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

function handleAction(action, uri) {
    var split = action.split("|");
    if (split.length == 2) {
        if (split[0] == "clear") socket.emit("clearQueue");
        action = split[split.length - 1];
    }

    var type = uri.split(":")[1];
    if (type == "user") type = "playlist"; //Assuming we're not going to use playlists

    if (action == "add") {
        switch (type) {
            case "artist":
                //Wat
                break;
            case "album":
                socket.emit("addAlbum", uri); //TODO add this
                break;
            case "track":
                socket.emit("addTrack", uri);
                break;
            case "playlist":
                socket.emit("addPlaylist", uri);
                break;
        }
    } else if (action == "view") {
        switch (type) {
            case "artist":
                navigateTo("viewArtist", {uri: uri});
                break;
            case "album":
                navigateTo("viewAlbum", {uri: uri});
                break;
            case "track":
                navigateTo("viewTrack", {uri: uri});
                break;
            case "playlist":
                navigateTo("viewPlaylist", {uri: uri});
                break;
        }
    }
}

function doSearch(val) {
    if (val.length < 2) {
        $(".search-content").html(templates.searchPage({emptySearch: true}));
        return;
    } else {
        $(".search-content").html(templates.searchPage({
            loading: true
        }));
    }
    if (searchPage == "track") {
        spotifyApi.searchTracks(val).then(function (results) {
            $(".search-content").html(templates.searchPage({
                tracks: results.tracks.items
            }));
        });
    } else if (searchPage == "album") {
        spotifyApi.searchAlbums(val).then(function (results) {
            console.log(results);
            $(".search-content").html(templates.searchPage({
                albums: results.albums.items
            }));
        })
    } else if (searchPage == "artist") {
        spotifyApi.searchArtists(val).then(function (results) {
            console.log(results);
            $(".search-content").html(templates.searchPage({
                artists: results.artists.items
            }));
        })
    } else if (searchPage == "playlist") {
        spotifyApi.searchPlaylists(val).then(function (results) {
            console.log(results);
            $(".search-content").html(templates.searchPage({
                playlists: results.playlists.items
            }));
        })
    }
}

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

    var page = pages[_page];
    if ("undefined" == typeof page) {
        console.log("Invalid page: %s", _page);
        return;
    }
    $("main").html("<div class='loader'><span>Loading...</span><div class='spinner'></div></div>");
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
    Handlebars.registerHelper("duration", function (ms) {
        var totalSeconds = Math.round(ms / 1000);
        var seconds = totalSeconds % 60;
        var minutes = Math.floor(totalSeconds / 60) % 60;
        var hours = Math.floor(totalSeconds / (60 * 60));

        return (hours > 0 ? hours + ":" : "") + padString(minutes, 2) + ":" + padString(seconds, 2);
    })
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

function padString(value, width, padWith) {
    padWith = padWith || '0';
    value = '' + value;
    return value.length >= width ? value : new Array(width - value.length + 1).join(padWith) + value;
}

function loadPages(cb) {
    $.getJSON("/pages.json").then(function (pages) {
        async.map(pages, function (name, cb) {
            $.getScript("/js/pages/" + name).then(function () {
                setTimeout(cb);
            });
        }, cb)
    });
}