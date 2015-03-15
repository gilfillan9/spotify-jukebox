var spotifyApi = new SpotifyWebApi()

var queue;
var currentTrack;
var trackCache = {};
var loaded = false;
var ourIp;
var notificationsAllowed = false;

var searchPage;

$(function () {
    if (localStorage.getItem("queue") != null)  localStorage.setItem("oldQueue", localStorage.getItem("queue"));

    $.ajaxSetup({
        cache: true
    });
    async.series([loadTemplates, loadPages], function () {
        console.log("Connecting...")
        var socket = window.socket = io('ws://' + window.location.hostname + "/", {transports: ['websocket']});
        socket.on('connect', function () {
            console.log("Connected to server");
        });
        socket.on("reconnect", function () {
            console.log("Reconnected");
            $("body").removeClass("disconnected")
        })
        socket.on("disconnect", function () {
            console.error("Disconnected");
            $("body").addClass("disconnected")
        })

        socket.on("playState", function (playing) {
            console.log("playState", playing)
            $("footer .play").toggleClass("icon-control-play", !playing).toggleClass("icon-control-pause", !!playing);
        })

        socket.on("ip", function (ip) {
            ourIp = ip;
        });

        socket.on("playQueue", function (_queue) {
            queue = _queue;
            localStorage.setItem("queue", JSON.stringify(queue)); //Save queue (saves from crashes!)
            $(".shuffle-button").toggleClass("active", queue.shuffled)

            if (queue.tracks.length > 0) {
                getTracks(queue.tracks).then(function (tracks) {
                    queue.tracks = tracks;
                    $(".play-queue").html(templates.playQueue({
                        tracks: tracks
                    }));
                    doneLoaded();
                })
            } else {
                doneLoaded();
                $(".play-queue ul").html("")
            }
        });
        socket.on("changedCurrent", function (track) {
            if (!track) {
                changedCurrent(track);
                return;
            }
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
        socket.on("isPhone", function (isPhone) {
            $(".phone-call-on").toggleClass("active", isPhone);
        })

        socket.on("accessToken", function (accessToken) {
            spotifyApi.setAccessToken(accessToken);
            if (!loaded) {
                //Load the current page (or default)
                var prom;
                if (window.location.hash != "") {
                    prom = navigateToPath(window.location.hash.slice(1), true);
                } else {
                    prom = navigateTo("browse");
                }
                prom.then(function () {
                    socket.emit("getQueue");
                })
                checkNotifications();
            }
        })
        socket.on("error", function (message) {
            console.log(message);
            doNotification(message, {timeout: 5})
        });
        socket.on("history", function (history) {
            if (window.historyFn) {
                window.historyFn(history);
                delete window.historyFn;
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
            var val = parseInt($(this).val());
            socket.emit("setVolume", Math.pow(val, 1 / 3) * 21.5);
        });
        $("footer").on("click", ".shuffle-button", function () {
            socket.emit("toggleShuffle", !$(this).hasClass("active"));
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
        $("body").on("click", ".close-search", function () {
            $(".search-content").removeClass("fadein")
            setTimeout(function () {
                $(".search-content").removeClass("show")
            }, 500)
            return false;
        })

        $("body").on("click", ".search-tabs .search-tab", function () {
            searchPage = $(this).attr("data-tab");
            doSearch($(".search").val())
            return false;
        })
        $("body").on("click", "[data-uri][data-action]", function () {
            $(".track-popup").remove();

            handleAction($(this).attr("data-action"), $(this).attr("data-uri"), $(this).parents("table").attr("data-uri"))
        })
        $("body").on("dblclick", "[data-uri][data-double-action]", function () {
            $(".track-popup").remove();
            handleAction($(this).attr("data-double-action"), $(this).attr("data-uri"), $(this).parents("table").attr("data-uri"))
            return false;
        })
        $("body").on("mousedown", "[data-uri][data-double-action]", function (e) {
            if (e.which == 1) return false;
        })
        $("body").on("click", ".phone-call-on", function () {
            socket.emit("phoneOn");
            return false;
        })
        $("body").on("click", ".phone-call-off", function () {
            socket.emit("phoneOff");
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
                return false;
            }
        })
        $(".play-queue").on("mouseenter", "li", function (e) {
            if ($(".track-popup[data-uuid='" + $(this).attr("data-uuid") + "']").length != 0) return;
            var track = queue.tracks.filter(function (track) {
                return track.uuid == $(this).attr("data-uuid");
            }.bind(this))[0];

            var getPromise = track.source ? handleAction("get", track.source) : undefined;

            Promise.all([getPromise,
                new Promise(function (resolve) {
                    $(this).data("timeout", setTimeout(resolve, 500))
                }.bind(this))
            ]).then(function (source) {
                $(".track-popup").remove();
                var $popup = $(templates.trackPopup($.extend({}, track, {source: source[0]})));
                $popup.attr("data-uuid", $(this).attr("data-uuid"));
                $popup.find("img").on("load", function () {
                    $("body").append($popup);
                    $popup.css("top", Math.max(0, Math.min(
                        $(window).height() - $popup.height(),
                        e.pageY - 50
                    )))
                })
            }.bind(this))
        });
        $(".play-queue").on("mouseleave", "li", function (e) {
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
            if ($to.is(".play-queue li[data-uuid]") && $to.attr("data-uuid") == $(this).attr("data-uuid")) {
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
function doneLoaded() {
    if (!loaded) {
        $("body").removeClass("loading");
        setTimeout(function () {
            $("body").removeClass("showLoader");
        }, 500)
        loaded = true;
    }
}
function changedCurrent(track) {
    currentTrack = track;
    if (!track) {
        $("footer .length").text("00:00");
        $("footer .duration-wrap .song-name").text("");
    } else {
        $(".duration-slider").attr("max", Math.round(track.duration_ms / 1000))
        if (currentPage == "nowPlaying") navigateTo(currentPage); //Refresh the now playing page
        $("footer .length").text(formatDuration(track.duration_ms));
        $("footer .duration-wrap .song-name").text(track.name + ' - ' + track.artists[0].name);

        doNotification("Now playing", {
            tag: "nowPlaying",
            body: track.name,
            icon: track.album.images[0].url,
            timeout: 10
        });
    }
}

function handleAction(action, uri, data) {
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
                socket.emit("addAlbum", uri);
                break;
            case "track":
                var alreadyIn = false;
                queue.tracks.forEach(function (track) {
                    if (track.uri == uri) alreadyIn = true;
                })
                if (!alreadyIn || confirm("This track is already in the queue, do you want to add it again?"))
                    socket.emit("addTrack", {uri: uri, source: data});
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
    } else if (action == "get") {
        switch (type) {
            case "artist":
                return spotifyApi.getArtist(uri.split(":").pop());
            case "playlist":
                var splitUri = uri.split(":");
                return spotifyApi.getPlaylist(splitUri[2], splitUri.pop());
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
        spotifyApi.searchTracks(val, {market: "GB"}).then(function (results) {
            $(".search-content").html(templates.searchPage({
                tracks: results.tracks.items
            }));
        });
    } else if (searchPage == "album") {
        spotifyApi.searchAlbums(val, {market: "GB"}).then(function (results) {
            $(".search-content").html(templates.searchPage({
                albums: results.albums.items
            }));
        })
    } else if (searchPage == "artist") {
        spotifyApi.searchArtists(val, {market: "GB"}).then(function (results) {
            $(".search-content").html(templates.searchPage({
                artists: results.artists.items
            }));
        })
    } else if (searchPage == "playlist") {
        spotifyApi.searchPlaylists(val, {market: "GB"}).then(function (results) {
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
    return navigateTo(hashSplit[0], args, noPush);
}

function navigateTo(_page, args, noPush) {
    return new Promise(function (resolve, reject) {
        console.log("Loading page %s", _page, args);
        var samePage = _page == currentPage;

        var page = pages[_page];
        if ("undefined" == typeof page) {
            console.log("Invalid page: %s", _page);
            reject();
            return;
        }
        $("main").html(templates.pageLoader());
        currentPage = page.name;

        page.fn(args).then(function (data) {
            $("main").html(page.template(data));
            resolve();
        })
        $("#nav .left-nav ul li a[data-nav]").removeClass("selected")
        $("#nav .left-nav ul li a[data-nav='" + currentPage + "']").addClass("selected")

        samePage || noPush || history.pushState({
            page: _page,
            args: args
        }, false, "#" + _page + ("undefined" != typeof args ? "?" + $.param(args) : ""));


        if ($(".search-content").hasClass("fadein")) {
            $(".search-content").removeClass("fadein")
            setTimeout(function () {
                $(".search-content").removeClass("show")
            }, 500)
        }
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


function formatDuration(ms) {
    var totalSeconds = Math.round(ms / 1000);
    var seconds = totalSeconds % 60;
    var minutes = Math.floor(totalSeconds / 60) % 60;
    var hours = Math.floor(totalSeconds / (60 * 60));

    return (hours > 0 ? hours + ":" : "") + padString(minutes, 2) + ":" + padString(seconds, 2);
}
function formatTimestamp(ms) {
    if (!ms) return;
    var date = new Date(ms);
    return timeSince(date) + " ago";
}

function timeSince(date) {

    var seconds = Math.floor((new Date() - date) / 1000);

    var interval = Math.floor(seconds / 31536000);

    if (interval > 1) {
        return interval + " years";
    }
    interval = Math.floor(seconds / 2592000);
    if (interval > 1) {
        return interval + " months";
    }
    interval = Math.floor(seconds / 86400);
    if (interval > 1) {
        return interval + " days";
    }
    interval = Math.floor(seconds / 3600);
    if (interval > 1) {
        return interval + " hours";
    }
    interval = Math.floor(seconds / 60);
    if (interval > 1) {
        return interval + " minutes";
    }
    return Math.floor(seconds) + " seconds";
}

function loadTemplates(cb) {
    console.groupCollapsed("Loading Templates");
    Handlebars.registerHelper("duration", formatDuration)
    Handlebars.registerHelper("timestamp", formatTimestamp)
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
            }], function () {
            console.groupEnd();
            cb();
        });
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

function doNotification(title, args, callback) {
    if (notificationsAllowed) {
        if (!callback) callback = $.noop;
        var notification = new Notification(title, args);
        callback(notification);
        if ("undefined" !== typeof args.timeout) {
            setTimeout(function () {
                notification.close();
            }, args.timeout * 1000)
        }
    }
}

function checkNotifications() {
    try {
        if (localStorage.getItem("notificationsAllowed") == null) {
            Notification.requestPermission(function (data) {
                notificationsAllowed = data == "granted";
                localStorage.setItem("notificationsAllowed", notificationsAllowed);
            });
        } else {
            notificationsAllowed = localStorage.getItem("notificationsAllowed") == "true";
        }
    } catch (e) {
        notificationsAllowed = false;
    }
}

function getTracks(uris) {
    return new Promise(function (resolve, reject) {
        var uncachedTracks = uris.filter(function (track) {
            return "undefined" == typeof trackCache["string" === typeof track ? track : track.id]
        })
        var tracksSplit = [];
        var i, chunk = 50;
        for (i = 0; i < uncachedTracks.length; i += chunk) {
            uncachedTracks.slice(i, i + chunk);
            tracksSplit.push(uncachedTracks.slice(i, i + chunk).map(function (track) {
                return "string" === typeof track ? track : track.id;
            }));
        }
        async.each(tracksSplit, function (item, cb) {
            spotifyApi.getTracks(item).then(function (result) {
                result.tracks.forEach(function (track) {
                    if (track == null) return;
                    trackCache[track.id] = track;
                });
                cb();
            })
        }, function () {
            var tracks = uris.map(function (track) {
                if ("object" === typeof track) {
                    var _track = $.extend({}, trackCache[track.id]); //Make a copy;
                    _track.source = track.source;
                    _track.votes = track.votes;
                    _track.uuid = track.uuid;
                    _track.votesIps = track.votesIps;
                    _track.vote = "undefined" == typeof track.votesIps[ourIp] ? 0 : track.votesIps[ourIp]
                    _track.votedUp = _track.vote == 1;
                    _track.votedDown = _track.vote == -1;
                } else {
                    var _track = $.extend({}, trackCache[track]);
                }
                return _track;
            });

            resolve(tracks)
        })
    });
}