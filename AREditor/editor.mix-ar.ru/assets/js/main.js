const ANCHORS_TYPES = {
    MarkerHorizontal: 0,
    MarkerVertical: 1,
    PlaneHorizontal: 2,
    PlaneVertical: 3,
    CloudAnchor: 4

}
const RESOURCES_TYPES = {
    model: 0,
    image: 1,
    audio: 2,
    video: 3,
    marker: 4
}
const ENTITIES_TYPES = {
    model: 0,
    audio: 1,
    video: 2,
    text: 3,
    texture: 4
}

const TOOLS_TYPES = {
    toolview : "toolview",
    toolmove : "toolmove",
    toolrotate : "toolrotate",
    toolscale : "toolscale",
    spacelocal : "spacelocal",
    spaceworld : "spaceworld",
    pivotself : "pivotself",
    pivotcenter : "pivotcenter",
    toolscalelock : "toolscalelock"
}

const contain_image_min_asp_rat = 0.58;
const contain_image_max_asp_rat = 1.7;


var scene;
var scene_number = 0;
var scenes;
var selected_scene = undefined;
var anchor;
var anchors_resourses;
var project_resources = {};
var entities = [];
var selected_obj = null;
var selected_type = null;
var interactions = [];
var interactions_count = 0;
var actions = [];
var actions_count = 0;
var is_switching_marker=false;
var adding_marker_scene=-1;
var force_reload = false;

var lock_storage = {
    "locker_scale": false
};
var loading_models = [];

var is_user_here = true;
$(window).focus(function() {
    console.log("window focus")
    is_user_here = true
});
$(window).blur(function() {
    console.log("window blur")
    is_user_here = false
});

function sendMessageToCodeEditor(msg){
    try {
        document.getElementById("code_editor").contentWindow.postMessage(msg)
    }
    catch (e) {

    }
}
function getProjectId(hash, callback){
    console.log("getProjectId", hash)
    var token = getCookie("token"); // Получаем токен из cookie
    $.ajax({
        url: "server/getProjectId.php",
        type: "GET",
        data: {
            token: token,
            hash: hash
        },
        dataType: "json", // Указываем, что ожидаем ответ в формате JSON
        success: function(response) {
            // Проверяем результат выполнения
            if (response.result === "success") {
                // Выводим сообщение об успешном создании проекта
                console.log("Project ID got successfully", response);
                callback(response.project_id)
                //alert("Проект успешно создан. Hash: " + response.hash);
            } else if (response.result === "error") {
                // Выводим сообщение об ошибке от сервера
                console.error("Error getting project id", response.error);
                alert("Ошибка: " + response.error);
            }
        },
        error: function(xhr, status, error) {
            // Обработка ошибки запроса
            console.error("Error getting project id", error);
            alert("Ошибка запроса: " + error);
        }
    });
}
let projectID;
let projectHASH;
getProjectId(getQueryVariable("id"),function(id){
    projectID = id;
    projectHASH = getQueryVariable("id");
    load_project_title(id)
    load_project_link(id)
    load_code_editor(projectHASH)
})
//unity init

console.log("_ready")
window.UNITY.oninit = () => {
    console.log("ready");
    $("#unity-container.unity-desktop").css({
        "left": "270px",
        "top": "50px",
        "width": "calc(100% - 270px)",
        "height": "calc(100% - 50px)",
        "z-index": "0"
    });
    init_engine();
}

window.UNITY.onselect = (id) => {
    console.log("onselect");
    console.log(id);
    if(id == "null") {
        select_menu_object(null);
    }
    else
        select_menu_object($("#"+id));
}

window.UNITY.onchange = (id, field) => {
    console.log("onchange");
    console.log(id);
    console.log(field);
    object_onchenge(id,field);
}

function center_object(){
    window.UNITY.sendMessageToUnity(new Command("centerobject","",[]))
}
function show_code_editor(){
    switch_theme(theme)
    $("html").attr("data-layout-code","true")
}
function hide_code_editor(){
    $("html").attr("data-layout-code","false")
}
function clone_object(_id){
    if(!_id)
        _id = selected_obj;
    if(_id != null){
        var entity = entities.find(({ id }) => id == _id);
        if(entity.type == ENTITIES_TYPES.model)
            clone_model(_id)
        if(entity.type == ENTITIES_TYPES.video)
            clone_video(_id)
        if(entity.type == ENTITIES_TYPES.audio)
            clone_sound(_id)
        if(entity.type == ENTITIES_TYPES.texture){
            if(entity.hasOwnProperty("is_text") && entity.is_text)
                clone_text(_id);
            else
                clone_image(_id)
        }
    }
}

function object_onchenge(_id,field){
    console.log("onchenge")
    var _entity = entities.find(({ id }) => id == _id);
    console.log(_entity) //console.trace
    if(field=="transform"){
        get_entity(_id,function(e){
            //if(field=="transform"){
                _entity.transform = e.transform;
                show_object_parms(_id)
           // }

        })
    }
    if(field=="model" && loading_models.length>0){
        console.log("_id")
        console.log(JSON.stringify(loading_models))
        _id = loading_models.shift()
        get_entity(_id,function(e){
            console.log("[object_onchenge] [model]",e)
            console.log()
            var i = entities.push(e);
            var entity = entities[i-1];
            entity.model.isPlaying = false
            add_model(entity, function(obj){
                obj.click();
            });
        })
    }
    if(field=="model"){
        get_entity(_id,function(e){
            console.log("MODELMODEL")
            console.log(e)
            setTimeout(function(){
                if(e.model.playOnAwake){
                    console.log("playOnAwake")
                    var entity = entities.find(({ id }) => id == e.id);
                    entity.model.isPlaying = true
                    playAnim(entity.id,entity.model.animations[0])
                    if(entity.id == selected_obj) {
                        $("#button_stop_model").css("display", "block")
                        $("#button_play_model").css("display", "none")
                    }
                }
            },1000)
        })
    }

}
setInterval(function(){
    $("#content_menu").css("height",(window.innerHeight-82-$("#scene_list_menu").height())+"px")
},1000)
$(".menu-markers-button").on("click",function(){
    setTimeout(function(){
        $("#content_menu").css("height",(window.innerHeight-82-$("#scene_list_menu").height())+"px")
    },30)
})

