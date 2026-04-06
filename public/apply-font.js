(function () {
    var FONT_KEY = 'sb_preferred_font';
    var FONT_TS_KEY = 'sb_preferred_font_ts';

    var FONT_GOOGLE_MAP = {
        'Inter':           'family=Inter:wght@400;600;700;800',
        'Roboto':          'family=Roboto:wght@400;500;700',
        'Open Sans':       'family=Open+Sans:wght@400;600;700',
        'Lato':            'family=Lato:wght@400;700',
        'Montserrat':      'family=Montserrat:wght@400;600;700',
        'Poppins':         'family=Poppins:wght@400;600;700',
        'Nunito Sans':     'family=Nunito+Sans:wght@400;700',
        'Ubuntu':          'family=Ubuntu:wght@400;700',
        'Merriweather':    'family=Merriweather:wght@400;700',
        'Playfair Display':'family=Playfair+Display:wght@400;700',
        'Space Mono':      'family=Space+Mono',
        'Dancing Script':  'family=Dancing+Script:wght@400;700',
        'Satisfy':         'family=Satisfy',
        'Atkinson Hyperlegible': 'family=Atkinson+Hyperlegible:wght@400;700',
        'Oswald':          'family=Oswald:wght@400;700',
        'Lora':            'family=Lora:wght@400;700',
        'PT Sans':         'family=PT+Sans:wght@400;700',
        'Source Sans Pro': 'family=Source+Sans+3:wght@400;700',
        'Fira Sans':       'family=Fira+Sans:wght@400;700',
        'Quicksand':       'family=Quicksand:wght@400;700',
    };

    var _injectedFonts = {};

    function injectGoogleFont(fontName) {
        if (!fontName || _injectedFonts[fontName]) return;
        var param = FONT_GOOGLE_MAP[fontName];
        if (!param) return;
        var href = 'https://fonts.googleapis.com/css2?' + param + '&display=swap';
        var existing = document.head ? document.head.querySelectorAll('link[rel="stylesheet"]') : [];
        for (var i = 0; i < existing.length; i++) {
            if (existing[i].href && existing[i].href.indexOf(encodeURIComponent(fontName.replace(/ /g,'+'))) !== -1) {
                _injectedFonts[fontName] = true;
                return;
            }
        }
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        (document.head || document.documentElement).appendChild(link);
        _injectedFonts[fontName] = true;
    }

    function getFontName(fontFamily) {
        if (!fontFamily) return null;
        return fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '');
    }

    function applyFont(fontFamily) {
        if (!fontFamily) return;
        var name = getFontName(fontFamily);
        injectGoogleFont(name);
        if (document.documentElement) document.documentElement.style.fontFamily = fontFamily;
        if (document.body) document.body.style.fontFamily = fontFamily;
    }

    function saveAndApply(fontFamily) {
        if (!fontFamily) return;
        localStorage.setItem(FONT_KEY, fontFamily);
        localStorage.setItem(FONT_TS_KEY, Date.now().toString());
        applyFont(fontFamily);
    }

    // Expose globally so profile page and any page can call it
    window.SBFont = {
        apply: applyFont,
        saveAndApply: saveAndApply,
        get: function () { return localStorage.getItem(FONT_KEY); }
    };

    // Apply immediately from cache to avoid FOUT
    var cached = localStorage.getItem(FONT_KEY);
    if (cached) applyFont(cached);

    // Cross-tab sync: when font changes in another tab, apply it here
    window.addEventListener('storage', function (e) {
        if (e.key === FONT_KEY && e.newValue) {
            applyFont(e.newValue);
        }
    });

    // On DOM ready: always re-sync from backend to pick up changes from other devices
    document.addEventListener('DOMContentLoaded', function () {
        // Apply cached immediately
        var local = localStorage.getItem(FONT_KEY);
        if (local) applyFont(local);

        var tok = localStorage.getItem('token');
        if (!tok) return;

        fetch('/student/dashboard', {
            headers: { 'Authorization': 'Bearer ' + tok }
        })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (d) {
                if (!d) return;
                var font = d.student && d.student.preferences && d.student.preferences.fontFamily;
                if (!font) return;
                // Only update localStorage if backend value differs
                var current = localStorage.getItem(FONT_KEY);
                if (font !== current) {
                    localStorage.setItem(FONT_KEY, font);
                    localStorage.setItem(FONT_TS_KEY, Date.now().toString());
                }
                applyFont(font);
            })
            .catch(function () {});
    });
})();
