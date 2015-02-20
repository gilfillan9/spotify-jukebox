registerPage("nowPlaying", function () {
    return new Promise(function (resolve) {
        if (!currentTrack) {
            setTimeout(function () {
                resolve(currentTrack)
            }, 650);
        } else {
            resolve(currentTrack)
        }
    })
}, templates.nowPlayingPage)