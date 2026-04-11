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
        },
        midnightAcademy: {
            name: 'Midnight Academy',
            description: 'Deep slate with indigo & amber highlights',
            primary: '#0F172A',
            secondary: '#4F46E5',
            gold: '#F59E0B',
            orange: '#1E293B'
        },
        freshMint: {
            name: 'Fresh Mint',
            description: 'Calm emerald greens for long study sessions',
            primary: '#334155',
            secondary: '#059669',
            gold: '#6366F1',
            orange: '#10B981'
        },
        kineticStealth: {
            name: 'Kinetic Stealth',
            description: 'Dark obsidian with electric blue & neo-green',
            primary: '#111827',
            secondary: '#3B82F6',
            gold: '#22C55E',
            orange: '#16A34A'
        },
        deepOrbit: {
            name: 'Deep Orbit',
            description: 'Cosmic midnight navy with solar yellow accents',
            primary: '#0F172A',
            secondary: '#64748B',
            gold: '#FACC15',
            orange: '#F59E0B'
        },
        pastelAcademy: {
            name: 'Pastel Academy',
            description: 'Soft blush & lavender for a calm study vibe',
            primary: '#F472B6',
            secondary: '#A78BFA',
            gold: '#FDE68A',
            orange: '#FDF2F8'
        },
        sunsetOrchid: {
            name: 'Sunset Orchid',
            description: 'Rich royal violet with watermelon & turquoise',
            primary: '#7C3AED',
            secondary: '#FB7185',
            gold: '#2DD4BF',
            orange: '#F0ABFC'
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
