(function () {
    var $page;

    registerPage("settings", function () {
        return new Promise(function (resolve) {
            resolve();

        })
    }, templates.settingsPage, {
        afterAppend: function (_$page) {
            $page = _$page;
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
            $page.find("#accounts").change(function () {
                socket.emit("switchAuthFile", $(this).val());
            })

            $page.find(".add-auth-file").submit(function () {
                var name = $(this).find("#name").val();
                var username = $(this).find("#username").val();
                var password = $(this).find("#password").val();

                var error = false;

                if (name == "") {
                    error = true;
                    $(this).find("#name").addClass("invalid").removeClass("valid")
                } else {
                    $(this).find("#name").addClass("valid").removeClass("invalid")
                }
                if (username == "") {
                    error = true;
                    $(this).find("#username").addClass("invalid").removeClass("valid")
                } else {
                    $(this).find("#username").addClass("valid").removeClass("invalid")
                }
                if (password == "") {
                    error = true;
                    $(this).find("#password").addClass("invalid").removeClass("valid")
                } else {
                    $(this).find("#password").addClass("valid").removeClass("invalid")
                }


                if (error === false) {
                    console.log("TEST");
                    socket.emit("addAuthFile", {name: name, username: username, password: password});
                }

                return false;
            })

            socket.on("authFiles", authFiles)
            socket.emit("getAuthFiles")
            return $page;
        },
        destroy: function () {
            socket.removeListener("authFiles", authFiles)
        }
    })

    function authFiles(data) {
        var $select = $page.find("#accounts").html("");

        data.files.forEach(function (file) {
            var $option = $("<option>").text(file)
            if (file == data.selected) {
                $select.attr("selected", true);
            }
            $select.append($option);
        })

        $select.material_select();
    }
})();

