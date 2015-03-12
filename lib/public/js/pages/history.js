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
}, templates.historyPage)