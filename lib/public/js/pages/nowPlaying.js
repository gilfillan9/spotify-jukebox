registerPage("nowPlaying", function () {
    return Promise.resolve(currentTrack)
}, templates.nowPlayingPage)