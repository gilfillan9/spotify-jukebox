registerPage("viewPlaylist", function (args) {
    return new Promise(function (resolve) {
        if ("string" === typeof args.uri) {
            var split = args.uri.split(":");
            args = {
                user: split[2],
                id: split[4]
            }
        }
        spotifyApi.getPlaylist(args.user, args.id).then(function (data) {
            console.log(data);
            resolve(data);
        });
    })
}, templates.playlistPage)