var spotifyApi = new SpotifyWebApi()

var queue;
var currentTrack;
var trackCache = {};
var loaded = false;
var ourIp;

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

        socket.on("ip", function (ip) {
            ourIp = ip;
        });

        socket.on("playQueue", function (_queue) {
            queue = _queue;
            localStorage.setItem("queue", queue); //Save queue (saves from crashes!)
            console.log("queue", queue);
            $(".shuffle-button").toggleClass("active", queue.shuffled)
            $(".loop-button").toggleClass("repeat-single", queue.repeat == 1).toggleClass("repeat-all ", queue.repeat == 2)

            if (queue.tracks.length > 0) {
                var tracks = queue.tracks;
                var uncachedTracks = tracks.filter(function (track) {
                    return "undefined" == typeof trackCache[track]
                })
                var tracksSplit = [];
                var i, chunk = 10;
                for (i = 0; i < uncachedTracks.length; i += chunk) {
                    uncachedTracks.slice(i, i + chunk);
                    tracksSplit.push(uncachedTracks.slice(i, i + chunk).map(function (val) {
                        return val.id;
                    }));
                }
                async.each(tracksSplit, function (item, cb) {
                    spotifyApi.getTracks(item).then(function (result) {
                        result.tracks.forEach(function (track) {
                            trackCache[track.id] = track;
                        });
                        cb();
                    })
                }, function () {
                    tracks = queue.tracks = queue.tracks.map(function (track) {
                        var _track = $.extend({}, trackCache[track.id]); //Make a copy;
                        _track.votes = track.votes;
                        _track.uuid = track.uuid;
                        _track.votesIps = track.votesIps;
                        _track.vote = "undefined" == typeof track.votesIps[ourIp] ? 0 : track.votesIps[ourIp]
                        _track.votedUp = _track.vote == 1;
                        _track.votedDown = _track.vote == -1;
                        return _track;
                    });
                    setTimeout(function(){
                        $(".play-queue").html(templates.playQueue({
                            tracks: queue.tracks
                        }));
                    }, 100)
                });
            } else {
                $(".play-queue ul").html("")
            }
        });
        socket.on("changedCurrent", function (track) {
            if (!track) return;
            var id = track.link.split(":")[2];
            if ("undefined" !== typeof trackCache[id]) {
                changedCurrent(trackCache[id]);
            } else {
                spotifyApi.getTrack(id).then(function (_track) {
                    trackCache[id] = _track;
                    changedCurrent(_track);
                });
            }
        });

        socket.on("seek", function (time) {
            $(".duration-slider").val(time);
            $("footer .current-time").text(formatDuration(time * 1000));
        })

        socket.on("volume", function (volume) {
            volume = Math.pow(volume / 21.5, 3);
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
        socket.on("error", function (message) {
            //TODO add a nice box
            alert(message);
        });

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
            var val = parseInt($(this).val());
            socket.emit("setVolume", Math.pow(val, 1 / 3) * 21.5);
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
        $("body").on("click", "[data-uri][data-action]", function () {
            if ($(".search-content").hasClass("fadein")) $(".search-content").removeClass("show fadein")
            $(".track-popup").remove();

            handleAction($(this).attr("data-action"), $(this).attr("data-uri"))
        })
        $("body").on("dblclick", "[data-uri][data-double-action]", function () {
            $(".track-popup").remove();
            handleAction($(this).attr("data-double-action"), $(this).attr("data-uri"))
            return false;
        })
        $("body").on("mousedown", "[data-uri][data-double-action]", function (e) {
            if (e.which == 1) return false;
        })
        $("body").on("click", ".phone-call", function () {
            socket.emit("phone");
            return false;
        })
        $("body").on("click", "aside.play-queue .vote-buttons button", function () {
            socket.emit("vote", {uuid: $(this).parents("li").attr("data-uuid"), up: $(this).is(".up")})
            return false;
        })
        $("body").on("keypress", function (e) {
            var $target = $(e.target);
            if ($target.is("input,textarea,button,select")) return true;
            if (e.which == 32) { //Space
                $("button.play").click();
            }
        })
        $("#play-queue").on("mouseenter", "li", function (e) {
            if ($(".track-popup[data-uuid='" + $(this).attr("data-uuid") + "']").length != 0) return;
            $(this).data("timeout", setTimeout(function () {
                var $popup = $(templates.trackPopup(trackCache[$(this).attr("data-id")]));
                $popup.attr("data-uuid", $(this).attr("data-uuid"));
                $popup.find("img").on("load", function () {
                    $("body").append($popup);
                    $popup.css("top", Math.max(0, Math.min(
                        $(window).height() - $popup.height(),
                        e.pageY - 50
                    )))
                })
            }.bind(this), 500))
        });
        $("#play-queue").on("mouseleave", "li", function (e) {
            clearTimeout($(this).data("timeout"));
            var $popup = $(".track-popup[data-uuid='" + $(this).attr("data-uuid") + "']");
            var $to = $(e.toElement);
            try {
                if (!$.contains($popup[0], $to[0]) && $popup[0] != $to[0])
                    $popup.remove();
            } catch (e) {
            }
        });
        $("body").on("mouseleave", ".track-popup", function (e) {
            var $to = $(e.toElement);
            if ($to.is("#play-queue li[data-uuid]") && $to.attr("data-uuid") == $(this).attr("data-uuid")) {
                return false;
            }
            $(this).remove();
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

function changedCurrent(track) {
    currentTrack = track;
    $(".duration-slider").attr("max", Math.round(track.duration_ms / 1000))
    if (currentPage == "nowPlaying") navigateTo(currentPage); //Refresh the now playing page
    $("footer .length").text(formatDuration(track.duration_ms));
	$("#song-name").text(track.name + ' - ' + track.artists[0][name]);


}

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
                var alreadyIn = false;
                queue.tracks.forEach(function (track) {
                    if (track.uri == uri) alreadyIn = true;
                })
                if (!alreadyIn || confirm("This track is already in the queue, do you want to add it again?"))
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
            case "category":
                navigateTo("viewCategory", {id: uri.split(":")[2]});
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
            $(".search-content").html(templates.searchPage({
                albums: results.albums.items
            }));
        })
    } else if (searchPage == "artist") {
        spotifyApi.searchArtists(val).then(function (results) {
            $(".search-content").html(templates.searchPage({
                artists: results.artists.items
            }));
        })
    } else if (searchPage == "playlist") {
        spotifyApi.searchPlaylists(val).then(function (results) {
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
        name:     name,
        fn:       fn,
        template: template
    }
}

var pages = {};
var templates = {};
var currentPage;


function formatDuration(ms) {
    var totalSeconds = Math.round(ms / 1000);
    var seconds = totalSeconds % 60;
    var minutes = Math.floor(totalSeconds / 60) % 60;
    var hours = Math.floor(totalSeconds / (60 * 60));

    return (hours > 0 ? hours + ":" : "") + padString(minutes, 2) + ":" + padString(seconds, 2);
}
function loadTemplates(cb) {
    Handlebars.registerHelper("duration", formatDuration)
    $.getJSON("/templates.json").then(function (data) {
        async.parallel([
            function (cb) {
                async.map(data.templates, function (name, cb) {
                    $.get("/templates/" + name + ".hbs").then(function (data) {
                        templates[name] = Handlebars.compile(data);
                        console.log("Compiled %s", name)
                        cb();
                    })
                }, cb)
            },
            function (cb) {
                async.map(data.partials, function (name, cb) {
                    $.get("/templates/partials/" + name + ".hbs").then(function (data) {
                        Handlebars.registerPartial(name, data);
                        console.log("Compiled fragment %s", name)
                        cb();
                    })
                }, cb)
            }], cb);
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