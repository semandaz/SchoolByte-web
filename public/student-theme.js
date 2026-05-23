(function () {
    var THEME_KEY = 'schoolbyte_student_theme';
    var DARK_KEY = 'schoolbyte_dark_mode';

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
        },
        executive: {
            name: 'Executive',
            description: 'Deep midnight navy with royal blue & antique gold',
            primary: '#0A0F1E',
            secondary: '#2563EB',
            gold: '#C9A84C',
            orange: '#1E2A45'
        },
        parchment: {
            name: 'Parchment',
            description: 'Charcoal & warm cognac on a cream academic base',
            primary: '#1F2937',
            secondary: '#9D6B3E',
            gold: '#B5873F',
            orange: '#F9F4EE'
        }
    };

    // ── Dark-mode CSS injected once into every page ──────────────────────────
    var DARK_STYLE_ID = 'sb-dark-mode-styles';
    function injectDarkStyles() {
        if (document.getElementById(DARK_STYLE_ID)) return;
        var style = document.createElement('style');
        style.id = DARK_STYLE_ID;
        style.textContent = [
            'html[data-sb-dark] {',
            '  --color-neutral-white: #1e2235;',
            '  --color-neutral-lightest: #252a40;',
            '  --color-neutral-light: #3a3f5c;',
            '  --color-neutral-medium: #7a80a0;',
            '  --color-neutral-dark: #a8aecb;',
            '  --color-neutral-darkest: #dde0ee;',
            '  --color-success-green: #34d399;',
            '  --color-info-blue: #60a5fa;',
            '  --color-error-red: #f87171;',
            '  color-scheme: dark;',
            '}',
            'html[data-sb-dark] body {',
            '  background: linear-gradient(135deg,#12141f,#1a1f35,#12141f) !important;',
            '  color: #dde0ee !important;',
            '}',
            'html[data-sb-dark] .card,',
            'html[data-sb-dark] .card-content,',
            'html[data-sb-dark] header,',
            'html[data-sb-dark] .modal-content,',
            'html[data-sb-dark] .dropdown-menu,',
            'html[data-sb-dark] .sidebar,',
            'html[data-sb-dark] .nav-panel,',
            'html[data-sb-dark] [class*="panel"] {',
            '  background-color: #1e2235 !important;',
            '  border-color: #3a3f5c !important;',
            '  color: #dde0ee !important;',
            '}',
            'html[data-sb-dark] input,',
            'html[data-sb-dark] select,',
            'html[data-sb-dark] textarea {',
            '  background-color: #252a40 !important;',
            '  color: #dde0ee !important;',
            '  border-color: #3a3f5c !important;',
            '}',
            'html[data-sb-dark] input::placeholder,',
            'html[data-sb-dark] textarea::placeholder { color: #7a80a0 !important; }',
            'html[data-sb-dark] a { color: #93c5fd; }',
            'html[data-sb-dark] a:hover { color: #bfdbfe; }',
            'html[data-sb-dark] table th {',
            '  background-color: #252a40 !important;',
            '  color: #dde0ee !important;',
            '}',
            'html[data-sb-dark] table td {',
            '  background-color: #1e2235 !important;',
            '  color: #dde0ee !important;',
            '  border-color: #3a3f5c !important;',
            '}',
            'html[data-sb-dark] table tr:hover td { background-color: #252a40 !important; }',
            'html[data-sb-dark] .progress { background-color: #3a3f5c !important; }',
            'html[data-sb-dark] .tabs-trigger:not(.active) {',
            '  background-color: #252a40 !important;',
            '  color: #a8aecb !important;',
            '}',
            'html[data-sb-dark] hr,',
            'html[data-sb-dark] .divider { border-color: #3a3f5c !important; }',
            'html[data-sb-dark] .btn-secondary {',
            '  background-color: #252a40 !important;',
            '  color: #dde0ee !important;',
            '  border-color: #3a3f5c !important;',
            '}',
            'html[data-sb-dark] .btn-secondary:hover {',
            '  background-color: #3a3f5c !important;',
            '}',
            'html[data-sb-dark] ::-webkit-scrollbar-track { background: #1e2235 !important; }',
            'html[data-sb-dark] ::-webkit-scrollbar-thumb { background: #3a3f5c !important; }',
        ].join('\n');
        (document.head || document.documentElement).appendChild(style);
    }

    function applyDarkMode(enabled) {
        injectDarkStyles();
        if (enabled) {
            document.documentElement.setAttribute('data-sb-dark', '1');
        } else {
            document.documentElement.removeAttribute('data-sb-dark');
        }
    }

    function getDarkMode() {
        return localStorage.getItem(DARK_KEY) === '1';
    }

    function setDarkMode(enabled) {
        localStorage.setItem(DARK_KEY, enabled ? '1' : '0');
        applyDarkMode(enabled);
    }

    function toggleDarkMode() {
        var next = !getDarkMode();
        setDarkMode(next);
        return next;
    }

    // Apply dark mode immediately on page load (prevents flash)
    if (getDarkMode()) {
        injectDarkStyles();
        document.documentElement.setAttribute('data-sb-dark', '1');
    }

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
        getCurrent: getCurrentTheme,
        getDarkMode: getDarkMode,
        setDarkMode: setDarkMode,
        toggleDarkMode: toggleDarkMode,
    };
})();
