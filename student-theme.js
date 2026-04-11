(function () {
    var THEME_KEY = 'schoolbyte_student_theme';

    var THEMES = {
        default: {
            name: 'SchoolByte Classic',
            description: 'The original blue & maroon palette',
            primary: '#1a2a6c',
            secondary: '#b21111',
            gold: '#FFD700',
            orange: '#FFA500'
        },
        cyber: {
            name: 'Cyber Scholar',
            description: 'Sleek dark tech vibes with neon cyan',
            primary: '#0f172a',
            secondary: '#8b5cf6',
            gold: '#06b6d4',
            orange: '#3b82f6'
        },
        botanical: {
            name: 'Botanical Mind',
            description: 'Calm forest greens for deep focus',
            primary: '#14532d',
            secondary: '#4ade80',
            gold: '#fbbf24',
            orange: '#d97706'
        },
        supernova: {
            name: 'Supernova',
            description: 'High-energy indigo & coral for gamers',
            primary: '#6366f1',
            secondary: '#f43f5e',
            gold: '#fde047',
            orange: '#f97316'
        }
    };

    function applyTheme(themeName) {
        var theme = THEMES[themeName] || THEMES['default'];
        var root = document.documentElement;
        root.style.setProperty('--color-brand-primary', theme.primary);
        root.style.setProperty('--color-brand-secondary', theme.secondary);
        root.style.setProperty('--color-brand-gold', theme.gold);
        root.style.setProperty('--color-brand-orange', theme.orange);
        localStorage.setItem(THEME_KEY, themeName);
    }

    function getCurrentTheme() {
        return localStorage.getItem(THEME_KEY) || 'default';
    }

    applyTheme(getCurrentTheme());

    window.SchoolByteTheme = {
        themes: THEMES,
        apply: applyTheme,
        getCurrent: getCurrentTheme
    };
})();
