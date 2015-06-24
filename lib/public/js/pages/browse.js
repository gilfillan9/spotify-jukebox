(function () {
    var resizeFn;

    registerPage("browse", function () {
        return new Promise(function (resolve) {
            var data = {};
            async.parallel([
                function (cb) {
                    spotifyApi.getFeaturedPlaylists({limit: 50, country: "GB"}).then(function (_data) {
                        data.message = _data.message;
                        data.featured = _data.playlists.items;
                        cb();
                    });
                },
                function (cb) {
                    spotifyApi.getCategories({limit: 50, country: "GB"}).then(function (_data) {
                        data.categories = _data.categories.items;
                        cb();
                    })
                }
            ], function () {
                resolve(data);
            });
        })
    }, templates.browsePage, {
        beforeAppend: colorizeItems,
        afterAppend: function ($page) {
            resizePills($page);
            resizeFn = throttle(function () {
                resizePills($page);
            }, 200);
            $(window).on("resize", resizeFn);
        },
        destroy: function () {
            $(window).off("resize", resizeFn);
        }
    });

    function resizePills($page) {
        var $featured = $page.find(".featured");
        var width = 0;
        var $pills = $featured.find(".pill")
        $pills.each(function () {
            $(this).removeClass("double-length").find("img").attr("src", $(this).find("img").attr("data-src"))
        })
        setTimeout(function () {
            var lastY = false;
            $pills.each(function () {
                if (lastY === false) lastY = $(this).offset().top;

                if (lastY != $(this).offset().top) {
                    return false;
                }
                width++;
            });
            if ($pills.length % width != 0) {
                var rows = Math.ceil($pills.length / width);
                var diff = (rows * width) - $pills.length;
                var tries = 0;
                do {
                    var i = diff;
                    $pills.removeClass("double-length")
                    do {
                        var index = Math.round(Math.random() * $pills.length);
                        var $rand = $($pills[index]);
                        if (!$rand.is(".double-length")) {
                            $rand.addClass("double-length");
                            $rand.find("img").removeAttr("src", "");
                            i--;
                        }
                    } while (i > 0);
                    var actualRows = 0;
                    var lastY = false;
                    $pills.each(function () {
                        if (lastY != $(this).offset().top) {
                            lastY = $(this).offset().top;
                            actualRows++;
                        }
                    })

                } while (tries++ < 20 && rows != actualRows);
            }
        });
    }

}).call(window);