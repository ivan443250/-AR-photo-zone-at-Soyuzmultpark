var tour = new Shepherd.Tour({
    defaultStepOptions: {
        cancelIcon: {
            enabled: !0
        },
        classes: "shadow-md bg-purple-dark",
        scrollTo: {
            behavior: "smooth",
            block: "center"
        }
    },
    useModalOverlay: {
        enabled: !0
    }
});
tour.addStep({
    title: "Добро пожаловать в редактор MIXAR WEB!",
    text: "Нажмите далее, чтобы начать тур!",
    attachTo: {
        element: "",
        on: ""
    },
    buttons: [{
        text: "Далее",
        classes: "btn btn-success",
        action: tour.next
    }]
}), tour.addStep({
    title: "Это окно со сценами и привязками",
    text: "Вы можете создавать несколько сцен и переключаться между ними",
    attachTo: {
        element: "#anchors-menu",
        on: "right"
    },
    buttons: [{
        text: "Назад",
        classes: "btn btn-light",
        action: tour.back
    }, {
        text: "Далее",
        classes: "btn btn-success",
        action: tour.next
    }]
}), tour.addStep({
    title: "У кажой сцены есть привязки",
    text: "Это может быть пол, стены или изображение, можно добавить сразу несколько изображений",
    attachTo: {
        element: ".scene_anchors",
        on: "right"
    },
    buttons: [{
        text: "Назад",
        classes: "btn btn-light",
        action: tour.back
    }, {
        text: "Далее",
        classes: "btn btn-success",
        action: tour.next
    }]
}), tour.addStep({
    title: "Это окно со контентом выбранной привязки",
    text: "Вы можете добавлять различные объекты, такие как: 3д-модели, изображения, звуки и видео",
    attachTo: {
        element: "#content_menu",
        on: "right"
    },
    buttons: [{
        text: "Назад",
        classes: "btn btn-light",
        action: tour.back
    }, {
        text: "Далее",
        classes: "btn btn-success",
        action: tour.next
    }]
}), tour.addStep({
    title: "Можно добавлять интерактив",
    text: "К примеру клик по объекту может вызывать его анимацию и т.д.",
    attachTo: {
        element: "#interactions-title",
        on: "right"
    },
    buttons: [{
        text: "Назад",
        classes: "btn btn-light",
        action: tour.back
    }, {
        text: "Далее",
        classes: "btn btn-success",
        action: tour.next
    }]
}), tour.addStep({
    title: "Это ваша сцена",
    text: "Здесь отображается контент выбранной привязки.",
    attachTo: {
        element: "#unity-container",
        on: "top"
    },
    buttons: [{
        text: "Назад",
        classes: "btn btn-light",
        action: tour.back
    }, {
        text: "Далее",
        classes: "btn btn-success",
        action: tour.next
    }]
}), tour.addStep({
    title: "Элементы управления",
    text: "Можно перемещать, вращать и масштабировать объекты",
    attachTo: {
        element: "#controls-menu",
        on: "bottom"
    },
    buttons: [{
        text: "Назад",
        classes: "btn btn-light",
        action: tour.back
    }, {
        text: "Далее",
        classes: "btn btn-success",
        action: tour.next
    }]
}), tour.addStep({
    title: "Панель настроек",
    text: "Здесь отображаются настройки выбранного объекта",
    attachTo: {
        element: "#object-menu",
        on: "left"
    },
    buttons: [{
        text: "Назад",
        classes: "btn btn-light",
        action: tour.back
    }, {
        text: "Далее",
        classes: "btn btn-success",
        action: tour.next
    }]
}), tour.addStep({
    title: "Последний шаг!",
    text: "После того как сцена собрана - жмите опубликовать и сканируйте QR-код!",
    attachTo: {
        element: "#share_button",
        on: "bottom"
    },
    buttons: [{
        text: "Готово!",
        classes: "btn btn-success",
        action: tour.complete
    }]
});
tour.on("complete",function(){
    console.log("tour_complete")
    setCookie("editor_tour","1",180)
})
tour.on("cancel",function(){
    console.log("tour_cancel")
    setCookie("editor_tour","1",180)
})
function restart_editor_tour(){
    tour.start();
    $("#help_button > i").trigger("click")
}