registerPage("viewArtist", function (args) {
    return new Promise(function (resolve, reject) {
        function error(e) {
            reject({title: "Couldn't load the artist", message: JSON.parse(e.response).error.message});
        }

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
        }, error).then(function (data) {
            artist.tracks = data.tracks;
            return spotifyApi.getArtistAlbums(args.id, {market: "GB"});
        }, error).then(function (data) {
            artist.albums = data.items;
            resolve(artist);
        }, error);
    })
}, templates.artistPage, {
    beforeAppend: colorizeItems,
    afterAppend: function ($page) {
        $("main").on("scroll", animateDetailPage).scroll()

        return $page;
    },
    destroy: function ($page) {
        $("main").off("scroll", animateDetailPage);
    }
})