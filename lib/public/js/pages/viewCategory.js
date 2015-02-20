registerPage("viewCategory", function (args) {
    return new Promise(function (resolve) {
        var category;
        spotifyApi.getCategory(args.id).then(function (data) {
            category = data;
        }).then(function () {
            return spotifyApi.getCategoryPlaylists(args.id);
        }).then(function (data) {
            category.playlists = data.playlists.items;
            console.log(category);
            resolve(category);
        });
    })
}, templates.categoryPage)