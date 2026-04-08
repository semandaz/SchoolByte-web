(function () {
    var FONT_KEY = 'sb_preferred_font';
    var STYLE_ID = 'sb-font-override';

    var FONT_GOOGLE_MAP = {
        'Inter':                 'family=Inter:wght@400;600;700;800',
        'Roboto':                'family=Roboto:wght@400;500;700',
        'Open Sans':             'family=Open+Sans:wght@400;600;700',
        'Lato':                  'family=Lato:wght@400;700',
        'Montserrat':            'family=Montserrat:wght@400;600;700',
        'Poppins':               'family=Poppins:wght@400;600;700',
        'Nunito Sans':           'family=Nunito+Sans:wght@400;700',
        'Ubuntu':                'family=Ubuntu:wght@400;700',
        'Merriweather':          'family=Merriweather:wght@400;700',
        'Playfair Display':      'family=Playfair+Display:wght@400;700',
        'Space Mono':            'family=Space+Mono',
        'Dancing Script':        'family=Dancing+Script:wght@400;700;900',
        'Satisfy':               'family=Satisfy',
        'Atkinson Hyperlegible': 'family=Atkinson+Hyperlegible:wght@400;700',
        'Oswald':                'family=Oswald:wght@400;700',
        'Lora':                  'family=Lora:wght@400;700',
        'PT Sans':               'family=PT+Sans:wght@400;700',
        'Source Sans Pro':       'family=Source+Sans+3:wght@400;700',
        'Fira Sans':             'family=Fira+Sans:wght@400;700',
        'Quicksand':             'family=Quicksand:wght@400;700',
    };

    var _loadedFonts = {};

    function getFontName(fontFamily) {
        if (!fontFamily) return null;
        return fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '');
    }

    function injectGoogleFont(fontName) {
        if (!fontName || _loadedFonts[fontName]) return;
        var param = FONT_GOOGLE_MAP[fontName];
        if (!param) return;
        var href = 'https://fonts.googleapis.com/css2?' + param + '&display=swap';
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        (document.head || document.documentElement).appendChild(link);
        _loadedFonts[fontName] = true;
    }

    function applyFont(fontFamily) {
        if (!fontFamily) return;
        var name = getFontName(fontFamily);

        // Load the Google Font CSS so the browser can render it
        injectGoogleFont(name);

        // Inject (or update) a <style> tag that uses !important to beat any
        // * { font-family: ... } or specific class rules on this page.
        var styleEl = document.getElementById(STYLE_ID);
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = STYLE_ID;
            (document.head || document.documentElement).appendChild(styleEl);
        }
        // Apply to all elements but NOT ::before/::after pseudo-elements (those are used by
        // Font Awesome icons). Then explicitly restore Font Awesome font families.
        var weightBoost = name === 'Dancing Script' ? 'html, body, * { font-weight: 700 !important; } ' : '';
        styleEl.textContent =
            'html, body, * { font-family: ' + fontFamily + ' !important; }' + weightBoost +
            '.fa, .fas, .far, .fal, .fad, .fass, .fasr, .fat,' +
            ' i[class*="fa-"], span[class*="fa-"] { font-family: "Font Awesome 6 Free" !important; }' +
            '.fab, i.fab, span.fab { font-family: "Font Awesome 6 Brands" !important; }' +
            '.fa, .fas, .far, .fal, .fad, .fass, .fasr, .fat,' +
            ' i[class*="fa-"], span[class*="fa-"],' +
            '.fab, i.fab, span.fab { -webkit-font-smoothing: antialiased; font-style: normal; }';
    }

    function saveAndApply(fontFamily) {
        if (!fontFamily) return;
        localStorage.setItem(FONT_KEY, fontFamily);
        applyFont(fontFamily);
    }

    // Expose globally so any page can call SBFont.saveAndApply(font)
    window.SBFont = {
        apply: applyFont,
        saveAndApply: saveAndApply,
        get: function () { return localStorage.getItem(FONT_KEY); }
    };

    // Apply immediately from localStorage cache (works even in <head> before body exists)
    var cached = localStorage.getItem(FONT_KEY);
    if (cached) applyFont(cached);

    // Cross-tab sync: another tab changed the font — apply instantly here too
    window.addEventListener('storage', function (e) {
        if (e.key === FONT_KEY && e.newValue) {
            applyFont(e.newValue);
        }
    });

    // On DOM ready: re-check cache and also sync from the backend
    document.addEventListener('DOMContentLoaded', function () {
        // Re-apply in case the DOM wasn't ready when the IIFE ran
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
                // Sync to localStorage if different (e.g. changed on another device)
                if (font !== localStorage.getItem(FONT_KEY)) {
                    localStorage.setItem(FONT_KEY, font);
                }
                applyFont(font);
            })
            .catch(function () {});
    });
})();
