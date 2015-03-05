registerPage("settings", function () {
    return new Promise(function (resolve) {
        resolve();

    })
}, templates.settingsPage)

$("body").on("click", ".reboot-pi", function () {
    confirm("Are you sure you want to reboot the pi?") && confirm("Really?") && socket.emit("reboot");
    return false;
})

$("body").on("click", ".clear-queue", function () {
    confirm("Are you sure you want to clear the queue?") && socket.emit("clearQueue")
});

$("body").on("click", ".save-queue", function () {
    socket.emit("save");
    return false;
});