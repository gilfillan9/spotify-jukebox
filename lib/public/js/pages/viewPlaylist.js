registerPage("viewPlaylist", function (args) {
    if ("string" === typeof args.uri) {
        var split = args.uri.split(":");
        args = {
            user: split[2],
            id: split[4]
        }
    }
    return new Promise(function (resolve, reject) {
        function error(e) {
            reject({title: "Couldn't load the playlist", message: JSON.parse(e.response).error.message});
        }

        spotifyApi.getPlaylist(args.user, args.id).then(resolve, error)
    })
}, templates.playlistPage, {
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