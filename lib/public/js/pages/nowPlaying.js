registerPage("nowPlaying", function () {
    return new Promise(function (resolve) {
        resolve(queue.tracks[0])
    })
}, templates.nowPlayingPage)