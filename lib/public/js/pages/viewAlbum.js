registerPage("viewAlbum", function (args) {
    return new Promise(function (resolve) {
        if ("string" === typeof args.uri) {
            var split = args.uri.split(":");
            args = {
                id: split[2]
            }
        }
        var album;
        spotifyApi.getAlbum(args.id, {market: "GB"}).then(function (data) {
            album = data;
            return data.tracks.items.map(function (t) {
                return t.id;
            });
        }).then(function (trackIds) {
            return spotifyApi.getTracks(trackIds, {market: "GB"});
        }).then(function (data) {
            album.tracks = data.tracks;
            resolve(album);
        });
    })
}, templates.albumPage)