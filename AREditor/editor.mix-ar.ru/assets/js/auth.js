async function getUser(callback){

    const response = await fetch("https://mixar-api.ru/user/current", {
        method: 'GET', // *GET, POST, PUT, DELETE, etc.
        mode: 'cors', // no-cors, *cors, same-origin
        cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
        credentials: 'same-origin', // include, *same-origin, omit
        headers: {'Content-Type': 'application/json',"Authorization": "Bearer "+getCookie("token")},
        redirect: 'follow', // manual, *follow, error
        referrerPolicy: 'no-referrer',
    }).then(async function(value){
        console.log(value.text().then(async function(value){
        try {
            if(JSON.parse(value).hasOwnProperty("status")){
                if(JSON.parse(value).status==403){
                    console.log("invalid")
                    callback("invalid")
                }
            }
            else {
                const response = await fetch("server/getUser.php?token="+encodeURI(getCookie("token")), {
                    method: 'GET',
                    headers: {'Content-Type': 'application/json'},
                }).then(value => {
                    value.text().then(value => {
                        console.log(value)
                        if(JSON.parse(value).hasOwnProperty("result")){
                            if(JSON.parse(value).result=="error"){
                                console.log("invalid",JSON.parse(value).error)
                                callback("invalid")
                            }
                            else {
                                callback(value)
                            }
                        }
                        else {
                            callback("invalid")
                        }
                    })

                });
            }
        }
        catch (e) {
            callback("invalid")
        }
    }))});



}
function checkLogin(callback, reload = true){
    if(getCookie("token")!=""){
        /*if(getCookie("user_name") != "" && getCookie("user_surname") != ""
            && getCookie("user_email") != "" && getCookie("user_picture") != ""){
            callback({
                name:getCookie("user_name"),
                surname:getCookie("user_surname"),
                email:getCookie("user_email"),
                picture:getCookie("user_picture")
            })
        }*/
        //else {
            getUser(function(e){
                if(e=="invalid") {
                    logout()
                }
                else {
                    e = JSON.parse(e)
                    setCookie("user_name",e.name,180)
                    setCookie("user_surname",e.surname,180)
                    setCookie("user_email",e.email,180)
                    setCookie("user_picture",e.picture,180)
                    callback(e)
                }
            });
        //}
    }
    else {
        if(reload)
            logout()
    }
}
function logout(){
    setCookie("token","",180)
    setCookie("user_name","",180)
    setCookie("user_surname","",180)
    setCookie("user_email","",180)
    setCookie("user_picture","",180)
    setTimeout(function(){
        location.href = "signin.html"
    },500)
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
/*async function getProjects(callback){
    const response = await fetch("https://mixar-api.ru/project", {
        method: 'GET', // *GET, POST, PUT, DELETE, etc.
        mode: 'cors', // no-cors, *cors, same-origin
        cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
        credentials: 'same-origin', // include, *same-origin, omit
        headers: {'Content-Type': 'application/json',"Authorization": "Bearer "+getCookie("token")},
        redirect: 'follow', // manual, *follow, error
        referrerPolicy: 'no-referrer',
    }).then(value => {console.log(value.text().then(value => {
        console.log(value)
    }))});
}*/
function load_user_info(){
    checkLogin(function(user_info){
        //console.log(user_info)
        $("#user_name").text(user_info.name+" "+user_info.surname)
        $("#user_email").text(user_info.email)
        $("#user_picture").attr("src",user_info.picture)
    })
}