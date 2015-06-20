registerPage("settings", function () {
    return new Promise(function (resolve) {
        resolve();

    })
}, templates.settingsPage, {
    afterAppend: function ($page) {
        $page.find(".reboot-pi").click(function () {
            confirm("Are you sure you want to reboot the pi?") && confirm("Really?") && socket.emit("reboot");
            return false;
        });
        $page.find(".clear-queue").click(function () {
            confirm("Are you sure you want to clear the queue?") && socket.emit("clearQueue")
            return false;
        });
        $page.find(".save-queue").click(function () {
            socket.emit("save");
            return false;
        });
        return $page;
    }
})