registerPage("viewPlaylist", function (args) {
    if ("string" === typeof args.uri) {
        var split = args.uri.split(":");
        args = {
            user: split[2],
            id: split[4]
        }
    }
    return spotifyApi.getPlaylist(args.user, args.id);
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