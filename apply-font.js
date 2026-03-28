(function () {
    function applyFont(font) {
        if (!font) return;
        document.documentElement.style.fontFamily = font;
        if (document.body) document.body.style.fontFamily = font;
    }

    var cached = localStorage.getItem('sb_preferred_font');
    if (cached) applyFont(cached);

    document.addEventListener('DOMContentLoaded', function () {
        var f = localStorage.getItem('sb_preferred_font');
        if (f) { applyFont(f); return; }

        var tok = localStorage.getItem('token');
        if (!tok) return;
        fetch('/student/dashboard', { headers: { 'Authorization': 'Bearer ' + tok } })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (d) {
                if (!d) return;
                var font = d.student && d.student.preferences && d.student.preferences.fontFamily;
                if (font) {
                    localStorage.setItem('sb_preferred_font', font);
                    applyFont(font);
                }
            })
            .catch(function () {});
    });
})();
