
$(document).ready(function(){
    theme = getCookie("theme")
    if(theme == "dark")
        switch_theme("dark");
    else
        switch_theme("light");
})

let theme;
function switch_theme(val){
    theme = val;
    //console.log("switch_theme",val)
    //console.log(val==="light")
    setTimeout(function(){
        $("html").attr("data-sidebar",val)
        $("html").attr("data-layout-mode",val)
        $("html").attr("data-topbar",val)
        setCookie("theme",val, 180);
        if(val=="dark"){
            window.UNITY.sendMessageToUnity(new Command("setcolors","{}",["212529","edf2f6"]))
        }
        else {
            window.UNITY.sendMessageToUnity(new Command("setcolors","{}",["f3f3f9","000"]))
        }
        sendMessageToCodeEditor("theme_"+theme)
    })
    //console.log("done")
    if(loaded_id){
        var bg = "fff"
        var color = "0075ff"
        if(theme == "dark") {
            bg = "32383e";
            color = "fff"
        }
        console.log("change_qr", bg)
        $("#project_qr").attr("src","https://api.qrserver.com/v1/create-qr-code/?data="+
            encodeURI("https://xr.mix-ar.ru/q?id="+loaded_id)+"&color="+color+"&bgcolor="+bg+"&qzone=1&margin=0&size=500x500&ecc=L")
    }
}
function sendMessageToCodeEditor(msg){
    try {
        document.getElementById("code_editor").contentWindow.postMessage(msg)
    }
    catch (e) {

    }
}