registerPage("viewCategory", function (args) {
    return new Promise(function (resolve) {
        var category, playlists;
        async.parallel([
            function (cb) {
                spotifyApi.getCategory(args.id).then(function (data) {
                    category = data;
                    cb();
                });
            },
            function (cb) {
                spotifyApi.getCategoryPlaylists(args.id).then(function (data) {
                    playlists = data.playlists.items;
                    cb();
                })
            }
        ], function () {
            category.playlists = playlists;
            resolve(category);
        });
    })
}, templates.categoryPage)