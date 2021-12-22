
///// Language Switching (2 languages: English and Finnish). /////

window.onload = function(){
    $('[lang="en"]').show();
    $('[lang="fi"]').hide();
}
    

function toggleLang() {
    $('[lang="fi"]').toggle();
    $('[lang="en"]').toggle();
};