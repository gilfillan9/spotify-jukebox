registerPage("history", function () {
    return new Promise(function (resolve) {
        window.historyFn = function (histTracks) {
            getTracks(histTracks.map(function (track) {
                return track.uri.split(":")[2]
            })).then(function (tracks) {
                tracks.forEach(function (val, index) {
                    if (val.uri == histTracks[index].uri) {
                        val.time = histTracks[index].time;
                    }
                })
                resolve(tracks);
            })
        }
        socket.emit("getHistory");
    })
}, templates.historyPage, function ($page) {
    var state = {page: 0};
    var $main = $page.parent();
    $main.on("scroll", function () {
        if ($page.data("loading")) return;

        if ($main.scrollTop() / ($page.innerHeight() - $main.height()) > 0.7) {
            $page.data("loading", true);
            window.historyFn = function (histTracks) {
                if (histTracks.length == 0) return;
                getTracks(histTracks.map(function (track) {
                    return track.uri.split(":")[2]
                })).then(function (_tracks) {
                    _tracks.forEach(function (val, index) {
                        if (val.uri == histTracks[index].uri) {
                            val.time = histTracks[index].time;
                        }
                        $page.find("table tbody").append(templates.track(val));
                    })
                    $page.data("loading", false);
                })
            }
            socket.emit("getHistory", ++state.page);
        }
    })
})