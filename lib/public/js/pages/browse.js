$(function () {
    registerPage("browse", function () {
        return new Promise(function (resolve) {
            spotifyApi.getFeaturedPlaylists().then(function (data) {
                resolve({
                    message: data.message,
                    playlists: data.playlists.items
                })
            });
        })
    }, templates.browsePage)
});