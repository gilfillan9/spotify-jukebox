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
            resolve(data);
        });
    })
}, templates.playlistPage, {
    beforeAppend: colorizeItems,
    afterAppend: function ($page) {
        $("main").on("scroll", animateDetailPage).scroll()

        return $page;
    },
    destroy: function ($page) {
        $("main").off("scroll", animateDetailPage);
    }
})