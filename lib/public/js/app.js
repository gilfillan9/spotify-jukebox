var spotifyApi = new SpotifyWebApi();

$(function () {
    var socket = window.socket = io('/');
    socket.on('connect', function () {
        console.log("Connected to server");
    });
    socket.on("playQueue", function (queue) {
        $(".shuffle-button").toggleClass("active", queue.shuffled)

        if (queue.tracks.length > 0) {
            spotifyApi.getTracks(queue.tracks.map(function (val) {
                return val.split(":").pop();
            })).then(function (result) {
                var $ul = $(".play-queue ul").html("");
                result.tracks.forEach(function (track) {
                    $ul.append('<li><span class="title">' + track.name + '</span><span class="artist">' + track.artists[0].name + '</span><i class="remove-track">X</i></li>');
                })
            })
        } else {
            $(".play-queue ul").html("")
        }
    });

    $("body").on("click", ".shuffle-button", function () {
        socket.emit("toggleShuffle");
    })

    //spotify.setAccessToken("da9d271f3e4e48018e05e9e2ff151e41");

    $("body").on("click", "[data-nav]", function () {
        navigateTo($(this).attr("data-nav"));
        return false;
    })
})

function navigateTo(url) {
    $("main").html("");
    if (url == "browse") {
        spotifyApi.getFeaturedPlaylists({}, function (err, data) {
            console.log(data);
        });
    } else {

    }
}