registerPage("viewAlbum", function (args) {
    return new Promise(function (resolve, reject) {
        function error(e) {
            reject({title: "Couldn't load the album", message: JSON.parse(e.response).error.message});
        }

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
        }, error).then(function (trackIds) {
            return getTracks(trackIds);
        }, error).then(function (tracks) {
            album.tracks = tracks;
            resolve(album);
        }, error);
    })
}, templates.albumPage, {
    beforeAppend: colorizeItems,
    afterAppend: function ($page) {
        $page.find(".fixed-action-btn").mouseout();
        $("main").on("scroll", animateDetailPage).scroll()

        return $page;
    },
    destroy: function ($page) {
        $("main").off("scroll", animateDetailPage);
    }
})