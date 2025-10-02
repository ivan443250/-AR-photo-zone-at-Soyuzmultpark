var container        = document.querySelector("#unity-container");
var canvas           = document.querySelector("#unity-canvas");
var loadingBar       = document.querySelector("#unity-loading-bar");
var progressBarFull  = document.querySelector("#unity-progress-bar-full");
var fullscreenButton = document.querySelector("#unity-fullscreen-button");
var warningBanner    = document.querySelector("#unity-warning");

// Shows a temporary message banner/ribbon for a few seconds, or
// a permanent error message on top of the canvas if type=='error'.
// If type=='warning', a yellow highlight color is used.
// Modify or remove this function to customize the visually presented
// way that non-critical warnings and error messages are presented to the
// user.
function getParm(variable) {
    var query = window.location.search.substring(1);
    var vars = query.split('&');
    for (var i = 0; i < vars.length; i++) {
        var pair = vars[i].split('=');
        if (decodeURIComponent(pair[0]) == variable) {
            return decodeURIComponent(pair[1]);
        }
    }
    console.log('Query variable %s not found', variable);
}
function unityShowBanner(msg, type) {
    function updateBannerVisibility() {
       // warningBanner.style.display = warningBanner.children.length ? 'block' : 'none';
    }

    var div       = document.createElement('div');
    div.innerHTML = msg;
   // warningBanner.appendChild(div);
    if (type == 'error') div.style = 'background: red; padding: 10px;';
    else {
        if (type == 'warning') div.style = 'background: yellow; padding: 10px;';
        setTimeout(function () {
            //warningBanner.removeChild(div);
            updateBannerVisibility();
        }, 5000);
    }
    updateBannerVisibility();
}

var buildUrl  = "Builds/last";
if(getParm("build") != undefined){
    buildUrl = "Builds/"+getParm("build");
}
var loaderUrl = buildUrl + "/_Build.loader.js?v=0.1.0.95";
var config    = {
    dataUrl:            buildUrl + "/_Build.data.unityweb?v=0.1.0.95",
    frameworkUrl:       buildUrl + "/_Build.framework.js.unityweb?v=0.1.0.95",
    codeUrl:            buildUrl + "/_Build.wasm.unityweb?v=0.1.0.95",
//    dataUrl:            buildUrl + "/_Build.data",
//    frameworkUrl:       buildUrl + "/_Build.framework.js",
//    codeUrl:            buildUrl + "/_Build.wasm",
    streamingAssetsUrl: "StreamingAssets",
    companyName:        "DefaultCompany",
    productName:        "webgl_test1",
    productVersion:     "0.1",
    showBanner:         unityShowBanner,
};

// By default Unity keeps WebGL canvas render target size matched with
// the DOM size of the canvas element (scaled by window.devicePixelRatio)
// Set this to false if you want to decouple this synchronization from
// happening inside the engine, and you would instead like to size up
// the canvas DOM size and WebGL render target sizes yourself.
// config.matchWebGLToCanvasSize = false;

/*if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
    // Mobile device style: fill the whole browser client area with the game canvas:

    var meta     = document.createElement('meta');
    meta.name    = 'viewport';
    meta.content = 'width=device-width, height=device-height, initial-scale=1.0, user-scalable=no, shrink-to-fit=yes';
    document.getElementsByTagName('head')[0].appendChild(meta);
    container.className = "unity-mobile";

    // To lower canvas resolution on mobile devices to gain some
    // performance, uncomment the following line:
    // config.devicePixelRatio = 1;

    canvas.style.width  = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
}
else {*/
// Desktop style: Render the game canvas in a window that can be maximized to fullscreen:

/*container.style.width  = window.innerWidth - 270 + 'px';
container.style.height = window.innerHeight - 50 + 'px';*/
//canvas.style.width  = "960px";
//canvas.style.height = "600px";
//}

loadingBar.style.display = "block";

var script    = document.createElement("script");
script.src    = loaderUrl;
var requestId = 0;

String.prototype.format = function () {
    var args = arguments;
    return this.replace(/{(\d+)}/g, function (match, number) {
        return typeof args[number] != 'undefined'
            ? args[number]
            : match
            ;
    });
};

class Command {
    constructor(command, data, params) {
        this.command = command;
        //this.data    = data;
        if(typeof data !== 'string')
            this.data = JSON.stringify(data);
        else
            this.data = data
        this.params  = params;
    }

    id      = -1;
    command = "";
    data    = "";
    params  = [];
}

var callbacks              = [];
window._onReceiveFromUnity = (message) => {
    console.log("[JS receive]", message)
    if (message === 'init') {
        console.log("_init")
        window.UNITY.oninit()
        return;
    }
    const json = JSON.parse(message);
    console.log("receive from Unity:", json);
    if (json.id !== -1) {
        if (callbacks[json.id] !== undefined) {
            callbacks[json.id](json);
            callbacks[json.id] = undefined;
        }
    }
    else {
        if (json.id === -1) {
            if (json.event === 'onchange') {
                window.UNITY.onchange(json.objectid, json.field)
            }
            if (json.event === 'onselect') {
                window.UNITY.onselect(json.objectid);
            }
        }
    }
};
window.UNITY               = {}
//window.UNITY.oninit        = () => {console.log("init")}
//window.UNITY.onchange      = (id, field) => { console.log("onchange", id, field)}
//window.UNITY.onselect      = (id) => {console.log("onselect", id)}

script.onload = () => {
    createUnityInstance(canvas, config, (progress) => {
        progressBarFull.style.width = 100 * progress + "%";
    }).then((unityInstance) => {
            window.unityInstance            = unityInstance
            window.receiveMessageFromUnity  = (message) => { window._onReceiveFromUnity(message) };
            window.UNITY.sendMessageToUnity = function (message) {
                message.command ??= undefined;
                return new Promise(
                    (resolve, reject) => {
                        message.id            = requestId++;
                        const m               = JSON.stringify(message);
                        callbacks[message.id] = evt => {
                            if (evt.error === undefined)
                                resolve(evt.data);
                            else
                                reject(evt.error);
                        }
                        window.unityInstance.SendMessage("[Bridge]", "SendToUnity", m);
                    }
                );
            }

            loadingBar.style.display = "none";
            //fullscreenButton.onclick = () => { unityInstance.SetFullscreen(1); };
        }
    ).catch((message) => {
        //alert(message);
        console.log(message)
    });
};
$( document ).ready(function(){
    console.log("[document.ready]")
    document.body.appendChild(script);
})