//get url parms
function getQueryVariable(variable) {
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
function init_engine(){
    getProjectId(getQueryVariable("id"),function(id){
        window.UNITY.sendMessageToUnity(new Command("init",{},[parseInt(id), getCookie("token")])).then(e=>{
            console.log(e);
            load_project();
        }).catch(e=>{console.log( e)});
    })
    if(theme=="dark"){
        window.UNITY.sendMessageToUnity(new Command("setcolors","{}",["212529","edf2f6"]))
    }
    else {
        window.UNITY.sendMessageToUnity(new Command("setcolors","{}",["f3f3f9","000"]))
    }
}

function getCookie(cname) {
    let name = cname + "=";
    let decodedCookie = decodeURIComponent(document.cookie);
    let ca = decodedCookie.split(';');
    for(let i = 0; i <ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}
function setCookie(cname, cvalue, exdays) {
    const d = new Date();
    d.setTime(d.getTime() + (exdays*24*60*60*1000));
    let expires = "expires="+ d.toUTCString();
    document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}

function load_code_editor(id){
    $("#code_editor").attr("src","codeEditor/main.html?id="+id);
}

function load_project_title(id){
    console.log("load_project_title")
    fetch('https://mixar-api.ru/project/'+id, {
        method:  'GET'
    })
        .then(response => {
            //console.log(response)
            response.json().then(function(r){
                console.log(r.name)
                document.title = "MIXAR: "+r.name;
            })
        })
}
var loaded_id = undefined;
function load_project_link(id){
    loaded_id = id;
    $("#project_link").val("https://xr.mix-ar.ru/q?id="+id);
    $("#project_link").on("click",function(){
        navigator.clipboard.writeText("https://xr.mix-ar.ru/q?id="+id);
    })
    var bg = "fff"
    var color = "0075ff"
    if(theme == "dark") {
        bg = "32383e";
        color = "fff"
    }
    $("#project_qr").attr("src","https://api.qrserver.com/v1/create-qr-code/?data="+
        encodeURI("https://xr.mix-ar.ru/q?id="+id)+"&color="+color+"&bgcolor="+bg+"&qzone=1&margin=0&size=500x500&ecc=L")
    $("#project_qr").parent().attr("href","https://api.qrserver.com/v1/create-qr-code/?data="+
        encodeURI("https://xr.mix-ar.ru/q?id="+id)+"&color=0075ff&bgcolor=FFFFFF&qzone=1&margin=0&size=500x500&ecc=L")
    $("#qr_svg").attr("href","https://api.qrserver.com/v1/create-qr-code/?data="+
        encodeURI("https://xr.mix-ar.ru/q?id="+id)+"&color=0075ff&bgcolor=FFFFFF&qzone=1&margin=0&size=500x500&ecc=L&format=svg&download=1")
}

function baseUrl() {
    var href = location.href.split('/');
    href.pop();
    href = href.join('/') + '/';
    return href;
}
let interaction_loaded = false;
function load_project(){
    window.UNITY.sendMessageToUnity(new Command("loadproject",{},[])).then(e=>{
        console.log(e);
        //alert(666)
        get_scenes(function(id){
            select_scene(id, function(){
                //alert(555)
                //alert(234)
                if(scene.anchors.length == 0){
                    scene.anchors = [{"id":Math.floor(Math.random() * 999999)+"","type":2}]
                    set_scene({anchors:scene.anchors})
                }
                let anchor_id = get_anchor();
                anchor = 0;
                for(var i = 0; i < scene.anchors.length; i++){
                    if(scene.anchors[i].id == anchor_id)
                        anchor = i;
                }
                if(scene.anchors[anchor].type == ANCHORS_TYPES.PlaneVertical ||
                    scene.anchors[anchor].type == ANCHORS_TYPES.PlaneHorizontal||
                    scene.anchors[anchor].type == ANCHORS_TYPES.CloudAnchor) {
                    //alert(123)
                    //$(".menu-markers-button, .anchors-menu").css("display", "none");
                }
                registr_scene_settings();

                select_anchor(scene.anchors[anchor].id, function(){
                    load_anchors_resourses();
                    //create_tmp_entity(function() {
                        get_entities(function(entities_ids){
                            get_project_resourses(function(){
                                parse_entities(entities_ids);
                                set_tool(TOOLS_TYPES.toolmove);
                                set_tool(TOOLS_TYPES.spaceworld);
                                $("#lock_scale").click()
                                select_menu_object(null)
                                //create_anchor();
                                /*setTimeout(function(){
                                    //actions.push(action)
                                    add_action(ACTIONS_ENUMS.type.Show, ACTIONS_ENUMS.visibilityAction.type.Show)
                                }, 1000);*/

                            });
                        });
                        get_interactive(function(_interactions){
                            interactions = _interactions;
                            interactions.forEach(function(_interaction){
                                if(_interaction.hasOwnProperty("anchor"))
                                    if(_interaction.anchor != get_anchor())
                                        return;
                                add_interaction(_interaction,undefined,false)
                            })
                            getProjectSettings(function(e){
                                if(!e.hasOwnProperty("webViewUrl")){
                                    setProjectSettings({webViewUrl:baseUrl()+"mainui.php"})
                                }
                            })
                            setTimeout(function(){
                                interaction_loaded = true;
                                check_interaction();
                            },5000)
                            setTimeout(function(){
                                //if(getCookie("editor_tour")!="1")
                                    //tour.start();
                            },1000)
                        })
                   // });

                });
            });
        });
    }).catch(e=>{console.log( e)});
}

function get_scenes(callback){
    window.UNITY.sendMessageToUnity(new Command("getscenes",{},[])).then(e=>{
        console.log(e);
        scenes = e;
        /*for(let i = 0; i < e.length;i++){
            if(e[i].id==getQueryVariable("scene")) {
                scene = e[i];
                callback(e[i].id);
                return;

            }
        }*/
        if(e.length >= Number(getQueryVariable("scene")))
            scene_number = Number(getQueryVariable("scene"))-1;
        scene = e[scene_number];
        callback(e[scene_number].id);
    }).catch(e=>{console.log( e)});
}
function get_anchor(){
    if(getQueryVariable("anchor")!=undefined)
        return getQueryVariable("anchor")
    return scene.anchors[0].id;
}

function select_scene(scene_id,callback) {
    console.log(scene_id)
    window.UNITY.sendMessageToUnity(new Command("selectscene", {}, [scene_id])).then(e=>{
        console.log(e);
        callback();
    }).catch(e=>{console.log( e)});

}
function select_anchor(anchor_id,callback){
    window.UNITY.sendMessageToUnity(new Command("selectanchor",{},[anchor_id])).then(e=>{
        console.log(e);
        callback();
    }).catch(e=>{console.log( e)});
}
function take_screenshot(callback){
    //console.log("take_screenshot")
    window.UNITY.sendMessageToUnity(new Command("getscreenshot", {}, [580,350])).then(e=>{
        console.log(e);
        callback(e);
    }).catch(e=>{console.log( e)});
}

function get_entities(callback){
    window.UNITY.sendMessageToUnity(new Command("getentities",{},[])).then(e=>{
        console.log(e);
        callback(e);
    }).catch(e=>{console.log( e)});
}

function get_project_resourses(callback){
    var resourses_types_count = 4;
    var callbacks_count = 0;
    //loading models
    get_resources(RESOURCES_TYPES.model,function (r){
        project_resources.models = r;
        callbacks_count++;
        check_loading_resourses_done();
    });
    //loading images
    get_resources(RESOURCES_TYPES.image,function (r){
        project_resources.images = r;
        callbacks_count++;
        check_loading_resourses_done();
    });
    //loading audio
    get_resources(RESOURCES_TYPES.audio,function (r){
        project_resources.audios = r;
        callbacks_count++;
        check_loading_resourses_done();
    });
    //loading video
    get_resources(RESOURCES_TYPES.video,function (r){
        project_resources.videos = r;
        callbacks_count++;
        check_loading_resourses_done();
    });

    function check_loading_resourses_done(){
        if(callbacks_count == resourses_types_count)
            callback();
    }
}
// get resources
function get_resources(type,callback){
    window.UNITY.sendMessageToUnity(new Command("getresources",{},[type])).then(e=>{
        console.log("getresources result")
        console.log(e)
        callback(e);
    }).catch(e=>{console.log( e)});
}
// parse entities
function parse_entities(entities_ids){
    entities_ids.forEach(function(entity_id){
        get_entity(entity_id,function(e){
            if(e.transform.parentId == scene.anchors[anchor].id) {
                var i = entities.push(e);
                var entity = entities[i - 1];
                console.log("RESOURCE " + entity.name + ", type " + entity.type);
                if (entity.type == ENTITIES_TYPES.model) {
                    //parse_model(entity);

                    entity.model.isPlaying = false
                    add_model(entity)
                }
                if (entity.type == ENTITIES_TYPES.audio)
                    //parse_audio(entity);
                    add_sound(entity);
                if (entity.type == ENTITIES_TYPES.video)
                    //parse_video(entity);
                    add_video(entity);
                /*if(entity.type == ENTITIES_TYPES.text)
                    parse_text(entity);*/
                if (entity.type == ENTITIES_TYPES.texture){
                    if(entity.hasOwnProperty("is_text") && entity.is_text)
                        add_text(entity);
                    else
                        add_image(entity);
                }
            }
        })
    });
}
function get_entity(entity_id,callback){
    window.UNITY.sendMessageToUnity(new Command("getentity",{},[entity_id])).then(e=>{
        console.log("get_entity")
        console.log(e);
        callback(e);
    }).catch(e=>{console.log( e)});
}
function parse_model(entity){
    /*console.log("PARSE MODEL "+entity.name);
    var obj = $("<div class=\"nav-item menu-object\" data-menu-type=\"3d\" data-title=\""+entity.name+"\" " +
        " data-id=\""+entity.id+"\">\n " +
        //"<img src=\"assets/images/3d-model.jpeg\" alt=\"\" class=\"avatar-xs rounded\">\n" +
        "<i class=\"bx bx-pyramid menu-block obj_icon\"></i>\n" +
        "<span data-key=\"t-dashboards\" class=\"menu-block menu_title\">"+entity.name+"</span>\n" +
        " <i class=\" bx bx-show show-button\" style=\"\"></i><i class=\" bx bx-hide hide-button\" " +
        "style=\"\"></i> </div>").appendTo("#models3d");
    $("#models3d-title").addClass("opened");
    if($("#models3d-title").hasClass("collapsed"))
        $("#models3d-title").click()
    registr_menu_object(obj,entity);*/
    //add_model(entity.name, entity, entity.renderer.materials[0].texture.contentId)
}
function parse_audio(entity){
    console.log("PARSE AUDIO "+entity.name);
    var obj = $("<div class=\"nav-item menu-object\" data-menu-type=\"audio\" data-title=\""+entity.name+"\" " +
        ">\n" +
        "<i class=\"bx bx-music menu-block obj_icon\"></i>\n" +
        "<span data-key=\"t-dashboards\" class=\"menu-block menu_title\">"+entity.name+"</span>\n" +
        " <i class=\" bx bx-show show-button\" style=\"\"></i><i class=\" bx bx-hide hide-button\" " +
        "style=\"\"></i> </div>").appendTo("#sounds");
    $("#sounds-title").addClass("opened");
    if($("#sounds-title").hasClass("collapsed"))
        $("#sounds-title").click()
    registr_menu_object(obj,entity);
}
function parse_video(entity){
    console.log("PARSE VIDEO "+entity.name);
    var obj = $("<div class=\"nav-item menu-object\" data-menu-type=\"video\" data-title=\""+entity.name+"\" " +
        ">\n" +
        //"<img src=\"assets/images/video.png\" alt=\"\" class=\"avatar-xs rounded\">\n" +
        "<i class=\"bx bx-film menu-block obj_icon\"></i>\n" +
        "<span data-key=\"t-dashboards\" class=\"menu-block menu_title\">"+entity.name+"</span>\n" +
        " <i class=\" bx bx-show show-button\" style=\"\"></i><i class=\" bx bx-hide hide-button\" " +
        "style=\"\"></i> </div>").appendTo("#videos");
    $("#videos-title").addClass("opened");
    if($("#videos-title").hasClass("collapsed"))
        $("#videos-title").click()
    registr_menu_object(obj,entity);
}
function parse_text(entity){
    console.log("PARSE TEXT "+entity.name);
    var obj = $("<div class=\"nav-item menu-object\" data-menu-type=\"text\" data-title=\""+entity.name+"\" " +
        ">\n" +
        "<i class=\"bx bx-text menu-block obj_icon\"></i>\n" +
        "<span data-key=\"t-dashboards\" class=\"menu-block menu_title\">"+entity.name+"</span>\n" +
        " <i class=\" bx bx-show show-button\" style=\"\"></i><i class=\" bx bx-hide hide-button\" " +
        "style=\"\"></i> </div>").appendTo("#textes");
    $("#textes-title").addClass("opened");
    if($("#textes-title").hasClass("collapsed"))
        $("#textes-title").click()
    registr_menu_object(obj,entity);
}
// load anchors resourses
function load_anchors_resourses(){
    get_resources(RESOURCES_TYPES.image,function (r){
        anchors_resourses = r;
        console.log("anchors_resourses!");
        console.log(anchors_resourses)
        let counter = 0;
        console.log("ADDING SCENES "+scenes.length)
        console.log(scenes);
        $(".menu-marker, .menu-scene, .scene_anchors").remove();
        scenes.forEach(function (sc) {
            console.log("ADD SCENE "+sc.id);
            let scene_num = counter;
            counter++;
            if(!sc.hasOwnProperty("name"))
                sc.name = "Сцена " +(scene_num+1);
            let scene_obj = $("<div class=\"nav-item menu-object menu-scene\" data-id='"+sc.id+"'" +
                "data-title='"+sc.name+"' data-menu-type='scene' id='scene"+scene_num+"'>\n" +
                "<div><i class=\"  bx bx-layer menu-block obj_icon\"></i></div> " +
                "<span data-key=\"t-dashboards\" class=\"menu-block menu_title\">"+sc.name+"</span>\n" +

                    "  <div class=\"dropend add-button\">\n" +
                    " <i class=\" bx bx-plus add_new_marker_button\" data-scene='"+scene_num+"' data-bs-toggle=\"modal\"" +
                "data-bs-target=\"#markerModal\"></i></div>\n" +
                    "<div class=\"dropend add-button \" floating-dropdown>\n" +
                "  <i class=\" bx bx-plus add_new_anchor_button floating-dropdown-button\" data-bs-toggle=\"dropdown\" " +
                " aria-expanded=\"false\" id=\"dropdownMenuButton1234\" data-bs-auto-close=\"outside\"></i>\n" +
                "    <div class=\"dropdown-menu\" aria-labelledby=\"dropdownMenuButton1234\" data-popper-placement=\"right-start\" >\n" +
                "       <o class=\"dropdown-item\" onclick=\"add_anchor("+ANCHORS_TYPES.PlaneHorizontal+",'"+sc.id+"')\">" +
                "Привязка к полу</o>\n" +
                "       <o class=\"dropdown-item\" onclick=\"add_anchor("+ANCHORS_TYPES.PlaneVertical+",'"+sc.id+"')\">" +
                "Привязка к стене</o>\n" +
                "       <o class=\"dropdown-item\" onclick=\"add_anchor("+ANCHORS_TYPES.MarkerHorizontal+",'"+sc.id+"')\">" +
                "Привязка к изображению</o>\n" +
                "       </div>\n" +
                "   </div>\n" +
                    "  </div>")
                .appendTo("#anchors-menu  .anchors-menu");
            let scene_anchors_obj = $("<div class='scene_anchors' id='scene_anchors"+scene_num+"'></div>")
                .appendTo("#anchors-menu  .anchors-menu");

            $(scene_obj).on("click",function(ev){
                if(!($(ev.target).hasClass("show-button") || $(ev.target).hasClass("hide-button") ||
                    $(ev.target).hasClass("add_new_marker_button") || $(ev.target).hasClass("add_new_anchor_button"))) {
                    $(this).addClass("checked");
                    select_menu_object(this);
                }
            });
            registr_context_menu(scene_obj,"scene"+scene_num,"scene")

            $(scene_obj).find(".add_new_marker_button").on("click",function(){
                adding_marker_scene = Number($(this).attr("data-scene"));
                is_switching_marker = false;
                $("#marker_name_input,#marker_orientation_input, #marker_name_label, #marker_orientation_label")
                    .css("display", "none");
            })
            $(scene_obj).find(".add_new_marker_button").css("display","none");
            $(scene_obj).find(".add_new_anchor_button").css("display","none");

            if(sc.anchors.length==0){
                $(scene_obj).find(".add_new_anchor_button").css("display","block")
            } else if(sc.anchors[0].type == ANCHORS_TYPES.MarkerVertical ||
                sc.anchors[0].type == ANCHORS_TYPES.MarkerHorizontal)
                $(scene_obj).find(".add_new_marker_button").css("display","block")
            sc.anchors.forEach(function (anc) {
                if(anc.type == ANCHORS_TYPES.MarkerVertical ||
                    anc.type == ANCHORS_TYPES.MarkerHorizontal){
                    add_marker(anc, scene_num)
                        //$(".nav-item.menu-object.menu-marker:eq(0)").click();
                        //$(".menu-marker:eq(0)").addClass("checked");
                    if($(".menu-markers-button").hasClass("collapsed")){
                        $(".menu-markers-button").click();
                    }
                };
                if(anc.type == ANCHORS_TYPES.PlaneVertical ||
                    anc.type == ANCHORS_TYPES.PlaneHorizontal) {
                    add_plane(anc, scene_num);

                }
                if(anc.type == ANCHORS_TYPES.CloudAnchor) {
                    add_cloud_anchor(anc, scene_num);

                }
            });

            if($(".menu-markers-button").hasClass("collapsed")){
                $(".menu-markers-button").click();
            }
        })
        /*if($(".menu-markers-button").hasClass("collapsed")){
            $(".menu-markers-button").click();
        }*/
    });





    //OLD
    //loading anchors
    /*if(scene.anchors[anchor].type == ANCHORS_TYPES.MarkerVertical ||
        scene.anchors[anchor].type == ANCHORS_TYPES.MarkerHorizontal){
        get_resources(RESOURCES_TYPES.image,function (r){
            anchors_resourses = r;
            console.log("anchors_resourses!");
            console.log(anchors_resourses)
            $(".menu-markers-button").css("display", "inline-block");
            scene.anchors.forEach(marker => add_marker(marker));
            //$(".nav-item.menu-object.menu-marker:eq(0)").click();
            //$(".menu-marker:eq(0)").addClass("checked");
            if($(".menu-markers-button").hasClass("collapsed")){
                $(".menu-markers-button").click();
            }
        });

    }*/

}
function get_anchors(){
    console.log("get_anchors")
    window.UNITY.sendMessageToUnity(new Command("getanchors",{},[scene.id])).then(e=>{

        console.log("get_anchors result")
        console.log(e)

    }).catch(e=>{console.log( e)});
}

function create_anchor(){
    console.log("create_anchor")
    window.UNITY.sendMessageToUnity(new Command("addanchor",{},[])).then(e=>{
        console.log("anchor created")

    }).catch(e=>{console.log( e)});
}

function add_scene(callback){
    window.UNITY.sendMessageToUnity(new Command("addscene", {}, [])).then(e=>{
        if(callback != undefined)
            callback(e);
    }).catch(e=>{console.log( e)});
}

function delete_scene(scene_id, callback){
    window.UNITY.sendMessageToUnity(new Command("deletescene", {}, [scene_id])).then(e=>{
        if(callback != undefined)
            callback(e);
    }).catch(e=>{console.log( e)});
}

function create_tmp_entity(callback){


    console.log("createentity")
    window.UNITY.sendMessageToUnity(new Command("createentity",{},[ENTITIES_TYPES.texture,scene.anchors[anchor].id])).then(e=>{
        console.log("entity created")
        console.log(e);
        console.log("setentity");
        /*set_entity(e,{transform:{position:{x:20.0}}}, function(){
            callback();
        })*/
        set_entity(e,{name:"123"}, function(){

        })
        callback();
    }).catch(e=>{console.log( e)});


}


function create_entity(type, callback){
    console.log("createentity")
    window.UNITY.sendMessageToUnity(new Command("createentity",{},[type,scene.anchors[anchor].id])).then(e=>{
        console.log("entity created")
        console.log(e);
        callback(e);
    }).catch(e=>{console.log( e)});
}

function set_entity(id, data, callback){
    window.UNITY.sendMessageToUnity(new Command("setentity",JSON.stringify(data),[id])).then(e=>{
        console.log("setentity done")
        console.log(e);
        if(callback != undefined)
            callback();
    }).catch(e=>{console.log( e);});
}

function delete_entity(_id,callback){
    console.log("delete_entity");
    for( var i = 0; i < entities.length; i++){
        if ( entities[i].id == _id) {
            entities.splice(i, 1);

            window.UNITY.sendMessageToUnity(new Command("deleteentity",{},[_id])).then(e=>{
                console.log("delete done")
                console.log(e);
                //select_entity(-1)
                if(callback != undefined)
                    callback();
            }).catch(e=>{console.log( e);});
        }
    }

}
function select_entity(_id,callback){
    console.log("select_entity "+_id);
    window.UNITY.sendMessageToUnity(new Command("selectentity",{},[_id])).then(e=>{
        console.log("select done")
        console.log(e);
        if(callback != undefined)
            callback();
    }).catch(e=>{console.log( e);});

}




//adding assets
$(document).ready(function(){
    console.log("pond1")
    FilePond.registerPlugin(FilePondPluginFileValidateType);
    FilePond.registerPlugin(FilePondPluginFileValidateSize);
    FilePond.registerPlugin(FilePondPluginImagePreview);
    console.log("pond2")
})


async function getAsByteArray(file,callback) {
    return new Uint8Array(await readFile(file))
    //callback(new Uint8Array(await readFile(file));
}
function readFile(file) {
    return new Promise((resolve, reject) => {
        // Create file reader
        let reader = new FileReader()

        // Register event listeners
        reader.addEventListener("loadend", e => resolve(e.target.result))
        reader.addEventListener("error", reject)

        // Read file
        reader.readAsArrayBuffer(file)
    })
}
async function postData(url = '', data = {}) {
    // Default options are marked with *
    const response = await fetch(url, {
        method: 'POST', // *GET, POST, PUT, DELETE, etc.
        mode: 'cors', // no-cors, *cors, same-origin
        cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
        credentials: 'same-origin', // include, *same-origin, omit
        headers: {
            'Content-Type': 'application/octet-stream',
            "Authorization": "Bearer "+getCookie("token")
            // 'Content-Type': 'application/x-www-form-urlencoded',
        },
        redirect: 'follow', // manual, *follow, error
        referrerPolicy: 'no-referrer', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
        body: data
    });
    return response.json(); // parses JSON response into native JavaScript objects
}



/*putData('https://mixar-api.ru/project?id=120&name=hhh',
    {})
    .then((res) => {
        alert(JSON.stringify(res))
    });*/
async function putData(url = '', data = {}) {
    // Default options are marked with *
    const response = await fetch(url, {
        method: 'PUT', // *GET, POST, PUT, DELETE, etc.
        mode: 'cors', // no-cors, *cors, same-origin
        cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
        credentials: 'same-origin', // include, *same-origin, omit
        headers: {
            'Content-Type': 'application/octet-stream'
            // 'Content-Type': 'application/x-www-form-urlencoded',
        },
        redirect: 'follow', // manual, *follow, error
        referrerPolicy: 'no-referrer', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
        body: data
    });
    return response.json(); // parses JSON response into native JavaScript objects
}
//adding marker
var close_marker_button = $("#close_marker_button");
var add_marker_button = $("#add_marker_button");
var marker_name_input = $("#marker_name_input");
var marker_size_x_input = $("#marker_size_x_input");
var marker_size_y_input = $("#marker_size_y_input");
var marker_orientation_input = $("#marker_orientation_input");
var uploading_marker_asp_rat = 1.0;
var marker_file_name = "";
var marker_pond;

$(document).ready(function(){
    marker_pond = FilePond.create(document.querySelector('#uploadmarker'), {
        acceptedFileTypes: ['image/png', 'image/jpeg'],
        fileValidateTypeDetectType: (source, type) =>
            new Promise((resolve, reject) => {
                //alert(resolve)
                // Do custom type detection here and return with promise

                resolve(type);
            })

    });

    marker_pond.on('addfile', (error,file) => {
        if (error) {
            console.log('Oh no');
            return;
        }
        var filename =  marker_pond.getFile().filename;
        marker_file_name = filename;
        console.log('File added',filename);
        marker_name_input.removeAttr("disabled");
        add_marker_button.removeAttr("disabled");
        marker_size_x_input.removeAttr("disabled");
        marker_size_y_input.removeAttr("disabled");
        marker_orientation_input.removeAttr("disabled");
        marker_name_input.val(filename);
        var reader = new FileReader();
        reader.readAsDataURL(marker_pond.getFile().file);
        reader.onload = function (e) {

            //Initiate the JavaScript Image object.
            var image = new Image();

            //Set the Base64 string return from FileReader as source.
            image.src = e.target.result;

            //Validate the File Height and Width.
            image.onload = function () {
                uploading_marker_asp_rat = 1.0*this.width/this.height;
                marker_size_x_input.val("20.0");
                marker_size_y_input.val(20.0/uploading_marker_asp_rat+"");

            };
        };
    });
    marker_pond.on('removefile',(error,file) => {
        if (error) {
            console.log('Oh no');
            return;
        }
        marker_name_input.attr("disabled","");
        add_marker_button.attr("disabled","");
        marker_name_input.val("");
        marker_size_x_input.attr("disabled","");
        marker_size_y_input.attr("disabled","");
        marker_size_x_input.val("");
        marker_size_y_input.val("");
        marker_orientation_input.attr("disabled","");
    });
});

document.getElementById("marker_size_x_input").addEventListener("input",function(){
    if(marker_size_x_input.val()!="" && parseFloat(marker_size_x_input.val())>0)
        marker_size_y_input.val(parseFloat(marker_size_x_input.val())/uploading_marker_asp_rat);
    else
        marker_size_y_input.val("0.0");
});
document.getElementById("marker_size_y_input").addEventListener("input",function(){
    if(marker_size_y_input.val()!="" && parseFloat(marker_size_y_input.val())>0)
        marker_size_x_input.val(parseFloat(marker_size_y_input.val())*uploading_marker_asp_rat);
    else
        marker_size_x_input.val("0.0");
});
marker_size_x_input.on("blur",function(){
    if(parseFloat(marker_size_x_input.val())<=0 || marker_size_x_input.val() == "") {
        marker_size_x_input.val("20.0");
        marker_size_y_input.val(20.0/uploading_marker_asp_rat+"");
    }

})
marker_size_y_input.on("blur",function(){
    if(parseFloat(marker_size_y_input.val())<=0 || marker_size_y_input.val() == "") {
        marker_size_x_input.val("20.0");
        marker_size_y_input.val(20.0/uploading_marker_asp_rat+"");
    }

})


var uploading_marker_asp_rat2 = 1.0;
var marker_width_input = $("#marker_width");
var marker_height_input = $("#marker_height");
document.getElementById("marker_width").addEventListener("input",function(){
    if(marker_width_input.val()!="" && parseFloat(marker_width_input.val())>0)
        marker_height_input.val(parseFloat(marker_width_input.val())/uploading_marker_asp_rat2);
    else
        marker_height_input.val("0.0");
});
document.getElementById("marker_height").addEventListener("input",function(){
    if(marker_height_input.val()!="" && parseFloat(marker_height_input.val())>0)
        marker_width_input.val(parseFloat(marker_height_input.val())*uploading_marker_asp_rat2);
    else
        marker_width_input.val("0.0");
});
marker_width_input.on("blur",function(){
    if(parseFloat(marker_width_input.val())<=0 || marker_width_input.val() == "") {
        marker_width_input.val("20.0");
        marker_height_input.val(20.0/uploading_marker_asp_rat2+"");
        change_marker_parms(selected_obj,"markerWidth", 0.1);
    }

})
marker_height_input.on("blur",function(){
    if(parseFloat(marker_height_input.val())<=0 || marker_height_input.val() == "") {
        marker_width_input.val("20.0");
        marker_height_input.val(20.0/uploading_marker_asp_rat2+"");
        change_marker_parms(selected_obj,"markerWidth", 0.1);
    }

})



/*postData('https://mixar-api.ru/project?name=test&description=description&visibility=1',"asdasd")
    .then((res) => {
        alert(JSON.stringify(res));

    });*/

/*
postData('https://mixar-api.ru/project/99/put?name=test&description=description&visibility=1',)
    .then((res) => {
        alert(JSON.stringify(res));

    });*/

add_marker_button.on("click",async function(){
    $("#markerModal .upload_area").css("display","none");
    $("#markerModal .loading-bar").css("display","block");
    marker_name_input.attr("disabled","");
    add_marker_button.attr("disabled","");
    const selectedFile = marker_pond.getFile().file;
    const byteFile = await getAsByteArray(selectedFile);
    postData('https://mixar-api.ru/asset?name='+encodeURI(marker_file_name)
        +'&type=image&extension='+marker_pond.getFile().fileExtension, byteFile)
        .then((res) => {

            close_marker_button.click();
            marker_name_input.val("");
            $("#markerModal .upload_area").css("display","block");
            $("#markerModal .loading-bar").css("display","none");
            var pond_ids = [];
            if (marker_pond.getFiles().length != 0) {  // "pond" is an object, created by FilePond.create
                marker_pond.getFiles().forEach(function(file) {
                    pond_ids.push(file.id);
                });
            }
            get_resources(RESOURCES_TYPES.image,function (r){
                anchors_resourses = r;
                console.log("anchors_resourses!");
                console.log(anchors_resourses)



                if(is_switching_marker){
                    var marker = scene.anchors.find(({ id }) => id == selected_obj);
                    console.log("is_switching_marker")
                    console.log(JSON.stringify(marker))

                    change_marker_parms(marker.id, "contentId",res)
                    console.log(parseFloat(marker_size_x_input.val())/100.0)
                    change_marker_parms(marker.id,"markerWidth", parseFloat(marker_size_x_input.val())/100.0);
                    console.log(JSON.stringify(marker))
                    var anchor_resource = anchors_resourses.find(({ id }) => id == marker.contentId);
                    var url = anchor_resource.domain[0]+anchor_resource.path;
                    console.log(url)
                    get_image_aspect_ratio(url,function(asp_rat){
                        var img_style = "center / cover no-repeat, #ededed";
                        if(asp_rat > contain_image_max_asp_rat || asp_rat < contain_image_min_asp_rat)
                            img_style = "center / cover no-repeat, #ededed";

                        console.log(img_style)
                        //add_marker()
                        $("#"+selected_obj).find(".preview").css("background", "url("+url+") "+img_style);

                        $("#"+selected_obj).click();
                    })

                    marker_pond.removeFiles(pond_ids);
                    marker_name_input.attr("disabled","");
                    add_marker_button.attr("disabled","");
                    location.reload();
                    //$("#"+selected_obj)

                }
                else {


                    var marker = {
                        "id":"a"+Math.floor(Math.random() * 999999)+"",
                        "type":0,
                        "contentId":res,
                        "markerWidth":parseFloat(marker_size_x_input.val())/100.0,
                        "markerName":marker_file_name
                    };
                    scenes[adding_marker_scene].anchors.push(marker);
                    set_scene({anchors:scenes[adding_marker_scene].anchors},function (){
                            load_anchors_resourses()
                        },
                        scenes[adding_marker_scene].id)
                    console.log(JSON.stringify(marker))
                    /*var anchor_resource = anchors_resourses.find(({ id }) => id == marker.contentId);
                    var url = anchor_resource.domain[0]+anchor_resource.path;
                    console.log(url);
                    get_image_aspect_ratio(url,function(asp_rat){
                        var img_style = "center / cover no-repeat, #ededed";
                        if(asp_rat > contain_image_max_asp_rat || asp_rat < contain_image_min_asp_rat)
                            img_style = "center / cover no-repeat, #ededed";

                        console.log(img_style)
                        //add_marker()
                        $("#"+selected_obj).find(".preview").css("background", "url("+url+") "+img_style);

                        $("#"+selected_obj).click();
                    })*/

                    marker_pond.removeFiles(pond_ids);
                    marker_name_input.attr("disabled","");
                    add_marker_button.attr("disabled","");
                    //add_marker(marker, adding_marker_scene)





                    $(".menu-markers-button").css("display", "inline-block");


                    //scene.anchors.forEach(marker => add_marker(marker));
                    //$(".nav-item.menu-object.menu-marker:eq(0)").click();
                    //$(".menu-marker:eq(0)").addClass("checked");
                }

                if($(".menu-markers-button").hasClass("collapsed")){
                    $(".menu-markers-button").click();
                }
            });
        });

})
$("#change_marker_image").on("click",function(){
    is_switching_marker = true;
    $("#marker_name_input,#marker_orientation_input, #marker_name_label, #marker_orientation_label")
        .css("display", "none");
})
/*$(".add_new_marker_button").on("click",function(){
    alert(Number($(this).attr("data-scene")))
    adding_marker_scene = Number($(this).attr("data-scene"))
    is_switching_marker = false;
    $("#marker_name_input,#marker_orientation_input, #marker_name_label, #marker_orientation_label")
        .css("display", "none");
})*/
$("#add_new_scene_button").on("click",function(){
    add_scene(function () {
        get_scenes(function(id) {
            load_anchors_resourses()
        });
    });
});

//adding images
var close_image_button = $("#close_image_button");
var add_image_button = $("#add_image_button");
var image_name_input = $("#image_name_input");
var image_pond;

$(document).ready(function() {
    console.log("img_pond1")
    image_pond = FilePond.create(document.querySelector('#uploadimage'), {
        acceptedFileTypes: ['image/png', 'image/jpeg'],
        fileValidateTypeDetectType: (source, type) =>
            new Promise((resolve, reject) => {
                //alert(resolve)
                // Do custom type detection here and return with promise

                resolve(type);
            })

    });
    image_pond.on('addfile', (error, file) => {
        if (error) {
            console.log('Oh no');
            return;
        }
        var filename = image_pond.getFile().filename;
        console.log('File added', filename);
        image_name_input.removeAttr("disabled");
        add_image_button.removeAttr("disabled");
        image_name_input.val(filename);
    });
    image_pond.on('removefile', (error, file) => {
        if (error) {
            console.log('Oh no');
            return;
        }
        image_name_input.attr("disabled", "");
        add_image_button.attr("disabled", "");
        image_name_input.val("");
    });

    console.log("img_pond2")
});
add_image_button.on("click",async function(){
    $("#imageModal .upload_area").css("display","none");
    $("#imageModal .loading-bar").css("display","block");
    image_name_input.attr("disabled","");
    add_image_button.attr("disabled","");
    const selectedFile = image_pond.getFile().file;
    const byteFile = await getAsByteArray(selectedFile);
    postData('https://mixar-api.ru/asset?name='+encodeURI(image_name_input.val())
        +'&type=image&extension='+image_pond.getFile().fileExtension, byteFile)
        .then((content_id) => {
            //alert(JSON.stringify(content_id));
            var title = image_name_input.val();
            close_image_button.click();
            image_name_input.val("");
            $("#imageModal .upload_area").css("display","block");
            $("#imageModal .loading-bar").css("display","none");
            var pond_ids = [];
            if (image_pond.getFiles().length != 0) {  // "pond" is an object, created by FilePond.create
                image_pond.getFiles().forEach(function(file) {
                    pond_ids.push(file.id);
                });
            }
            image_pond.removeFiles(pond_ids);
            image_name_input.attr("disabled","");
            add_image_button.attr("disabled","");
            get_resources(RESOURCES_TYPES.image,function (r){
                project_resources.images = r;
                console.log("update image resources")
                console.log(project_resources.images);
                var image_resource = project_resources.images.find(({ id }) => id == content_id);
                var url = image_resource.domain[0]+image_resource.path;
                var rotation = {"x":0,"y":0,"z":0}
                var position = {
                    x: 0,
                    y: 0,
                    z: 0
                }
                if(scene.anchors[anchor].type == ANCHORS_TYPES.MarkerHorizontal) {
                    rotation = {"x":-90,"y":180,"z":0}
                    position = {
                        x: 0,
                        y: 0.0001,
                        z: 0
                    }
                }
                if(scene.anchors[anchor].type == ANCHORS_TYPES.MarkerVertical) {
                    position = {
                        x: 0,
                        y: 0,
                        z: 0.0001
                    }
                }
                if(scene.anchors[anchor].type == ANCHORS_TYPES.PlaneHorizontal) {
                    rotation = {"x":-90,"y":0,"z":0}
                }
                get_image_aspect_ratio(url,function(asp_rat) {
                    create_entity(ENTITIES_TYPES.texture, function(id) {
                        set_entity(id, {
                            name: title,
                            renderer: {
                                materials: [{
                                    texture: {
                                        contentId: content_id,
                                        tiling: {
                                            x: 1.0,
                                            y: 1.0
                                        }
                                    }
                                }]
                            },
                            transform: {
                                position:position,
                                rotation:rotation,
                                scale: {
                                    x:0.1,
                                    y:0.1/asp_rat,
                                    z:1.0
                                }
                            },
                            manipulation:{
                                "movable": false,
                                "sizable": false,
                                "rotatable": false,
                                "heightCorrection": false
                            }
                        },function(){
                            get_entity(id,function(e){
                                var i = entities.push(e);
                                var entity = entities[i-1];
                                add_image(entity, function(obj){
                                    obj.click();
                                });
                            })
                        });

                    })
                });
            })
    });

})
//adding models
var close_model_button = $("#close_model_button");
var add_model_button = $("#add_model_button");
var model_name_input = $("#model_name_input");
var model_pond;

$(document).ready(function() {
    model_pond = FilePond.create(document.querySelector('#uploadmodel'), {
        acceptedFileTypes: ['.glb'],
        fileValidateTypeDetectType: (source, type) =>
            new Promise((resolve, reject) => {
                resolve("." + source.name.split('.').pop())
            })

    });
    model_pond.on('addfile', (error, file) => {
        if (error) {
            console.log('Oh no');
            return;
        }
        var filename = model_pond.getFile().filename;
        console.log('File added', filename);
        model_name_input.removeAttr("disabled");
        add_model_button.removeAttr("disabled");
        model_name_input.val(filename);
    });
    model_pond.on('removefile', (error, file) => {
        if (error) {
            console.log('Oh no');
            return;
        }
        model_name_input.attr("disabled", "");
        add_model_button.attr("disabled", "");
        model_name_input.val("");
    });
});
add_model_button.on("click",async function(){
    $("#modelModal .upload_area").css("display","none");
    $("#modelModal .loading-bar").css("display","block");
    model_name_input.attr("disabled","");
    add_model_button.attr("disabled","");
    const selectedFile = model_pond.getFile().file;
    const byteFile = await getAsByteArray(selectedFile);
    postData('https://mixar-api.ru/asset?name='+encodeURI(model_name_input.val())
        +'&type=model&shared=false&extension='+model_pond.getFile().fileExtension, byteFile)
        .then((content_id) => {
            //alert(JSON.stringify(content_id));
            var title = model_name_input.val();
            close_model_button.click();
            model_name_input.val("");
            $("#modelModal .upload_area").css("display","block");
            $("#modelModal .loading-bar").css("display","none");
            var pond_ids = [];
            if (model_pond.getFiles().length != 0) {  // "pond" is an object, created by FilePond.create
                model_pond.getFiles().forEach(function(file) {
                    pond_ids.push(file.id);
                });
            }
            model_pond.removeFiles(pond_ids);
            model_name_input.attr("disabled","");
            add_model_button.attr("disabled","");
            get_resources(RESOURCES_TYPES.model,function (r){
                project_resources.models = r;
                console.log("update model resources")
                console.log(project_resources.models);
                //var model_resource = project_resources.models.find(({ id }) => id == content_id);
                //var url = model_resource.domain[0]+model_resource.path;
                var rotation = {"x":0,"y":0,"z":0}
                if(scene.anchors[anchor].type == ANCHORS_TYPES.MarkerHorizontal) {
                    rotation = {"x":0,"y":180,"z":0}
                }
                create_entity(ENTITIES_TYPES.model, function(id) {
                    loading_models.push(id);
                    console.log("loading_models")
                    console.log(loading_models)
                    set_entity(id, {
                        name: title,
                        model: {
                            contentId: content_id
                        },
                        transform: {
                            rotation:rotation
                        },
                        manipulation:{
                            "movable": false,
                            "sizable": false,
                            "rotatable": false,
                            "heightCorrection": false
                        }
                    },function(){

                    });
                })

            })
        });

})
const LIBRARY = {
    images : {
        nature : {
            "id": 1000471,
            "name": "Nature.jpg",
            "type": "image",
            "domain": [
                "https://mixar-api.ru/data-dev/"
            ],
            "path": "1000471.jpg",
            "shared": true
        }
    },
    videos : {
        nature : {
            "id": 1000233,
            "name": "Nature.mp4",
            "type": "video",
            "domain": [
                "https://mixar-api.ru/data-dev/"
            ],
            "path": "1000233.mp4",
            "shared": true
        }
    },
    sounds : {
        triceratops: {
            "id": 1002305,
            "name": "Triceratops.mp3",
            "type": "audio",
            "domain": [
                "https://mixar-api.ru/data-dev/"
            ],
            "path": "1002305.mp3",
            "shared": true
        }
    },
    models : {
        helicopter : {
            "id": 1000005,
            "name": "Helicopter",
            "type": "model",
            "domain": [
                "https://mixar-api.ru/data-dev/"
            ],
            "path": "1000005.glb",
            "shared": true
        },
        balloon : {
            "id": 1000140,
            "name": "Balloon",
            "type": "model",
            "domain": [
                "https://mixar-api.ru/data-dev/"
            ],
            "path": "1000140.glb",
            "shared": true
        },
        humanfigure : {
            "id": 1000141,
            "name": "Humanfigure",
            "type": "model",
            "domain": [
                "https://mixar-api.ru/data-dev/"
            ],
            "path": "1000141.glb",
            "shared": true
        },
        boat : {
            "id": 1000142,
            "name": "Boat",
            "type": "model",
            "domain": [
                "https://mixar-api.ru/data-dev/"
            ],
            "path": "1000142.glb",
            "shared": true
        },
        train: {
            "id": 1000143,
            "name": "Train",
            "type": "model",
            "domain": [
                "https://mixar-api.ru/data-dev/"
            ],
            "path": "1000143.glb",
            "shared": true
        },
        car: {
            "id": 1000152,
            "name": "Car",
            "type": "model",
            "domain": [
                "https://mixar-api.ru/data-dev/"
            ],
            "path": "1000152.glb",
            "shared": true
        },
        chair: {
            "id": 1000144,
            "name": "Chair",
            "type": "model",
            "domain": [
                "https://mixar-api.ru/data-dev/"
            ],
            "path": "1000144.glb",
            "shared": true
        },
        table: {
            "id": 1000145,
            "name": "Table",
            "type": "model",
            "domain": [
                "https://mixar-api.ru/data-dev/"
            ],
            "path": "1000145.glb",
            "shared": true
        },
        laptop: {
            "id": 1000146,
            "name": "Laptop",
            "type": "model",
            "domain": [
                "https://mixar-api.ru/data-dev/"
            ],
            "path": "1000146.glb",
            "shared": true
        },
        book: {
            "id": 1000147,
            "name": "Book",
            "type": "model",
            "domain": [
                "https://mixar-api.ru/data-dev/"
            ],
            "path": "1000147.glb",
            "shared": true
        },
        tv: {
            "id": 1000148,
            "name": "TV",
            "type": "model",
            "domain": [
                "https://mixar-api.ru/data-dev/"
            ],
            "path": "1000148.glb",
            "shared": true
        },
        plant: {
            "id": 1000149,
            "name": "Plant",
            "type": "model",
            "domain": [
                "https://mixar-api.ru/data-dev/"
            ],
            "path": "1000149.glb",
            "shared": true
        },
        amelie: {
            "id": 1000153,
            "name": "Amelie",
            "type": "model",
            "domain": [
                "https://mixar-api.ru/data-dev/"
            ],
            "path": "1000153.glb",
            "shared": true
        },
        bot: {
            "id": 1000154,
            "name": "Bot",
            "type": "model",
            "domain": [
                "https://mixar-api.ru/data-dev/"
            ],
            "path": "1000154.glb",
            "shared": true
        },
        malik: {
            "id": 1000155,
            "name": "Malik",
            "type": "model",
            "domain": [
                "https://mixar-api.ru/data-dev/"
            ],
            "path": "1000155.glb",
            "shared": true
        },
        cube: {
            "id": 1000675,
            "name": "Cube",
            "type": "model",
            "domain": [
                "https://mixar-api.ru/data-dev/"
            ],
            "path": "1000675.glb",
            "shared": true
        },
        sphere: {
            "id": 1000676,
            "name": "Sphere",
            "type": "model",
            "domain": [
                "https://mixar-api.ru/data-dev/"
            ],
            "path": "1000676.glb",
            "shared": true
        },
        plane: {
            "id": 1000677,
            "name": "Plane",
            "type": "model",
            "domain": [
                "https://mixar-api.ru/data-dev/"
            ],
            "path": "1000677.glb",
            "shared": true
        },
        triceratops: {
            "id": 1002307,
            "name": "Triceratops",
            "type": "model",
            "domain": [
                "https://mixar-api.ru/data-dev/"
            ],
            "path": "1002307.glb",
            "shared": true
        },
        tyrannosa: {
            "id": 1002310,
            "name": "Tyrannosa",
            "type": "model",
            "domain": [
                "https://mixar-api.ru/data-dev/"
            ],
            "path": "1002310.glb",
            "shared": true
        },
        velociraptor: {
            "id": 1002314,
            "name": "Velociraptor",
            "type": "model",
            "domain": [
                "https://mixar-api.ru/data-dev/"
            ],
            "path": "1002314.glb",
            "shared": true
        },
        palmtree: {
            "id": 1002315,
            "name": "Palm",
            "type": "model",
            "domain": [
                "https://mixar-api.ru/data-dev/"
            ],
            "path": "1002315.glb",
            "shared": true
        },
        roses: {
            "id": 1002316,
            "name": "Roses",
            "type": "model",
            "domain": [
                "https://mixar-api.ru/data-dev/"
            ],
            "path": "1002316.glb",
            "shared": true
        },
        tulips: {
            "id": 1002317,
            "name": "Tulips",
            "type": "model",
            "domain": [
                "https://mixar-api.ru/data-dev/"
            ],
            "path": "1002317.glb",
            "shared": true
        }
    }
}
function add_model_from_lib(res){
    var i = project_resources.models.push(res);

    create_entity(ENTITIES_TYPES.model, function(id) {
        loading_models.push(id);
        console.log("loading_models")
        console.log(loading_models)
        console.log("[add_model_from_lib]")
        var rotation = {"x":0,"y":0,"z":0}
        if(scene.anchors[anchor].type == ANCHORS_TYPES.MarkerHorizontal) {
            rotation = {"x":0,"y":180,"z":0}
        }
        set_entity(id, {
            transform:{
                rotation:rotation
            },
            manipulation:{
                "movable": false,
                "sizable": false,
                "rotatable": false,
                "heightCorrection": false
            }
        }, function(){
            set_entity(id, {
                name: res.name,
                model: {
                    contentId: res.id
                }
            }, function(){
                /*get_entity(id,function(e){
                    console.log("[add_model_from_lib] [set_entity] [get_entity]",JSON.stringify(e))
                })*/
            });
        });


        /*get_entity(id,function(e){
            var i = entities.push(e);
            var entity = entities[i-1];
            add_model(entity, function(obj){
                obj.click();
            });
        })*/
    })
}

function clone_model(id,callback){
    get_entity(id,function(data){
        create_entity(ENTITIES_TYPES.model, function(_id) {
            loading_models.push(_id);
            var _data = { ...data }
            delete _data.id;
            _data.name += " (clone)"
            set_entity(_id, _data, function(){

                get_entity(_id,function(e){
                    for(let i = 0; i < entities.length; i++){
                        if(entities[i].id == _id) {
                            console.log(entities[i])
                            entities[i] = e;
                            show_object_parms(_id)
                            callback(id)
                        }
                    }
                })
            });



        })
    })

}

function add_video_from_lib(res){
    var i = project_resources.videos.push(res);
    var url = res.domain[0]+res.path;
    var rotation = {"x":0,"y":0,"z":0}
    var position = {
        x: 0,
        y: 0,
        z: 0
    }
    if(scene.anchors[anchor].type == ANCHORS_TYPES.MarkerHorizontal) {
        rotation = {"x":-90,"y":180,"z":0}
        position = {
            x: 0,
            y: 0.0001,
            z: 0
        }
    }
    if(scene.anchors[anchor].type == ANCHORS_TYPES.MarkerVertical) {
        position = {
            x: 0,
            y: 0,
            z: 0.0001
        }
    }
    if(scene.anchors[anchor].type == ANCHORS_TYPES.PlaneHorizontal) {
        rotation = {"x":-90,"y":0,"z":0}
    }
    get_video_aspect_ratio(url,function(asp_rat) {
        create_entity(ENTITIES_TYPES.video, function (id) {
            set_entity(id, {
                name: res.name,
                video: {
                    contentId: res.id,
                    volume: 1.0,
                    loop: false,
                    playOnAwake: false,
                    chromakey: false
                },
                transform: {
                    position: position,
                    rotation: rotation,
                    scale: {
                        x: 0.1,
                        y: 0.1 / asp_rat,
                        z: 1.0
                    }
                },
                manipulation: {
                    "movable": false,
                    "sizable": false,
                    "rotatable": false,
                    "heightCorrection": false
                }
            }, function(){
                get_entity(id, function (e) {
                    var i = entities.push(e);
                    var entity = entities[i - 1];
                    add_video(entity, function (obj) {
                        obj.click();
                    });
                })
            });

        })
    })
}
function clone_video(id,callback){
    get_entity(id,function(data){
        create_entity(ENTITIES_TYPES.video, function (id) {
            var _data = { ...data }
            delete _data.id;
            _data.name += " (clone)";
            set_entity(id, _data, function(){
                get_entity(id, function (e) {
                    var i = entities.push(e);
                    var entity = entities[i - 1];
                    add_video(entity, function (obj) {
                        obj.click();
                        callback()
                    });
                })
            });

        })
    })

}
function add_image_from_lib(res){
    var i = project_resources.images.push(res);
    var url = res.domain[0]+res.path;
    var rotation = {"x":0,"y":0,"z":0}
    var position = {
        x: 0,
        y: 0,
        z: 0
    }
    if(scene.anchors[anchor].type == ANCHORS_TYPES.MarkerHorizontal) {
        rotation = {"x":-90,"y":180,"z":0}
        position = {
            x: 0,
            y: 0.0001,
            z: 0
        }
    }
    if(scene.anchors[anchor].type == ANCHORS_TYPES.MarkerVertical) {
        position = {
            x: 0,
            y: 0,
            z: 0.0001
        }
    }
    if(scene.anchors[anchor].type == ANCHORS_TYPES.PlaneHorizontal) {
        rotation = {"x":-90,"y":0,"z":0}
    }
    get_image_aspect_ratio(url,function(asp_rat) {
        create_entity(ENTITIES_TYPES.texture, function (id) {
            set_entity(id, {
                name: res.name,
                renderer: {
                    materials: [{
                        texture: {
                            contentId: res.id,
                            tiling: {
                                x: 1.0,
                                y: 1.0
                            }
                        }
                    }]
                },
                transform: {
                    position:position,
                    rotation:rotation,
                    scale: {
                        x:0.2,
                        y:0.2/asp_rat,
                        z:1.0
                    }
                },
                manipulation:{
                    "movable": false,
                    "sizable": false,
                    "rotatable": false,
                    "heightCorrection": false
                }
            });
            get_entity(id, function (e) {
                var i = entities.push(e);
                var entity = entities[i - 1];
                add_image(entity, function (obj) {
                    obj.click();
                });
            })
        })
    })
}

function clone_image(id,callback){
    get_entity(id,function(data){
        create_entity(ENTITIES_TYPES.texture, function (id) {
            var _data = { ...data }
            delete _data.id;
            _data.name += " (clone)";
            set_entity(id, _data, function(){
                get_entity(id, function (e) {
                    var i = entities.push(e);
                    var entity = entities[i - 1];
                    add_image(entity, function (obj) {
                        obj.click();
                        callback()
                    });
                })
            });

        })
    })

}

function clone_text(id,callback){
    get_entity(id,function(data){
        create_entity(ENTITIES_TYPES.texture, function (id) {
            var _data = { ...data }
            delete _data.id;
            _data.name += " (clone)";
            set_entity(id, _data, function(){
                get_entity(id, function (e) {
                    var i = entities.push(e);
                    var entity = entities[i - 1];
                    add_text(entity, function (obj) {
                        obj.click();
                        callback()
                    });
                })
            });

        })
    })
}

function add_sound_from_lib(res){
    var i = project_resources.audios.push(res);
    var url = res.domain[0]+res.path;
    var rotation = {"x":0,"y":0,"z":0}
    var position = {
        x: 0,
        y: 0,
        z: 0
    }
    create_entity(ENTITIES_TYPES.audio, function (id) {
        set_entity(id, {
            name: res.name,
            audio: {
                contentId: res.id,
                volume: 1.0,
                loop: false,
                playOnAwake: false
            },
            transform: {
                position: position,
                rotation: rotation,
                scale: {
                    x: 1.0,
                    y: 1.0,
                    z: 1.0
                }
            },
            manipulation: {
                "movable": false,
                "sizable": false,
                "rotatable": false,
                "heightCorrection": false
            }
        }, function(){
            get_entity(id, function (e) {
                var i = entities.push(e);
                var entity = entities[i - 1];
                add_sound(entity, function (obj) {
                    obj.click();
                });
            })
        });

    })
}
function clone_sound(id,callback){
    get_entity(id,function(data){
        create_entity(ENTITIES_TYPES.audio, function (id) {
            var _data = { ...data }
            delete _data.id;
            _data.name += " (clone)";
            set_entity(id, _data, function(){
                get_entity(id, function (e) {
                    var i = entities.push(e);
                    var entity = entities[i - 1];
                    add_sound(entity, function (obj) {
                        obj.click();
                        callback()
                    });
                })
            });

        })
    })

}

//adding sounds
var close_sound_button = $("#close_sound_button");
var add_sound_button = $("#add_sound_button");
var sound_name_input = $("#sound_name_input");
var sound_pond;

$(document).ready(function() {
    sound_pond = FilePond.create(document.querySelector('#uploadsound'), {
        acceptedFileTypes: ['audio/mpeg'],
        fileValidateTypeDetectType: (source, type) =>
            new Promise((resolve, reject) => {
                //alert(resolve)
                // Do custom type detection here and return with promise

                resolve(type);
            })

    });
    sound_pond.on('addfile', (error, file) => {
        if (error) {
            console.log('Oh no');
            return;
        }
        var filename = sound_pond.getFile().filename;
        console.log('File added', filename);
        sound_name_input.removeAttr("disabled");
        add_sound_button.removeAttr("disabled");
        sound_name_input.val(filename);
    });
    sound_pond.on('removefile', (error, file) => {
        if (error) {
            console.log('Oh no');
            return;
        }
        sound_name_input.attr("disabled", "");
        add_sound_button.attr("disabled", "");
        sound_name_input.val("");
    });
});
add_sound_button.on("click",async function(){
    $("#soundModal .upload_area").css("display","none");
    $("#soundModal .loading-bar").css("display","block");
    sound_name_input.attr("disabled","");
    add_sound_button.attr("disabled","");
    const selectedFile = sound_pond.getFile().file;
    const byteFile = await getAsByteArray(selectedFile);
    postData('https://mixar-api.ru/asset?name='+encodeURI(sound_name_input.val())
        +'&type=audio&extension='+sound_pond.getFile().fileExtension, byteFile)
        .then((content_id) => {
            //alert(JSON.stringify(content_id));
            var title = sound_name_input.val();
            close_sound_button.click();
            sound_name_input.val("");
            $("#soundModal .upload_area").css("display","block");
            $("#soundModal .loading-bar").css("display","none");
            var pond_ids = [];
            if (sound_pond.getFiles().length != 0) {  // "pond" is an object, created by FilePond.create
                sound_pond.getFiles().forEach(function(file) {
                    pond_ids.push(file.id);
                });
            }
            sound_pond.removeFiles(pond_ids);
            sound_name_input.attr("disabled","");
            add_sound_button.attr("disabled","");
            get_resources(RESOURCES_TYPES.audio,function (r){
                project_resources.audios = r;
                console.log("update sound resources")
                console.log(project_resources.audios);
                //var sound_resource = project_resources.sounds.find(({ id }) => id == content_id);
                //var url = sound_resource.domain[0]+sound_resource.path;

                create_entity(ENTITIES_TYPES.audio, function(id) {
                    set_entity(id, {
                        name: title,
                        audio: {
                            contentId: content_id,
                            volume: 1.0,
                            loop: false,
                            playOnAwake: false
                        }
                    }, function(){
                        get_entity(id,function(e){
                            var i = entities.push(e);
                            var entity = entities[i-1];
                            add_sound(entity, function(obj){
                                obj.click();
                            });
                        })
                    });

                })

            })
        });

})



//adding videos
var close_video_button = $("#close_video_button");
var add_video_button = $("#add_video_button");
var add_videotexture_button = $("#add_videotexture_button");
var video_name_input = $("#video_name_input");
var video_pond;
$(document).ready(function() {
    console.log("[adding videos]")
    video_pond = FilePond.create(document.querySelector('#uploadvideo'), {
        acceptedFileTypes: ['video/mp4' ],
        fileValidateTypeDetectType: (source, type) =>
            new Promise((resolve, reject) => {
                //alert(resolve)
                // Do custom type detection here and return with promise

                resolve(type);
            })

    });
    video_pond.on('addfile', (error, file) => {

        console.log("[addfile]")
        if (error) {
            console.log('Oh no');
            return;
        }
        var filename = video_pond.getFile().filename;
        console.log('File added', filename);
        video_name_input.removeAttr("disabled");
        add_video_button.removeAttr("disabled");
        add_videotexture_button.removeAttr("disabled");
        video_name_input.val(filename);
    });
    video_pond.on('removefile', (error, file) => {
        if (error) {
            console.log('Oh no');
            return;
        }
        video_name_input.attr("disabled", "");
        add_video_button.attr("disabled", "");
        add_videotexture_button.attr("disabled", "");
        video_name_input.val("");
    });
});
add_video_button.on("click",async function(){
    $("#videoModal .upload_area").css("display","none");
    $("#videoModal .loading-bar").css("display","block");
    video_name_input.attr("disabled","");
    add_video_button.attr("disabled","");
    const selectedFile = video_pond.getFile().file;
    const byteFile = await getAsByteArray(selectedFile);
    postData('https://mixar-api.ru/asset?name='+encodeURI(video_name_input.val())
        +'&type=video&extension='+video_pond.getFile().fileExtension, byteFile)
        .then((content_id) => {
            //alert(JSON.stringify(content_id));
            var title = video_name_input.val();
            close_video_button.click();
            video_name_input.val("");
            $("#videoModal .upload_area").css("display","block");
            $("#videoModal .loading-bar").css("display","none");
            var pond_ids = [];
            if (video_pond.getFiles().length != 0) {  // "pond" is an object, created by FilePond.create
                video_pond.getFiles().forEach(function(file) {
                    pond_ids.push(file.id);
                });
            }
            video_pond.removeFiles(pond_ids);
            video_name_input.attr("disabled","");
            add_video_button.attr("disabled","");


            get_resources(RESOURCES_TYPES.video,function (r){
                project_resources.videos = r;
                console.log("update video resources")
                console.log(project_resources.videos);
                var video_resource = project_resources.videos.find(({ id }) => id == content_id);
                var url = video_resource.domain[0]+video_resource.path;
                var rotation = {"x":0,"y":0,"z":0}
                var position = {
                    x: 0,
                    y: 0,
                    z: 0
                }
                if(scene.anchors[anchor].type == ANCHORS_TYPES.MarkerHorizontal) {
                    rotation = {"x":-90,"y":180,"z":0}
                    position = {
                        x: 0,
                        y: 0.0001,
                        z: 0
                    }
                }
                if(scene.anchors[anchor].type == ANCHORS_TYPES.MarkerVertical) {
                    position = {
                        x: 0,
                        y: 0,
                        z: 0.0001
                    }
                }
                if(scene.anchors[anchor].type == ANCHORS_TYPES.PlaneHorizontal) {
                    rotation = {"x":-90,"y":0,"z":0}
                }
                get_video_aspect_ratio(url,function(asp_rat) {

                    create_entity(ENTITIES_TYPES.video, function (id) {
                        set_entity(id, {
                            name: title,
                            video: {
                                contentId: content_id,
                                volume: 1.0,
                                loop: false,
                                playOnAwake: false,
                                chromakey: false
                            },
                            transform: {
                                position:position,
                                rotation:rotation,
                                scale: {
                                    x: 0.1,
                                    y: 0.1 / asp_rat,
                                    z: 1.0
                                }
                            },
                            manipulation: {
                                "movable": false,
                                "sizable": false,
                                "rotatable": false,
                                "heightCorrection": false
                            }
                        }, function (){
                            get_entity(id, function (e) {
                                var i = entities.push(e);
                                var entity = entities[i - 1];
                                add_video(entity, function (obj) {
                                    obj.click();
                                });
                            })
                        });

                    })
                })

            })
        });

})
add_videotexture_button.on("click",async function(){
    $("#videoModal .upload_area").css("display","none");
    $("#videoModal .loading-bar").css("display","block");
    video_name_input.attr("disabled","");
    add_videotexture_button.attr("disabled","");
    const selectedFile = video_pond.getFile().file;
    const byteFile = await getAsByteArray(selectedFile);
    postData('https://mixar-api.ru/asset?name='+encodeURI(video_name_input.val())
        +'&type=video&extension='+video_pond.getFile().fileExtension, byteFile)
        .then((content_id) => {
            //alert(JSON.stringify(content_id));
            var title = video_name_input.val();
            close_video_button.click();
            video_name_input.val("");
            $("#videoModal .upload_area").css("display","block");
            $("#videoModal .loading-bar").css("display","none");
            var pond_ids = [];
            if (video_pond.getFiles().length != 0) {  // "pond" is an object, created by FilePond.create
                video_pond.getFiles().forEach(function(file) {
                    pond_ids.push(file.id);
                });
            }
            video_pond.removeFiles(pond_ids);
            video_name_input.attr("disabled","");
            add_videotexture_button.attr("disabled","");


            get_resources(RESOURCES_TYPES.video,function (r){
                project_resources.videos = r;
                console.log("update video resources")
                console.log(project_resources.videos);
                var video_resource = project_resources.videos.find(({ id }) => id == content_id);
                var url = video_resource.domain[0]+video_resource.path;
                if(selected_obj!=undefined) {
                    var entity = entities.find(({ id }) => id == selected_obj);
                    entity.renderer.materials.forEach(function(material){
                        material.texture.isVideo = false;
                        material.texture.contentId = 0
                    });
                    var material_id = Number($("#model_materials").val());
                    console.log(material_id)
                    current_content_id = content_id
                    entity.renderer.materials[material_id].texture.isVideo = true;
                    entity.renderer.materials[material_id].texture.contentId = content_id;
                    set_entity(selected_obj,{
                        renderer: {
                            materials: entity.renderer.materials
                        }
                    },function(){

                    })
                    $(".addComponentVideo").css("display","none");
                    $("#chooseVideoResource").text("Заменить")
                    $("#video_resource").html("<i class=\"bx bx-film menu-block obj_icon object_icon\""+
                        "onclick=\"$('#chooseVideoResource').click()\" ></i>\n" +
                        "<span onclick=\"$('#chooseVideoResource').click()\" data-key=\"t-dashboards\" class=\"menu-block long_title\">"+
                        title+"</span>")
                }

                /*get_video_aspect_ratio(url,function(asp_rat) {

                    create_entity(ENTITIES_TYPES.video, function (id) {
                        set_entity(id, {
                            name: title,
                            video: {
                                contentId: content_id,
                                volume: 1.0,
                                loop: false,
                                playOnAwake: false,
                                chromakey: false
                            },
                            transform: {
                                scale: {
                                    x: 0.1,
                                    y: 0.1 / asp_rat,
                                    z: 1.0
                                }
                            },
                            manipulation: {
                                "movable": false,
                                "sizable": false,
                                "rotatable": false,
                                "heightCorrection": false
                            }
                        });
                        get_entity(id, function (e) {
                            var i = entities.push(e);
                            var entity = entities[i - 1];
                            add_video(entity, function (obj) {
                                obj.click();
                            });
                        })
                    })
                })*/

            })
        });

})
var current_content_id = 0;
$("#model_materials").on("change",function(){
    var val = Number($("#model_materials").val())
    console.log(val)
    var entity = entities.find(({ id }) => id == selected_obj);
    var i = 0;
    //var current_content_id = entity.renderer.materials[val].texture.contentId;
    console.log("current_content_id")
    console.log(current_content_id)
    entity.renderer.materials.forEach(function(material){
        if(i == val) {
            console.log(val)
            entity.renderer.materials[i].texture.isVideo = true
            entity.renderer.materials[i].texture.contentId = current_content_id;
        }
        else {
            entity.renderer.materials[i].texture.isVideo = false
            entity.renderer.materials[i].texture.contentId = 0;
        }
        i++;
    })
    set_entity(selected_obj,{
        renderer: {
            materials: entity.renderer.materials
        }
    },function(){

    })
})


// FLOATING DROPDOWNS

//$("#settings-menu").css("display","none")
//$("#settings-menu").attr("data-simplebar","");
//alert($("[floating-dropdown]")[0].outerHTML)
$("[floating-dropdown]").each(function (index, value) {
//alert($(this)[0].outerHTML)

var a = $('<div style="position:fixed;top:-300px;left:-300px; z-index:2">'
    +$(this)[0].outerHTML
    +'</div>').appendTo("body");
$(a).find(".floating-dropdown-button").css({
    "visibility": "hidden",
    "width":"0px",
    "height":"0px",
    padding:0
});
$(this).find(".dropdown-menu").css({
    "visibility": "hidden",
    "width":"0px",
    "height":"0px",
    padding:0
});
var b = this;
var close_timer;
var prev_drop;
var close_obj
$(a).find(".dropdown2").parent().on("mouseover", function () {
    //console.log("mouseover "+$(this).text())

    //console.log(prev_drop == this)
    if(prev_drop != this) {
        $(close_obj).children().dropdown("hide");
    }
    clearTimeout(close_timer);
    //prev_drop = null;
    $(this).children().dropdown("show");
})
$(a).find(".dropdown2").parent().on("mouseleave", function () {

    //console.log("mouseleave "+$(this).text())
    prev_drop = this;
    close_obj = this;
    close_timer = setTimeout(function(){
        $(close_obj).children().dropdown("hide");
    },200);
})

$(document).ready(function(){
    //$("#dropdrop button").dropdown("show");

    //var b = document.getElementById('dropdrop')
    b.addEventListener('show.bs.dropdown', function () {


        //alert($(myDropdown).offset().left)

        setTimeout(function(){
            //alert(123)
            //$("#dropdrop button").dropdown("hide");
            $(a).css({
                left:$(b).offset().left+"px",
                top:+$(b).offset().top+"px"
            });
            $(a).find(".floating-dropdown-button").dropdown("show");
        },1)
    })
    b.addEventListener('hide.bs.dropdown', function () {


        //alert($(myDropdown).offset().left)

        setTimeout(function(){
            //alert(123)
            //$("#dropdrop button").dropdown("hide");
            $(a).css({
                left:$(b).offset().left+"px",
                top:+$(b).offset().top+"px"
            });
            $(a).find(".floating-dropdown-button").dropdown("hide");
        },1)
    })
});


$(this).on("click", function(e){
    //alert($(this).position().top);
    //alert($(a).position().top)
//                    $(a).addClass('open');
//                    $().addEventListener('show.bs.dropdown', function () {
//                      alert(123)
//                    })


    //$(a).children(".btn").click();
});
});

// Open/Close settings menu
$(".settings-menu-title").on("click", function(){
// if($(this).parent().hasClass("closed"))
//     $(this).parent().removeClass("closed")
// else
//     $(this).parent().addClass("closed")
var t = this;
setTimeout(function(){
    if($(t).parent().find(".collapsed").length)
        $(t).parent().css("padding-bottom","0");
    else
        $(t).parent().css("padding-bottom","4px");

},1);
})

// Disable right click
if(!window.location.search.substring(1).includes("enableContextMenu=true"))
    document.addEventListener('contextmenu', event => event.preventDefault());
//on window close
window.addEventListener('beforeunload', function (e) {
    save_project();

    if(force_reload){
    }
    else {
        e.preventDefault();
        e.returnValue = '';
    }
});

// DEMO
$(".action-block").css("display", "none");

$(".menu-object").on("click",function(){
    select_menu_object(this)
});
$("#generaly-play").on("click",function(){
if($(this).hasClass("playing")) {
    $(this).removeClass("playing");
    $(this).find("i").removeClass("ri-pause-circle-line");
    $(this).find("i").addClass("ri-play-circle-line");
    $(this).find("span").text("Воспроизвести");
}
else {
    $(this).addClass("playing");
    $(this).find("i").removeClass("ri-play-circle-line");
    $(this).find("i").addClass("ri-pause-circle-line");
    $(this).find("span").text("Остановить");
}
})
/*$(".menu-marker").on("click",function() {
var id = $(this).attr("data-settings");
$(".menu-marker").removeClass("current");
$(this).addClass("current");
show_settings_menu(id);
$(this).addClass("checked");
});*/
$(".menu-markers-button").on("click",function(){
if($(this).hasClass("closed")) {
    $(this).removeClass("closed");
}
else {
    $(this).addClass("closed");
}
})

$("#local_transform").on("click", function(){
    $("#local_transform").css("display", "none");
    $("#global_transform").css("display", "block");
    set_tool(TOOLS_TYPES.spaceworld);
})

$("#global_transform").on("click", function(){
    $("#global_transform").css("display", "none");
    $("#local_transform").css("display", "block");
    set_tool(TOOLS_TYPES.spacelocal);
})

$("#tool_move").on("click", function(){
    set_tool(TOOLS_TYPES.toolmove);
    $(".tool_transform").removeClass("active");
    $(this).addClass("active");
})

$("#tool_rotate").on("click", function(){
    set_tool(TOOLS_TYPES.toolrotate);
    $(".tool_transform").removeClass("active");
    $(this).addClass("active");
})

$("#tool_scale").on("click", function(){
    set_tool(TOOLS_TYPES.toolscale);
    $(".tool_transform").removeClass("active");
    $(this).addClass("active");
})
function show_library(){
    $("#project-button").removeClass("selected_section");
    $("#library-button").addClass("selected_section");
    $("#project-menu").css("display", "none");
    $("#library-menu").css("display", "block");
}
function show_project(){
    $("#project-button").addClass("selected_section");
    $("#library-button").removeClass("selected_section");
    $("#project-menu").css("display", "block");
    $("#library-menu").css("display", "none");
}
////////////////////////////////////////////////////////////////////////////////////////////

function registr_menu_object(obj,entity,type = "object"){
    if(entity!=null) {
        if (!entity.enabled) {
            $(obj).addClass("hided");
        }
    }
    $(obj).on("click",function(ev){
        if(!($(ev.target).hasClass("show-button") || $(ev.target).hasClass("hide-button") ||
            $(ev.target).hasClass("add_new_marker_button") || $(ev.target).hasClass("add_new_anchor_button")))
            select_menu_object(this);
    });
    $(obj).find(".show-button").on("click", function(){
        $(this).parent().addClass("hided");
        if(type == "interaction")
            hide_interaction(entity);
        else
            change_parms(entity.id, {enabled:false});
    })
    $(obj).find(".hide-button").on("click", function(){
        $(this).parent().removeClass("hided");
        if(type == "interaction")
            show_interaction(entity);
        else
            change_parms(entity.id, {enabled:true});
    })
    registr_context_menu(obj, entity.id, type)
    //$(obj).click();
}

function registr_context_menu(obj,id,type){
    console.log("registr_context_menu", type)
    $(obj).mousedown(function(ev){
        if($(ev.target).hasClass("show-button") || $(ev.target).hasClass("hide-button") ||
            $(ev.target).hasClass("add_new_marker_button") || $(ev.target).hasClass("add_new_anchor_button"))
            return;
        if(ev.which == 3)
        {
            switch (type) {
                case "scene":
                    $("#clone_menu_object").css("display", "none");
                    break;
                case "anchor":
                    $("#clone_menu_object").css("display", "none");
                    break;
                case "plane_anchor":
                    $("#rename_menu_object").css("display", "none");
                    $("#clone_menu_object").css("display", "none");
                    break;
                case "cloud_anchor":
                    $("#rename_menu_object").css("display", "none");
                    $("#clone_menu_object").css("display", "none");
                    break;
                default:
                    $("#rename_menu_object").css("display", "block");
                    $("#clone_menu_object").css("display", "block");
            }
            $("#context_menu").attr("data-id", id)
            $("#context_menu").attr("data-type", type)
            //alert(ev.clientX)
            $("#context_menu").css({
                "display": "block",
                "left" : ev.clientX + "px",
                "top" : ev.clientY + "px"
            });
            if(!$("#context_menu button").hasClass("show"))
                $("#context_menu button").click()
            else {
                $("#context_menu button").click()
                $("#context_menu button").click()
            }
        }
    });
}

function updateURLParameter(url, param, paramVal){
    var newAdditionalURL = "";
    var tempArray = url.split("?");
    var baseURL = tempArray[0];
    var additionalURL = tempArray[1];
    var temp = "";
    if (additionalURL) {
        tempArray = additionalURL.split("&");
        for (var i=0; i<tempArray.length; i++){
            if(tempArray[i].split('=')[0] != param){
                newAdditionalURL += temp + tempArray[i];
                temp = "&";
            }
        }
    }
    var rows_txt = "";
    if(paramVal != undefined)
        rows_txt = temp + "" + param + "=" + paramVal;
    return baseURL + "?" + newAdditionalURL + rows_txt;
}

// adding menu-objects
function add_model(entity, callback){
    var obj = $("<div class=\"nav-item menu-object\" data-menu-type=\"3d\" id='"+entity.id+"' " +
        "data-title=\"" + entity.name + "\" data-id=\"" + entity.id + "\" >\n" +
        //"<img src=\"assets/images/3d-model.jpeg\" alt=\"\" class=\"avatar-xs rounded\">\n" +
        "<i class=\"bx bx-pyramid menu-block obj_icon\"></i>\n" +
        "<span data-key=\"t-dashboards\" class=\"menu-block menu_title\">"+entity.name+"</span>\n" +
        " <i class=\" bx bx-show show-button\" style=\"\"></i><i " +
        "class=\" bx bx-hide hide-button\" style=\"\"></i> </div>").appendTo("#models3d");
    $("#models3d-title").addClass("opened");
    if($("#models3d-title").hasClass("collapsed"))
        $("#models3d-title").click()
    registr_menu_object(obj,entity);
    if(callback != undefined)
        callback(obj);
}
function add_anchor(type,scene_id){
    console.log("[add_anchor]")
    var _scene = scenes.find(({ id }) => id == scene_id);
    if(type == ANCHORS_TYPES.PlaneVertical || type == ANCHORS_TYPES.PlaneHorizontal){
        var anc = {
            "id":"a"+Math.floor(Math.random() * 999999)+"",
            "type":type
        };
        _scene.anchors.push(anc);
        console.log(anc)
        set_scene({anchors:_scene.anchors},function (){
            load_anchors_resourses()
            },
            _scene.id)
    }
    else {
        console.log("images")
        if(type == ANCHORS_TYPES.MarkerHorizontal || type == ANCHORS_TYPES.MarkerVertical){
            $(".nav-item[data-id="+scene_id+"]").find(".add_new_marker_button").click();
        }
    }
}
function add_marker(marker, scene_num, callback){
    console.log("[add_marker] ", scene_num);
    console.log(marker);
/*var obj = $("<div class=\"nav-item menu-object menu-marker\" data-menu-type=\"marker\" data-settings=\"marker-menu2\" data-title=\"Маркер 1\" >\n" +
    "                        <img src=\"assets/images/img-placeholder.jpg\" alt=\"\" class=\"avatar-xs rounded\">\n" +
    "                        <span data-key=\"t-dashboards\" class=\"menu-block menu_title\">Маркер 2</span>\n" +
    "                        <i class=\" bx bx-check check-button\"></i>\n" +
    "   </div>").appendTo("#anchors-menu .anchors-menu");

if($("#anchors-menu").hasClass("collapsed"))
    $("#anchors-menu").click()
$(obj).on("click",function(){
    var id = $(this).attr("data-settings");
    $(".menu-marker").removeClass("current");
    $(this).addClass("current");
    show_settings_menu(id);
    $(this).addClass("checked");
});
$(obj).click()*/
    var anchor_resource = anchors_resourses.find(({ id }) => id == marker.contentId);
    var url = anchor_resource.domain[0]+anchor_resource.path;
    get_image_aspect_ratio(url,function(asp_rat){
        var img_style = "center / cover no-repeat, #ededed";
        if(asp_rat > contain_image_max_asp_rat || asp_rat < contain_image_min_asp_rat)
            img_style = "center / cover no-repeat, #ededed";
        var obj = $("<div class=\"nav-item menu-object menu-marker\" data-menu-type=\"marker\" id=\""+marker.id+"\"" +
            "data-id=\""+marker.id+"\" " +
            "data-title=\"Маркер 1\" >\n" +
            "<div style=\"background: url("+url+") "+img_style+";\" alt=\"\" class=\"img avatar-xs rounded preview\"></div>\n" +
            "<span data-key=\"t-dashboards\" class=\"menu-block menu_title\"  alt='"+marker.markerName+"'>"+marker.markerName+"</span>\n" +
            "<i class=\" bx bx-check check-button\"></i>\n" +
            "</div>").appendTo("#scene_anchors"+scene_num);

        /*if($("#anchors-menu").hasClass("collapsed"))
            $("#anchors-menu").click()*/
        //$(".menu-marker").removeClass("current");
        let anchor_index = scene.anchors.indexOf(scene.anchors.find(({id}) => id == marker.id));
        let current = false;
        if(anchor == anchor_index && scene_num == scene_number) {
            obj.addClass("current");
            current = true;
        }
        /*obj.on("click",function(){
            var id = $(this).attr("data-settings");
            $(".menu-marker").removeClass("current");
            $(this).addClass("current");
            show_settings_menu(id);
            $(this).addClass("checked");
        });*/

        $(obj).on("click",function(ev){
            if(current){
                $(this).addClass("checked");
                select_menu_object(this);
            }
            else {
                var newURL = updateURLParameter(window.location.href, 'anchor', marker.id);
                newURL = updateURLParameter(newURL, 'scene', scene_num+1);
                force_reload = true;
                location.href = newURL;
            }
        });
        registr_context_menu(obj,marker.id,"anchor")
        if(callback != undefined)
            callback(obj);
        //$(obj).click()
    })



}

function add_plane(anc, scene_num, callback){
    var title = "Привязка к полу";
    if(anc.type == ANCHORS_TYPES.PlaneVertical)
        title = "Привязка к стене";
    var obj = $("<div class=\"nav-item menu-object menu-marker\" data-menu-type=\"planeTracker\" id=\""+anc.id+"\"" +
        "data-id=\""+anc.id+"\" " +
        "data-scene-id=\""+scenes[scene_num].id+"\" " +
        "data-title=\"Маркер 1\" >\n" +
        "<div><i class=\"bx bx-fullscreen menu-block obj_icon\"></i></div>" +
        "<span data-key=\"t-dashboards\" class=\"menu-block menu_title\"  alt='Привязка к плоскости'>" + title +
        "</span>\n" +
        "<i class=\" bx bx-check check-button\"></i>\n" +
        "</div>").appendTo("#scene_anchors"+scene_num);

    /*if($("#anchors-menu").hasClass("collapsed"))
        $("#anchors-menu").click()*/
    //$(".menu-marker").removeClass("current");
    let anchor_index = scene.anchors.indexOf(scene.anchors.find(({id}) => id == anc.id));
    let current = false;
    if(anchor == anchor_index && scene_num == scene_number) {
        obj.addClass("current");
        current = true;
    }

    $(obj).on("click",function(ev){
        if(current){
            $(this).addClass("checked");
            select_menu_object(this);
        }
        else {
            var newURL = updateURLParameter(window.location.href, 'anchor', anc.id);
            newURL = updateURLParameter(newURL, 'scene', scene_num+1);
            force_reload = true;
            location.href = newURL;
        }
    });
    registr_context_menu(obj,anc.id,"plane_anchor")
    if(callback != undefined)
        callback(obj);
}

function add_cloud_anchor(anc, scene_num, callback){
    var title = "Привязка к объекту";
    var obj = $("<div class=\"nav-item menu-object menu-marker\" data-menu-type=\"cloudAnchor\" id=\""+anc.id+"\"" +
        "data-id=\""+anc.id+"\" " +
        "data-scene-id=\""+scenes[scene_num].id+"\" " +
        "data-title=\"Привязка к объекту\" >\n" +
        "<div><i class=\"bx bx-cube menu-block obj_icon\"></i></div>" +
        "<span data-key=\"t-dashboards\" class=\"menu-block menu_title\"  alt='Привязка к объекту'>" + title +
        "</span>\n" +
        "<i class=\" bx bx-check check-button\"></i>\n" +
        "</div>").appendTo("#scene_anchors"+scene_num);

    /*if($("#anchors-menu").hasClass("collapsed"))
        $("#anchors-menu").click()*/
    //$(".menu-marker").removeClass("current");
    let anchor_index = scene.anchors.indexOf(scene.anchors.find(({id}) => id == anc.id));
    let current = false;
    if(anchor == anchor_index && scene_num == scene_number) {
        obj.addClass("current");
        current = true;
    }

    $(obj).on("click",function(ev){
        if(current){
            $(this).addClass("checked");
            select_menu_object(this);
        }
        else {
            var newURL = updateURLParameter(window.location.href, 'anchor', anc.id);
            newURL = updateURLParameter(newURL, 'scene', scene_num+1);
            force_reload = true;
            location.href = newURL;
        }
    });
    registr_context_menu(obj,anc.id,"cloud_anchor")
    if(callback != undefined)
        callback(obj);
}




var img_count = 0;
function add_image(entity,callback){
    img_count++;
    var content_id = entity.renderer.materials[0].texture.contentId;
    var image_resource = project_resources.images.find(({ id }) => id == content_id);
    var url = image_resource.domain[0]+image_resource.path;
    get_image_aspect_ratio(url,function(asp_rat) {
        var img_style = "center / cover no-repeat, #ededed";
        if(asp_rat > contain_image_max_asp_rat || asp_rat < contain_image_min_asp_rat)
            img_style = "center / cover no-repeat, #ededed";
        /*var obj = $("<div class=\"nav-item menu-object\" data-menu-type=\"3d\" data-title=\"Изображение "+img_count+"\" >\n" +
            "                            <img src=\"assets/images/test-image.jpeg\" alt=\"\" class=\"avatar-xs rounded\">\n" +
            "                            <span data-key=\"t-dashboards\" class=\"menu-block menu_title\">Изображение "+img_count+"</span>\n" +
            "<i class=\" bx bx-show show-button\" style=\"\"></i><i class=\" bx bx-hide hide-button\" style=\"\"></i></div>").appendTo("#images");
        */
        var obj = $("<div class=\"nav-item menu-object\" data-menu-type=\"image\" id='"+entity.id+"' " +
            "data-bs-toggle=\"dropdown\" aria-haspopup=\"true\" aria-expanded=\"false\"" +
            "data-title=\"" + entity.name + "\" data-id=\"" + entity.id + "\">\n" +
            "<div style=\"background: url(" + url + ") "+img_style+";\" alt=\"\" class=\"img avatar-xs rounded\"></div>\n" +
            "<span data-key=\"t-dashboards\" class=\"menu-block menu_title\" alt='"+entity.name+"'>" + entity.name + "</span>\n" +
            "<i class=\" bx bx-show show-button\" style=\"\"></i><i class=\" bx bx-hide hide-button\" style=\"\"></i>" +
            "</div>").appendTo("#images");

        $("#images-title").addClass("opened");
        if ($("#images-title").hasClass("collapsed"))
            $("#images-title").click()
        registr_menu_object(obj, entity);
        if(callback != undefined)
            callback(obj);
    });
}
var sound_count = 0;
function add_sound(entity,callback){
    console.log("add_sound")
    /*sound_count++;
    var obj = $("<div class=\"nav-item menu-object\" data-menu-type=\"sound\" data-title=\"Звук "+sound_count+"\" >\n" +
        "                            <i class=\"bx bx-music menu-block obj_icon\"></i>\n" +
        "                            <span data-key=\"t-dashboards\" class=\"menu-block menu_title\">Звук "+sound_count+"</span>\n" +
        "<i class=\" bx bx-show show-button\" style=\"\"></i><i class=\" bx bx-hide hide-button\" style=\"\"></i> </div>").appendTo("#sounds");
    $("#sounds-title").addClass("opened");
    if($("#sounds-title").hasClass("collapsed"))
        $("#sounds-title").click()
    $(obj).on("click",function(){
        select_menu_object(this)
    });
    $(obj).find(".show-button").on("click", function(){
        $(this).parent().addClass("hided");
    })
    $(obj).find(".hide-button").on("click", function(){
        $(this).parent().removeClass("hided");
    })
    $(obj).click()*/
    var obj = $("<div class=\"nav-item menu-object\" data-menu-type=\"sound\" id='"+entity.id+"' " +
        "data-title=\"" + entity.name + "\" data-id=\"" + entity.id + "\" >\n" +
        "<i class=\"bx bx-music menu-block obj_icon\"></i>\n" +
        "<span data-key=\"t-dashboards\" class=\"menu-block menu_title\">"+entity.name+"</span>\n" +
        " <i class=\" bx bx-show show-button\" style=\"\"></i><i " +
        "class=\" bx bx-hide hide-button\" style=\"\"></i> </div>").appendTo("#sounds");
    $("#sounds-title").addClass("opened");
    if($("#sounds-title").hasClass("collapsed"))
        $("#sounds-title").click()
    registr_menu_object(obj,entity);
    if(callback != undefined)
        callback(obj);
}

var video_count = 0;
function add_video(entity,callback){
    /*video_count++;
    var obj = $("<div class=\"nav-item menu-object\" data-menu-type=\"video\" data-title=\"Видео "+video_count+"\" >\n" +
        "                            <img src=\"assets/images/video.png\" alt=\"\" class=\"avatar-xs rounded\">\n" +
        "                            <span data-key=\"t-dashboards\" class=\"menu-block menu_title\">Видео "+video_count+"</span>\n" +
        "<i class=\" bx bx-show show-button\" style=\"\"></i><i class=\" bx bx-hide hide-button\" style=\"\"></i> </div>").appendTo("#videos");
    $("#videos-title").addClass("opened");
    if($("#videos-title").hasClass("collapsed"))
        $("#videos-title").click()
    $(obj).on("click",function(){
        select_menu_object(this)
    });
    $(obj).find(".show-button").on("click", function(){
        $(this).parent().addClass("hided");
    })
    $(obj).find(".hide-button").on("click", function(){
        $(this).parent().removeClass("hided");
    })
    $(obj).click()*/
    var obj = $("<div class=\"nav-item menu-object\" data-menu-type=\"video\" id='"+entity.id+"' " +
        "data-title=\"" + entity.name + "\" data-id=\"" + entity.id + "\" >\n" +
        "<i class=\"bx bx-film menu-block obj_icon\"></i>\n" +
        "<span data-key=\"t-dashboards\" class=\"menu-block menu_title\">"+entity.name+"</span>\n" +
        " <i class=\" bx bx-show show-button\" style=\"\"></i><i " +
        "class=\" bx bx-hide hide-button\" style=\"\"></i> </div>").appendTo("#videos");
    $("#videos-title").addClass("opened");
    if($("#videos-title").hasClass("collapsed"))
        $("#videos-title").click()
    registr_menu_object(obj,entity);
    if(callback != undefined)
        callback(obj);
}

var cube_count = 0;
function add_cube(){
cube_count++;
var obj = $("<div class=\"nav-item menu-object\" data-menu-type=\"primitive\" data-title=\"Куб "+cube_count+"\" >\n" +
    "                            <img src=\"assets/images/cube.png\" alt=\"\" class=\"avatar-xs rounded\">\n" +
    "                            <span data-key=\"t-dashboards\" class=\"menu-block menu_title\">Куб "+cube_count+"</span>\n" +
    "<i class=\" bx bx-show show-button\" style=\"\"></i><i class=\" bx bx-hide hide-button\" style=\"\"></i> </div>").appendTo("#primitives");
$("#primitives-title").addClass("opened");
if($("#primitives-title").hasClass("collapsed"))
    $("#primitives-title").click()
$(obj).on("click",function(){
    select_menu_object(this)
});
$(obj).find(".show-button").on("click", function(){
    $(this).parent().addClass("hided");
})
$(obj).find(".hide-button").on("click", function(){
    $(this).parent().removeClass("hided");
})
$(obj).click()
}
var text_count = 0;
function add_text(entity,callback){
/*text_count++;
    var obj = $("<div class=\"nav-item menu-object\" data-menu-type=\"text\" data-title=\"Текст "+text_count+"\" >\n" +
        "                            <i class=\"bx bx-text menu-block obj_icon\"></i>\n" +
        "                            <span data-key=\"t-dashboards\" class=\"menu-block menu_title\">Текст "+text_count+"</span>\n" +
        "<i class=\" bx bx-show show-button\" style=\"\"></i><i class=\" bx bx-hide hide-button\" style=\"\"></i> </div>").appendTo("#textes");
    $("#textes-title").addClass("opened");
    if($("#textes-title").hasClass("collapsed"))
        $("#textes-title").click()
    $(obj).on("click",function(){
        select_menu_object(this)
    });
    $(obj).find(".show-button").on("click", function(){
        $(this).parent().addClass("hided");
    })
    $(obj).find(".hide-button").on("click", function(){
        $(this).parent().removeClass("hided");
    })
    $(obj).click()*/
    var obj = $("<div class=\"nav-item menu-object\" data-menu-type=\"text\" id='"+entity.id+"' " +
        "data-bs-toggle=\"dropdown\" aria-haspopup=\"true\" aria-expanded=\"false\"" +
        "data-title=\"" + entity.name + "\" data-id=\"" + entity.id + "\">\n" +
        "<i class=\"bx bx-text menu-block obj_icon\"></i>\n" +
        "<span data-key=\"t-dashboards\" class=\"menu-block menu_title\" alt='"+entity.name+"'>" + entity.name + "</span>\n" +
        "<i class=\" bx bx-show show-button\" style=\"\"></i><i class=\" bx bx-hide hide-button\" style=\"\"></i>" +
        "</div>").appendTo("#textes");

    $("#textes-title").addClass("opened");
    if ($("#textes-title").hasClass("collapsed"))
        $("#textes-title").click()
    registr_menu_object(obj, entity);
    if(callback != undefined)
        callback(obj);
}

//adding text
var add_text_button = $("#add_text_button");
var close_text_button = $("#close_text_button");
var text_input = document.getElementById("text_input");
text_input.addEventListener('input', function(element) {
    var val = $("#text_input").val()
    console.log($.trim(val))
    if($.trim(val)!="")
        $("#add_text_button").removeAttr("disabled");
    else
        $("#add_text_button").attr("disabled",true);
});
$('#textModal').on('hidden.bs.modal', function (e) {
    console.log('Модальное окно закрыто');
    $("#textModal .upload_area").css("display","block");
    $("#textModal .loading-bar").css("display","none");
    $("#text_input").val("")
    $("#add_text_button").attr("disabled",true);
});
$("#use_text_background_input").on("change",function(){
    if(document.getElementById("use_text_background_input").checked)
        $("#if_use_background").css("display","block")
    else
        $("#if_use_background").css("display","none")
})
$("#use_text_background_settings").on("change",function(){
    if(document.getElementById("use_text_background_settings").checked)
        $("#if_use_background_settings").css("display","block")
    else
        $("#if_use_background_settings").css("display","none")
})

add_text_button.on("click",async function(){
    $("#textModal .upload_area").css("display","none");
    $("#textModal .loading-bar").css("display","block");
    add_text_button.attr("disabled","");
    var text_text = $("#text_input").val();
    var title = text_text;
    if(title.length > 20)
        title = title.substring(0, 20)+"...";
    var fontFamily = $("#text_font_select").val();
    var fontWeightOption = $("#text_weight_select").val();
    var fontSizeOption = $("#text_size_select").val();
    var textAlign = $("#text_align_select").val();
    var textColor = $("#text_color_input").val();
    var useTextBackground = document.getElementById("use_text_background_input").checked;
    var textBackgroundColor = $("#text_background_color_input").val();
    var textBackgroundBorderRadiusOption = $("#text_background_border_radius_select").val();

    generate_text(
        title,
        text_text,
        fontFamily,
        fontWeightOption,
        fontSizeOption,
        textColor,
        textAlign,
        useTextBackground,
        textBackgroundColor,
        textBackgroundBorderRadiusOption,
        function(content_id){
            close_text_button.click();

            get_resources(RESOURCES_TYPES.image,function (r){
                project_resources.images = r;
                console.log("update image resources")
                console.log(project_resources.images);
                var image_resource = project_resources.images.find(({ id }) => id == content_id);
                var url = image_resource.domain[0]+image_resource.path;
                var rotation = {"x":0,"y":0,"z":0}
                var position = {
                    x: 0,
                    y: 0,
                    z: 0
                }
                if(scene.anchors[anchor].type == ANCHORS_TYPES.MarkerHorizontal) {
                    rotation = {"x":-90,"y":180,"z":0}
                    position = {
                        x: 0,
                        y: 0.0001,
                        z: 0
                    }
                }
                if(scene.anchors[anchor].type == ANCHORS_TYPES.MarkerVertical) {
                    position = {
                        x: 0,
                        y: 0,
                        z: 0.0001
                    }
                }
                if(scene.anchors[anchor].type == ANCHORS_TYPES.PlaneHorizontal) {
                    rotation = {"x":-90,"y":0,"z":0}
                }
                get_image_aspect_ratio(url,function(asp_rat) {
                    create_entity(ENTITIES_TYPES.texture, function(id) {
                        set_entity(id, {
                            name: title,
                            is_text: true,
                            text_data: {
                                text: "string:"+text_text,
                                font_family: fontFamily,
                                font_weight:fontWeightOption,
                                font_size: fontSizeOption,
                                text_align: textAlign,
                                color: textColor,
                                use_background: useTextBackground,
                                background:textBackgroundColor,
                                border_radius:textBackgroundBorderRadiusOption
                            },
                            renderer: {
                                materials: [{
                                    texture: {
                                        contentId: content_id,
                                        tiling: {
                                            x: 1.0,
                                            y: 1.0
                                        }
                                    }
                                }]
                            },
                            transform: {
                                position:position,
                                rotation:rotation,
                                scale: {
                                    x:0.2,
                                    y:0.2/asp_rat,
                                    z:1.0
                                }
                            },
                            manipulation:{
                                "movable": false,
                                "sizable": false,
                                "rotatable": false,
                                "heightCorrection": false
                            }
                        },function(){
                            get_entity(id,function(e){
                                var i = entities.push(e);
                                var entity = entities[i-1];


                                setTimeout(function(){

                                    entity.renderer.materials.forEach(function(material){
                                        material.shaderId = 1
                                    });
                                    set_entity(entity.id,{
                                        renderer: {
                                            materials: entity.renderer.materials
                                        }
                                    },function(){
                                        setTimeout(function(){
                                            add_text(entity, function(obj){
                                                obj.click();
                                            });
                                        },1)
                                    })
                                },1)





                            })
                        });

                    })
                });
            })
        })



})


async function generate_text(title, _text,_fontFamily,_fontWeightOption,_fontSizeOption,_textColor,_textAlign,
        _useTextBackground, _textBackgroundColor,_textBackgroundBorderRadiusOption,callback){
    var text_text = _text;
    $("#text_input_visualiser").text(_text)
    // Получаем выбранные пользователем стили
    var fontFamily = _fontFamily;
    var fontWeightOption = _fontWeightOption;
    var fontSizeOption = _fontSizeOption;
    var fontSize = fontSizeOption*3 + "px";
    var textColor = _textColor;
    var textAlign = _textAlign;
    var useTextBackground = _useTextBackground;
    var textBackgroundColor = _textBackgroundColor;
    var textBackgroundBorderRadiusOption = _textBackgroundBorderRadiusOption;
    var textBackgroundBorderRadius = textBackgroundBorderRadiusOption+"px";
    if(!useTextBackground) {
        textBackgroundColor = "none"
        textBackgroundBorderRadius = "0px";
    }

    // Преобразуем значение fontWeight в допустимое значение CSS
    var fontWeight;
    switch (fontWeightOption) {
        case 'Regular':
            fontWeight = 400;
            break;
        case 'Medium':
            fontWeight = 500;
            break;
        case 'Bold':
            fontWeight = 700;
            break;
        default:
            fontWeight = 400; // значение по умолчанию
    }

    // Применяем стили к p #text_input_visualiser
    $("#text_input_visualiser").css({
        "font-family": fontFamily,
        "font-weight":fontWeight,
        "font-size": fontSize,
        "line-height": fontSize,
        "color": textColor,
        "text-align":textAlign,
        "background":textBackgroundColor,
        "border-radius":textBackgroundBorderRadius

    });
    // Функция для преобразования Blob в массив байтов
    function blobToByteArray(blob, callback) {
        var reader = new FileReader();
        reader.onloadend = function() {
            var arrayBuffer = reader.result;
            var byteArray = new Uint8Array(arrayBuffer);
            callback(byteArray);
        };
        reader.readAsArrayBuffer(blob);
    }


    html2canvas(document.getElementById('text_input_visualiser'), {
        onrendered: function (canvas) {
            //alert(123)
            // Получаем Blob из canvas
            canvas.toBlob(function(blob) {
                // Преобразуем Blob в массив байтов
                blobToByteArray(blob, function(byteFile) {
                    // Теперь можно отправить массив байтов на сервер
                    postData('https://mixar-api.ru/asset?name='+encodeURI(title)
                        +'&type=image&extension='+"png", byteFile)
                        .then((content_id) => {
                            console.log("TEXT_UPLOADED https://mixar-api.ru/data-dev/"+content_id+".png")
                            //alert(JSON.stringify(content_id));
                            if(callback != undefined)
                                callback(content_id);
                        });
                });
            }, 'image/png');
        },
    });


}

/*var interaction_count = 0;
function add_interaction(){
    interaction_count++;
    var obj = $("<div class=\"nav-item menu-object\" data-menu-type=\"interaction\" data-title=\"Интерактив "+interaction_count+"\" >\n" +
        "                            <img src=\"assets/images/interaction.png\" alt=\"\" class=\"avatar-xs rounded\">\n" +
        "                            <span data-key=\"t-dashboards\" class=\"menu-block menu_title\">Интерактив "+interaction_count+"</span>\n" +
        "<i class=\" bx bx-show show-button\" style=\"\"></i><i class=\" bx bx-hide hide-button\" style=\"\"></i> </div>").appendTo("#interactions");
    $("#interactions-title").addClass("opened");
    if($("#interactions-title").hasClass("collapsed"))
        $("#interactions-title").click()
    $(obj).on("click",function(){
        select_menu_object(this)
    });
    $(obj).find(".show-button").on("click", function(){
        $(this).parent().addClass("hided");
    })
    $(obj).find(".hide-button").on("click", function(){
        $(this).parent().removeClass("hided");
    })
    $(obj).click()
}*/
function show_settings_scene(){
    show_settings_menu("scene-menu");
    show_scene_settings(scene.id);
}

// RIGHT MENU
function select_menu_object(obj){
    if(obj == null){
        $(".menu-object").removeClass("checked");
        show_settings_block("", "[data-block='choose-object']");
        select_entity(-1);
    }
    var type = $(obj).attr("data-menu-type");
    var title = $(obj).attr("data-title");
    var id = $(obj).attr("data-id");
    var selector = "";
    selected_obj = id;
    selected_type = type;
    pauseAudio();
    audio_playing = false;
    if(type != "interaction")
        select_entity(id);
    else
        select_entity(-1);
    /*var id = $(this).attr("data-settings");
    $(".menu-marker").removeClass("current");
    $(this).addClass("current");
    show_settings_menu(id);*/
    $(".menu-object").removeClass("checked");
    switch (type) {
        case "marker":
            show_settings_menu("marker-menu1");
            show_marker_settings(id);
            break;
        case "planeTracker":
            show_settings_menu("plane-menu");
            show_scene_settings($(obj).attr("data-scene-id"));
            break;
        case "cloudAnchor":
            show_settings_menu("cloudAnchor-menu");
            show_cloud_anchor_settings(id);
            break;
        case "scene":
            show_settings_menu("scene-menu");
            show_scene_settings(id);
            break;
        case "3d":
            selector = "[data-block='title']," +
                "[data-block='transform']," +
                "[data-block='view']," +
                "[data-block='animation']," +
                "[data-block='user-interaction']," +
                "[data-block='component']";
            show_settings_block(title, selector);
            show_object_parms(id);
            break;
        case "image":
            selector = "[data-block='title']," +
                "[data-block='transform']," +
                "[data-block='view']," +
                "[data-block='user-interaction']," +
                "[data-block='component']";
            show_object_parms(id);
            show_settings_block(title, selector);
            break;
        case "sound":
            selector = "[data-block='title']," +
                "[data-block='transform']," +
                "[data-block='play-settings']," +
                "[data-block='sound']";
            show_object_parms(id);
            show_settings_block(title, selector);
            break;
        case "video":
            selector = "[data-block='title']," +
                "[data-block='transform']," +
                "[data-block='view']," +
                "[data-block='user-interaction']," +
                "[data-block='video']";
            show_object_parms(id);
            show_settings_block(title, selector);
            break;
        case "primitive":
            selector = "[data-block='title']," +
                "[data-block='transform']," +
                "[data-block='view']," +
                "[data-block='primitive']," +
                "[data-block='user-interaction']," +
                "[data-block='component']";
            show_settings_block(title, selector);
            break;
        case "text":
            selector = "[data-block='title']," +
                "[data-block='transform']," +
                "[data-block='view']," +
                "[data-block='text']";
                "[data-block='user-interaction']";
            show_object_parms(id);
            show_settings_block(title, selector);
            break;
        case "interaction":
            selector = "[data-block='interaction-title']," +
                "[data-block='interaction']," +
                "[data-block='trigger1']," +
                "[data-block='action']";
            show_settings_block(title, selector);
            show_interaction_parms(id);
            break;
        //default:
        //alert( "Нет таких значений" );
    }
    $(obj).addClass("checked");
}

function show_settings_menu(id){
    $(".settings-menu").css("display", "none");
    $(".menu-object").removeClass("checked");
    $("#"+id).css("display", "block");
}

function show_settings_block(title, selector){

    show_settings_menu("object-menu");
    $("#settings-title").attr("value",title)
    $("#object-menu .settings-block").css("display", "none");
    $(selector).css("display", "block");
    $("#unity-container.unity-desktop").css({
        "width": "calc(100% - 540px)"
    });
}
function show_marker_settings(_id){
    /*$("#unity-container.unity-desktop, #controls-menu").css({
        "width": "calc(100% - 540px)"
    });*/

    var marker = scene.anchors.find(({ id }) => id == _id);
    console.log("show_marker_parms")
    console.log(marker)
    $("#marker-title").val(marker.markerName)
    onchange_marker_parms("marker-title","markerName");
    console.log(anchors_resourses);
    var anchor_resource = anchors_resourses.find(({ id }) => id == marker.contentId);
    var url = anchor_resource.domain[0]+anchor_resource.path;
    get_image_aspect_ratio(url,function(asp_rat){
        var img_style = "center / cover no-repeat, #ededed";
        if(asp_rat > contain_image_max_asp_rat || asp_rat < contain_image_min_asp_rat)
            img_style = "center / cover no-repeat, #ededed";
        $("#marker_image").html("<div style=\"background: url("+url+") "+
            img_style+";\" alt=\"\" class=\"img avatar-xs rounded\"></div>");
        $("#marker_preview").attr("src",url);
        uploading_marker_asp_rat2 = asp_rat;
        $("#marker_width").val(marker.markerWidth*100);
        $("#marker_height").val(parseFloat(marker.markerWidth)/uploading_marker_asp_rat2*100);
        onchange_marker_parms("marker_width","markerWidth");
        onchange_marker_parms("marker_height","markerWidth", "marker_width");

    })
    $("#marker_name").text(anchor_resource.name);
    $("#marker_orientation").val(marker.type);
    onchange_marker_parms("marker_orientation","type");
    if(marker.hasOwnProperty("stayAnchorOnLostTracking")){
        document.getElementById("stayAnchorOnLostTracking").checked = marker.stayAnchorOnLostTracking;
    }
    onchange_marker_parms("stayAnchorOnLostTracking","stayAnchorOnLostTracking");
    /*if(entity.type==ENTITIES_TYPES.model ||
        entity.type==ENTITIES_TYPES.texture ||
        entity.type==ENTITIES_TYPES.audio ||
        entity.type==ENTITIES_TYPES.video){
        $("#transform_p_x").val(entity.transform.position.x)
        $("#transform_p_y").val(entity.transform.position.y)
        $("#transform_p_z").val(entity.transform.position.z)
        $("#transform_r_x").val(entity.transform.rotation.x)
        $("#transform_r_y").val(entity.transform.rotation.y)
        $("#transform_r_z").val(entity.transform.rotation.z)
        $("#transform_s_x").val(entity.transform.scale.x)
        $("#transform_s_y").val(entity.transform.scale.y)
        $("#transform_s_z").val(entity.transform.scale.z)
    }
    if(entity.type==ENTITIES_TYPES.model ||
        entity.type==ENTITIES_TYPES.texture ||
        entity.type==ENTITIES_TYPES.video){
        document.getElementById("renderer_visible").checked = entity.renderer.visible;
        document.getElementById("renderer_billboard").checked = entity.renderer.billboard;
        document.getElementById("renderer_shadowCast").checked = entity.renderer.shadowCast;
        $("#renderer_opacity").val(entity.renderer.opacity*100);
        var em_color = entity.renderer.emission.color;
        $("#renderer_emission").val(rgbToHex(em_color.r, em_color.g, em_color.b));
        /!*$("#viewsettings .settings-item").css("display","flex");*!/
    }
    if(entity.type==ENTITIES_TYPES.audio) {
        /!*document.getElementById("renderer_visible").checked = entity.renderer.visible;
        $("#viewsettings .settings-item").css("display","none");
        $("#viewsettings .settings-item:eq(0)").css("display","flex");*!/
        $("#audio_volume").val(entity.audio.volume*100);
        document.getElementById("audio_loop").checked = entity.audio.loop;
        document.getElementById("audio_playOnAwake").checked = entity.audio.playOnAwake;
        var content_id = entity.audio.contentId;
        var audio_resource = project_resources.audios.find(({ id }) => id == content_id);
        var url = audio_resource.domain[0]+audio_resource.path;
        console.log(url)
        audio.addEventListener("canplaythrough", function(){
            audio_currenttime = 0;
            $("#audio_player .current_time").text("0:00");
            $("#audio_player .total_time").text(time_format(audio.duration));
            clearInterval(update_interval);
            audio_timeline.noUiSlider.set([0]);
        }, {once : true});
        audio.src = url;

    }
    if(entity.type==ENTITIES_TYPES.video) {
        $("#video_volume").val(entity.video.volume*100);
        document.getElementById("video_loop").checked = entity.video.loop;
        document.getElementById("video_playOnAwake").checked = entity.video.playOnAwake;
    }


    if(entity.type==ENTITIES_TYPES.model ||
        entity.type==ENTITIES_TYPES.texture ||
        entity.type==ENTITIES_TYPES.video){
        document.getElementById("manipulation_movable").checked = entity.manipulation.movable;
        document.getElementById("manipulation_sizable").checked = entity.manipulation.sizable;
        document.getElementById("manipulation_rotatable").checked = entity.manipulation.rotatable;
        document.getElementById("manipulation_heightCorrection").checked = entity.manipulation.heightCorrection;
    }*/
}

function show_cloud_anchor_settings(_id){
    var marker = scene.anchors.find(({ id }) => id == _id);
    var contentId = marker.cloudAnchorId;
    var was_canceled = false;
    $("#object_id_input2").off("change");
    $("#object_id_input2").val(marker.cloudAnchorId);
    $("#object_id_input2").on("change",function(){
        //if(!was_canceled){
            if(confirm("Подтвердите смену ID объекта")) {
                var val = $("#object_id_input2").val();
                change_marker_parms(selected_obj, "cloudAnchorId", val);
                change_marker_parms(selected_obj, "contentId", val);
            } else {
              //  was_canceled = true;
                $("#object_id_input2").val(contentId);
            }
      // }
       // else
        //    was_canceled = false;
    })
}

function show_object_parms(_id){
    var entity = entities.find(({ id }) => id == _id);
    console.log("[show_object_parms]",entity)
    $("#settings-title").val(entity.name)
    $(".object_component").css("display","none").attr("data-hided",true)
    if(entity.type==ENTITIES_TYPES.model ||
        entity.type==ENTITIES_TYPES.texture ||
        entity.type==ENTITIES_TYPES.audio ||
        entity.type==ENTITIES_TYPES.video){
        $("#transform_p_x").val(entity.transform.position.x)
        $("#transform_p_y").val(entity.transform.position.y)
        $("#transform_p_z").val(entity.transform.position.z)
        $("#transform_r_x").val(entity.transform.rotation.x)
        $("#transform_r_y").val(entity.transform.rotation.y)
        $("#transform_r_z").val(entity.transform.rotation.z)
        $("#transform_s_x").val(entity.transform.scale.x)
        $("#transform_s_x").attr("data-val", entity.transform.scale.x)
        $("#transform_s_y").val(entity.transform.scale.y)
        $("#transform_s_y").attr("data-val", entity.transform.scale.y)
        $("#transform_s_z").val(entity.transform.scale.z)
        $("#transform_s_z").attr("data-val", entity.transform.scale.z)

    }
    $("#copy_position").on("click",function(){
        navigator.clipboard.writeText(JSON.stringify({x:Number($("#transform_p_x").val()),
            y:Number($("#transform_p_y").val()),z:Number($("#transform_p_z").val())}));
    })
    $("#paste_position").on("click",async function(){
        let clipboardContent = await window.navigator.clipboard.readText();
        clipboardContent = JSON.parse(clipboardContent)
        change_parms(selected_obj,{transform:{position:{
                    x:clipboardContent.x,
                    y:clipboardContent.y,
                    z:clipboardContent.z
                }}})
        $("#transform_p_x").val(clipboardContent.x)
        $("#transform_p_y").val(clipboardContent.y)
        $("#transform_p_z").val(clipboardContent.z)
    })
    $("#copy_rotation").on("click",function(){
        navigator.clipboard.writeText(JSON.stringify({x:Number($("#transform_r_x").val()),
            y:Number($("#transform_r_y").val()),z:Number($("#transform_r_z").val())}));
    })
    $("#paste_rotation").on("click",async function(){
        let clipboardContent = await window.navigator.clipboard.readText();
        clipboardContent = JSON.parse(clipboardContent)
        change_parms(selected_obj,{transform:{rotation:{
                    x:clipboardContent.x,
                    y:clipboardContent.y,
                    z:clipboardContent.z
                }}})
        $("#transform_r_x").val(clipboardContent.x)
        $("#transform_r_y").val(clipboardContent.y)
        $("#transform_r_z").val(clipboardContent.z)
    })
    $("#copy_scale").on("click",function(){
        navigator.clipboard.writeText(JSON.stringify({x:Number($("#transform_s_x").val()),
            y:Number($("#transform_s_y").val()),z:Number($("#transform_s_z").val())}));
    })
    $("#paste_scale").on("click",async function(){
        let clipboardContent = await window.navigator.clipboard.readText();
        clipboardContent = JSON.parse(clipboardContent)
        change_parms(selected_obj,{transform:{scale:{
                    x:clipboardContent.x,
                    y:clipboardContent.y,
                    z:clipboardContent.z
                }}})
        $("#transform_s_x").val(clipboardContent.x)
        $("#transform_s_y").val(clipboardContent.y)
        $("#transform_s_z").val(clipboardContent.z)
    })

    if(entity.type==ENTITIES_TYPES.model) {
        if (entity.model.animations.length > 0) {
            console.log("entity.model.playOnAwake")
            console.log(entity.model.playOnAwake)
            document.getElementById("animation_play_on_awake").checked = entity.model.playOnAwake;
            $("#model_animations").html("")
            let max_anim = 1;
            let current_anim = 0;
            entity.model.animations.forEach(function (animation) {
                if(current_anim < max_anim) {
                    $("#model_animations").append("<option value='" + animation + "'>" + animation + "</option>");
                    current_anim++;
                }
            })
            if (entity.model.isPlaying) {
                $("#button_play_model").css("display", "none")
                $("#button_stop_model").css("display", "block")
            } else {
                $("#button_play_model").css("display", "block")
                $("#button_stop_model").css("display", "none")
            }
            if (entity.model.hasOwnProperty("defaultAnimation"))
                $("#model_animations").val(entity.model.defaultAnimation)
        } else {
            console.log("entity.model.animations.length==0")
            $("[data-block='animation']").css("display", "none");
        }
    }
    if(entity.type==ENTITIES_TYPES.model){

        var j = 0;
        var hasComponentVideo = false
        entity.renderer.materials.forEach(function(material){
            if(material.texture.isVideo){
                current_content_id = material.texture.contentId
                $("[data-block='videomaterial']").css("display","block");
                $("#model_materials").html("")
                var i = 0;
                entity.renderer.materials.forEach(function(material2){
                    $("#model_materials").append('<option value="'+i+'">'+material2.name+'</option>')
                    i++;
                })
                if(material.texture.contentId!=0) {
                    var video_resource = project_resources.videos.find(({id}) => id == material.texture.contentId);
                    console.log(video_resource)
                    $("#chooseVideoResource").text("Заменить")
                    $("#video_resource").html("<i class=\"bx bx-film menu-block obj_icon object_icon\" onclick=\"$('#chooseVideoResource').click()\"></i>\n" +
                        "<span onclick=\"$('#chooseVideoResource').click()\" data-key=\"t-dashboards\" class=\"menu-block long_title\">" +
                        video_resource.name + "</span>")
                }
                else {
                    $("#chooseVideoResource").text("Выбрать")
                    $("#video_resource").html("<img src=\"assets/images/img-placeholder.jpg\" alt=\"\" "+
                        "onclick=\"$('#chooseVideoResource').click()\" class=\"avatar-xs rounded\">\n" +
                        "<span onclick=\"$('#chooseVideoResource').click()\" data-key=\"t-dashboards\" class=\"menu-block long_title\">Нет выбранного</span>")
                }
                $("#model_materials").val(j);
                hasComponentVideo = true;
            }
            j++;
        });
        if(!hasComponentVideo) {
            $(".addComponentVideo").css("display", "block").attr("data-hided",false);
            current_content_id = 0;
        }
        if(entity.renderer.isOcclusion){
            $("[data-block='occlusionmaterial']").css("display","block");
        }
        else {
            $("[data-block='occlusionmaterial']").css("display","none");
            $(".addComponentOcclusion").css("display", "block").attr("data-hided",false);
        }

    }

    if(entity.type==ENTITIES_TYPES.model ||
        entity.type==ENTITIES_TYPES.texture){
        let j = 0;
        let hasComponentUnlit = false
        entity.renderer.materials.forEach(function(material){
            if(material.shaderId=="1"){
                console.log("[hasComponentUnlit]",true)
                setTimeout(function(){
                    $("[data-block='unlitmaterial']").css("display","block");
                },1)
                hasComponentUnlit = true;
            }
            j++;
        });
        if(!hasComponentUnlit) {
            $(".addComponentUnlit").css("display", "block").attr("data-hided",false);
        }
    }


    if(entity.type==ENTITIES_TYPES.model ||
        entity.type==ENTITIES_TYPES.texture ||
        entity.type==ENTITIES_TYPES.video){
        document.getElementById("renderer_visible").checked = entity.renderer.visible;
        document.getElementById("renderer_billboard").checked = entity.renderer.billboard;
        document.getElementById("renderer_shadowCast").checked = entity.renderer.shadowCast;
        $("#renderer_opacity").val(entity.renderer.opacity*100);
        var em_color = entity.renderer.emission.color;
        $("#renderer_emission").val(rgbToHex(Math.round(em_color.r*255.0),
            Math.round(em_color.g*255.0), Math.round(em_color.b*255.0)));
        /*$("#viewsettings .settings-item").css("display","flex");*/
    }
    if(entity.type==ENTITIES_TYPES.audio) {
        /*document.getElementById("renderer_visible").checked = entity.renderer.visible;
        $("#viewsettings .settings-item").css("display","none");
        $("#viewsettings .settings-item:eq(0)").css("display","flex");*/
        $("#audio_volume").val(entity.audio.volume*100);
        document.getElementById("audio_loop").checked = entity.audio.loop;
        document.getElementById("audio_playOnAwake").checked = entity.audio.playOnAwake;
        var content_id = entity.audio.contentId;
        var audio_resource = project_resources.audios.find(({ id }) => id == content_id);
        var url = audio_resource.domain[0]+audio_resource.path;
        console.log(url)
        audio.addEventListener("canplaythrough", function(){
            audio_currenttime = 0;
            $("#audio_player .current_time").text("0:00");
            $("#audio_player .total_time").text(time_format(audio.duration));
            clearInterval(update_interval);
            audio_timeline.noUiSlider.set([0]);
        }, {once : true});
        audio.src = url;

    }
    if(entity.type==ENTITIES_TYPES.video) {
        $("#video_volume").val(entity.video.volume*100);
        document.getElementById("video_loop").checked = entity.video.loop;
        document.getElementById("video_playOnAwake").checked = entity.video.playOnAwake;
    }


    if(entity.type==ENTITIES_TYPES.model ||
        entity.type==ENTITIES_TYPES.texture ||
        entity.type==ENTITIES_TYPES.video){
        document.getElementById("manipulation_movable").checked = entity.manipulation.movable;
        document.getElementById("manipulation_sizable").checked = entity.manipulation.sizable;
        document.getElementById("manipulation_rotatable").checked = entity.manipulation.rotatable;
        document.getElementById("manipulation_heightCorrection").checked = entity.manipulation.heightCorrection;
    }

    if(entity.type==ENTITIES_TYPES.model ||
        entity.type==ENTITIES_TYPES.texture ||
        entity.type==ENTITIES_TYPES.audio){
        let hasComponentDynamicLoading = entity.lazyLoad;
        if(hasComponentDynamicLoading)
            setTimeout(function(){
                $("[data-block='dynamicloading']").css("display","block");
            },1)
        else
            $(".addComponentDynamicLoading").css("display", "block").attr("data-hided",false);
    }
    console.log("has text "+entity.hasOwnProperty("is_text"))
    if(entity.hasOwnProperty("is_text") && entity.is_text){
        //console.log("IT IS TEXT")
        $("#text_input_settings").val(entity.text_data.text.slice(7));
        $("#text_font_select_settings").val(entity.text_data.font_family);
        $("#text_weight_select_settings").val(entity.text_data.font_weight);
        $("#text_align_select_settings").val(entity.text_data.text_align);
        $("#text_size_select_settings").val(entity.text_data.font_size);
        $("#text_color_input_settings").val(entity.text_data.color);
        document.getElementById("use_text_background_settings").checked = entity.text_data.use_background;
        if(!entity.text_data.use_background){
            $("#if_use_background_settings").css("display","none")
        }
        else
            $("#if_use_background_settings").css("display","block")

        $("#text_background_color_input_settings").val(entity.text_data.background);
        $("#text_background_border_radius_select_settings").val(entity.text_data.border_radius);
    }

    setTimeout(function(){
        checkComponentsCount()
    },1)

}
var parms_map = {
    name : "settings-title",
    transform: {
        position: {
            x: "transform_p_x",
            y: "transform_p_y",
            z: "transform_p_z"
        },
        rotation: {
            x: "transform_r_x",
            y: "transform_r_y",
            z: "transform_r_z"
        },
        scale: {
            x: "transform_s_x",
            y: "transform_s_y",
            z: "transform_s_z"
        }
    },
    renderer: {
        visible: "renderer_visible",
        billboard: "renderer_billboard",
        shadowCast: "renderer_shadowCast",
        opacity: "renderer_opacity",
        /*emission: {
            color : "renderer_emission"
        }*/
        emission : "renderer_emission"
    },
    manipulation : {
        movable: "manipulation_movable",
        sizable: "manipulation_sizable",
        rotatable: "manipulation_rotatable",
        heightCorrection: "manipulation_heightCorrection"
    },
    audio : {
        volume: "audio_volume",
        loop: "audio_loop",
        playOnAwake: "audio_playOnAwake"
    },
    video : {
        volume: "video_volume",
        loop: "video_loop",
        playOnAwake: "video_playOnAwake"
    },
    model : {
        playOnAwake: "animation_play_on_awake"
    },
    text_data: {
        text: "text_input_settings",
        font_family: "text_font_select_settings",
        font_weight: "text_weight_select_settings",
        font_size: "text_size_select_settings",
        text_align: "text_align_select_settings",
        color: "text_color_input_settings",
        use_background: "use_text_background_settings",
        background: "text_background_color_input_settings",
        border_radius: "text_background_border_radius_select_settings",
    }
}
read_parms_map({},parms_map)
function read_parms_map(path, obj){
    //console.log("read_parms_map");
    var keys = Object.keys(obj);
    if(keys.length == 0 || isString(obj)){
        var new_path = JSON.parse(JSON.stringify(path));
        var end = new_path
        var is_end = Object.keys(end).length;
        while(is_end > 0)  {
            var _end = end[Object.keys(end)[0]]
            is_end = Object.keys(_end).length || isString(Object.keys(_end));
            if(is_end > 0)
                end = _end;
            else
                end[Object.keys(end)[0]] = "$val";
        }

        //console.log("find")
        //console.log(JSON.stringify(new_path))
        //console.log(JSON.stringify(obj))
        onchange_parms(obj,new_path);

    }
    else {
        keys.forEach(function(key) {
            //console.log("readkey")
            //console.log(JSON.stringify(path))
            //console.log(JSON.stringify(obj))
            //console.log(key)
            var new_path = JSON.parse(JSON.stringify(path));
            //console.log(JSON.stringify(new_path))
            var end = new_path
            var is_end = Object.keys(end).length;
            while(is_end > 0)  {
                end = end[Object.keys(end)[0]]
                is_end = Object.keys(end).length;
            }
            end[key] = {}

            //console.log(JSON.stringify(new_path))
            read_parms_map(new_path,obj[key])
        });
    }
}

function onchange_parms(parm, data){
    var parm_obj = document.getElementById(parm);
    if($("#" + parm).hasClass("text_settings")){
        $("#" + parm).on("change", function(){
            console.log("[onchange_parms]")
            console.log(parm)
            var val = $("#" + parm).val()
            console.log(val)
            if($(parm_obj).hasClass("text_message"))
                val = "string:"+val;
            //switch
            if ($(parm_obj).hasClass("form-check-input"))
                val = parm_obj.checked;
            if (val != 0)
                $(parm_obj).attr("data-val", val)
            //string
            console.log("var")
            console.log(val)
            console.log(data)
            if (isString(val)) {
                function escapeStringForJSON(string) {
                    return string.replace(/\\/g, '\\\\')
                        .replace(/"/g, '\\"')
                        .replace(/\n/g, '\\n')
                        .replace(/\r/g, '\\r')
                        .replace(/\t/g, '\\t');
                }
                let escapedVal = escapeStringForJSON(val);
                escapedVal = `"${escapedVal}"`;
                _data = JSON.parse(JSON.stringify(data).replace('"$val"', escapedVal));
            } else {
                if (Object.keys(val).length > 0)
                    val = JSON.stringify(val)
                _data = JSON.parse(JSON.stringify(data).replace('"$val"', val));
            }
            console.log(val)

            var text_text = $("#text_input_settings").val();
            var title = text_text;
            if(title.length > 20)
                title = title.substring(0, 20)+"...";
            var fontFamily = $("#text_font_select_settings").val();
            var fontWeightOption = $("#text_weight_select_settings").val();
            var fontSizeOption = $("#text_size_select_settings").val();
            var textAlign = $("#text_align_select_settings").val();
            var textColor = $("#text_color_input_settings").val();
            var useTextBackground = document.getElementById("use_text_background_settings").checked;
            var textBackgroundColor = $("#text_background_color_input_settings").val();
            var textBackgroundBorderRadiusOption = $("#text_background_border_radius_select_settings").val();

            generate_text(
                title,
                text_text,
                fontFamily,
                fontWeightOption,
                fontSizeOption,
                textColor,
                textAlign,
                useTextBackground,
                textBackgroundColor,
                textBackgroundBorderRadiusOption,
                function(content_id){

                    get_resources(RESOURCES_TYPES.image,function (r){
                        project_resources.images = r;
                        console.log("update image resources")
                        console.log(project_resources.images);
                        var entity = entities.find(({ id }) => id == selected_obj);
                        var image_resource = project_resources.images.find(({ id }) => id == content_id);
                        var url = image_resource.domain[0]+image_resource.path;
                        get_image_aspect_ratio(url,function(asp_rat) {
                            set_entity(selected_obj, {
                                transform: {
                                    scale: {
                                        x:entity.transform.scale.x,
                                        y:entity.transform.scale.x/asp_rat,
                                        z:entity.transform.scale.z
                                    }
                                },
                                renderer: {
                                    materials: [{
                                        texture: {
                                            contentId: content_id,
                                            tiling:{"x":1,"y":1},
                                            isVideo:false
                                        },
                                        shaderId:1
                                    }]
                                },

                            },function() {
                                change_parms(selected_obj, _data);
                            });
                        })

                    })
                })
        })
    }
    else {
        parm_obj.addEventListener('input', function (element) {
            console.log('oninput ' + parm);
            var val = $("#" + parm).val()
            if ($(parm_obj).hasClass("allownumericwithdecimal")) {
                val = parseFloat($("#" + parm).val());
                if (val == null || isNaN(val)) {
                    val = 0;
                }
            }
            //percents
            if ($(parm_obj).hasClass("percents"))
                val = val / 100.0;
            //rename menu-object if changing name of object
            if (parm == "settings-title")
                $("#" + selected_obj).find(".menu_title").text(val);
            //switch
            if ($(parm_obj).hasClass("form-check-input"))
                val = parm_obj.checked;
            //color
            if ($(parm_obj).hasClass("form-control-color")) {
                val = val.split("#")[1].convertToRGB();
                //val = {r: val[0], g: val[1], b: val[2], a: 5}
                val = {color: {r: val[0] / 255.0, g: val[1] / 255.0, b: val[2] / 255.0, a: 1}, intensive: 0.00}
            }
            if ($(parm_obj).hasClass("locker") && parm_obj === document.activeElement) {
                var change = val / parseFloat($(parm_obj).attr("data-val"));
                var locker = $(parm_obj).attr("data-locker");
                if (lock_storage[locker]) {
                    console.log("change", change)
                    var lockers = $("[data-locker='" + locker + "'");
                    for (var i = 0; i < lockers.length; i++) {
                        if ($(lockers[i]).attr("id") != $(parm_obj).attr("id")) {
                            console.log("i: " + i + ", " + parseFloat($(lockers[i]).attr("data-val")) * change)
                            if (isFinite(parseFloat($(lockers[i]).attr("data-val")) * change) &&
                                !isNaN(parseFloat($(lockers[i]).attr("data-val")) * change))
                                $(lockers[i]).val(parseFloat($(lockers[i]).attr("data-val")) * change)
                            else {
                                console.log("crap")
                                $(lockers[i]).val(val)
                            }
                            document.getElementById($(lockers[i]).attr("id")).dispatchEvent(new Event('input', {bubbles: true}));
                            /*if(!isFinite(parseFloat($(lockers[i]).attr("data-val"))*change) &&
                                parseFloat($(lockers[i]).attr("data-val"))*change != 0)
                                $(lockers[i]).attr("data-val",$(lockers[i]).attr("data-val")*change)*/
                        }
                    }
                }
            }
            if (val != 0)
                $(parm_obj).attr("data-val", val)
            //string
            if (isString(val)) {
                _data = JSON.parse(JSON.stringify(data).replace('$val', val));
            } else {
                if (Object.keys(val).length > 0)
                    val = JSON.stringify(val)
                _data = JSON.parse(JSON.stringify(data).replace('"$val"', val));
            }
            console.log(val)
            change_parms(selected_obj, _data);
        });
    }
}

function change_parms(id, _data){
    console.log("change_parms")
    console.log(_data)
    set_entity(id,_data, function(){
        get_entity(id,function(e){
            for(var i=0;i<entities.length;i++){
                if(entities[i].id==id){
                    entities[i] = e;
                    return;
                }
            }
        })
    });
}


function onchange_marker_parms(parm, data, target_field=undefined){
    var parm_obj = document.getElementById(parm);
    if(target_field ==undefined)
        target_field = parm;
    parm_obj.addEventListener('input', function(element) {
        console.log('oninput ' + target_field);
        var val = $("#" + target_field).val()
        if ($("#"+target_field).hasClass("allownumericwithdecimal")) {
            val = parseFloat($("#" + target_field).val());
            if (val == null || isNaN(val)) {
                val = 0;
            }
        }
        //percents
        if ($("#"+target_field).hasClass("percents"))
            val = val / 100.0;
        if ($("#"+target_field).hasClass("centimeters"))
            val = val / 100.0;
        //rename menu-object if changing name of object
        if (target_field == "marker-title") {
            $("#" + selected_obj).find(".menu_title").text(val);
        }
        if ($(parm_obj).hasClass("form-check-input"))
            val = parm_obj.checked;
        console.log(val)
        change_marker_parms(selected_obj,data,val);
    });
}
let reloadTimeout;
function change_marker_parms(id, _data,val){
    clearTimeout(reloadTimeout);
    for(var i=0;i<scene.anchors.length;i++){
        if(scene.anchors[i].id==id){
            scene.anchors[i][_data] = val;
            console.log(scene.anchors[i]);
            //set_scene({anchors:scene.anchors})

            set_scene({anchors: scene.anchors}, function () {
                clearTimeout(reloadTimeout);
                reloadTimeout = setTimeout(function(){
                    force_reload = true;
                    location.reload();
                },2000)

            });

            return;
        }
    }
    /*set_entity(id,_data, function(){
        get_entity(id,function(e){
            for(var i=0;i<entities.length;i++){
                if(entities[i].id==id){
                    entities[i] = e;
                    return;
                }
            }
        })
    });*/
}

////////////////////////////////////////////////////

function isString(x) {
    return Object.prototype.toString.call(x) === "[object String]"
}


function registr_allownumericwithdecimal(obj){
    $(obj).on("keypress keyup blur",function (event) {
        if($(obj).hasClass("positive"))
            $(this).val($(this).val().replace(/[^0-9\.]/g,''));
        else
            $(this).val($(this).val().replace(/[^0-9\.-]/g,''));
        if($(this).val().indexOf('-') != -1)
            $(this).val($(this).val().replace(/^.+-/,'-'));
        //alert(event.which)
        //- = 45 . = 190
        if ((event.which != 46 || $(this).val().indexOf('.') != -1)
            && (event.which < 48 || event.which > 57) && event.which !=45) {
            event.preventDefault();
        }
        $(this).trigger("change");
    });

    $(obj).on("keypress",function (event) {
        if (event.key === "Enter") {
            if($(this).val() == "")
                $(this).val("0")
        }
    });
    $(obj).on("blur",function (event) {

        if($(this).val() == "" || $(this).val() == "-"){
            if($(obj).hasClass("maybenull"))
                $(this).val("-")
            else
                $(this).val("0")
        }
        $(this).trigger("change");
    });
    regist_input_selection(obj);
}
function regist_input_selection(obj){
    $(obj).on("focus",function(){
        //$(this).select();
    });
    $(obj).on("click",function(){
        //$(this).select();
    });
}
registr_allownumericwithdecimal($(".allownumericwithdecimal"));

function componentToHex(c) {
    var hex = c.toString(16);
    return hex.length == 1 ? "0" + hex : hex;
}
function rgbToHex(r, g, b) {
    return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}
String.prototype.convertToRGB = function(){
    if(this.length != 6){
        throw "Only six-digit hex colors are allowed.";
    }

    var aRgbHex = this.match(/.{1,2}/g);
    var aRgb = [
        parseInt(aRgbHex[0], 16),
        parseInt(aRgbHex[1], 16),
        parseInt(aRgbHex[2], 16)
    ];
    return aRgb;
}
//////////////////////////////////////////////////
function set_tool(tool,data=""){
    window.UNITY.sendMessageToUnity(new Command(tool,data,[]))
}

function get_image_aspect_ratio(url,callback){
    var image = new Image();
    image.src = url;
    image.onload = function () {
        callback(1.0*this.width/this.height);
    };
}

function get_video_aspect_ratio(url,callback){
    const video = document.createElement('video');
    video.src = url;
    video.addEventListener( "loadedmetadata", function (e) {
        callback(1.0*this.videoWidth/this.videoHeight);
    }, false );
}
// save project
function save_project(){
    console.log("save project");
    sendMessageToCodeEditor("save");
    check_interaction()
    window.UNITY.sendMessageToUnity(new Command("saveproject",{},[])).then(e=>{
        console.log("project saved")
        console.log(e);
    }).catch(e=>{console.log( e)});
    take_screenshot(function(e){
        console.log("take_screenshot", e.length)
        var token = getCookie("token"); // Получаем токен из cookie
        $.ajax({
            url: "server/updateProjectImage.php",
            type: "POST",
            data: {
                token: token,
                image: e.split("base64,")[1],
                project_hash: projectHASH
            },
            dataType: "json", // Указываем, что ожидаем ответ в формате JSON
            success: function(response) {
                console.log(response)
                // Проверяем результат выполнения
                if (response.result === "success") {
                    // Выводим сообщение об успешном создании проекта
                    console.log("Изображение проекта обновлено успешно", response);
                    //alert("Проект успешно создан. Hash: " + response.hash);
                } else if (response.result === "error") {
                    // Выводим сообщение об ошибке от сервера
                    console.error("Ошибка при обновлении изображения проекта", response.error);
                    alert("Ошибка: " + response.error);
                }
            },
            error: function(xhr, status, error) {
                // Обработка ошибки запроса
                console.error("Ошибка при обновлении изображения проекта", error);
                alert("Ошибка запроса: " + error);
                console.log(error)
            }
        });
    })
}

// context menu
$("#delete_menu_object").on("click",function(){

    var id = $(this).parent().parent().attr("data-id");
    var type = $(this).parent().parent().attr("data-type");
    console.log("[delete_menu_object] "+id+" "+type)
    let onDelete = function(){
        delete_menu_object(id);
        if (id == selected_obj) {
            select_entity(-1);
            selected_obj = null
            select_menu_object(null);
        } else {
            if (selected_obj == null)
                select_entity(-1);
            else {
                select_entity(selected_obj);
            }
        }
    }
    if (type == "interaction") {
        delete_interaction(id);
        onDelete()
    }
    else {
        if(type == "object") {
            delete_entity(id);
            onDelete()
        }
        else {
            if(type == "anchor" || type == "plane_anchor" || type == "cloud_anchor"){
                let _id = id;
                if(scene.anchors.find(({ id }) => id == _id)!=undefined) {
                    if (scene.anchors.length > 1) {
                        if (confirm("Удалить маркер и весь контент, связанный с ним?")) {
                            deleteAnchorWithContent(id, function () {

                                let current_anchor_id = scene.anchors[anchor].id;
                                for (var i = 0; i < scene.anchors.length; i++) {
                                    if (scene.anchors[i].id == id)
                                        scene.anchors.splice(i, 1);
                                }

                                set_scene({anchors: scene.anchors}, function () {
                                    console.log("deleteAnchorWithContent 2")
                                    console.log(current_anchor_id + " " + id)
                                    if (current_anchor_id == id) {
                                        var newURL = updateURLParameter(window.location.href, 'anchor', scene.anchors[0].id);
                                        force_reload = true;
                                        location.href = newURL;
                                    } else {
                                        onDelete()
                                    }
                                });


                            });
                        }
                    } else {
                        alert("Невозможно удалить единственный способ привязки!")
                    }
                }
                else {
                    alert("Невозможно удалить привязки вне целевой сцены, для удаления перейдите в нужную сцену!")
                }
            }
            else {
                if(type == "scene"){
                    let deleted_scene_number = Number(id.split("scene")[1])
                    id = scenes[deleted_scene_number].id;
                    let current_scene_id = scene.id;
                    delete_scene(id,function () {
                        console.log("scene_deleted "+id)
                        console.log("current_scene "+scene.id)
                        if(current_scene_id == id){
                            save_project();
                            setTimeout(function(){
                                var newURL = updateURLParameter(window.location.href, 'anchor');
                                newURL = updateURLParameter(newURL, 'scene');
                                force_reload = true;
                                location.href = newURL;
                            },1000)
                        }
                        else {
                            if(scene_number > deleted_scene_number){
                                save_project();
                                setTimeout(function() {
                                    var newURL = updateURLParameter(window.location.href, 'scene', scene_number--);
                                    force_reload = true;
                                    location.href = newURL;
                                },1000)
                            }
                            else {
                                get_scenes(function () {
                                    load_anchors_resourses()
                                });
                            }
                        }
                    })
                }
            }
        }
    }
})
$("#rename_menu_object").on("click",function(e){
    var id = $(this).parent().parent().attr("data-id");
    var type = $(this).parent().parent().attr("data-type");
    console.log("[rename_menu_object] "+type)
    $("#"+id).click();
    switch (type) {
        case "anchor":
            $("#marker-title").focus();
            $("#marker-title").select();
            break;
        case "scene":
            $("#scene_name").focus();
            $("#scene_name").select();
            break;
        default:
            $("#settings-title").focus();
            $("#settings-title").select();
            break;
    }
    e.preventDefault();
})
$("#clone_menu_object").on("click",function(e){
    var id = $(this).parent().parent().attr("data-id");
    var type = $(this).parent().parent().attr("data-type");
    console.log("[clone_menu_object] "+type)
    switch (type) {
        case "anchor":
            $("#marker-title").focus();
            $("#marker-title").select();
            break;
        case "scene":
            $("#scene_name").focus();
            $("#scene_name").select();
            break;
        default:
            clone_object(id)
            break;
    }
    e.preventDefault();
})
function delete_menu_object(id){
    var parent = $("#"+id).parent()
    $("#"+id).remove();
    if(parent.children().length==0){
        parent.parent().find("o").removeClass("opened")
    }
}
// buttons listner
window.addEventListener("keydown", (e) => {
    if(document.activeElement.tagName != "INPUT" && document.activeElement.tagName != "TEXTAREA" || document.activeElement.type=="checkbox") {
        //escape
        if (e.which == 27)
            if ($("#context_menu button").hasClass("show"))
                $("#context_menu button").click()
        //delete
        if (e.which == 46) {
            if (selected_obj != null) {
                if(selected_type == "marker" || selected_type == "planeTracker" || selected_type == "objectTracker"){
                    if(scene.anchors.length > 1) {
                        if (confirm("Удалить маркер и весь контент, связанный с ним?")) {



                            deleteAnchorWithContent(selected_obj, function () {

                                for (var i = 0; i < scene.anchors.length; i++) {
                                    if (scene.anchors[i].id == selected_obj)
                                        scene.anchors.splice(i, 1);
                                }

                                set_scene({anchors: scene.anchors}, function () {
                                    var newURL = updateURLParameter(window.location.href, 'anchor', scene.anchors[0].id);
                                    force_reload = true;
                                    location.href = newURL;
                                });


                            });










                        }
                    }
                    else {
                        alert("Невозможно удалить единственный способ привязки")
                    }
                }
                else {
                    delete_entity(selected_obj);
                    delete_interaction(selected_obj)
                    delete_menu_object(selected_obj);
                    select_entity(-1);
                    selected_obj = null
                    select_menu_object(null);
                }
            }
        }
        //focus
        if (e.which == 70) {
            if (selected_obj != null) {
                center_object();
            }
        }
        //clone
        if (e.which == 67) {
            if (selected_obj != null) {
                clone_object();
            }
        }
    }
    else {
        if (e.which == 27)
            document.activeElement.blur()
    }
}, true);
$("input").on("focus",function(){
    //$(this).select();
})
$("input").on("click",function(){
    //$(this).select();
});
let onInputMouseDown = false;
let mouseMoveStart = {x:0,y:0}
let current_input = undefined;
$("input").on("mousedown",function(e){
    //console.log("mousedown")
    onInputMouseDown = true;
    mouseMoveStart = {x: e.pageX, y: e.pageY}
});
$("input").on("mousemove",function(e){
    //console.log("mousemove", )
    //onInputMouseDown = false;
});
$("input").on("mouseup",function(e){
    //console.log("mouseup")
    let dist = Math.sqrt(Math.pow(e.pageX-mouseMoveStart.x,2)+Math.pow(e.pageY-mouseMoveStart.y,2))
    console.log("onInputMouseDown",onInputMouseDown)
    console.log("dist",dist)
    console.log("current_input != this",current_input != this)
    if(onInputMouseDown && dist < 3 && current_input != this) {
        console.log("select")
        setTimeout(()=>{
            $(this).select();
        },30)
    }
    //setTimeout(()=>{
        current_input = this;
    //},100)
    onInputMouseDown = false
});
$("input").on("blur",function(e){
    current_input = undefined;
});


var audio_timeline=document.getElementById("audioline");
noUiSlider.create(audio_timeline,
    {start:0,connect:"lower",range:{min:0,max:100}});
var update_interval = null;
const playerButton = $('#audio_player .play-button'),
    audio = document.getElementById("audio_source");
var audio_playing = false;
var audio_currenttime = 0;
$("#audio_player .current_time").text("0:00");
$("#audio_player .total_time").text(time_format(audio.duration));
//changeSeek(parseFloat(e[0]))

function toggleAudio () {
    audio_playing = audio.paused;
    if (audio.paused)
        playAudio()
    else
        pauseAudio();

}
function playAudio(){
    audio.src = audio.src;
    audio.currentTime = audio_currenttime;
    audio.play();
    $(playerButton).removeClass("bx-play");
    $(playerButton).addClass("bx-pause");
    clearInterval(update_interval);
    update_interval = setInterval(function () {
        changeTimelinePosition()
    }, 30);
}
function time_format(seconds){
    let minutes = ~~(seconds / 60);
    let extraSeconds = Math.ceil(seconds % 60);
    return minutes+":"+(("0" + extraSeconds).slice(-2));
}
function pauseAudio(){
    audio_currenttime = audio.currentTime;
    console.log("C "+audio.currentTime)
    audio.pause();
    clearInterval(update_interval);
    update_interval = null;
    $(playerButton).addClass("bx-play");
    $(playerButton).removeClass("bx-pause");
}
$('#audio_player .play-button').on("click",function(){
    toggleAudio()
})
var audio_slider_onmousedown = false;
$('#audioline .noUi-touch-area').on("mousedown",function(){
    audio_slider_onmousedown = true;
    pauseAudio();
    console.log("DOWN")
    console.log(audio_playing)
})
$('body').on("mouseup",function(){
    if(audio_slider_onmousedown) {
        audio_slider_onmousedown = false;
        console.log("UP")
        console.log(audio_playing)
        if(audio_playing){
            //alert(123)
            playAudio();
        }
    }
})
function changeTimelinePosition () {
    const percentagePosition = (100*audio.currentTime) / audio.duration;
    audio_timeline.noUiSlider.set([percentagePosition]);
    $("#audio_player .current_time").text(time_format(audio.currentTime));
}
function audioEnded () {
    $(playerButton).addClass("bx-play");
    $(playerButton).removeClass("bx-pause");
    audio_currenttime = 0;
    audio_playing = false;
    if(update_interval != null)
        audio_timeline.noUiSlider.set([0])
    clearInterval(update_interval);
    update_interval = null;
}
audio.onended = audioEnded;
function changeSeek (val) {
    //console.log(val)
    //console.log(audio.currentTime/audio.duration*100);
    if(update_interval == null) {
        var time = (val * audio.duration) / 100;

        if(val > 98) {
            time = 0;
        }
        //console.log("currentTime "+ audio.currentTime/audio.duration*100);
        try {
            audio.currentTime = time;
        }
        catch (e) {
            audio_currenttime = time;
            $("#audio_player .current_time").text(time_format(time));
        }
    }
}
audio_timeline.noUiSlider.on("update",function(e,t,i,n,l){
    // console.log(parseFloat(e[0]));
    changeSeek(parseFloat(e[0]))
})

function get_interactive(callback){
    window.UNITY.sendMessageToUnity(new Command("getinteractive",{},[])).then(e=>{
        console.log(e);
        callback(e)
    }).catch(e=>{console.log( e)});
}
function set_interactive(obj){
    check_interaction()
    window.UNITY.sendMessageToUnity(new Command("setinteractive",obj,[])).then(e=>{
        console.log(e);
    }).catch(e=>{console.log( e)});
}


////////
//INTERACTION

function add_interaction(interaction, callback, is_new = false){
    interactions_count++;
    /*var obj = $("<div class=\"nav-item menu-object\" data-menu-type=\"interaction\" data-title=\"Интерактив "+interactions_count+"\" >\n" +
        "                            <img src=\"assets/images/interaction.png\" alt=\"\" class=\"avatar-xs rounded\">\n" +
        "                            <span data-key=\"t-dashboards\" class=\"menu-block menu_title\">Интерактив "+interactions_count+"</span>\n" +
        "<i class=\" bx bx-show show-button\" style=\"\"></i><i class=\" bx bx-hide hide-button\" style=\"\"></i> </div>").appendTo("#interactions");
    $("#interactions-title").addClass("opened");
    if($("#interactions-title").hasClass("collapsed"))
        $("#interactions-title").click()
    $(obj).on("click",function(){
        select_menu_object(this)
    });
    $(obj).find(".show-button").on("click", function(){
        $(this).parent().addClass("hided");
    })
    $(obj).find(".hide-button").on("click", function(){
        $(this).parent().removeClass("hided");
    })
    $(obj).click()*/
    if(interaction == undefined){
        var _interaction = {
            id:"i"+Math.floor(Math.random() * 999999),
            name:"Интерактив "+interactions_count,
            enabled:true,
            trigger:{},
            actionFlows:[{
                actions:[]
            }],
            anchor: get_anchor()
        }
        var i = interactions.push(_interaction);
        interaction = interactions[i-1];
        set_interactive(interactions);
    }
    var obj = $("<div class=\"nav-item menu-object\" data-menu-type=\"interaction\" id='"+interaction.id+"' " +
        "data-title=\"" + interaction.name + "\" data-id=\"" + interaction.id + "\" >\n" +
        "<i class=\"bx bx-walk menu-block obj_icon\"></i>\n" +
        "<span data-key=\"t-dashboards\" class=\"menu-block menu_title\">"+interaction.name+"</span>\n" +
        "<i class=\"bx bx-error menu-block error_icon \"bx-error></i> <i class=\" bx bx-show show-button\" style=\"\"></i><i " +
        "class=\" bx bx-hide hide-button\" style=\"\"></i> </div>").appendTo("#interactions");
    /*$(obj).find(".error_icon").attr("data-bs-toggle","tooltip");
    $(obj).find(".error_icon").attr("data-bs-placement","left");
    $(obj).find(".error_icon").attr("data-bs-original-title","Не все поля заполнены верно!");*/
    $("#interactions-title").addClass("opened");
    if($("#interactions-title").hasClass("collapsed"))
        $("#interactions-title").click()
    registr_menu_object(obj,interaction, "interaction");
    if(is_new)
        $(obj).click()
    if(callback != undefined)
        callback(obj);
    if(is_new)
        check_interaction()
}
function delete_interaction(_id){
    console.log("delete_interaction");
    for( var i = 0; i < interactions.length; i++){
        if ( interactions[i].id == _id) {
            interactions.splice(i, 1);
            set_interactive(interactions);
        }
    }
}
/*
$(".trigger1settings-dropdown o").on("click",function(){
    $("[data-block='trigger1']").css("display", "none");
    $("[data-block='trigger2']").css("display", "block");
})*/
$(".add-action-menu o").on("click",function(){
    //$(".action-block").css("display", "block");
})


function show_interaction_parms(_id){
    var interaction = interactions.find(({ id }) => id == _id);
    console.log("show_interaction_parms")
    console.log(interaction)
    $("#interaction-title").val(interaction.name);
    if(Object.keys(interaction.trigger).length==0){
        $("[data-block='trigger2']").css("display", "none");
        $("[data-block='trigger1']").css("display", "block");
    }
    else {
        $("[data-block='trigger1']").css("display", "none");
        $("[data-block='trigger2']").css("display", "block");
        add_trigger(interaction);


    }
    $("#actions").html("")
    for( var i = 0; i < interaction.actionFlows[0].actions.length; i++) {
        build_html_action(interaction.actionFlows[0].actions[i],i+1);
    }
    /*if(entity.type==ENTITIES_TYPES.model ||
        entity.type==ENTITIES_TYPES.texture ||
        entity.type==ENTITIES_TYPES.audio ||
        entity.type==ENTITIES_TYPES.video){
        $("#transform_p_x").val(entity.transform.position.x)
        $("#transform_p_y").val(entity.transform.position.y)
        $("#transform_p_z").val(entity.transform.position.z)
        $("#transform_r_x").val(entity.transform.rotation.x)
        $("#transform_r_y").val(entity.transform.rotation.y)
        $("#transform_r_z").val(entity.transform.rotation.z)
        $("#transform_s_x").val(entity.transform.scale.x)
        $("#transform_s_y").val(entity.transform.scale.y)
        $("#transform_s_z").val(entity.transform.scale.z)
    }
    if(entity.type==ENTITIES_TYPES.model ||
        entity.type==ENTITIES_TYPES.texture ||
        entity.type==ENTITIES_TYPES.video){
        document.getElementById("renderer_visible").checked = entity.renderer.visible;
        document.getElementById("renderer_billboard").checked = entity.renderer.billboard;
        document.getElementById("renderer_shadowCast").checked = entity.renderer.shadowCast;
        $("#renderer_opacity").val(entity.renderer.opacity*100);
        var em_color = entity.renderer.emission.color;
        $("#renderer_emission").val(rgbToHex(em_color.r, em_color.g, em_color.b));
        /!*$("#viewsettings .settings-item").css("display","flex");*!/
    }
    if(entity.type==ENTITIES_TYPES.audio) {
        /!*document.getElementById("renderer_visible").checked = entity.renderer.visible;
        $("#viewsettings .settings-item").css("display","none");
        $("#viewsettings .settings-item:eq(0)").css("display","flex");*!/
        $("#audio_volume").val(entity.audio.volume*100);
        document.getElementById("audio_loop").checked = entity.audio.loop;
        document.getElementById("audio_playOnAwake").checked = entity.audio.playOnAwake;
        var content_id = entity.audio.contentId;
        var audio_resource = project_resources.audios.find(({ id }) => id == content_id);
        var url = audio_resource.domain[0]+audio_resource.path;
        console.log(url)
        audio.addEventListener("canplaythrough", function(){
            audio_currenttime = 0;
            $("#audio_player .current_time").text("0:00");
            $("#audio_player .total_time").text(time_format(audio.duration));
            clearInterval(update_interval);
            audio_timeline.noUiSlider.set([0]);
        }, {once : true});
        audio.src = url;

    }
    if(entity.type==ENTITIES_TYPES.video) {
        $("#video_volume").val(entity.video.volume*100);
        document.getElementById("video_loop").checked = entity.video.loop;
        document.getElementById("video_playOnAwake").checked = entity.video.playOnAwake;
    }


    if(entity.type==ENTITIES_TYPES.model ||
        entity.type==ENTITIES_TYPES.texture ||
        entity.type==ENTITIES_TYPES.video){
        document.getElementById("manipulation_movable").checked = entity.manipulation.movable;
        document.getElementById("manipulation_sizable").checked = entity.manipulation.sizable;
        document.getElementById("manipulation_rotatable").checked = entity.manipulation.rotatable;
        document.getElementById("manipulation_heightCorrection").checked = entity.manipulation.heightCorrection;
    }*/

}
function show_interaction(interaction){
    interaction.enabled = true;
    set_interactive(interactions);
}
function hide_interaction(interaction){
    interaction.enabled = false;
    set_interactive(interactions);
}
document.getElementById("interaction-title").addEventListener('input', function(element) {
    console.log('oninput interaction-title');
    var val = $("#interaction-title").val()
    $("#" + selected_obj).find(".menu_title").text(val);
    for( var i = 0; i < interactions.length; i++){
        if ( interactions[i].id == selected_obj) {
            interactions[i].name = val;
            set_interactive(interactions);
        }
    }
});
const TRIGGER_UI_TYPES = {
    Click:0,
    Hold:1,
    DoubleClick:2,
    SceneStart:3,
    PositionChanged:4,
    RotationChanged:5,
    ScaleChanged:6,
    TrackingMarkerFind:7,
    TrackingMarkerLost:8,
    TrackingPlaneFind:9,
    Collide:10,
    ObjectRender:11,
    WebViewTrigger:12
}
const TRIGGER_STRUCTURE = {
    type: {
        Click: 0,
        Hold: 1,
        SceneStart: 2,
        Collide: 3,
        ObjectRender: 4,
        TransformChanged: 5,
        TrackingMarker: 6,
        TrackingPlane: 7,
        WebViewTrigger: 8
    },
    triggerReuse : {
        None : 0,
        Always : 1,
        WaitForActionsDone: 2
    },
    clickTrigger: {
        targetsType: {
            Single : 0,
            Multiple : 1,
            All: 2
        }
    },
    holdTrigger: {
        targetsType: {
            Single : 0,
            Multiple : 1,
            All: 2
        }
    },
    transformChangedTrigger : {
        targetsType: {
            Single : 0,
            Multiple : 1,
            All: 2
        },
        /*changeType: {
            Position: 0,
            Rotation: 1,
            Scale: 2
        }*/
    },
    trackingMarkerTrigger: {
        type: {
            Begin : 0,
            Stay: 1,
            End: 2
        },
        targetsType: {
            Single : 0,
            Multiple : 1,
            All: 2
        }
    },
    planeTrackedTrigger: {
        type: {
            Horizontal: 0,
            Vertical: 1
        }
    },
    renderInCameraTrigger: {
        type: {
            Begin : 0,
            Stay: 1,
            End: 2
        },
        targetsType: {
            Single : 0,
            Multiple : 1,
            All: 2
        }
    },
    collideTrigger: {
        type: {
            Begin : 0,
            Stay: 1,
            End: 2
        },
        targetAType: {
            Single : 0,
            Multiple : 1,
            All: 2
        },
        targetBType: {
            Single : 0,
            Multiple : 1,
            All: 2
        }
    },
    webViewTrigger: {
        message: ""
    }
}

const TRIGGERS_HTML = {
    //    Click : "<div class=\"trigger-block\"><label class=\"form-label mini-label title-label\" style=\"margin-bottom: 8px\">Касание</label><div class=\"choices\" data-type=\"select-multiple\" role=\"combobox\" aria-autocomplete=\"list\" aria-haspopup=\"true\" aria-expanded=\"false\"><div class=\"choices__inner\"><select class=\"form-control choices__input\" id=\"trigger-click-targets\" data-choices=\"\" data-choices-sorting-false=\"\" data-choices-removeitem=\"\" name=\"choices-multiple-remove-button\" data-placeholder=\"Select City\" multiple=\"\" hidden=\"\" tabindex=\"-1\" data-choice=\"active\"></select><div class=\"choices__list choices__list--multiple\"></div><input type=\"text\" class=\"choices__input choices__input--cloned\" autocomplete=\"off\" autocapitalize=\"off\" spellcheck=\"false\" role=\"textbox\" aria-autocomplete=\"list\" aria-label=\"Целевые объекты\" placeholder=\"Целевые объекты\" style=\"min-width: 16ch; width: 1ch;\"></div><div class=\"choices__list choices__list--dropdown\" aria-expanded=\"false\"><div class=\"choices__list\" aria-multiselectable=\"true\" role=\"listbox\"><div id=\"choices--trigger-click-targets-item-choice-2\" class=\"choices__item choices__item--choice choices__item--selectable is-highlighted\" role=\"option\" data-choice=\"\" data-id=\"2\" data-value=\"0\" data-select-text=\"Press to select\" data-choice-selectable=\"\" aria-selected=\"true\">Любой объект</div><div id=\"choices--trigger-click-targets-item-choice-3\" class=\"choices__item choices__item--choice choices__item--selectable\" role=\"option\" data-choice=\"\" data-id=\"3\" data-value=\"1\" data-select-text=\"Press to select\" data-choice-selectable=\"\">3d-модель шара 1</div><div id=\"choices--trigger-click-targets-item-choice-4\" class=\"choices__item choices__item--choice choices__item--selectable\" role=\"option\" data-choice=\"\" data-id=\"4\" data-value=\"2\" data-select-text=\"Press to select\" data-choice-selectable=\"\">3d-модель шара 2</div><div id=\"choices--trigger-click-targets-item-choice-5\" class=\"choices__item choices__item--choice choices__item--selectable\" role=\"option\" data-choice=\"\" data-id=\"5\" data-value=\"3\" data-select-text=\"Press to select\" data-choice-selectable=\"\">Изображение 1</div><div id=\"choices--trigger-click-targets-item-choice-6\" class=\"choices__item choices__item--choice choices__item--selectable\" role=\"option\" data-choice=\"\" data-id=\"6\" data-value=\"4\" data-select-text=\"Press to select\" data-choice-selectable=\"\">Видео 1</div></div></div></div></div>",
    Click : {
        html: "<div class=\"trigger-block\">\n" +
                "<label class=\"form-label mini-label title-label\">Касание</label>\n" +
            "    <div class=\"settings-item\">\n" +
            "        <select class=\"form-select form-select-sm form-select-option-m target1\">\n" +
            // "            <option selected=\"\" value=\"Arial\">Переместить в</option>\n" +
            // "            <option value=\"Courier\">Переместить на</option>\n" +
            "        </select>\n" +
            "    </div>\n" +
            "<label class=\"form-label mini-label\" style='margin-bottom: 8px'>Повторное отслеживание</label>\n" +
            "    <div class=\"settings-item\">\n" +
            "        <select class=\"form-select form-select-sm form-select-option-m reuse\">\n" +
            "            <option selected=\"selected\" value=1>Сразу</option>\n" +
            "            <option value=2>После выполнения всех действий</option>\n" +
            "            <option value=0>Нет</option>\n" +
            "        </select>\n" +
            "    </div>\n" +
            "</div>"
    },
    DoubleClick :{
      html: "<div class=\"trigger-block\">\n" +
          "<label class=\"form-label mini-label title-label\">Двойное касание</label>\n" +
          "<div class=\"settings-item\">\n" +
          "    <select class=\"form-select form-select-sm form-select-option-m target1\">\n" +
          /*"        <option value=\"\" selected=\"\">Любой объект</option>\n" +
          "        <option value=\"All\">Любой объект</option>\n" +
          "        <option value=\"$id\">Объект 1</option>\n" +
          "        <option value=\"$id\">...</option>\n" +*/
          "    </select>\n" +
          "</div>\n" +
          "<label class=\"form-label mini-label\" style='margin-bottom: 8px'>Повторное отслеживание</label>\n" +
          "    <div class=\"settings-item\">\n" +
          "        <select class=\"form-select form-select-sm form-select-option-m reuse\">\n" +
          "            <option selected=\"selected\" value=1>Сразу</option>\n" +
          "            <option value=2>После выполнения всех действий</option>\n" +
          "            <option value=0>Нет</option>\n" +
          "        </select>\n" +
          "    </div>\n" +
          "</div>"
    },
    Hold :{
        html: "<div class=\"trigger-block\">\n" +
            "<label class=\"form-label mini-label title-label\">Длительное касание</label>\n" +
            "<div class=\"settings-item\">\n" +
            "    <select class=\"form-select form-select-sm form-select-option-m target1\">\n" +
            /*"        <option value=\"\" selected=\"\">Любой объект</option>\n" +
            "        <option value=\"All\">Любой объект</option>\n" +
            "        <option value=\"$id\">Объект 1</option>\n" +
            "        <option value=\"$id\">...</option>\n" +*/
            "    </select>\n" +
            "</div>\n" +
            "<label class=\"form-label mini-label\" style='margin-bottom: 8px'>Повторное отслеживание</label>\n" +
            "    <div class=\"settings-item\">\n" +
            "        <select class=\"form-select form-select-sm form-select-option-m reuse\">\n" +
            "            <option selected=\"selected\" value=1>Сразу</option>\n" +
            "            <option value=2>После выполнения всех действий</option>\n" +
            "            <option value=0>Нет</option>\n" +
            "        </select>\n" +
            "    </div>\n" +
            "</div>"
    },
    SceneStart : {
        html: "<div class=\"trigger-block\">\n" +
            "    <label class=\"form-label mini-label title-label\" style=\"margin-bottom: 0px\">Запуск сцены</label>\n" +
            "</div>"
    },
    PositionChanged :{
        html: "<div class=\"trigger-block\">\n" +
        "<label class=\"form-label mini-label title-label\">Изменение положения объекта</label>\n" +
        "<div class=\"settings-item\">\n" +
        "    <select class=\"form-select form-select-sm form-select-option-m target1\">\n" +
        /*"        <option value=\"\" selected=\"\">Любой объект</option>\n" +
        "        <option value=\"All\">Любой объект</option>\n" +
        "        <option value=\"$id\">Объект 1</option>\n" +
        "        <option value=\"$id\">...</option>\n" +*/
        "    </select>\n" +
        "</div>\n" +
            "<label class=\"form-label mini-label\" style='margin-bottom: 8px'>Повторное отслеживание</label>\n" +
            "    <div class=\"settings-item\">\n" +
            "        <select class=\"form-select form-select-sm form-select-option-m reuse\">\n" +
            "            <option selected=\"selected\" value=1>Сразу</option>\n" +
            "            <option value=2>После выполнения всех действий</option>\n" +
            "            <option value=0>Нет</option>\n" +
            "        </select>\n" +
            "    </div>\n" +
        "</div>"
    },
    RotationChanged :{
        html: "<div class=\"trigger-block\">\n" +
        "<label class=\"form-label mini-label title-label\">Изменение вращения объекта</label>\n" +
        "<div class=\"settings-item\">\n" +
        "    <select class=\"form-select form-select-sm form-select-option-m target1\">\n" +
        /*"        <option value=\"\" selected=\"\">Любой объект</option>\n" +
        "        <option value=\"All\">Любой объект</option>\n" +
        "        <option value=\"$id\">Объект 1</option>\n" +
        "        <option value=\"$id\">...</option>\n" +*/
        "    </select>\n" +
        "</div>\n" +
            "<label class=\"form-label mini-label\" style='margin-bottom: 8px'>Повторное отслеживание</label>\n" +
            "    <div class=\"settings-item\">\n" +
            "        <select class=\"form-select form-select-sm form-select-option-m reuse\">\n" +
            "            <option selected=\"selected\" value=1>Сразу</option>\n" +
            "            <option value=2>После выполнения всех действий</option>\n" +
            "            <option value=0>Нет</option>\n" +
            "        </select>\n" +
            "    </div>\n" +
        "</div>"
    },
    ScaleChanged :{
        html: "<div class=\"trigger-block\">\n" +
        "<label class=\"form-label mini-label title-label\">Изменение масштаба объекта</label>\n" +
        "<div class=\"settings-item\">\n" +
        "    <select class=\"form-select form-select-sm form-select-option-m target1\">\n" +
        /*"        <option value=\"\" selected=\"\">Любой объект</option>\n" +
        "        <option value=\"All\">Любой объект</option>\n" +
        "        <option value=\"$id\">Объект 1</option>\n" +
        "        <option value=\"$id\">...</option>\n" +*/
        "    </select>\n" +
        "</div>\n" +
            "<label class=\"form-label mini-label\" style='margin-bottom: 8px'>Повторное отслеживание</label>\n" +
            "    <div class=\"settings-item\">\n" +
            "        <select class=\"form-select form-select-sm form-select-option-m reuse\">\n" +
            "            <option selected=\"selected\" value=1>Сразу</option>\n" +
            "            <option value=2>После выполнения всех действий</option>\n" +
            "            <option value=0>Нет</option>\n" +
            "        </select>\n" +
            "    </div>\n" +
        "</div>"
    },
    TrackingMarkerFind : {
        html: "<div class=\"trigger-block\">\n" +
            "    <label class=\"form-label mini-label title-label\" style=\"margin-bottom: 0px\">Распознавание маркера</label>\n" +
            "    <div class=\"settings-item\">\n" +
            "        <select class=\"form-select form-select-sm form-select-option-m target1\">\n" +
            /*"        <option value=\"\" selected=\"\">Любой объект</option>\n" +
            "        <option value=\"All\">Любой объект</option>\n" +
            "        <option value=\"$id\">Объект 1</option>\n" +
            "        <option value=\"$id\">...</option>\n" +*/
            "        </select>\n" +
            "    </div>\n" +
            "<label class=\"form-label mini-label\" style='margin-bottom: 8px'>Повторное отслеживание</label>\n" +
            "    <div class=\"settings-item\">\n" +
            "        <select class=\"form-select form-select-sm form-select-option-m reuse\">\n" +
            "            <option selected=\"selected\" value=1>Сразу</option>\n" +
            "            <option value=2>После выполнения всех действий</option>\n" +
            "            <option value=0>Нет</option>\n" +
            "        </select>\n" +
            "    </div>\n" +
            "</div>"
    },
    TrackingMarkerLost : {
        html: "<div class=\"trigger-block\">\n" +
            "    <label class=\"form-label mini-label title-label\" style=\"margin-bottom: 0px\">Потеря распознавания маркера</label>\n" +
            "<label class=\"form-label mini-label\" style='margin-bottom: 8px'>Повторное отслеживание</label>\n" +
            "    <div class=\"settings-item\">\n" +
            "        <select class=\"form-select form-select-sm form-select-option-m reuse\">\n" +
            "            <option selected=\"selected\" value=1>Сразу</option>\n" +
            "            <option value=2>После выполнения всех действий</option>\n" +
            "            <option value=0>Нет</option>\n" +
            "        </select>\n" +
            "    </div>\n" +
            "</div>"
    },
    TrackingPlaneFind : {
        html: "<div class=\"trigger-block\">\n" +
            "    <label class=\"form-label mini-label title-label\" style=\"margin-bottom: 0px\">Распознавание плоскости</label>\n" +
            "</div>"
    },
    ObjectRender : {
        html: "<div class=\"trigger-block\">\n" +
            "<label class=\"form-label mini-label title-label\">Появление объекта в кадре</label>\n" +
            "    <div class=\"settings-item\">\n" +
            "        <select class=\"form-select form-select-sm form-select-option-m target1\">\n" +
            /*"        <option value=\"\" selected=\"\">Любой объект</option>\n" +
            "        <option value=\"All\">Любой объект</option>\n" +
            "        <option value=\"$id\">Объект 1</option>\n" +
            "        <option value=\"$id\">...</option>\n" +*/
            "        </select>\n" +
            "    </div>\n" +
            "<label class=\"form-label mini-label\" style='margin-bottom: 8px'>Повторное отслеживание</label>\n" +
            "    <div class=\"settings-item\">\n" +
            "        <select class=\"form-select form-select-sm form-select-option-m reuse\">\n" +
            "            <option selected=\"selected\" value=1>Сразу</option>\n" +
            "            <option value=2>После выполнения всех действий</option>\n" +
            "            <option value=0>Нет</option>\n" +
            "        </select>\n" +
            "    </div>\n" +
            "</div>"
    },
    Collide : {
        html: "<div class=\"trigger-block\">\n" +
            "<label class=\"form-label mini-label title-label\">Соприкосновение объектов</label>\n" +
            "    <div class=\"settings-item\">\n" +
            "        <select class=\"form-select form-select-sm form-select-option-m target1\">\n" +
            /*"        <option value=\"\" selected=\"\">Любой объект</option>\n" +
            "        <option value=\"All\">Любой объект</option>\n" +
            "        <option value=\"$id\">Объект 1</option>\n" +
            "        <option value=\"$id\">...</option>\n" +*/
            "        </select>\n" +
            "    </div>\n" +
            "    <div class=\"settings-item\">\n" +
            "        <select class=\"form-select form-select-sm form-select-option-m target2\">\n" +
            /*"        <option value=\"\" selected=\"\">Любой объект</option>\n" +
            "        <option value=\"All\">Любой объект</option>\n" +
            "        <option value=\"$id\">Объект 1</option>\n" +
            "        <option value=\"$id\">...</option>\n" +*/
            "        </select>\n" +
            "    </div>\n" +
            "<label class=\"form-label mini-label\" style='margin-bottom: 8px'>Повторное отслеживание</label>\n" +
            "    <div class=\"settings-item\">\n" +
            "        <select class=\"form-select form-select-sm form-select-option-m reuse\">\n" +
            "            <option selected=\"selected\" value=1>Сразу</option>\n" +
            "            <option value=2>После выполнения всех действий</option>\n" +
            "            <option value=0>Нет</option>\n" +
            "        </select>\n" +
            "    </div>\n" +
            "</div>"
    },
    WebViewTrigger : {
        html: "<div class=\"trigger-block\">\n" +
            "<label class=\"form-label mini-label title-label\">Событие из кода</label>\n" +

            "<input class=\"form-control form-control-sm settings-input-full webviewmessage\" text=\"text\""+
            "       placeholder=\"Введите сообщение...\">"+
        "<label class=\"form-label mini-label\" style='margin-bottom: 8px'>Повторное отслеживание</label>\n" +
                "    <div class=\"settings-item\">\n" +
            "        <select class=\"form-select form-select-sm form-select-option-m reuse\">\n" +
            "            <option selected=\"selected\" value=1>Сразу</option>\n" +
            "            <option value=2>После выполнения всех действий</option>\n" +
            "            <option value=0>Нет</option>\n" +
            "        </select>\n" +
            "    </div>\n" +
            "</div>"

    }
}


function add_trigger(interaction,trigger_ui_type){
    var is_new = true;
    if(interaction == undefined){
        for( var i = 0; i < interactions.length; i++){
            if (interactions[i].id == selected_obj) {
                interaction = interactions[i];
            }
        }
    }
    else {
        is_new = false;
        var _trigger_type = interaction.trigger.type
        switch (_trigger_type) {
            case TRIGGER_STRUCTURE.type.Click:
                trigger_ui_type = TRIGGER_UI_TYPES.Click;
                if(interaction.trigger.clickTrigger.clickCount == 2)
                    trigger_ui_type = TRIGGER_UI_TYPES.DoubleClick;
                break;
            case TRIGGER_STRUCTURE.type.Hold:
                trigger_ui_type = TRIGGER_UI_TYPES.Hold;
                break;
            case TRIGGER_STRUCTURE.type.SceneStart:
                trigger_ui_type = TRIGGER_UI_TYPES.SceneStart;
                break;
            case TRIGGER_STRUCTURE.type.TransformChanged:
                if(interaction.trigger.transformChangedTrigger.usePosition)
                    trigger_ui_type = TRIGGER_UI_TYPES.PositionChanged;
                if(interaction.trigger.transformChangedTrigger.useRotation)
                    trigger_ui_type = TRIGGER_UI_TYPES.RotationChanged;
                if(interaction.trigger.transformChangedTrigger.useScale)
                    trigger_ui_type = TRIGGER_UI_TYPES.ScaleChanged;
                break;
            case TRIGGER_STRUCTURE.type.TrackingMarker:
                if(interaction.trigger.trackingMarkerTrigger.type ==
                    TRIGGER_STRUCTURE.trackingMarkerTrigger.type.Begin)
                    trigger_ui_type = TRIGGER_UI_TYPES.TrackingMarkerFind;
                if(interaction.trigger.trackingMarkerTrigger.type ==
                    TRIGGER_STRUCTURE.trackingMarkerTrigger.type.End)
                    trigger_ui_type = TRIGGER_UI_TYPES.TrackingMarkerLost;
                break;
            case TRIGGER_STRUCTURE.type.TrackingPlane:
                trigger_ui_type = TRIGGER_UI_TYPES.TrackingPlaneFind;
                break;
            case TRIGGER_STRUCTURE.type.ObjectRender:
                trigger_ui_type = TRIGGER_UI_TYPES.ObjectRender;
                break;
            case TRIGGER_STRUCTURE.type.Collide:
                trigger_ui_type = TRIGGER_UI_TYPES.Collide;
                break;
            case TRIGGER_STRUCTURE.type.WebViewTrigger:
                trigger_ui_type = TRIGGER_UI_TYPES.WebViewTrigger;
                break;
        }
    }
    console.log("add_trigger");
    console.log(interaction);
    $("#triggers-block").html("");
    $("[data-block='trigger1']").css("display", "none");
    $("[data-block='trigger2']").css("display", "block");
    switch (trigger_ui_type) {
        case TRIGGER_UI_TYPES.Click:
            $("#triggers-block").html(TRIGGERS_HTML.Click.html);
            var trigger_block = $("#triggers-block .trigger-block")[0]
            // $(trigger_block).find(".target1")
            //     .append("<option value=\"\"  selected=\"\">Целевой объект...</option>");
            $(trigger_block).find(".target1")
                .append("<option value=\"All\" selected=\"\">Любой объект</option>");
            entities.forEach(function(entity){
                if(entity.type == ENTITIES_TYPES.model ||
                    entity.type == ENTITIES_TYPES.texture ||
                    entity.type == ENTITIES_TYPES.text ||
                    entity.type == ENTITIES_TYPES.video){
                    $(trigger_block).find(".target1")
                        .append("<option value=\""+entity.id+"\">"+entity.name+"</option>");

                }
            });
            $(trigger_block).find(".target1, .reuse").on("change",function(){
                if($(trigger_block).find(".target1").val() == "All")
                    interaction.trigger = {
                        type: TRIGGER_STRUCTURE.type.Click,
                        triggerReuse: Number($(trigger_block).find(".reuse").val()),
                        clickTrigger: {
                            targetsType:TRIGGER_STRUCTURE.clickTrigger.targetsType.All,
                            targetId:[],
                            clickCount:1
                        }
                    }
                else
                    interaction.trigger = {
                        type: TRIGGER_STRUCTURE.type.Click,
                        triggerReuse: Number($(trigger_block).find(".reuse").val()),
                        clickTrigger: {
                            targetsType:TRIGGER_STRUCTURE.clickTrigger.targetsType.Single,
                            targetId:[$(trigger_block).find(".target1").val()],
                            clickCount:1
                        }
                    }
                set_interactive(interactions);
            })
            if(is_new)
                $(trigger_block).find(".target1").trigger("change");
            else {
                console.log("triggerReuse");
                console.log(interaction.trigger.triggerReuse);
                $(trigger_block).find(".reuse").val(interaction.trigger.triggerReuse);
                if(interaction.trigger.clickTrigger.targetsType == TRIGGER_STRUCTURE.clickTrigger.targetsType.Single){
                    $(trigger_block).find(".target1").val(interaction.trigger.clickTrigger.targetId[0]);
                }
                if(interaction.trigger.clickTrigger.targetsType == TRIGGER_STRUCTURE.clickTrigger.targetsType.All)
                    $(trigger_block).find(".target1").val("All");
            }

            break;
        case TRIGGER_UI_TYPES.DoubleClick:
            $("#triggers-block").html(TRIGGERS_HTML.DoubleClick.html);
            var trigger_block = $("#triggers-block .trigger-block")[0]
            // $(trigger_block).find(".target1")
            //     .append("<option value=\"\"  selected=\"\">Целевой объект...</option>");
            $(trigger_block).find(".target1")
                .append("<option value=\"All\" selected=\"\">Любой объект</option>");
            entities.forEach(function(entity){
                if(entity.type == ENTITIES_TYPES.model ||
                    entity.type == ENTITIES_TYPES.texture ||
                    entity.type == ENTITIES_TYPES.text ||
                    entity.type == ENTITIES_TYPES.video){
                    $(trigger_block).find(".target1")
                        .append("<option value=\""+entity.id+"\">"+entity.name+"</option>");

                }
            });
            $(trigger_block).find(".target1, .reuse").on("change",function(){
                if($(trigger_block).find(".target1").val() == "All")
                    interaction.trigger = {
                        type: TRIGGER_STRUCTURE.type.Click,
                        triggerReuse: Number($(trigger_block).find(".reuse").val()),
                        clickTrigger: {
                            targetsType:TRIGGER_STRUCTURE.clickTrigger.targetsType.All,
                            targetId:[],
                            clickCount:2
                        }
                    }
                else
                    interaction.trigger = {
                        type: TRIGGER_STRUCTURE.type.Click,
                        triggerReuse: Number($(trigger_block).find(".reuse").val()),
                        clickTrigger: {
                            targetsType:TRIGGER_STRUCTURE.clickTrigger.targetsType.Single,
                            targetId:[$(trigger_block).find(".target1").val()],
                            clickCount:2
                        }
                    }


                set_interactive(interactions);
            })
            if(is_new)
                $(trigger_block).find(".target1").trigger("change");
            else {
                $(trigger_block).find(".reuse").val(interaction.trigger.triggerReuse);
                if(interaction.trigger.clickTrigger.targetsType == TRIGGER_STRUCTURE.clickTrigger.targetsType.Single){
                    $(trigger_block).find(".target1").val(interaction.trigger.clickTrigger.targetId[0]);
                }
                if(interaction.trigger.clickTrigger.targetsType == TRIGGER_STRUCTURE.clickTrigger.targetsType.All)
                    $(trigger_block).find(".target1").val("All");
            }
            break;
        case TRIGGER_UI_TYPES.Hold:
            $("#triggers-block").html(TRIGGERS_HTML.Hold.html);
            var trigger_block = $("#triggers-block .trigger-block")[0]
            // $(trigger_block).find(".target1")
            //     .append("<option value=\"\"  selected=\"\">Целевой объект...</option>");
            $(trigger_block).find(".target1")
                .append("<option value=\"All\" selected=\"\">Любой объект</option>");
            entities.forEach(function(entity){
                if(entity.type == ENTITIES_TYPES.model ||
                    entity.type == ENTITIES_TYPES.texture ||
                    entity.type == ENTITIES_TYPES.text ||
                    entity.type == ENTITIES_TYPES.video){
                    $(trigger_block).find(".target1")
                        .append("<option value=\""+entity.id+"\">"+entity.name+"</option>");

                }
            });
            $(trigger_block).find(".target1, .reuse").on("change",function(){
                if($(trigger_block).find(".target1").val() == "All")
                    interaction.trigger = {
                        type: TRIGGER_STRUCTURE.type.Hold,
                        triggerReuse: Number($(trigger_block).find(".reuse").val()),
                        holdTrigger: {
                            targetsType:TRIGGER_STRUCTURE.holdTrigger.targetsType.All,
                            targetId:[],
                            length:1
                        }
                    }
                else
                    interaction.trigger = {
                        type: TRIGGER_STRUCTURE.type.Hold,
                        triggerReuse: Number($(trigger_block).find(".reuse").val()),
                        holdTrigger: {
                            targetsType:TRIGGER_STRUCTURE.holdTrigger.targetsType.Single,
                            targetId:[$(trigger_block).find(".target1").val()],
                            length:1
                        }
                    }


                set_interactive(interactions);
            })
            if(is_new)
                $(trigger_block).find(".target1").trigger("change");
            else {
                $(trigger_block).find(".reuse").val(interaction.trigger.triggerReuse);
                if(interaction.trigger.holdTrigger.targetsType == TRIGGER_STRUCTURE.holdTrigger.targetsType.Single){
                    $(trigger_block).find(".target1").val(interaction.trigger.holdTrigger.targetId[0]);
                }
                if(interaction.trigger.holdTrigger.targetsType == TRIGGER_STRUCTURE.holdTrigger.targetsType.All)
                    $(trigger_block).find(".target1").val("All");
            }
            break;
        case TRIGGER_UI_TYPES.SceneStart:
            $("#triggers-block").html(TRIGGERS_HTML.SceneStart.html);
            if(is_new) {
                interaction.trigger = {
                    type: TRIGGER_STRUCTURE.type.SceneStart,
                    triggerReuse: TRIGGER_STRUCTURE.triggerReuse.None
                }
                set_interactive(interactions);
            }
            else {}
            break;
        case TRIGGER_UI_TYPES.PositionChanged:
            $("#triggers-block").html(TRIGGERS_HTML.PositionChanged.html);
            var trigger_block = $("#triggers-block .trigger-block")[0]
            // $(trigger_block).find(".target1")
            //     .append("<option value=\"\"  selected=\"\">Целевой объект...</option>");
            $(trigger_block).find(".target1")
                .append("<option value=\"All\" selected=\"\">Любой объект</option>");
            entities.forEach(function(entity){
                if(entity.type == ENTITIES_TYPES.model ||
                    entity.type == ENTITIES_TYPES.texture ||
                    entity.type == ENTITIES_TYPES.text ||
                    entity.type == ENTITIES_TYPES.video ||
                    entity.type == ENTITIES_TYPES.audio){
                    $(trigger_block).find(".target1")
                        .append("<option value=\""+entity.id+"\">"+entity.name+"</option>");

                }
            });
            $(trigger_block).find(".target1, .reuse").on("change",function(){
                if($(trigger_block).find(".target1").val() == "All")
                    interaction.trigger = {
                        type: TRIGGER_STRUCTURE.type.TransformChanged,
                        triggerReuse: Number($(trigger_block).find(".reuse").val()),
                        transformChangedTrigger: {
                            targetsType:TRIGGER_STRUCTURE.transformChangedTrigger.targetsType.All,
                            targetId:[],
                            usePosition: true,
                            useRotation: false,
                            useScale: false
                        }
                    }
                else
                    interaction.trigger = {
                        type: TRIGGER_STRUCTURE.type.TransformChanged,
                        triggerReuse: Number($(trigger_block).find(".reuse").val()),
                        transformChangedTrigger: {
                            targetsType:TRIGGER_STRUCTURE.transformChangedTrigger.targetsType.Single,
                            targetId:[$(trigger_block).find(".target1").val()],
                            usePosition: true,
                            useRotation: false,
                            useScale: false
                        }
                    }


                set_interactive(interactions);
            })
            if(is_new)
                $(trigger_block).find(".target1").trigger("change");
            else {
                $(trigger_block).find(".reuse").val(interaction.trigger.triggerReuse);
                if(interaction.trigger.transformChangedTrigger.targetsType ==
                    TRIGGER_STRUCTURE.transformChangedTrigger.targetsType.Single){
                    $(trigger_block).find(".target1").val(interaction.trigger.transformChangedTrigger.targetId[0]);
                }
                if(interaction.trigger.transformChangedTrigger.targetsType ==
                    TRIGGER_STRUCTURE.transformChangedTrigger.targetsType.All)
                    $(trigger_block).find(".target1").val("All");
            }
            break;
        case TRIGGER_UI_TYPES.RotationChanged:
            $("#triggers-block").html(TRIGGERS_HTML.RotationChanged.html);
            var trigger_block = $("#triggers-block .trigger-block")[0]
            // $(trigger_block).find(".target1")
            //     .append("<option value=\"\"  selected=\"\">Целевой объект...</option>");
            $(trigger_block).find(".target1")
                .append("<option value=\"All\" selected=\"\">Любой объект</option>");
            entities.forEach(function(entity){
                if(entity.type == ENTITIES_TYPES.model ||
                    entity.type == ENTITIES_TYPES.texture ||
                    entity.type == ENTITIES_TYPES.text ||
                    entity.type == ENTITIES_TYPES.video ||
                    entity.type == ENTITIES_TYPES.audio){
                    $(trigger_block).find(".target1")
                        .append("<option value=\""+entity.id+"\">"+entity.name+"</option>");

                }
            });
            $(trigger_block).find(".target1, .reuse").on("change",function(){
                if($(trigger_block).find(".target1").val() == "All")
                    interaction.trigger = {
                        type: TRIGGER_STRUCTURE.type.TransformChanged,
                        triggerReuse: Number($(trigger_block).find(".reuse").val()),
                        transformChangedTrigger: {
                            targetsType:TRIGGER_STRUCTURE.transformChangedTrigger.targetsType.All,
                            targetId:[],
                            usePosition: false,
                            useRotation: true,
                            useScale: false
                        }
                    }
                else
                    interaction.trigger = {
                        type: TRIGGER_STRUCTURE.type.TransformChanged,
                        triggerReuse: Number($(trigger_block).find(".reuse").val()),
                        transformChangedTrigger: {
                            targetsType:TRIGGER_STRUCTURE.transformChangedTrigger.targetsType.Single,
                            targetId:[$(trigger_block).find(".target1").val()],
                            usePosition: false,
                            useRotation: true,
                            useScale: false
                        }
                    }


                set_interactive(interactions);
            })
            if(is_new)
                $(trigger_block).find(".target1").trigger("change");
            else {
                $(trigger_block).find(".reuse").val(interaction.trigger.triggerReuse);
                if(interaction.trigger.transformChangedTrigger.targetsType ==
                    TRIGGER_STRUCTURE.transformChangedTrigger.targetsType.Single){
                    $(trigger_block).find(".target1").val(interaction.trigger.transformChangedTrigger.targetId[0]);
                }
                if(interaction.trigger.transformChangedTrigger.targetsType ==
                    TRIGGER_STRUCTURE.transformChangedTrigger.targetsType.All)
                    $(trigger_block).find(".target1").val("All");
            }
            break;
        case TRIGGER_UI_TYPES.ScaleChanged:
            $("#triggers-block").html(TRIGGERS_HTML.ScaleChanged.html);
            var trigger_block = $("#triggers-block .trigger-block")[0]
            // $(trigger_block).find(".target1")
            //     .append("<option value=\"\"  selected=\"\">Целевой объект...</option>");
            $(trigger_block).find(".target1")
                .append("<option value=\"All\" selected=\"\">Любой объект</option>");
            entities.forEach(function(entity){
                if(entity.type == ENTITIES_TYPES.model ||
                    entity.type == ENTITIES_TYPES.texture ||
                    entity.type == ENTITIES_TYPES.text ||
                    entity.type == ENTITIES_TYPES.video ||
                    entity.type == ENTITIES_TYPES.audio){
                    $(trigger_block).find(".target1")
                        .append("<option value=\""+entity.id+"\">"+entity.name+"</option>");

                }
            });
            $(trigger_block).find(".target1, .reuse").on("change",function(){
                if($(trigger_block).find(".target1").val() == "All")
                    interaction.trigger = {
                        type: TRIGGER_STRUCTURE.type.TransformChanged,
                        triggerReuse: Number($(trigger_block).find(".reuse").val()),
                        transformChangedTrigger: {
                            targetsType:TRIGGER_STRUCTURE.transformChangedTrigger.targetsType.All,
                            targetId:[],
                            usePosition: false,
                            useRotation: false,
                            useScale: true
                        }
                    }
                else
                    interaction.trigger = {
                        type: TRIGGER_STRUCTURE.type.TransformChanged,
                        triggerReuse: Number($(trigger_block).find(".reuse").val()),
                        transformChangedTrigger: {
                            targetsType:TRIGGER_STRUCTURE.transformChangedTrigger.targetsType.Single,
                            targetId:[$(trigger_block).find(".target1").val()],
                            usePosition: false,
                            useRotation: false,
                            useScale: true
                        }
                    }


                set_interactive(interactions);
            })
            if(is_new)
                $(trigger_block).find(".target1").trigger("change");
            else {
                $(trigger_block).find(".reuse").val(interaction.trigger.triggerReuse);
                if(interaction.trigger.transformChangedTrigger.targetsType ==
                    TRIGGER_STRUCTURE.transformChangedTrigger.targetsType.Single){
                    $(trigger_block).find(".target1").val(interaction.trigger.transformChangedTrigger.targetId[0]);
                }
                if(interaction.trigger.transformChangedTrigger.targetsType ==
                    TRIGGER_STRUCTURE.transformChangedTrigger.targetsType.All)
                    $(trigger_block).find(".target1").val("All");
            }
            break;
        case TRIGGER_UI_TYPES.TrackingMarkerFind:
            $("#triggers-block").html(TRIGGERS_HTML.TrackingMarkerFind.html);
            var trigger_block = $("#triggers-block .trigger-block")[0]


            $(trigger_block).find(".target1")
                .append("<option value=\"All\" selected=\"\">Любой объект</option>");
            if(is_new){
                interaction.trigger = {
                    type: TRIGGER_STRUCTURE.type.TrackingMarker,
                    triggerReuse: Number($(trigger_block).find(".reuse").val()),
                    trackingMarkerTrigger: {
                        type:TRIGGER_STRUCTURE.trackingMarkerTrigger.type.Begin,
                        targetsType:TRIGGER_STRUCTURE.trackingMarkerTrigger.targetsType.All,
                        targetMarkerId:[]
                    }
                }
            }
            scene.anchors.forEach(function(_anchor){
                if(_anchor.type == ANCHORS_TYPES.MarkerVertical || _anchor.type == ANCHORS_TYPES.MarkerHorizontal) {
                    $(trigger_block).find(".target1")
                        .append("<option value=\"" + _anchor.id + "\">" + _anchor.markerName + "</option>");
                }
            });


            $(trigger_block).find(".reuse, .target1").on("change",function(){
                interaction.trigger.triggerReuse = Number($(trigger_block).find(".reuse").val());
                if($(trigger_block).find(".target1").val() == "All") {
                    interaction.trigger.trackingMarkerTrigger.targetsType =
                        TRIGGER_STRUCTURE.trackingMarkerTrigger.targetsType.All;
                    interaction.trigger.trackingMarkerTrigger.targetMarkerId = [];
                }
                else {
                    interaction.trigger.trackingMarkerTrigger.targetsType =
                        TRIGGER_STRUCTURE.trackingMarkerTrigger.targetsType.Single;
                    interaction.trigger.trackingMarkerTrigger.targetMarkerId =
                        [$(trigger_block).find(".target1").val()];
                }
                set_interactive(interactions);
            })
            if(is_new) {
                $(trigger_block).find(".reuse").trigger("change");
            }
            else {
                $(trigger_block).find(".reuse").val(interaction.trigger.triggerReuse);
                if(interaction.trigger.trackingMarkerTrigger.targetsType ==
                    TRIGGER_STRUCTURE.trackingMarkerTrigger.targetsType.Single){
                    $(trigger_block).find(".target1").val(interaction.trigger.trackingMarkerTrigger.targetMarkerId[0]);
                }
                if(interaction.trigger.trackingMarkerTrigger.targetsType ==
                    TRIGGER_STRUCTURE.trackingMarkerTrigger.targetsType.All)
                    $(trigger_block).find(".target1").val("All");

                    $(trigger_block).find(".target2").val("Camera");
            }
            break;
        case TRIGGER_UI_TYPES.TrackingMarkerLost:
            $("#triggers-block").html(TRIGGERS_HTML.TrackingMarkerLost.html);
            var trigger_block = $("#triggers-block .trigger-block")[0]

            $(trigger_block).find(".reuse").on("change",function(){
                interaction.trigger = {
                    type: TRIGGER_STRUCTURE.type.TrackingMarker,
                    triggerReuse: Number($(trigger_block).find(".reuse").val()),
                    trackingMarkerTrigger: {
                        type:TRIGGER_STRUCTURE.trackingMarkerTrigger.type.End,
                        targetsType:TRIGGER_STRUCTURE.trackingMarkerTrigger.targetsType.Single,
                        targetMarkerId:[scene.anchors[anchor].id+""]
                    }
                }
                set_interactive(interactions);
            })
            if(is_new) {
                $(trigger_block).find(".reuse").trigger("change");
            }
            else {
                $(trigger_block).find(".reuse").val(interaction.trigger.triggerReuse);
            }
            break;
        case TRIGGER_UI_TYPES.TrackingPlaneFind:
            var orientation = TRIGGER_STRUCTURE.planeTrackedTrigger.type.Horizontal;
            if(scene.anchors[anchor].type == ANCHORS_TYPES.PlaneVertical)
                orientation = TRIGGER_STRUCTURE.planeTrackedTrigger.type.Vertical;
            $("#triggers-block").html(TRIGGERS_HTML.TrackingPlaneFind.html);
            if(is_new) {
                interaction.trigger = {
                    type: TRIGGER_STRUCTURE.type.TrackingPlane,
                    triggerReuse: TRIGGER_STRUCTURE.triggerReuse.None,
                    planeTrackedTrigger: {
                        type:orientation
                    }
                }
                set_interactive(interactions);
            }
            else {}
            break;
        case TRIGGER_UI_TYPES.ObjectRender:
            $("#triggers-block").html(TRIGGERS_HTML.ObjectRender.html);
            var trigger_block = $("#triggers-block .trigger-block")[0]
            // $(trigger_block).find(".target1")
            //     .append("<option value=\"\"  selected=\"\">Целевой объект...</option>");
            $(trigger_block).find(".target1")
                .append("<option value=\"All\" selected=\"\">Любой объект</option>");
            entities.forEach(function(entity){
                if(entity.type == ENTITIES_TYPES.model ||
                    entity.type == ENTITIES_TYPES.texture ||
                    entity.type == ENTITIES_TYPES.text ||
                    entity.type == ENTITIES_TYPES.video){
                    $(trigger_block).find(".target1")
                        .append("<option value=\""+entity.id+"\">"+entity.name+"</option>");

                }
            });
            $(trigger_block).find(".target1, .reuse").on("change",function(){
                if($(trigger_block).find(".target1").val() == "All")
                    interaction.trigger = {
                        type: TRIGGER_STRUCTURE.type.ObjectRender,
                        triggerReuse: Number($(trigger_block).find(".reuse").val()),
                        renderInCameraTrigger: {
                            type: TRIGGER_STRUCTURE.renderInCameraTrigger.type.Begin,
                            targetsType:TRIGGER_STRUCTURE.renderInCameraTrigger.targetsType.All,
                            targetId:[]
                        }
                    }
                else
                    interaction.trigger = {
                        type: TRIGGER_STRUCTURE.type.ObjectRender,
                        triggerReuse: Number($(trigger_block).find(".reuse").val()),
                        renderInCameraTrigger: {
                            type: TRIGGER_STRUCTURE.renderInCameraTrigger.type.Begin,
                            targetsType:TRIGGER_STRUCTURE.renderInCameraTrigger.targetsType.Single,
                            targetId:[$(trigger_block).find(".target1").val()]
                        }
                    }


                set_interactive(interactions);
            })
            if(is_new)
                $(trigger_block).find(".target1").trigger("change");
            else {
                $(trigger_block).find(".reuse").val(interaction.trigger.triggerReuse);
                if(interaction.trigger.renderInCameraTrigger.targetsType ==
                    TRIGGER_STRUCTURE.renderInCameraTrigger.targetsType.Single){
                    $(trigger_block).find(".target1").val(interaction.trigger.renderInCameraTrigger.targetId[0]);
                }
                if(interaction.trigger.renderInCameraTrigger.targetsType ==
                    TRIGGER_STRUCTURE.renderInCameraTrigger.targetsType.All)
                    $(trigger_block).find(".target1").val("All");
            }
            break;
        case TRIGGER_UI_TYPES.Collide:
            $("#triggers-block").html(TRIGGERS_HTML.Collide.html);
            var trigger_block = $("#triggers-block .trigger-block")[0]
            // $(trigger_block).find(".target1")
            //     .append("<option value=\"\"  selected=\"\">Целевой объект...</option>");
            $(trigger_block).find(".target1, .target2")
                .append("<option value=\"All\" selected=\"\">Любой объект</option>");
            $(trigger_block).find(".target2")
                .append("<option value=\"Camera\">Камера</option>");
            if(is_new){
                interaction.trigger = {
                    type: TRIGGER_STRUCTURE.type.Collide,
                    triggerReuse: Number($(trigger_block).find(".reuse").val()),
                    collideTrigger: {
                        type: TRIGGER_STRUCTURE.renderInCameraTrigger.type.Begin,
                        collideWithCamera:false,
                        targetAType:TRIGGER_STRUCTURE.collideTrigger.targetAType.All,
                        targetAId:[],
                        targetBType:TRIGGER_STRUCTURE.collideTrigger.targetBType.All,
                        targetBId:[],
                    }
                }
            }
            entities.forEach(function(entity){
                if(entity.type == ENTITIES_TYPES.model ||
                    entity.type == ENTITIES_TYPES.texture ||
                    entity.type == ENTITIES_TYPES.text ||
                    entity.type == ENTITIES_TYPES.video){
                    $(trigger_block).find(".target1, .target2")
                        .append("<option value=\""+entity.id+"\">"+entity.name+"</option>");

                }
            });
            $(trigger_block).find(".target1, .target2, .reuse").on("change",function(){
                interaction.trigger.triggerReuse = Number($(trigger_block).find(".reuse").val());
                var target_num = 1;
                if($(this).hasClass("target2"))
                    target_num = 2;
                var _collideWithCamera = false;
                if($(trigger_block).find(".target2").val() == "Camera")
                    _collideWithCamera = true;
                interaction.trigger.collideTrigger.collideWithCamera = _collideWithCamera;
                if($(trigger_block).find(".target"+target_num).val() == "All") {
                    if(_collideWithCamera){
                        interaction.trigger.collideTrigger.targetAType =
                            TRIGGER_STRUCTURE.collideTrigger.targetAType.All;
                        interaction.trigger.collideTrigger.targetAId = [];
                    }
                    else {
                        if(target_num == 1){
                            interaction.trigger.collideTrigger.targetAType =
                                TRIGGER_STRUCTURE.collideTrigger.targetAType.All;
                            interaction.trigger.collideTrigger.targetAId = [];
                        }
                        else {
                            interaction.trigger.collideTrigger.targetBType =
                                TRIGGER_STRUCTURE.collideTrigger.targetBType.All;
                            interaction.trigger.collideTrigger.targetBId = [];
                        }
                    }
                }
                else {
                    if($(trigger_block).find(".target"+target_num).val() == "Camera") {
                        if($(trigger_block).find(".target1").val() == "All"){
                            interaction.trigger.collideTrigger.targetAType =
                                TRIGGER_STRUCTURE.collideTrigger.targetAType.All;
                            interaction.trigger.collideTrigger.targetAId = [];
                        }
                        else {
                            interaction.trigger.collideTrigger.targetAType =
                                TRIGGER_STRUCTURE.collideTrigger.targetAType.Single;
                            interaction.trigger.collideTrigger.targetAId =
                                [$(trigger_block).find(".target1").val()];
                        }
                        interaction.trigger.collideTrigger.targetBType =
                            TRIGGER_STRUCTURE.collideTrigger.targetBType.All;
                        interaction.trigger.collideTrigger.targetBId = [];
                    }
                    else {
                        if(target_num == 1){
                            interaction.trigger.collideTrigger.targetAType =
                                TRIGGER_STRUCTURE.collideTrigger.targetAType.Single;
                            interaction.trigger.collideTrigger.targetAId =
                                [$(trigger_block).find(".target1").val()];
                        }
                        else {
                            interaction.trigger.collideTrigger.targetBType =
                                TRIGGER_STRUCTURE.collideTrigger.targetBType.Single;
                            interaction.trigger.collideTrigger.targetBId =
                                [$(trigger_block).find(".target2").val()];
                        }
                    }
                }
                set_interactive(interactions);
            })
            if(is_new)
                $(trigger_block).find(".target1").trigger("change");
            else {
                $(trigger_block).find(".reuse").val(interaction.trigger.triggerReuse);
                if(interaction.trigger.collideTrigger.targetAType ==
                    TRIGGER_STRUCTURE.collideTrigger.targetAType.Single){
                    $(trigger_block).find(".target1").val(interaction.trigger.collideTrigger.targetAId[0]);
                }
                if(interaction.trigger.collideTrigger.targetAType ==
                    TRIGGER_STRUCTURE.collideTrigger.targetAType.All)
                    $(trigger_block).find(".target1").val("All");
                if(interaction.trigger.collideTrigger.targetBType ==
                    TRIGGER_STRUCTURE.collideTrigger.targetBType.Single)
                    $(trigger_block).find(".target2").val(interaction.trigger.collideTrigger.targetBId[0]);
                if(interaction.trigger.collideTrigger.targetBType ==
                    TRIGGER_STRUCTURE.collideTrigger.targetBType.All)
                    $(trigger_block).find(".target2").val("All");
                if(interaction.trigger.collideTrigger.collideWithCamera)
                    $(trigger_block).find(".target2").val("Camera");
            }
            break;
        case TRIGGER_UI_TYPES.WebViewTrigger:
            $("#triggers-block").html(TRIGGERS_HTML.WebViewTrigger.html);
            var trigger_block = $("#triggers-block .trigger-block")[0]
            // $(trigger_block).find(".target1")
            //     .append("<option value=\"\"  selected=\"\">Целевой объект...</option>");
            $(trigger_block).find(".webviewmessage").val("");
            $(trigger_block).find(".webviewmessage").on("change",function(){
                interaction.trigger = {
                    type: TRIGGER_STRUCTURE.type.WebViewTrigger,
                    triggerReuse: Number($(trigger_block).find(".reuse").val()),
                    webViewTrigger: {
                        message:$(trigger_block).find(".webviewmessage").val()
                    }
                }
                set_interactive(interactions);
            })
            console.log("asdasd")
            console.log(interaction.trigger)
            if(is_new)
                $(trigger_block).find(".webviewmessage").trigger("change");
            else {
                $(trigger_block).find(".reuse").val(interaction.trigger.triggerReuse);
                $(trigger_block).find(".webviewmessage").val(interaction.trigger.webViewTrigger.message);
            }
            break;
    }
}

var ACTIONS_ENUMS = {
    type : {
        Show:0,
        OpenUrl:1,
        Transform:2,
        Animation:3,
        Video:4,
        Audio:5,
        VideoVolume:6,
        AudioVolume:7,
        Text:8,
        Renderer:9,
        Following:10,
        LookAt:11,
        ChangeManipulation:12,
        SendToWebView: 13,
        OpenScene: 14
    },
    UniversaltargetsType : {
        Single : 0,
        Multiple : 1,
        All: 2
    },
    visibilityAction : {
        titles : ["Показать объект","Скрыть объект"],
        type : {
            Show : 0,
            Hide: 1
        },
        targetsType : {
            Single : 0,
            Multiple : 1,
            All: 2
        },
        UI : {
            Show : 0,
            Hide: 1
        }
    },
    openUrlAction : {
        title : "Перейти по ссылке",
    },
    openSceneAction : {
        title : "Открыть сцену",
    },
    transformAction : {
        title : "Изменить положение",
        type : {
            MoveTo : 0,
            MoveBy : 1
        },
        targetsType : {
            Single : 0,
            Multiple : 1,
            All: 2
        },
        relative : {
            Local : 0,
            World : 1
        },
        UI : {
            MoveTo : 0,
            MoveBy : 1
        },
        labels: {
            position: "Позиция",
            rotation: "Вращение",
            scale: "Масштаб",
        }
    },
    animationAction : {
        titles : [
            "Включить анимацию",
            "Остановить анимацию",
            "Остановить анимацию",
            "Включить анимацию"
        ],
        type : {
            Play : 0,
            Pause: 1,
            Stop: 2,
            Rewind: 3
        },
        targetsType : {
            Single : 0,
            Multiple : 1,
            All: 2
        },
        UI : {
            Play : 0,
            Pause: 1
        }
    },
    videoAction : {
        titles : [
            "Включить видео",
            "Остановить видео",
            "Остановить видео",
            "Включить видео"
        ],
        type : {
            Play : 0,
            Pause: 1,
            Stop: 2,
            Rewind: 3
        },
        targetsType : {
            Single : 0,
            Multiple : 1,
            All: 2
        },
        UI : {
            Play : 0,
            Pause: 1
        }
    },
    audioAction : {
        titles : [
            "Включить звук",
            "Остановить звук",
            "Остановить звук",
            "Включить звук"
        ],
        type : {
            Play : 0,
            Pause: 1,
            Stop: 2,
            Rewind: 3
        },
        targetsType : {
            Single : 0,
            Multiple : 1,
            All: 2
        },
        UI : {
            Play : 0,
            Pause: 1
        }
    },
    videoVolumeAction : {
        title : "Изменить громкость",
        targetsType : {
            Single : 0,
            Multiple : 1,
            All: 2
        }
    },
    audioVolumeAction : {
        title : "Изменить громкость",
        targetsType : {
            Single : 0,
            Multiple : 1,
            All: 2
        }
    },
    rendererAction : {
        type : {
            changeOpacity : 0,
            changeEmission : 1
        },
        titles : [
            "Изменить непрозрачность",
            "Изменить подсветку"
        ],
        subtitles : [
            "Изменить непрозрачность"
        ],
        targetsType : {
            Single : 0,
            Multiple : 1,
            All: 2
        },
        UI : {
            changeOpacity : 0,
            changeEmission: 1
        }
    },
    followingAction : {
        titles : ["Включить следование","Выключить следование","Переключить следование"],
        subtitles : {
            offset: "Отступ в локальных координатах от центра объекта, за которым нужно следовать",
            linear: "Чем дальше объект от цели, тем быстрее он будет двигаться к ней"
        },
        targetsType : {
            Single : 0,
            Multiple : 1,
            All: 2
        },
        UI : {
            On : 0,
            Off: 1
        },
        State : {
            Enable: 0,
            Disable: 1,
            Toggle: 2
        }
    },
    lookAtAction : {
        titles : ["Включить поворот лицом","Выключить поворот лицом","Переключить поворот лицом"],
        subtitles : {
            title: "Включить поворот лицом к объекту",
            offset: "Угловой отступ в локальных координатах от поворота целевого объекта",
            linear: "Чем больше угол поворота до цели, тем быстрее объект будет поворачиваться"
        },
        targetsType : {
            Single : 0,
            Multiple : 1,
            All: 2
        },
        UI : {
            On : 0,
            Off: 1
        },
        State : {
            Enable: 0,
            Disable: 1,
            Toggle: 2
        }
    },
    changeManipulationAction : {
        title : "Изменить пользовател...",
        subtitles : {
            title: "Изменить настройки пользовательского взаимодействие",
            movable: "Включите, чтобы пользователь мог перемещать объект касанием",
            sizable: "Включите, чтобы пользователь мог масштабировать объект (двумя пальцами)",
            rotatable: "Включите, чтобы пользователь мог вращать объект (двумя пальцами)",
            heightCorrection: "Включите, чтобы пользователь мог двигать объект вверх/вниз (двумя пальцами)",
        },
        targetsType : {
            Single : 0,
            Multiple : 1,
            All: 2
        },
    },
    sendToWebViewAction : {
        title : "Отправить сообщение"
    }
}
var action = {
    id:123,
    type:ACTIONS_ENUMS.type.Show,
    visibilityAction:{
        type: ACTIONS_ENUMS.visibilityAction.type.Show,
        targetsType:ACTIONS_ENUMS.visibilityAction.targetsType.All,
        targetId:[],
        length:0.00,
        delay:0.00
    }
}
const ACTION_SELECT_TYPES = {
    All : 0,
    Models: 1,
    Textures : 2,
    Audios : 3,
    Videos : 4,
    Textes : 5,
    Camera : 6,
    Custom: 7
}
function add_action(type, details){
    var interaction = undefined;
    for( var i = 0; i < interactions.length; i++){
        if (interactions[i].id == selected_obj) {
            interaction = interactions[i];
        }
    }
    if(interaction == undefined)
        return;
    var _action;
    switch(type) {
        case ACTIONS_ENUMS.type.Show:
            _action = {
                id: Math.floor(Math.random() * 9999999)+"",
                type: ACTIONS_ENUMS.type.Show,
                visibilityAction: {
                    type: details,
                    targetsType: ACTIONS_ENUMS.UniversaltargetsType.Single,
                    targetId: [],
                    disableOnHide: true,
                    length: 0,
                    delay: 0
                }
            }
            break;
        case ACTIONS_ENUMS.type.Video:
            _action = {
                id: Math.floor(Math.random() * 9999999)+"",
                type: ACTIONS_ENUMS.type.Video,
                videoAction: {
                    type: details,
                    targetsType: ACTIONS_ENUMS.UniversaltargetsType.Single,
                    targetId: [],
                    loop: false,
                    speed: 1,
                    delay: 0
                }
            }
            break;
        case ACTIONS_ENUMS.type.Animation:
            _action = {
                id: Math.floor(Math.random() * 9999999)+"",
                type: ACTIONS_ENUMS.type.Animation,
                animationAction: {
                    type: details,
                    targetId: "",
                    animationName: "",
                    speed: 1,
                    delay: 0,
                    loop: false
                }
            }
            break;
        case ACTIONS_ENUMS.type.Audio:
            _action = {
                id: Math.floor(Math.random() * 9999999)+"",
                type: ACTIONS_ENUMS.type.Audio,
                audioAction: {
                    type: details,
                    targetsType: ACTIONS_ENUMS.UniversaltargetsType.Single,
                    targetId: [],
                    loop: false,
                    speed: 1,
                    delay: 0
                }
            }
            break;
        case ACTIONS_ENUMS.type.OpenUrl:
            _action = {
                id: Math.floor(Math.random() * 9999999)+"",
                type: ACTIONS_ENUMS.type.OpenUrl,
                openUrlAction: {
                    url: "",
                    delay: 0
                }
            }
            break;
        case ACTIONS_ENUMS.type.OpenScene:
            _action = {
                id: Math.floor(Math.random() * 9999999)+"",
                type: ACTIONS_ENUMS.type.OpenScene,
                openSceneAction: {
                    sceneId: "",
                    resetTracking: false,
                    delay: 0
                }
            }
            break;
        case ACTIONS_ENUMS.type.Transform:
            _action = {
                id: Math.floor(Math.random() * 9999999)+"",
                type: ACTIONS_ENUMS.type.Transform,
                transformAction: {
                    type: details,
                    targetsType: ACTIONS_ENUMS.UniversaltargetsType.Single,
                    targetId: [],
                    relative: ACTIONS_ENUMS.transformAction.relative.World,
                    targetPosition : {
                        x: {
                            hasValue : false,
                            value: 0
                        },
                        y: {
                            hasValue : false,
                            value: 0},
                        z: {
                            hasValue : false,
                            value: 0}
                    },
                    targetRotation : {
                        x: {
                            hasValue : false,
                            value: 0
                        },
                        y: {
                            hasValue : false,
                            value: 0},
                        z: {
                            hasValue : false,
                            value: 0}
                    },
                    targetScale : {
                        x: {
                            hasValue : false,
                            value: 0
                        },
                        y: {
                            hasValue : false,
                            value: 0},
                        z: {
                            hasValue : false,
                            value: 0}
                    },
                    length: 1,
                    delay: 0
                }
            }
            break;
        case ACTIONS_ENUMS.type.AudioVolume:
            _action = {
                id: Math.floor(Math.random() * 9999999)+"",
                type: ACTIONS_ENUMS.type.AudioVolume,
                audioVolumeAction: {
                    targetsType: ACTIONS_ENUMS.UniversaltargetsType.Single,
                    targetId: [],
                    volume: 1,
                    length: 1,
                    delay: 0
                }
            }
            break;
        case ACTIONS_ENUMS.type.VideoVolume:
            _action = {
                id: Math.floor(Math.random() * 9999999)+"",
                type: ACTIONS_ENUMS.type.VideoVolume,
                videoVolumeAction: {
                    targetsType: ACTIONS_ENUMS.UniversaltargetsType.Single,
                    targetId: [],
                    volume: 1,
                    length: 1,
                    delay: 0
                }
            }
            break;
        case ACTIONS_ENUMS.type.Renderer:
            var opacity = false;
            var emission = false;
            if(details == ACTIONS_ENUMS.rendererAction.type.changeOpacity)
                opacity = true
            if(details == ACTIONS_ENUMS.rendererAction.type.changeEmission)
                emission = true
            _action = {
                id: Math.floor(Math.random() * 9999999)+"",
                type: ACTIONS_ENUMS.type.Renderer,
                rendererAction: {
                    targetsType: ACTIONS_ENUMS.UniversaltargetsType.Single,
                    targetId: [],
                    opacity: {
                        hasValue: opacity,
                        value: 1
                    },
                    emission: {
                        hasValue: emission,
                        value: {
                            color: {
                                r: 0,
                                g: 0,
                                b: 0,
                                a: 1
                            },
                            intensive: 0.0
                        }
                    },
                    length: 1,
                    delay: 0
                }
            }
            break;
        case ACTIONS_ENUMS.type.Following:
            _action = {
                id: Math.floor(Math.random() * 9999999)+"",
                type: ACTIONS_ENUMS.type.Following,
                followingAction: {
                    state: details,
                    targetsType: ACTIONS_ENUMS.UniversaltargetsType.Single,
                    targetId: [],
                    followCamera : false,
                    followTargetId : "",
                    usePosition : true,
                    useXPosition : true,
                    useYPosition : true,
                    useZPosition : true,
                    positionOffset:{
                        hasValue:true,
                        value:{
                            x:{hasValue:false,value:0},
                            y:{hasValue:false,value:0},
                            z:{hasValue:false,value:0}
                        }
                    },
                    useRotation:false,
                    useXRotation:false,
                    useYRotation:false,
                    useZRotation:false,
                    rotationOffset:{
                        hasValue:false,
                        value:{
                            x:{hasValue:false,value:0},
                            y:{hasValue:false,value:0},
                            z:{hasValue:false,value:0}
                        }
                    },
                    speed:1,
                    delay:0,
                    linear:false
                }
            }
            break;
        case ACTIONS_ENUMS.type.LookAt:
            _action = {
                id: Math.floor(Math.random() * 9999999)+"",
                type: ACTIONS_ENUMS.type.LookAt,
                lookAtAction: {
                    state: details,
                    targetsType: ACTIONS_ENUMS.UniversaltargetsType.Single,
                    targetId: [],
                    lookAtCamera : false,
                    followTargetId : "",
                    useRotation:true,
                    useXRotation:true,
                    useYRotation:true,
                    useZRotation:true,
                    rotationOffset:{
                        hasValue:true,
                        value:{
                            x:{hasValue:false,value:0},
                            y:{hasValue:false,value:0},
                            z:{hasValue:false,value:0}
                        }
                    },
                    speed:1,
                    delay:0,
                    linear:false
                }
            }
            break;
        case ACTIONS_ENUMS.type.ChangeManipulation:
            _action = {
                id: Math.floor(Math.random() * 9999999)+"",
                type: ACTIONS_ENUMS.type.ChangeManipulation,
                changeManipulationAction: {
                    targetsType: ACTIONS_ENUMS.UniversaltargetsType.Single,
                    targetId: [],
                    movable: false,
                    sizable: false,
                    rotatable: false,
                    heightCorrection: false,
                    delay:0,
                }
            }
            break;
        case ACTIONS_ENUMS.type.SendToWebView:
            _action = {
                id: Math.floor(Math.random() * 9999999)+"",
                type: ACTIONS_ENUMS.type.SendToWebView,
                sendToWebViewAction: {
                    message: details,
                    delay: 0
                }
            }
            break;
    }

    var i = interaction.actionFlows[0].actions.push(_action);
    action = interaction.actionFlows[0].actions[i-1];
    build_html_action(action, i);
    set_interactive(interactions);

}
function build_html_action(action, action_num){
    var action_block = document.createElement('div');
    $(action_block).addClass("action-block");
    $(action_block).attr('id', action.id);
    $(action_block).append("<label class=\"form-label mini-label title-label action-label\"></label>");
    var title = "";
    var title_hint = ""
    switch(action.type){
        case ACTIONS_ENUMS.type.Show:
            title = ACTIONS_ENUMS.visibilityAction.titles[action.visibilityAction.type];
            add_action_select(action_block, [
                ACTION_SELECT_TYPES.All,
                ACTION_SELECT_TYPES.Models,
                ACTION_SELECT_TYPES.Textures,
                ACTION_SELECT_TYPES.Videos,
                ACTION_SELECT_TYPES.Textes
            ], action.visibilityAction, {
                targetsType : "targetsType",
                targetId : "targetId"
            });
            if(action.visibilityAction.type == ACTIONS_ENUMS.visibilityAction.type.Hide)
                add_action_bool(action_block, "Отключать объект", action.visibilityAction, "disableOnHide",
            "Отключение снижает нагрузку на устройство, но объект перестает взаимодействовать и реагировать на события");
            add_action_float(action_block, "Длительность", "с", action.visibilityAction, "length");
            add_action_float(action_block, "Задержка", "с", action.visibilityAction, "delay");
            break;
        case ACTIONS_ENUMS.type.Video:
            title = ACTIONS_ENUMS.videoAction.titles[action.videoAction.type];
            add_action_select(action_block, [
                ACTION_SELECT_TYPES.All,
                ACTION_SELECT_TYPES.Videos,
            ], action.videoAction, {
                targetsType : "targetsType",
                targetId : "targetId"
            });
            if(action.videoAction.type == ACTIONS_ENUMS.videoAction.type.Play
                || action.videoAction.type == ACTIONS_ENUMS.videoAction.type.Rewind)
                add_action_bool(action_block, "Зациклить", action.videoAction, "loop");
            add_action_float(action_block, "Задержка", "с", action.videoAction, "delay");
            if(action.videoAction.type == ACTIONS_ENUMS.videoAction.type.Play ||
                action.videoAction.type == ACTIONS_ENUMS.videoAction.type.Rewind) {
                add_action_float(action_block, "Скорость", "%", action.videoAction, "speed", true);
                add_action_bool(action_block, "С начала", action.videoAction, "type",
                    "Если отключить, то видео будет воспроизводиться с того же места, где было остановлено",
                    function (input) {
                        if (action.videoAction.type == ACTIONS_ENUMS.videoAction.type.Rewind)
                            input.checked = true;
                        $(input).on("change", function () {
                            var val = input.checked;
                            if (val)
                                action.videoAction.type = ACTIONS_ENUMS.videoAction.type.Rewind;
                            else
                                action.videoAction.type = ACTIONS_ENUMS.videoAction.type.Play;
                            set_interactive(interactions);
                        })
                    })
            }
            break;
        case ACTIONS_ENUMS.type.Audio:
            title = ACTIONS_ENUMS.audioAction.titles[action.audioAction.type];
            add_action_select(action_block, [
                ACTION_SELECT_TYPES.All,
                ACTION_SELECT_TYPES.Audios,
            ], action.audioAction, {
                targetsType : "targetsType",
                targetId : "targetId"
            });
            if(action.audioAction.type == ACTIONS_ENUMS.audioAction.type.Play
                || action.audioAction.type == ACTIONS_ENUMS.audioAction.type.Rewind)
                add_action_bool(action_block, "Зациклить", action.audioAction, "loop");
            add_action_float(action_block, "Задержка", "с", action.audioAction, "delay");
            if(action.audioAction.type == ACTIONS_ENUMS.audioAction.type.Play ||
                action.audioAction.type == ACTIONS_ENUMS.audioAction.type.Rewind) {
                add_action_float(action_block, "Скорость", "%", action.audioAction, "speed", true);
                add_action_bool(action_block, "С начала", action.audioAction, "type",
                    "Если отключить, то звук будет воспроизводиться с того же места, где было остановлено",
                    function(input){
                        if(action.audioAction.type == ACTIONS_ENUMS.audioAction.type.Rewind)
                            input.checked = true;
                        $(input).on("change",function(){
                            var val = input.checked;
                            if(val)
                                action.audioAction.type = ACTIONS_ENUMS.audioAction.type.Rewind;
                            else
                                action.audioAction.type = ACTIONS_ENUMS.audioAction.type.Play;
                            set_interactive(interactions);
                        })
                    })
            }
            break;
        case ACTIONS_ENUMS.type.OpenUrl:
            title = ACTIONS_ENUMS.openUrlAction.title;
            add_action_string(action_block, action.openUrlAction, "url", "Введите ссылку...",
                "Ссылка должна начинаться с http")
            add_action_float(action_block, "Задержка", "с", action.openUrlAction, "delay");
            break;
        case ACTIONS_ENUMS.type.OpenScene:
            title = ACTIONS_ENUMS.openSceneAction.title;

            //add_action_string(action_block, action.openSceneAction, "sceneId", "Введите ID Сцены...")

            var values = [];
            let i = 0;
            scenes.forEach(function(sc){
                i++;
                if(!sc.hasOwnProperty("name"))
                    sc.name = "Сцена "+i;
                values.push({value: sc.id, name: sc.name})
            })

            add_action_select(action_block, [ACTION_SELECT_TYPES.Custom],
                null, null,
                values, function (select) {
                    $(select).on("change", function () {
                        action.openSceneAction.sceneId = $(this).val();
                        if($(this).val()==null)
                            action.openSceneAction.sceneId = ""
                        set_interactive(interactions);
                    })
                    $(select).val(action.openSceneAction.sceneId);
                }, {
                    multiple: false,
                    placeholder: "Выберите сцену"
                });

            add_action_bool(action_block, "Сбросить трекинг", action.openSceneAction, "resetTracking");
            add_action_float(action_block, "Задержка", "с", action.openSceneAction, "delay");
            break;
        case ACTIONS_ENUMS.type.Animation:
            title = ACTIONS_ENUMS.animationAction.titles[action.animationAction.type];
            add_action_select(action_block, [
                ACTION_SELECT_TYPES.Models,
            ], action.animationAction, {
                targetId : "targetId"
            }, [], undefined, {
                multiple : false,
                placeholder : "Целевые объекты"
            },function(){
                console.log("onChange");
                action.animationAction.animationName = ""
                show_interaction_parms(selected_obj);
            }, true);
            console.log(action.animationAction.targetId)
            if(action.animationAction.targetId
                && action.animationAction.type==ACTIONS_ENUMS.animationAction.type.Play ||
                action.animationAction.type == ACTIONS_ENUMS.animationAction.type.Rewind) {

                var entity = entities.find(({ id }) => id == action.animationAction.targetId);
                var values = []
                //{value: ACTIONS_ENUMS.transformAction.type.MoveBy, name: "Переместиться на"}

                entity.model.animations = [...new Set(entity.model.animations)];
                console.log(entity.model.animations)
                let max_anim = 1;
                let current_anim = 0;
                entity.model.animations.forEach(function(animation){
                    if(current_anim < max_anim) {
                        values.push({value: animation, name: animation})
                        current_anim++;
                    }
                })
                add_action_select(action_block, [ACTION_SELECT_TYPES.Custom],
                    null, null,
                    values, function (select) {
                        $(select).on("change", function () {
                            action.animationAction.animationName = $(this).val();
                            if($(this).val()==null)
                                action.animationAction.animationName = ""
                            set_interactive(interactions);
                        })
                        $(select).val(action.animationAction.animationName);
                    }, {
                        multiple: false,
                        placeholder: "Выберите анимацию"
                    });
            }
            add_action_float(action_block, "Задержка", "с", action.animationAction, "delay");
            if(action.animationAction.type == ACTIONS_ENUMS.animationAction.type.Play ||
                action.animationAction.type == ACTIONS_ENUMS.animationAction.type.Rewind) {
                add_action_float(action_block, "Скорость", "%", action.animationAction, "speed", true);
                add_action_bool(action_block, "С начала", action.animationAction, "type",
                    "Если отключить, то анимация будет воспроизводиться с того же места, где было остановлено",
                    function (input) {
                        if (action.animationAction.type == ACTIONS_ENUMS.animationAction.type.Rewind)
                            input.checked = true;
                        $(input).on("change", function () {
                            var val = input.checked;
                            if (val)
                                action.animationAction.type = ACTIONS_ENUMS.animationAction.type.Rewind;
                            else
                                action.animationAction.type = ACTIONS_ENUMS.animationAction.type.Play;
                            set_interactive(interactions);
                        })
                    })
                add_action_bool(action_block, "Зациклить", action.animationAction, "loop");
            }
            break;
        case ACTIONS_ENUMS.type.Transform:
            title = ACTIONS_ENUMS.transformAction.title;
            add_action_select(action_block, [
                ACTION_SELECT_TYPES.All,
                ACTION_SELECT_TYPES.Models,
                ACTION_SELECT_TYPES.Textures,
                ACTION_SELECT_TYPES.Audios,
                ACTION_SELECT_TYPES.Videos,
                ACTION_SELECT_TYPES.Textes
            ], action.transformAction, {
                targetsType : "targetsType",
                targetId : "targetId"
            });
            add_action_select(action_block, [ACTION_SELECT_TYPES.Custom],
                null, null,
                [
                    {value: ACTIONS_ENUMS.transformAction.type.MoveTo, name: "Переместиться в"},
                    {value: ACTIONS_ENUMS.transformAction.type.MoveBy, name: "Переместиться на"}
                ],function(select){
                    $(select).on("change", function () {
                        action.transformAction.type = $(this).val();
                        set_interactive(interactions);
                    })
                    $(select).val(action.transformAction.type);
                }, {
                    multiple : false,
                    placeholder : "Выберите опцию",
                    removeItem : false,
                    removeItemButton : false,
                    searchEnabled : false
                });
            add_action_vector3(action_block, ACTIONS_ENUMS.transformAction.labels.position,
                action.transformAction.targetPosition)
            add_action_vector3(action_block, ACTIONS_ENUMS.transformAction.labels.rotation,
                action.transformAction.targetRotation)
            add_action_vector3(action_block, ACTIONS_ENUMS.transformAction.labels.scale,
                action.transformAction.targetScale)
            add_action_float(action_block, "Длительность", "с", action.transformAction, "length");
            add_action_float(action_block, "Задержка", "с", action.transformAction, "delay");
            break;
        case ACTIONS_ENUMS.type.AudioVolume:
            title = ACTIONS_ENUMS.audioVolumeAction.title;
            add_action_select(action_block, [
                ACTION_SELECT_TYPES.All,
                ACTION_SELECT_TYPES.Audios,
            ], action.audioVolumeAction, {
                targetsType : "targetsType",
                targetId : "targetId"
            });
            add_action_float(action_block, "Громкость", "%", action.audioVolumeAction, "volume", true);
            add_action_float(action_block, "Длительность", "с", action.audioVolumeAction, "length");
            add_action_float(action_block, "Задержка", "с", action.audioVolumeAction, "delay");
            break;
        case ACTIONS_ENUMS.type.VideoVolume:
            title = ACTIONS_ENUMS.videoVolumeAction.title;
            add_action_select(action_block, [
                ACTION_SELECT_TYPES.All,
                ACTION_SELECT_TYPES.Videos,
            ], action.videoVolumeAction, {
                targetsType : "targetsType",
                targetId : "targetId"
            });
            add_action_float(action_block, "Громкость", "%", action.videoVolumeAction, "volume", true);
            add_action_float(action_block, "Длительность", "с", action.videoVolumeAction, "length");
            add_action_float(action_block, "Задержка", "с", action.videoVolumeAction, "delay");
            break;
        case ACTIONS_ENUMS.type.Renderer:
            var type;
            if(action.rendererAction.opacity.hasValue)
                type = ACTIONS_ENUMS.rendererAction.type.changeOpacity;
            if(action.rendererAction.emission.hasValue)
                type = ACTIONS_ENUMS.rendererAction.type.changeEmission;
            title = ACTIONS_ENUMS.rendererAction.titles[type];
            add_action_select(action_block, [
                ACTION_SELECT_TYPES.All,
                ACTION_SELECT_TYPES.Models,
                ACTION_SELECT_TYPES.Textures,
                ACTION_SELECT_TYPES.Videos,
                ACTION_SELECT_TYPES.Textes,
            ], action.rendererAction, {
                targetsType : "targetsType",
                targetId : "targetId"
            });
            if(type == ACTIONS_ENUMS.rendererAction.type.changeOpacity)
                add_action_float(action_block, "Непрозрачность", "%", action.rendererAction.opacity,
                    "value", true);
            else {
                add_action_color(action_block, "Подсветка", action.rendererAction.emission,
                    "value", "Позволяет подсветить объект любым цветом");
            }
            add_action_float(action_block, "Длительность", "с", action.rendererAction, "length");
            add_action_float(action_block, "Задержка", "с", action.rendererAction, "delay");
            break;
        case ACTIONS_ENUMS.type.Following:
            title = ACTIONS_ENUMS.followingAction.titles[action.followingAction.state];
            add_action_select(action_block, [
                ACTION_SELECT_TYPES.All,
                ACTION_SELECT_TYPES.Models,
                ACTION_SELECT_TYPES.Textures,
                ACTION_SELECT_TYPES.Audios,
                ACTION_SELECT_TYPES.Videos,
                ACTION_SELECT_TYPES.Textes
            ], action.followingAction, {
                targetsType : "targetsType",
                targetId : "targetId"
            },undefined, undefined,{
                placeholder : "Объекты, которые следуют"
            });
            console.log(action_block)
            if(action.followingAction.state == ACTIONS_ENUMS.followingAction.State.Enable
            || action.followingAction.state == ACTIONS_ENUMS.followingAction.State.Toggle) {
                add_action_select(action_block, [
                        ACTION_SELECT_TYPES.Camera,
                        ACTION_SELECT_TYPES.Models,
                        ACTION_SELECT_TYPES.Textures,
                        ACTION_SELECT_TYPES.Audios,
                        ACTION_SELECT_TYPES.Videos,
                        ACTION_SELECT_TYPES.Textes],
                    action.followingAction, {targetId: "followTargetId", camera: "followCamera"},
                    undefined, undefined, {
                        multiple: false,
                        placeholder: "Объект, за которым следовать"
                    });
                add_action_bool(action_block, "Использовать Ось X", action.followingAction, "useXPosition")
                add_action_bool(action_block, "Использовать Ось Y", action.followingAction, "useYPosition")
                add_action_bool(action_block, "Использовать Ось Z", action.followingAction, "useZPosition")
                /*add_action_bool(action_block, "Отступ от центра", action.followingAction.positionOffset, "hasValue",
                    "Отступ в локальных координатах от центра объекта, за которым нужно следовать")*/
                add_action_vector3(action_block, "Отступ от центра",
                    action.followingAction.positionOffset.value)
                add_action_float(action_block, "Скорость", "м/с", action.followingAction, "speed");
                add_action_bool(action_block, "Нелинейность", action.followingAction, "linear",
                    "Чем дальше объект от цели, тем быстрее он будет двигаться к ней", undefined, true);
            }
            add_action_float(action_block, "Задержка", "с", action.followingAction, "delay");
            break;
        case ACTIONS_ENUMS.type.LookAt:
            title = ACTIONS_ENUMS.lookAtAction.titles[action.lookAtAction.state];
            add_action_select(action_block, [
                ACTION_SELECT_TYPES.All,
                ACTION_SELECT_TYPES.Models,
                ACTION_SELECT_TYPES.Textures,
                ACTION_SELECT_TYPES.Videos,
                ACTION_SELECT_TYPES.Textes
            ], action.lookAtAction, {
                targetsType : "targetsType",
                targetId : "targetId"
            },undefined, undefined,{
                placeholder : "Объекты, которые вращаются"
            });
            if(action.lookAtAction.state == ACTIONS_ENUMS.followingAction.State.Enable
                || action.lookAtAction.state == ACTIONS_ENUMS.followingAction.State.Toggle) {
                add_action_select(action_block, [
                        ACTION_SELECT_TYPES.Camera,
                        ACTION_SELECT_TYPES.Models,
                        ACTION_SELECT_TYPES.Textures,
                        ACTION_SELECT_TYPES.Audios,
                        ACTION_SELECT_TYPES.Videos,
                        ACTION_SELECT_TYPES.Textes],
                    action.lookAtAction, {targetId: "followTargetId", camera: "lookAtCamera"},
                    undefined, undefined, {
                        multiple: false,
                        placeholder: "Объект, к которому поворачиваться"
                    });
                add_action_bool(action_block, "Использовать Ось X", action.lookAtAction, "useXRotation")
                add_action_bool(action_block, "Использовать Ось Y", action.lookAtAction, "useYRotation")
                add_action_bool(action_block, "Использовать Ось Z", action.lookAtAction, "useZRotation")
                /*add_action_bool(action_block, "Отступ от центра", action.followingAction.positionOffset, "hasValue",
                    "Отступ в локальных координатах от центра объекта, за которым нужно следовать")*/
                add_action_vector3(action_block, "Угловой отступ",
                    action.lookAtAction.rotationOffset.value)
                add_action_float(action_block, "Скорость", "г/с", action.lookAtAction, "speed");
                add_action_bool(action_block, "Нелинейность", action.lookAtAction, "linear",
                    "Чем дальше объект от цели, тем быстрее он будет двигаться к ней", undefined, true);
            }
            add_action_float(action_block, "Задержка", "с", action.lookAtAction, "delay");
            break;
        case ACTIONS_ENUMS.type.ChangeManipulation:
            title = ACTIONS_ENUMS.changeManipulationAction.title;
            title_hint = "Изменить настройки взаимодействия пользователя с объектом"
            add_action_select(action_block, [
                ACTION_SELECT_TYPES.All,
                ACTION_SELECT_TYPES.Models,
                ACTION_SELECT_TYPES.Textures,
                ACTION_SELECT_TYPES.Videos,
                ACTION_SELECT_TYPES.Textes
            ], action.changeManipulationAction, {
                targetsType : "targetsType",
                targetId : "targetId"
            });
            add_action_bool(action_block, "Перетаскивание", action.changeManipulationAction, "movable",
                "Включите, чтобы пользователь мог перемещать объект касанием");
            add_action_bool(action_block, "Вращение", action.changeManipulationAction, "rotatable",
                "Включите, чтобы пользователь мог вращать объект (двумя пальцами)");
            add_action_bool(action_block, "Масштабирование", action.changeManipulationAction, "sizable",
                "Включите, чтобы пользователь мог масштабировать объект (двумя пальцами)");
            add_action_bool(action_block, "Изменение высоты", action.changeManipulationAction, "heightCorrection",
                "Включите, чтобы пользователь мог двигать объект вверх/вниз (двумя пальцами)");
            add_action_float(action_block, "Задержка", "с", action.changeManipulationAction, "delay");
            break;
        case ACTIONS_ENUMS.type.SendToWebView:
            title = ACTIONS_ENUMS.sendToWebViewAction.title;
            //title_hint = "Изменить настройки взаимодействия пользователя с объектом"
            add_action_string(action_block, action.sendToWebViewAction, "message", "Введите сообщение...")
            add_action_float(action_block, "Задержка", "с", action.sendToWebViewAction, "delay");
            break;
    }
    ///////////////////////////////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////////////////////
    $(action_block).find(".action-label").append("<span class='action_title'>"+title+"</span>");
    $(action_block).find(".action-label").prepend("<span class='action_num'>"+action_num+") </span>");
    $(action_block).find(".action-label").append(
        "<i class=\"bx bx-play\" style='display: none'></i><i class=\"bx bx-x delete_action\"></i>"
    );
    $(action_block).find(".action-label .delete_action").on("click",function(){
        delete_action(action.id);
    });

    if(title_hint != ""){
        $(action_block).find(".action-label .action_title").attr("data-bs-toggle","tooltip");
        $(action_block).find(".action-label .action_title").attr("data-bs-placement","left");
        $(action_block).find(".action-label .action_title").attr("data-bs-original-title",title_hint);
    }
    $("#actions").append(action_block);
    for( var i = 0; i < $(action_block).find('[data-choices]').length; i++){
        let removeItem = $($(action_block).find('[data-choices]')[i]).attr("data-removeItem");
        removeItem = typeof removeItem !== 'undefined' && removeItem !== false;
        let removeItemButton = $($(action_block).find('[data-choices]')[i]).attr("data-removeItemButton");
        removeItemButton = typeof removeItemButton !== 'undefined' && removeItemButton !== false;
        let searchEnabled = $($(action_block).find('[data-choices]')[i]).attr("data-searchEnabled");
        searchEnabled = typeof searchEnabled !== 'undefined' && searchEnabled !== false;

        var start_val = $($(action_block).find('[data-choices]')[i]).val();
        let choices = new Choices($(action_block).find('[data-choices]')[i], {
            removeItems: removeItem,
            removeItemButton: removeItemButton,
            noChoicesText: "Список объектов пуст",
            noResultsText: 'Объекты не найдены',
            shouldSort: false,
            shouldSortItems: false,
            searchEnabled: searchEnabled,
            searchChoices: true,

        });
        choices.passedElement.element.addEventListener(
            'addItem',
            function(event) {
                if(!isString(choices.getValue(true))){
                    if (choices.getValue(true).slice(-1).pop() == "All") {
                        choices.removeActiveItems();
                        choices.setChoiceByValue("All")
                    } else {
                        if (choices.getValue(true).includes("All")) {
                            choices.removeActiveItemsByValue("All")
                        }
                    }
                    if (choices.getValue(true).includes("Camera")) {
                        choices.removeActiveItems();
                        choices.setChoiceByValue("Camera")
                    }
                }
                /*else {
                    var placeholeder = $(choices.passedElement.element).attr("data-placeholder");
                    console.log(placeholeder)
                    console.log(choices.getValue(true))
                }*/
            },
            false,
        );
        choices.passedElement.element.addEventListener(
            'removeItem',
            function(event) {
                var placeholeder = $(choices.passedElement.element).attr("data-placeholder");
                console.log(placeholeder)
                console.log(choices.getValue(true))
                console.log($(choices.passedElement.element).parent().find(".choices__list.choices__list--single").length);
                console.log($(choices.passedElement.element).parent().find(".choices__placeholder").length);
                if(choices.getValue(true)==undefined &&
                    $(choices.passedElement.element).parent().find(".choices__list.choices__list--single").length == 1 &&
                    $(choices.passedElement.element).parent().find(".choices__placeholder").length == 0){
                    $(choices.passedElement.element).parent().find(".choices__list.choices__list--single").append(
                    "<div class=\"choices__item choices__placeholder choices__item--selectable\" data-item=\"\" data-id=\"1\" data-value=\"\" data-custom-properties=\"[object Object]\" aria-selected=\"true\" data-deletable=\"\">"+placeholeder+"<button type=\"button\" class=\"choices__button\" aria-label=\"Remove item: ''\" data-button=\"\">Remove item</button></div>"
                    )
                }
            },
            false,
        );

        if(start_val == null && start_val != $($(action_block).find('[data-choices]')[i]).val()){
            choices.removeActiveItems();
        }
    }

    enable_tooltips();
}

function add_action_select(action_block, action_select_types, action_parms, action_names, custom=[],
                           customBehaviour = undefined, select_parms = undefined,
                           onChange = undefined, has_animation = false){
    var select = document.createElement('select');
    $(select).addClass("form-select");
    $(select).addClass("form-select-sm");
    $(select).addClass("form-select-option-m");
    $(select).addClass("choices2");
    $(select).attr("data-choices", "");
    $(select).attr("data-choices-sorting-false", "");
    $(select).attr("data-placeholder", "Целевые объекты");
    $(select).attr("data-removeItem", "");
    $(select).attr("data-removeItemButton", "");
    $(select).attr("multiple", "");
    $(select).attr("data-searchEnabled", "");
    var multiple = true;
    if(select_parms != undefined){
        if(select_parms.hasOwnProperty("multiple"))
            if(!select_parms.multiple) {
                $(select).removeAttr("multiple");
                multiple = false;
            }
        if(select_parms.hasOwnProperty("placeholder"))
            $(select).attr("data-placeholder", select_parms.placeholder);
        if(select_parms.hasOwnProperty("removeItem"))
            if(!select_parms.removeItem)
                $(select).removeAttr("data-removeItem");
        if(select_parms.hasOwnProperty("removeItemButton"))
            if(!select_parms.removeItemButton)
                $(select).removeAttr("data-removeItemButton");
        if(select_parms.hasOwnProperty("searchEnabled"))
            if(!select_parms.searchEnabled)
                $(select).removeAttr("data-searchEnabled");
    }


    //$(select).attr("data-choices");
    action_select_types.forEach(function(action_select_type) {
        switch (action_select_type) {
            case ACTION_SELECT_TYPES.All:
                $(select).append("<option value=\"All\">Любой объект</option>");
                break;
            case ACTION_SELECT_TYPES.Camera:
                $(select).append("<option value=\"Camera\">Камера</option>");
                break;
            case ACTION_SELECT_TYPES.Models:
                var models = entities.filter(entity => entity.type == ENTITIES_TYPES.model);
                models.forEach(function(model) {
                    if(!has_animation || has_animation && model.model.animations.length > 0)
                    $(select).append("<option value=\""+model.id+"\">"+model.name+"</option>");
                });
                break;
            case ACTION_SELECT_TYPES.Textures:
                var textures = entities.filter(entity => entity.type == ENTITIES_TYPES.texture);
                textures.forEach(function(texture) {
                    $(select).append("<option value=\""+texture.id+"\">"+texture.name+"</option>");
                });
                break;
            case ACTION_SELECT_TYPES.Videos:
                var videos = entities.filter(entity => entity.type == ENTITIES_TYPES.video);
                videos.forEach(function(video) {
                    $(select).append("<option value=\""+video.id+"\">"+video.name+"</option>");
                });
                break;
            case ACTION_SELECT_TYPES.Audios:
                var audios = entities.filter(entity => entity.type == ENTITIES_TYPES.audio);
                audios.forEach(function(audio) {
                    $(select).append("<option value=\""+audio.id+"\">"+audio.name+"</option>");
                });
                break;
            case ACTION_SELECT_TYPES.Custom:
                custom.forEach(function(option) {
                    $(select).append("<option value=\""+option.value+"\">"+option.name+"</option>");
                });
                break;
            /*case ACTION_SELECT_TYPES.Textes:
                var textes = entities.filter(entity => entity.type == ENTITIES_TYPES.text);
                textes.forEach(function(text) {
                    $(select).append("<option value=\""+text.id+"\">"+text.name+"</option>");
                });
                break;*/
        }
    });
    if(customBehaviour != undefined){
        customBehaviour(select);
    }
    else {
        $(select).on("change", function () {
            var val = $(this).val();
            if(multiple) {
                if (val.includes("All")) {
                    action_parms[action_names.targetsType] = ACTIONS_ENUMS.UniversaltargetsType.All;
                    action_parms[action_names.targetId] = [];
                } else {
                    if (val.includes("Camera")) {
                        $(this).val(["Camera"]);
                        action_parms[action_names.camera] = true
                        action_parms[action_names.targetId] = [];
                    } else {
                        action_parms[action_names.targetsType] = ACTIONS_ENUMS.UniversaltargetsType.Multiple;
                        action_parms[action_names.targetId] = $(this).val()
                    }
                }
            }
            else {
                if (val == "Camera") {
                    $(this).val("Camera");
                    action_parms[action_names.camera] = true
                    action_parms[action_names.targetId] = "";
                } else {
                    action_parms[action_names.camera] = false
                    if(val==null)
                        val=""
                    action_parms[action_names.targetId] = val;
                }
            }
            set_interactive(interactions);
            if(onChange != undefined)
                onChange();
        })
        if(multiple) {
            if (action_parms[action_names.targetsType] == ACTIONS_ENUMS.UniversaltargetsType.All)
                $(select).val(["All"]);
            else {
                if (action_parms[action_names.camera])
                    $(select).val(["Camera"]);
                else
                    $(select).val(action_parms[action_names.targetId]);
            }
        }
        else {
            console.log(action_parms[action_names.camera])
            if (action_parms[action_names.camera])
                $(select).val("Camera");
            else
                $(select).val(action_parms[action_names.targetId]);
        }
    }
    $(action_block).append(select);
}
function add_action_float(action_block, title, mini_label, action_parms, action_names, is_percent=false){
    var div = document.createElement('div');
    $(div).addClass("settings-item");
    $(div).append("<label class=\"form-label mini-label\">"+title+"</label>" +
        "<div class=\"input-group input-group-sm right-pos  mini-input2\">\n" +
        "<input type=\"text\" autocomplete=\"off\" class=\"form-control accurate positive allownumericwithdecimal\" value=\"\">\n" +
        "<span class=\"input-group-text\"></span>\n" +
        "</div>");
    $(div).find("input").val(action_parms[action_names]);
    if(is_percent)
        $(div).find("input").val(action_parms[action_names]*100);
    else
        $(div).find("input").val(action_parms[action_names]);
    $(div).find(".input-group-text").text(mini_label);
    registr_allownumericwithdecimal($(div).find("input"));
    $(div).find("input").on("change",function(){
        var val = $(this).val()
        if(val == "")
            val = 0;
        val = parseFloat(val);
        if(is_percent)
            action_parms[action_names] = val/100;
        else
            action_parms[action_names] = val;
        set_interactive(interactions);
    })
    $(action_block).append(div);
}
function add_action_color(action_block, title, action_parms, action_names, subtitle = undefined){
    var div = document.createElement('div');
    $(div).addClass("settings-item");
    $(div).append("<label class=\"form-label mini-label\">"+title+"</label>" +
        "<div class=\"right-pos\">\n" +
        "<input type=\"color\" class=\"form-control form-control-color form-control-sm w-100 box-color-picker\" " +
        "value=\"#ffffff\">\n" +
        "</div>");
    if(subtitle != undefined) {
        $(div).find("label").attr("data-bs-toggle", "tooltip");
        $(div).find("label").attr("data-bs-placement", "left");
        $(div).find("label").attr("data-bs-original-title", subtitle);
    }
    $(div).find("input").val(rgbToHex(action_parms[action_names].color.r*255.0,
        action_parms[action_names].color.g*255.0, action_parms[action_names].color.b*255.0));
    $(div).find("input").on("change",function(){
        var val = $(this).val()
        val = val.split("#")[1].convertToRGB();
        val = {color: {r: val[0]/255.0, g: val[1]/255.0, b: val[2]/255.0, a: 1.0}, intensive: 0.0}
        action_parms[action_names] = val;
        set_interactive(interactions);
    })
    $(action_block).append(div);
}
function add_action_vector3(action_block, title, action_parms){
    var div = document.createElement('div');
    $(div).addClass("settings-item");
    $(div).append("<div class=\"row g-3 px-md-1\">\n" +
        "<div class=\"col-sm-4 px-md-1\">\n" +
        "    <div class=\"input-group input-group-sm\">\n" +
        "        <span class=\"input-group-text\">x</span>\n" +
        "        <input type=\"text\"  autocomplete=\"off\" class=\"form-control vector_x accurate allownumericwithdecimal " +
        "maybenull\" value=\"0.00\">\n" +
        "    </div>\n" +
        "</div><!--end col-->\n" +
        "<div class=\"col-sm-4 px-md-1\">\n" +
        "    <div class=\"input-group input-group-sm\">\n" +
        "        <span class=\"input-group-text\">y</span>\n" +
        "        <input type=\"text\" autocomplete=\"off\" class=\"form-control vector_y accurate allownumericwithdecimal " +
        "maybenull\" value=\"0.00\">\n" +
        "    </div>\n" +
        "</div><!--end col-->\n" +
        "<div class=\"col-sm-4 px-md-1\">\n" +
        "    <div class=\"input-group input-group-sm\">\n" +
        "        <span class=\"input-group-text\">z</span>\n" +
        "        <input type=\"text\"  autocomplete='off' class=\"form-control vector_z accurate allownumericwithdecimal " +
        "maybenull\" value=\"0.00\">\n" +
        "    </div>\n" +
        "</div><!--end col-->\n" +
        "\n" +
        "</div>");
    $(div).find(".vector_x").val(action_parms.x.value);
    if(!action_parms.x.hasValue)
        $(div).find(".vector_x").val("-");
    $(div).find(".vector_y").val(action_parms.y.value);
    if(!action_parms.y.hasValue)
        $(div).find(".vector_y").val("-");
    $(div).find(".vector_z").val(action_parms.z.value);
    if(!action_parms.z.hasValue)
        $(div).find(".vector_z").val("-");
    registr_allownumericwithdecimal($(div).find(".vector_x"));
    registr_allownumericwithdecimal($(div).find(".vector_y"));
    registr_allownumericwithdecimal($(div).find(".vector_z"));
    $(div).find("input").on("change",function(){
        var val = $(this).val()
        if(val == "")
            val = "-";
        val = parseFloat(val);
        let obj = this
        let vectors = ["x","y","z"];
        vectors.forEach(function(vec) {
            if($(obj).hasClass("vector_"+vec)){
                if(isNaN(val)){
                    action_parms[vec].hasValue = false
                    val = 0;
                }
                else
                    action_parms[vec].hasValue = true;
                action_parms[vec].value = val;
            }
        });

        set_interactive(interactions);
    })
    $(action_block).append("<label class=\"form-label mini-label2\">"+title+"</label>")
    $(action_block).append(div);
}
function add_action_bool(action_block, title, action_parms, action_names, subtitle = undefined,
                         customBehaviour = undefined, negative = false){
    var div = document.createElement('div');
    $(div).addClass("settings-item");
    $(div).append("<label class=\"form-label mini-label\">"+title+"</label>\n" +
    "<div class=\"form-check form-switch form-switch-md right-pos mini-check\" dir=\"ltr\">\n" +
    "</div>");
    var input = document.createElement('input');
    $(input).attr("type","checkbox");
    $(input).addClass("form-check-input");
    $(div).find(".form-check").append(input);
    if(subtitle != undefined) {
        $(div).find("label").attr("data-bs-toggle", "tooltip");
        $(div).find("label").attr("data-bs-placement", "left");
        $(div).find("label").attr("data-bs-original-title", subtitle);
    }
    if(customBehaviour != undefined){
        customBehaviour(input);
    }
    else {
        if(action_parms[action_names] && !negative || !action_parms[action_names] && negative){
            if(!negative)
                input.checked = action_parms[action_names];
            else
                input.checked = !action_parms[action_names];
        }
        $(input).on("change", function () {
            var val = input.checked;
            if(negative)
                val = !val;
            action_parms[action_names] = val;
            set_interactive(interactions);
        })
    }
    $(action_block).append(div);
}
function add_action_string(action_block, action_parms, action_names, placeholder, subtitle = undefined){
    var input = document.createElement('input');
    $(input).addClass("form-control");
    $(input).addClass("form-control-sm");
    $(input).addClass("settings-input-full");
    $(input).attr("text","text");
    $(input).attr("placeholder",placeholder);
    $(input).val(action_parms[action_names]);
    $(input).on("change",function(){
        var val = $(this).val()
        action_parms[action_names] = val
        set_interactive(interactions);
    })
    if(subtitle != undefined) {
        $(input).attr("data-bs-toggle", "tooltip");
        $(input).attr("data-bs-placement", "left");
        $(input).attr("data-bs-original-title", subtitle);
    }
    $(action_block).append(input);
}

function check_interaction() {
    if(!interaction_loaded)
        return
    interactions.forEach(function(interaction){
        $("#"+interaction.id).removeClass("has_error");
        //CHECK TRIGGERS
        if(Object.keys(interaction.trigger).length == 0)
            $("#"+interaction.id).addClass("has_error");
        try {
            let targetId = JSON.parse(
                "["+JSON.stringify(interaction.trigger).split('targetId":[')[1].split("]")[0]
                +"]");
            console.log(targetId)
            targetId.forEach(function (target) {
                if(entities.find(({ id }) => id == target) == undefined)
                    $("#"+interaction.id).addClass("has_error");
            })
        } catch (e) {

        }
        try {
            let targetAId = JSON.parse(
                "["+JSON.stringify(interaction.trigger).split('targetAId":[')[1].split("]")[0]
                +"]");
            let targetBId = JSON.parse(
                "["+JSON.stringify(interaction.trigger).split('targetBId":[')[1].split("]")[0]
                +"]");
            console.log(targetAId)
            console.log(targetBId)
            targetAId.forEach(function (target) {
                if(entities.find(({ id }) => id == target) == undefined)
                    $("#"+interaction.id).addClass("has_error");
            })
            targetBId.forEach(function (target) {
                if(entities.find(({ id }) => id == target) == undefined)
                    $("#"+interaction.id).addClass("has_error");
            })
        } catch (e) {

        }
        try {
            let targetMarkerId = JSON.parse(
                "["+JSON.stringify(interaction.trigger).split('targetMarkerId":[')[1].split("]")[0]
                +"]");
            console.log(targetMarkerId)
            targetMarkerId.forEach(function (target) {
                if(scene.anchors.find(({ id }) => id == target) == undefined)
                    $("#"+interaction.id).addClass("has_error");
            })
        } catch (e) {

        }
        try {
            if(interaction.trigger.webViewTrigger.hasOwnProperty("message")){
                if(interaction.trigger.webViewTrigger.message=="")
                    $("#"+interaction.id).addClass("has_error");
            }
        } catch (e) {

        }
        // CHECK ACTIONS
        interaction.actionFlows.forEach(function (actionFlow) {
            actionFlow.actions.forEach(function (action) {
                try {
                    let targetId = JSON.parse(
                        "["+JSON.stringify(action).split('targetId":[')[1].split("]")[0]
                        +"]");
                    console.log(targetId)
                    let targetsType = Number(JSON.stringify(action).split('targetsType":')[1].split(",")[0])

                    console.log("targetsType",targetsType)
                    targetId.forEach(function (target) {
                        if(entities.find(({ id }) => id == target) == undefined)
                            $("#"+interaction.id).addClass("has_error");
                    })
                    if((targetsType==1 || targetsType==0) && targetId.length==0)
                        $("#"+interaction.id).addClass("has_error");
                } catch (e) {

                }
                try {
                    if(action.hasOwnProperty("animationAction")){
                        let targetId = JSON.stringify(action).split('targetId":')[1].split(",")[0]
                            .replace(/['"]+/g, '')+"";;
                        console.log(targetId)
                        if(entities.find(({ id }) => id == targetId) == undefined)
                            $("#"+interaction.id).addClass("has_error");
                    }
                } catch (e) {

                }
                try {
                    let url = JSON.stringify(action).split('url":"')[1].split('"')[0]
                    console.log("url",url)
                    if(url.indexOf("http")==-1)
                        $("#"+interaction.id).addClass("has_error");
                } catch (e) {

                }
                try {
                    let sceneId = JSON.stringify(action).split('sceneId":')[1].split(',')[0]
                        .replace(/['"]+/g, '')+"";
                    console.log("sceneId",sceneId)
                    if(scenes.find(({ id }) => id == sceneId) == undefined)
                        $("#"+interaction.id).addClass("has_error");
                } catch (e) {

                }
                try {
                    let followTargetId = JSON.stringify(action).split('followTargetId":')[1].split(',')[0]
                        .replace(/['"]+/g, '')+"";
                    console.log("followTargetId",followTargetId)
                    let lookAtCamera = JSON.parse(JSON.stringify(action).split('lookAtCamera":')[1].split(',')[0]
                        .replace(/['"]+/g, '')+"");
                    console.log("lookAtCamera",lookAtCamera)
                    let state = Number(JSON.stringify(action).split('state":')[1].split(',')[0]);
                    console.log("state",state)
                    if(entities.find(({ id }) => id == followTargetId) == undefined && !lookAtCamera && state == 0)
                        $("#"+interaction.id).addClass("has_error");
                } catch (e) {

                }
                try {
                    let followTargetId = JSON.stringify(action).split('followTargetId":')[1].split(',')[0]
                        .replace(/['"]+/g, '')+"";
                    console.log("followTargetId",followTargetId)
                    let followCamera = JSON.parse(JSON.stringify(action).split('followCamera":')[1].split(',')[0]
                        .replace(/['"]+/g, '')+"");
                    console.log("followCamera",followCamera)
                    let state = Number(JSON.stringify(action).split('state":')[1].split(',')[0]);
                    console.log("state",state)
                    if(entities.find(({ id }) => id == followTargetId) == undefined && !followCamera && state == 0)
                        $("#"+interaction.id).addClass("has_error");
                } catch (e) {

                }

                try {
                    let animationName = JSON.stringify(action).split('animationName":')[1].split(',')[0]
                        .replace(/['"]+/g, '')+"";
                    console.log("animationName",animationName)
                    if(animationName == "")
                        $("#"+interaction.id).addClass("has_error");
                } catch (e) {

                }


            })
        })
    })
}

/*<div class="settings-item">
<label for="firstnameInput" class="form-label mini-label" data-bs-toggle="tooltip" data-bs-placement="left" title="" data-bs-original-title="Угловой отступ в локальных координатах от поворота целевого объекта">Угловой отступ</label>

<div class="form-check form-switch form-switch-md right-pos mini-check" dir="ltr">
    <input type="checkbox" checked="" class="form-check-input ">
</div>
</div>*/

function delete_action(_id){
    $("#"+_id).remove();
    var interaction = undefined;
    for( var i = 0; i < interactions.length; i++){
        if (interactions[i].id == selected_obj) {
            interaction = interactions[i];
        }
    }
    if(interaction == undefined)
        return;
    for( var i = 0; i < interaction.actionFlows[0].actions.length; i++){
        if(interaction.actionFlows[0].actions[i].id == _id)
            interaction.actionFlows[0].actions.splice(i, 1);
    }
    rebuild_actions_nums();
    set_interactive(interactions);
}

function rebuild_actions_nums(){
    for( var i = 0; i < $("#actions .action-block").length; i++){
        $("#actions .action-block:eq("+i+") .action_num").text((i+1)+") ");
    }
}

function enable_tooltips(){

    var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
    var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl)
    })
}

function set_scene(data, callback, scene_id=scene.id){
    console.log("[set_scene]")
    window.UNITY.sendMessageToUnity(new Command("setscene",data,[scene_id])).then(e=>{
        console.log("[set_scene callback]")
        console.log(e);
        if(callback!=undefined)
            callback();
    }).catch(e=>{console.log( e)});
    /*setTimeout(function(){

        if(callback!=undefined)
            callback();
    },1000);*/
}
//saving
setInterval(function(){

    if(is_user_here)
        save_project();
},30000)

function show_scene_settings(_id){
    console.log("[show_scene_settings] "+_id)
    var _scene = scenes.find(({ id }) => id == _id);
    console.log(_scene)
    selected_scene = _scene;
    var autoPlacementInputs = document.getElementsByClassName("autoPlacement");
    var captureInput = document.getElementById("capture");
    var lidarInput = document.getElementById("lidar");
    var humanSegmentationInput = document.getElementById("humanSegmentation");
    var showConsoleInput = document.getElementById("showConsole");
    var analyticsInput = document.getElementById("analytics");
    var showTipsInput = document.getElementById("showTips");
    var anchorinType = $(".anchoring_type")
    var hasWebview = document.getElementById("hasWebview");
    var webviewLink = $("#webviewLink");
    $("#scene_name").val(_scene.name)
    if(_scene.sceneSettings.hasOwnProperty("webViewUrl")){
        webviewLink.val(_scene.sceneSettings.webViewUrl);
        $("#webviewSettings").css("display", "block")
    }
    else {
        $("#webviewSettings").css("display", "none")
    }
    hasWebview.checked = _scene.sceneSettings.hasOwnProperty("webViewUrl");
    autoPlacementInputs.forEach(function(autoPlacementInput){
        autoPlacementInput.checked = _scene.sceneSettings.autoPlacement;

    })
    captureInput.checked = _scene.sceneSettings.capture;

    if(_scene.sceneSettings.hasOwnProperty("occlusionEnvironment")){
        lidarInput.checked = _scene.sceneSettings.occlusionEnvironment;
    }
    else {
        lidarInput.checked = false;
    }

    if(_scene.sceneSettings.hasOwnProperty("enableDepthOcclusion")){
        humanSegmentationInput.checked = _scene.sceneSettings.enableDepthOcclusion;
    }
    else {
        humanSegmentationInput.checked = false;
    }

    getProjectSettings(function(e){
        if(!e.hasOwnProperty("webViewUrl")){
            setProjectSettings({webViewUrl:baseUrl()+"mainui.php"})
        }
        else {
            if(e.webViewUrl.includes("_console"))
                showConsoleInput.checked = true;
            else {
                showConsoleInput.checked = false;
            }
        }
    })

    analyticsInput.checked = _scene.sceneSettings.analytics;
    showTipsInput.checked = _scene.sceneSettings.showTips;
    if(_scene.anchors.length > 0 && _scene.id == scene.id) {
        $("#scene_anchor_type").css("display", "block")
        if (_scene.anchors[0].type == ANCHORS_TYPES.PlaneVertical || _scene.anchors[anchor].type == ANCHORS_TYPES.PlaneHorizontal)
            anchorinType.val(_scene.anchors[0].type)
        else {
            $(".autoPlacement").parent().parent().css("display", "none")
            if (_scene.anchors[anchor].type == ANCHORS_TYPES.MarkerVertical || _scene.anchors[anchor].type == ANCHORS_TYPES.MarkerHorizontal)
                anchorinType.val(ANCHORS_TYPES.MarkerHorizontal)
            else
                anchorinType.val(ANCHORS_TYPES.CloudAnchor)
        }
    }
    else {
        $("#scene_anchor_type").css("display", "none")
    }
}
//scene settings
function registr_scene_settings(){
    var autoPlacementInputs = document.getElementsByClassName("autoPlacement");
    var captureInput = document.getElementById("capture");
    var lidarInput = document.getElementById("lidar");
    var humanSegmentationInput = document.getElementById("humanSegmentation");
    var showConsoleInput = document.getElementById("showConsole");
    var analyticsInput = document.getElementById("analytics");
    var showTipsInput = document.getElementById("showTips");
    var anchorinType = $(".anchoring_type")
    var hasWebview = document.getElementById("hasWebview");
    var webviewLink = $("#webviewLink");

    var parm_obj = document.getElementById("scene_name");
    parm_obj.addEventListener('input', function(element) {
        var val = $("#scene_name").val();
        $(".nav-item[data-id='"+selected_scene.id+"']").find(".menu_title").text(val);
        selected_scene.name = val;
        set_scene({name:selected_scene.name},undefined,selected_scene.id);
    });



    //webViewUrl

    hasWebview.addEventListener('input',function(){
        if(hasWebview.checked) {
            $("#webviewSettings").css("display", "block")
            if(selected_scene.sceneSettings.hasOwnProperty("webViewUrl"))
                delete selected_scene.sceneSettings.webViewUrl;
        }
        else {
            $("#webviewSettings").css("display", "none")
            selected_scene.sceneSettings.webViewUrl = "";
        }
        webviewLink.val("");
        set_scene({sceneSettings:selected_scene.sceneSettings},undefined,selected_scene.id);
    })
    webviewLink.on("change",function(){
        var val = $("#webviewLink").val();
        selected_scene.sceneSettings.webViewUrl = val;
        set_scene({sceneSettings:selected_scene.sceneSettings},undefined,selected_scene.id);
    })
    autoPlacementInputs.forEach(function(autoPlacementInput){
        autoPlacementInput.addEventListener('input',function(){
            selected_scene.sceneSettings.autoPlacement = autoPlacementInput.checked;
            autoPlacementInputs.forEach(function(_autoPlacementInput) {
                _autoPlacementInput.checked = selected_scene.sceneSettings.autoPlacement
            })
            set_scene({sceneSettings:selected_scene.sceneSettings},undefined,selected_scene.id);
        })
    })
    captureInput.addEventListener('input',function(){
        selected_scene.sceneSettings.capture = captureInput.checked;
        set_scene({sceneSettings:selected_scene.sceneSettings},undefined,selected_scene.id);
    })
    lidarInput.addEventListener('input',function(){
        selected_scene.sceneSettings.occlusionEnvironment = lidarInput.checked;
        set_scene({sceneSettings:selected_scene.sceneSettings},undefined,selected_scene.id);
    })
    humanSegmentationInput.addEventListener('input',function(){
        selected_scene.sceneSettings.enableDepthOcclusion = humanSegmentationInput.checked;
        set_scene({sceneSettings:selected_scene.sceneSettings},undefined,selected_scene.id);
    })
    showConsoleInput.addEventListener('input',function(){
        if(showConsoleInput.checked)
            setProjectSettings({webViewUrl:baseUrl()+"mainui_console.php"})
        else
            setProjectSettings({webViewUrl:baseUrl()+"mainui.php"})
    })
    analyticsInput.addEventListener('input',function(){
        selected_scene.sceneSettings.analytics = analyticsInput.checked;
        set_scene({sceneSettings:selected_scene.sceneSettings},undefined,selected_scene.id);
    })
    showTipsInput.addEventListener('input',function(){
        selected_scene.sceneSettings.showTips = showTipsInput.checked;
        set_scene({sceneSettings:selected_scene.sceneSettings},undefined,selected_scene.id);
    })
    anchorinType.on("change",function(e){
        var val = $(this).val();
        var id = selected_scene.anchors[anchor].id;
        if(val == ANCHORS_TYPES.PlaneVertical || val == ANCHORS_TYPES.PlaneHorizontal){
            if(selected_scene.anchors[anchor].type==ANCHORS_TYPES.MarkerVertical || selected_scene.anchors[anchor].type==ANCHORS_TYPES.MarkerHorizontal){
                if(selected_scene.anchors.length == 1 ||
                    confirm("Внимание, при смене привязки контент на остальных маркерах удалится, подтвердить?")){

                    deleteContentFromAnotherAnchors(id,function () {
                        console.log("onComplete")
                        selected_scene.anchors= [{
                            "id": id, "type": val
                        }];
                        set_scene({anchors:selected_scene.anchors},function(){
                            force_reload = true;
                            location.reload();
                        },selected_scene.id);
                    })
                }
                else {
                    $(this).val(selected_scene.anchors[anchor].type)
                }
            }
            else {
                if(selected_scene.anchors[anchor].type==ANCHORS_TYPES.CloudAnchor){
                    selected_scene.anchors[anchor]= {
                        "id": id, "type": val
                    }
                    //scene.anchors[1].id = "cloudanchor"+Math.floor(Math.random() * 999)
                    set_scene({anchors:selected_scene.anchors},function(){
                        force_reload = true;
                        location.reload();
                    },selected_scene.id);
                }
                else {
                    selected_scene.anchors[anchor] = {
                        "id": id, "type": val
                    }
                    set_scene({anchors:selected_scene.anchors},function(){
                        force_reload = true;
                        location.reload();
                    },selected_scene.id);
                }
            }
        }
        else {
            if(val == ANCHORS_TYPES.MarkerVertical || val == ANCHORS_TYPES.MarkerHorizontal) {
                if (selected_scene.anchors[anchor].type != ANCHORS_TYPES.MarkerVertical && selected_scene.anchors[anchor].type != ANCHORS_TYPES.MarkerHorizontal) {
                    /*if (scene.anchors.length > 1) {
                        if (scene.anchors[1].type == ANCHORS_TYPES.MarkerVertical ||
                            scene.anchors[1].type == ANCHORS_TYPES.MarkerHorizontal) {
                            scene.anchors.shift();
                            scene.anchors[0].id = id;
                            set_scene({anchors: scene.anchors}, function () {
                                force_reload = true;
                                location.reload();
                            });
                        } else {
                            scene.anchors[0] = {
                                "id": "marker" + Math.floor(Math.random() * 999), "type": val, "contentId": 1000050,
                                "markerWidth": 0.1,
                                "markerName": "Маркер 1"
                            }
                            set_scene({anchors: scene.anchors}, function () {
                                force_reload = true;
                                location.reload();
                            });
                        }
                    } else {*/
                        //default marker 1000050
                        selected_scene.anchors = [{
                            "id": id, "type": val, "contentId": 1000050,
                            "markerWidth": 0.2,
                            "markerName": "Маркер 1"
                        }]
                        set_scene({anchors: selected_scene.anchors}, function () {
                            force_reload = true;
                            location.reload();
                        },selected_scene.id);
                    //}
                }
            }
            else {
                if(val == ANCHORS_TYPES.CloudAnchor) {
                    if (selected_scene.anchors[anchor].type != ANCHORS_TYPES.CloudAnchor) {
                        if(selected_scene.anchors[anchor].type==ANCHORS_TYPES.MarkerVertical ||
                            selected_scene.anchors[anchor].type==ANCHORS_TYPES.MarkerHorizontal){
                            if(selected_scene.anchors.length == 1 ||
                                confirm("Внимание, при смене привязки контент на остальных маркерах удалится, подтвердить?")){
                                showAddCloudAhchor()
                            }
                            //else {
                                $(this).val(selected_scene.anchors[anchor].type)
                            //}
                        }
                        else {
                            showAddCloudAhchor()
                            $(this).val(selected_scene.anchors[anchor].type)
                        }



                        /*if (scene.anchors.length > 1) {
                            if (scene.anchors[1].type == ANCHORS_TYPES.CloudAnchor) {
                                scene.anchors.shift();
                                scene.anchors[0].id = id;
                                set_scene({anchors: scene.anchors}, function () {
                                    force_reload = true;
                                    location.reload();
                                });
                            } else {
                                showAddCloudAhchor()
                            }
                        } else {*/
                            //showAddCloudAhchor()
                        //}
                    }
                }
            }
        }
    })
}

function deleteContentFromAnotherAnchors(id, callback){
    get_entities(function (entitiesList) {
        let counter = 0;
        let check = function () {
            if(counter==entitiesList.length && callback != undefined){
                callback();
            }
        }
        if(entitiesList.length > 0) {
            select_entity(entitiesList[0],function () {
                entitiesList.forEach(function (entity_id) {
                    get_entity(entity_id, function (entity) {
                        if (entity.transform.parentId != id) {
                            console.log("DELETE " + entity.name)
                            window.UNITY.sendMessageToUnity(new Command("deleteentity", {},
                                [entity_id])).then(e => {
                                counter++;
                                check();
                            }).catch(e => {
                                console.log(e);
                            });

                        } else {
                            counter++;
                            check();
                        }
                    })
                })
            });

        }
        else {
            check();
        }
    })
}

function deleteAnchorWithContent(anchor_id, callback){
    console.log("[deleteAnchorWithContent] "+anchor_id);

    get_entities(function (entitiesList) {
        let counter = 0;
        let check = function () {
            if(counter==entitiesList.length && callback != undefined){
                callback();
            }
        }
        if(entitiesList.length > 0) {
            select_entity(entitiesList[0],function () {
                entitiesList.forEach(function (entity_id) {
                    get_entity(entity_id, function (entity) {
                        if (entity.transform.parentId == anchor_id) {
                            console.log("DELETE " + entity.name)
                            window.UNITY.sendMessageToUnity(new Command("deleteentity", {},
                                [entity_id])).then(e => {
                                counter++;
                                check();
                            }).catch(e => {
                                console.log(e);
                            });

                        } else {
                            counter++;
                            check();
                        }
                    })
                })
            });

        }
        else {
            check();
        }
    })
    interactions = interactions.filter(item => item.anchor !== anchor_id)
    set_interactive(interactions)
}
function getProjectSettings(callback){
    window.UNITY.sendMessageToUnity(new Command("getscenesconfig","{}",[])).then(e => {
        callback(e)
    })
}
function setProjectSettings(parm, callback){
    window.UNITY.sendMessageToUnity(new Command("setscenesconfig",JSON.stringify(parm),[])).then(e => {
        callback(e)
    })
}
function showAddCloudAhchor(){
    $("#objectModal").modal('show')
}
$("#add_object_button").on("click",function(){
    deleteContentFromAnotherAnchors(scene.anchors[anchor].id, function () {
        var type = ANCHORS_TYPES.CloudAnchor;
        scene.anchors = [{
            "id": scene.anchors[anchor].id, "type": type,
            "cloudAnchorId": $("#object_id_input").val(),
            "contentId": $("#object_id_input").val()
        }]
        set_scene({anchors: scene.anchors}, function () {
            force_reload = true;
            location.reload();
        });
    })

})

var object_id_input = document.getElementById("object_id_input");
object_id_input.addEventListener('input', function(element) {
    this.value = parseInt(this.value);
    if($("#object_id_input").val()!=0)
        $("#add_object_button").removeAttr("disabled");
    else
        $("#add_object_button").attr("disabled",true);
})
$("#lock_scale").on("click",function(){
    lock_storage.locker_scale = !lock_storage.locker_scale;
    $("#lock_scale").removeClass("bx-lock-open-alt");
    $("#lock_scale").removeClass("bxs-lock-alt");
    if(lock_storage.locker_scale)
        $("#lock_scale").addClass("bxs-lock-alt");
    else
        $("#lock_scale").addClass("bx-lock-open-alt");
    //window.UNITY.sendMessageToUnity(new Command("toolscalelock",true,[]))
    set_tool(TOOLS_TYPES.toolscalelock,lock_storage.locker_scale)
})
$(".copy_vector3").on("click",function(){

})
setInterval(async function() {
    try {
        let clipboardContent = await window.navigator.clipboard.readText();
       // console.log(clipboardContent)
        try {
            const obj = JSON.parse(clipboardContent);

            // Проверка, является ли объект правильной структуры
            if (obj.hasOwnProperty('x') && obj.hasOwnProperty('y') && obj.hasOwnProperty('z') &&
                typeof obj.x === 'number' && typeof obj.y === 'number' && typeof obj.z === 'number') {
                //console.log("Содержимое буфера обмена соответствует формату {x: число, y: число, z: число}");
                $(".paste_vector3").removeClass("hided")
                // Здесь можно выполнить дальнейшие действия, если объект соответствует ожидаемому формату
            } else {
                $(".paste_vector3").addClass("hided")
                //console.log("Содержимое буфера обмена НЕ соответствует ожидаемому формату.");
            }
        } catch (e) {
            // Если возникает ошибка при разборе JSON, предполагаем, что формат неверный
            //console.log("Содержимое буфера обмена НЕ соответствует ожидаемому формату.");
            $(".paste_vector3").addClass("hided")
        }

        $(".copy_vector3").removeClass("hided")
    } catch (e) {
        // Если возникает ошибка при разборе JSON, предполагаем, что формат неверный
        //console.log("Ошибка чтения буфера обмена");
        $(".paste_vector3").addClass("hided")
        $(".copy_vector3").addClass("hided")
    }
}, 1000);

$("#marker_preview").on("click",function(){
    let url = $(this).attr("src");
    window.open(url, '_blank');
})

function playAnim(id, name){
    console.log("playanim",id,name)
    window.UNITY.sendMessageToUnity(new Command("playanim",name,[id])).then(e=>{
        console.log(e);

    }).catch(e=>{console.log( e)});
}
function stopAnim(id){
    window.UNITY.sendMessageToUnity(new Command("stopanim",{},[id])).then(e=>{
        console.log(e);

    }).catch(e=>{console.log( e)});
}
function playVideo(id){
    window.UNITY.sendMessageToUnity(new Command("playvideo",{},[id])).then(e=>{
        console.log("+", e)
    }).catch(e=>{console.log("-", e)})
}
function pauseVideo(id){
    window.UNITY.sendMessageToUnity(new Command("pausevideo",{},[id])).then(e=>{
        console.log("+", e)
    }).catch(e=>{console.log("-", e)})
}
function addVideoMaterial(){
    var entity = entities.find(({ id }) => id == selected_obj);
    entity.renderer.materials[0].texture.isVideo = true;
    set_entity(selected_obj,{
        renderer: {
            materials: entity.renderer.materials
        }
    },function(){

    })
    $("#model_materials").html("");
    $("[data-block='videomaterial']").css("display","block");
    $("#chooseVideoResource").text("Выбрать")
    $("#video_resource").html("<img src=\"assets/images/img-placeholder.jpg\" alt=\"\" class=\"avatar-xs rounded\" onclick=\"$('#chooseVideoResource').click()\">\n" +
        "<span onclick=\"$('#chooseVideoResource').click()\" data-key=\"t-dashboards\" class=\"menu-block long_title\">Нет выбранного</span>")
    var i =0;
    entity.renderer.materials.forEach(function(material){
        $("#model_materials").append('<option value="'+i+'">'+material.name+'</option>')
        i++;
    })

    $(".addComponentVideo").css("display","none")
    setTimeout(function(){
        show_object_parms(selected_obj)
    },1)
}
function deleteVideoComponent(){
    var entity = entities.find(({ id }) => id == selected_obj);
    entity.renderer.materials.forEach(function(material){
        material.texture.isVideo = false;
        material.texture.contentId = 0
    });
    set_entity(selected_obj,{
        renderer: {
            materials: entity.renderer.materials
        }
    },function(){

    })
    $("[data-block='videomaterial']").css("display","none");
    $(".addComponentVideo").css("display","block")
    setTimeout(function(){
        show_object_parms(selected_obj)
    },1)
}
function addUnlit(){
    var entity = entities.find(({ id }) => id == selected_obj);

    entity.renderer.materials.forEach(function(material){
        material.shaderId = 1
    });
    set_entity(selected_obj,{
        renderer: {
            materials: entity.renderer.materials
        }
    },function(){

    })
    $("[data-block='unlitmaterial']").css("display","block");
    setTimeout(function(){
        show_object_parms(selected_obj)
    },1)
}
function deleteUnlitComponent(){
    var entity = entities.find(({ id }) => id == selected_obj);
    entity.renderer.materials.forEach(function(material){
        material.shaderId = 0
    });
    set_entity(selected_obj,{
        renderer: {
            materials: entity.renderer.materials
        }
    },function(){

    })
    $("[data-block='unlitmaterial']").css("display","none");
    $(".addComponentUnlit").css("display","block")
    setTimeout(function(){
        show_object_parms(selected_obj)
    },1)
}

function addOcclusion(){
    var entity = entities.find(({ id }) => id == selected_obj);
    entity.renderer.isOcclusion = true
    set_entity(selected_obj,{
        renderer: {
            isOcclusion: true
        }
    },function(){

    })
    $("[data-block='occlusionmaterial']").css("display","block");
    $(".addComponentUnlit").css("display","none")
    setTimeout(function(){
        show_object_parms(selected_obj)
    },1)
}
function deleteOcclusionComponent(){
    var entity = entities.find(({ id }) => id == selected_obj);
    entity.renderer.isOcclusion = false
    set_entity(selected_obj,{
        renderer: {
            isOcclusion: false
        }
    },function(){

    })
    $("[data-block='occlusionmaterial']").css("display","none");
    $(".addComponentOcclusion").css("display","block");
    setTimeout(function(){
        show_object_parms(selected_obj)
    },1)
}
function addDynamicLoading(){
    var entity = entities.find(({ id }) => id == selected_obj);
    entity.lazyLoad = true
    set_entity(selected_obj,{
        lazyLoad: true
    },function(){

    })
    $("[data-block='dynamicloading']").css("display","block");
    setTimeout(function(){
        show_object_parms(selected_obj)
    },1)
}
function deleteDynamicLoadingComponent(){
    var entity = entities.find(({ id }) => id == selected_obj);
    entity.lazyLoad = false;
    set_entity(selected_obj,{
        lazyLoad: false
    },function(){

    })
    $("[data-block='dynamicloading']").css("display","none");
    $(".addComponentDynamicLoading").css("display","block");
    setTimeout(function(){
        show_object_parms(selected_obj)
    },1)
}
function checkComponentsCount(){
    if($("#materailComponentsDropdown").find("[data-hided=false]").length>0)
        $(".materailComponents").css("display","block")
    else
        $(".materailComponents").css("display","none")
    var count_avaliable_components = 0
    for(var i = 0; i < $(".object_component").length;i++){
        if($(".object_component:eq("+i+")").css("display")=="block")
            count_avaliable_components++
    }
    console.log("[count_avaliable_components]",count_avaliable_components)

    if(count_avaliable_components == 0){
        console.log("no count_avaliable_components")
        setTimeout(function(){
            $("[data-block='component']").css("display","none");
        },1)
    }
    else {
        console.log("has count_avaliable_components")
        setTimeout(function(){
            $("[data-block='component']").css("display","block");
        },1)
    }
}
$("#button_play_video").on("click",function(){
    var entity = entities.find(({ id }) => id == selected_obj);
    entity.video.isPlaying = true
    playVideo(selected_obj)
    $("#button_pause_video").css("display","block")
    $("#button_play_video").css("display","none")
})
$("#button_pause_video").on("click",function(){
    var entity = entities.find(({ id }) => id == selected_obj);
    entity.video.isPlaying = false
    pauseVideo(selected_obj)
    $("#button_play_video").css("display","block")
    $("#button_pause_video").css("display","none")
})
$("#button_play_model").on("click",function(){
    console.log("CLICK")
    var entity = entities.find(({ id }) => id == selected_obj);
    entity.model.isPlaying = true
    playAnim(selected_obj,$("#model_animations").val())
    $("#button_stop_model").css("display","block")
    $("#button_play_model").css("display","none")
})
$("#button_stop_model").on("click",function(){
    var entity = entities.find(({ id }) => id == selected_obj);
    entity.model.isPlaying = false
    stopAnim(selected_obj)
    $("#button_play_model").css("display","block")
    $("#button_stop_model").css("display","none")
})
$("#model_animations").on("change",function(){
    var entity = entities.find(({ id }) => id == selected_obj);
    entity.model.defaultAnimation = $("#model_animations").val()
    if(entity.model.isPlaying){
        stopAnim(selected_obj)
        playAnim(selected_obj,$("#model_animations").val())
    }
})


