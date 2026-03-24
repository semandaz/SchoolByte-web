(function () {
    var font = localStorage.getItem('sb_preferred_font');
    if (font) {
        document.documentElement.style.fontFamily = font;
        document.body && (document.body.style.fontFamily = font);
    }
    document.addEventListener('DOMContentLoaded', function () {
        var f = localStorage.getItem('sb_preferred_font');
        if (f) document.body.style.fontFamily = f;
    });
})();
