registerPage("browse", function () {
    return new Promise(function (resolve) {
        var data = {};
        async.parallel([
            function (cb) {
                spotifyApi.getFeaturedPlaylists().then(function (_data) {
                    data.message = _data.message;
                    data.featured = _data.playlists.items;
                    cb();
                });
            },
            function (cb) {
                spotifyApi.getCategories({limit: 50}).then(function (_data) {
                    data.categories = _data.categories.items;
                    cb();
                })
            }
        ], function () {
            resolve(data);
        });

    })
}, templates.browsePage)