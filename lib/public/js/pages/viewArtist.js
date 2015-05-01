registerPage("viewArtist", function (args) {
    return new Promise(function (resolve) {
        if ("string" === typeof args.uri) {
            var split = args.uri.split(":");
            args = {
                id: split[2]
            }
        }
        var artist;
        spotifyApi.getArtist(args.id).then(function (data) {
            artist = data;
            return spotifyApi.getArtistTopTracks(args.id, "GB");
        }).then(function (data) {
            artist.tracks = data.tracks;
            return spotifyApi.getArtistAlbums(args.id, {market: "GB"});
        }).then(function (data) {
            artist.albums = data.items;
            resolve(artist);
        });
    })
}, templates.artistPage, {
    beforeAppend: colorizeItems
})