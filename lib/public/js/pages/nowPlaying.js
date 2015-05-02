registerPage("nowPlaying", function () {
    return new Promise(function (resolve) {
        resolve(currentTrack)
    })
}, templates.nowPlayingPage)