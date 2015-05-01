registerPage("viewCategory", function (args) {
    return new Promise(function (resolve) {
        var category, playlists;
        async.parallel([
            function (cb) {
                spotifyApi.getCategory(args.id, {country: "GB"}).then(function (data) {
                    category = data;
                    cb();
                });
            },
            function (cb) {
                spotifyApi.getCategoryPlaylists(args.id, {limit: 50, country: "GB"}).then(function (data) {
                    playlists = data.playlists.items;
                    cb();
                })
            }
        ], function () {
            category.playlists = playlists;
            resolve(category);
        });
    })
}, templates.categoryPage, {
    afterAppend: colorizeItems
})