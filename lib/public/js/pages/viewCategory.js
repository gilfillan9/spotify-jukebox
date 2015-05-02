registerPage("viewCategory", function (args) {
    return new Promise(function (resolve, reject) {
        function error(e) {
            reject({title: "Couldn't load the category", message: JSON.parse(e.response).error.message});
        }

        var category, playlists;
        async.parallel([
            function (cb) {
                spotifyApi.getCategory(args.id, {country: "GB"}).then(function (data) {
                    category = data;
                    cb();
                }, function (e) {
                    cb(e);
                })
            },
            function (cb) {
                spotifyApi.getCategoryPlaylists(args.id, {limit: 50, country: "GB"}).then(function (data) {
                    playlists = data.playlists.items;
                    cb();
                }, function (e) {
                    cb(e);
                });
            }
        ], function (e) {
            if (e) {
                error(e);
                return;
            }
            category.playlists = playlists;
            resolve(category);
        });
    })
}, templates.categoryPage, {
    beforeAppend: colorizeItems,
    afterAppend: function ($page) {
        $("main").on("scroll", animateDetailPage).scroll()

        return $page;
    },
    destroy: function ($page) {
        $("main").off("scroll", animateDetailPage);
    }
})