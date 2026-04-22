(function () {
    if (window.__latexHelperLoaded) return;
    window.__latexHelperLoaded = true;

    const KATEX_CSS = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css';
    const KATEX_JS  = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js';

    const SYMBOLS = [
        { l: 'x²',  v: 'x^{2}' },
        { l: '√',   v: '\\sqrt{x}' },
        { l: 'a/b', v: '\\frac{a}{b}' },
        { l: '∑',   v: '\\sum_{i=1}^{n} i' },
        { l: '∫',   v: '\\int_{a}^{b} f(x)\\,dx' },
        { l: 'lim', v: '\\lim_{x \\to \\infty}' },
        { l: 'π',   v: '\\pi' },
        { l: 'θ',   v: '\\theta' },
        { l: '≤',   v: '\\leq' },
        { l: '≥',   v: '\\geq' },
        { l: '≠',   v: '\\neq' },
        { l: '±',   v: '\\pm' },
        { l: '×',   v: '\\times' },
        { l: '÷',   v: '\\div' },
        { l: '∞',   v: '\\infty' },
        { l: 'sin', v: '\\sin(x)' },
        { l: 'cos', v: '\\cos(x)' },
        { l: 'log', v: '\\log_{10}(x)' },
        { l: 'matrix', v: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}' }
    ];

    const STYLES = `
        #lhFab {
            position: fixed; right: 22px; bottom: 22px; z-index: 9998;
            width: 54px; height: 54px; border-radius: 50%; border: none; cursor: pointer;
            background: linear-gradient(135deg, #1a2a6c, #b21f1f); color: #fff;
            box-shadow: 0 6px 20px rgba(26,42,108,0.35);
            display: flex; align-items: center; justify-content: center;
            font-size: 22px; font-family: 'Cambria Math','Latin Modern Math',serif;
            transition: transform .2s, box-shadow .2s;
        }
        #lhFab:hover { transform: scale(1.06); box-shadow: 0 8px 26px rgba(26,42,108,0.45); }
        #lhFab .lh-tip {
            position: absolute; right: 64px; top: 50%; transform: translateY(-50%);
            background: #1f2937; color: #fff; font-size: 12px; font-weight: 600;
            padding: 6px 10px; border-radius: 6px; white-space: nowrap;
            opacity: 0; pointer-events: none; transition: opacity .2s;
            font-family: 'Inter',sans-serif;
        }
        #lhFab:hover .lh-tip { opacity: 1; }

        #lhOverlay {
            position: fixed; inset: 0; background: rgba(0,0,0,0.5);
            backdrop-filter: blur(4px); z-index: 9999;
            display: none; align-items: flex-end; justify-content: flex-end;
            padding: 18px;
        }
        #lhOverlay.open { display: flex; }
        #lhPanel {
            background: #fff; border-radius: 16px; width: 100%; max-width: 460px;
            max-height: 88vh; overflow: hidden; display: flex; flex-direction: column;
            box-shadow: 0 24px 60px rgba(0,0,0,0.3);
            font-family: 'Inter', sans-serif;
            animation: lhSlideUp .25s ease;
        }
        @keyframes lhSlideUp { from { transform: translateY(20px); opacity: 0; } to { transform: none; opacity: 1; } }
        .lh-head {
            display: flex; align-items: center; justify-content: space-between;
            padding: 14px 18px; background: linear-gradient(135deg, #1a2a6c, #b21f1f); color: #fff;
        }
        .lh-head h3 { font-size: 15px; font-weight: 700; margin: 0; display: flex; align-items: center; gap: 8px; }
        .lh-close { background: rgba(255,255,255,0.2); border: none; color: #fff;
            width: 28px; height: 28px; border-radius: 6px; cursor: pointer; font-size: 16px; }
        .lh-close:hover { background: rgba(255,255,255,0.32); }
        .lh-body { padding: 16px 18px; overflow-y: auto; }
        .lh-label { font-size: 11px; font-weight: 700; color: #4b5563;
            text-transform: uppercase; letter-spacing: .04em; margin-bottom: 6px; display: block; }
        .lh-input {
            width: 100%; min-height: 80px; padding: 10px 12px;
            border: 1.5px solid #d1d5db; border-radius: 10px;
            font-family: 'Menlo','Consolas',monospace; font-size: 13px;
            color: #1f2937; background: #f9fafb; outline: none; resize: vertical;
        }
        .lh-input:focus { border-color: #1a2a6c; background: #fff; }
        .lh-preview {
            min-height: 56px; margin-top: 8px; padding: 14px;
            background: #f9fafb; border: 1.5px dashed #d1d5db;
            border-radius: 10px; overflow-x: auto;
            font-size: 16px; color: #1f2937; text-align: center;
        }
        .lh-preview .lh-err { color: #b91c1c; font-size: 12px; font-family: monospace; }
        .lh-preview .lh-empty { color: #9ca3af; font-size: 12px; font-style: italic; }
        .lh-symbols {
            display: grid; grid-template-columns: repeat(5, 1fr);
            gap: 6px; margin-top: 10px;
        }
        .lh-symbols button {
            padding: 8px 4px; border: 1px solid #e5e7eb; background: #fff;
            border-radius: 8px; cursor: pointer; font-size: 13px; color: #1f2937;
            font-family: 'Cambria Math','Latin Modern Math',serif;
            transition: all .15s;
        }
        .lh-symbols button:hover { background: #eef2ff; border-color: #1a2a6c; color: #1a2a6c; }
        .lh-actions {
            display: flex; gap: 8px; padding: 12px 18px;
            border-top: 1px solid #f3f4f6; background: #fafafa;
        }
        .lh-btn {
            flex: 1; padding: 10px; border: none; border-radius: 8px;
            font-size: 13px; font-weight: 700; cursor: pointer;
            display: inline-flex; align-items: center; justify-content: center; gap: 6px;
            transition: opacity .2s;
        }
        .lh-btn-primary { background: linear-gradient(135deg, #1a2a6c, #b21f1f); color: #fff; }
        .lh-btn-secondary { background: #f3f4f6; color: #374151; }
        .lh-btn:hover { opacity: 0.9; }
        .lh-toast {
            position: fixed; bottom: 90px; right: 22px; z-index: 10000;
            background: #16a34a; color: #fff; padding: 10px 16px;
            border-radius: 8px; font-size: 13px; font-weight: 600;
            box-shadow: 0 4px 14px rgba(0,0,0,0.2);
            opacity: 0; transition: opacity .25s; pointer-events: none;
            font-family: 'Inter',sans-serif;
        }
        .lh-toast.show { opacity: 1; }
        @media (max-width: 520px) {
            #lhOverlay { align-items: flex-end; justify-content: center; padding: 0; }
            #lhPanel { max-width: 100%; border-radius: 16px 16px 0 0; max-height: 80vh; }
            .lh-symbols { grid-template-columns: repeat(4, 1fr); }
        }
    `;

    let katexLoading = null;
    function loadKatex() {
        if (window.katex) return Promise.resolve();
        if (katexLoading) return katexLoading;
        katexLoading = new Promise((resolve, reject) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = KATEX_CSS;
            document.head.appendChild(link);
            const script = document.createElement('script');
            script.src = KATEX_JS;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('KaTeX failed to load'));
            document.head.appendChild(script);
        });
        return katexLoading;
    }

    function buildUI() {
        const style = document.createElement('style');
        style.textContent = STYLES;
        document.head.appendChild(style);

        const fab = document.createElement('button');
        fab.id = 'lhFab';
        fab.title = 'Open math editor';
        fab.innerHTML = '<span style="font-style:italic;">f(x)</span><span class="lh-tip">Math editor</span>';
        document.body.appendChild(fab);

        const overlay = document.createElement('div');
        overlay.id = 'lhOverlay';
        overlay.innerHTML = `
            <div id="lhPanel" role="dialog" aria-label="LaTeX math editor">
                <div class="lh-head">
                    <h3><i class="fas fa-square-root-variable"></i> Math Editor</h3>
                    <button class="lh-close" id="lhClose" title="Close">&times;</button>
                </div>
                <div class="lh-body">
                    <label class="lh-label" for="lhInput">Type LaTeX</label>
                    <textarea id="lhInput" class="lh-input" spellcheck="false" placeholder="e.g.  \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}"></textarea>
                    <label class="lh-label" style="margin-top:14px;">Quick symbols</label>
                    <div class="lh-symbols" id="lhSymbols"></div>
                    <label class="lh-label" style="margin-top:14px;">Live preview</label>
                    <div class="lh-preview" id="lhPreview"><span class="lh-empty">Your rendered math will appear here…</span></div>
                </div>
                <div class="lh-actions">
                    <button class="lh-btn lh-btn-secondary" id="lhCopySrc"><i class="fas fa-code"></i> Copy LaTeX</button>
                    <button class="lh-btn lh-btn-primary" id="lhCopyImg"><i class="fas fa-copy"></i> Copy Rendered</button>
                </div>
            </div>
            <div class="lh-toast" id="lhToast"></div>
        `;
        document.body.appendChild(overlay);

        const symbolsEl = document.getElementById('lhSymbols');
        SYMBOLS.forEach(sym => {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = sym.l;
            b.title = sym.v;
            b.addEventListener('click', () => insertAtCursor(sym.v));
            symbolsEl.appendChild(b);
        });

        fab.addEventListener('click', openPanel);
        document.getElementById('lhClose').addEventListener('click', closePanel);
        overlay.addEventListener('click', e => { if (e.target === overlay) closePanel(); });
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && overlay.classList.contains('open')) closePanel();
        });

        const input = document.getElementById('lhInput');
        let renderTimer = null;
        input.addEventListener('input', () => {
            clearTimeout(renderTimer);
            renderTimer = setTimeout(renderPreview, 120);
        });

        document.getElementById('lhCopySrc').addEventListener('click', () => {
            const src = input.value || '';
            if (!src.trim()) { toast('Nothing to copy', '#dc2626'); return; }
            navigator.clipboard.writeText(src).then(() => toast('LaTeX copied!')).catch(() => toast('Copy failed', '#dc2626'));
        });
        document.getElementById('lhCopyImg').addEventListener('click', () => {
            const html = document.getElementById('lhPreview').innerHTML;
            const src = input.value || '';
            if (!src.trim()) { toast('Nothing to copy', '#dc2626'); return; }
            const blobHtml = new Blob([html], { type: 'text/html' });
            const blobText = new Blob([src], { type: 'text/plain' });
            if (navigator.clipboard && window.ClipboardItem) {
                navigator.clipboard.write([new ClipboardItem({ 'text/html': blobHtml, 'text/plain': blobText })])
                    .then(() => toast('Rendered math copied!'))
                    .catch(() => navigator.clipboard.writeText(src).then(() => toast('LaTeX copied!')));
            } else {
                navigator.clipboard.writeText(src).then(() => toast('LaTeX copied!'));
            }
        });
    }

    function insertAtCursor(text) {
        const input = document.getElementById('lhInput');
        const start = input.selectionStart || 0;
        const end = input.selectionEnd || 0;
        const v = input.value;
        input.value = v.slice(0, start) + text + v.slice(end);
        input.focus();
        input.selectionStart = input.selectionEnd = start + text.length;
        renderPreview();
    }

    function renderPreview() {
        const input = document.getElementById('lhInput');
        const preview = document.getElementById('lhPreview');
        const src = (input.value || '').trim();
        if (!src) {
            preview.innerHTML = '<span class="lh-empty">Your rendered math will appear here…</span>';
            return;
        }
        if (!window.katex) return;
        try {
            preview.innerHTML = '';
            window.katex.render(src, preview, { displayMode: true, throwOnError: false, errorColor: '#b91c1c' });
        } catch (e) {
            preview.innerHTML = '<span class="lh-err">' + (e.message || 'Invalid LaTeX') + '</span>';
        }
    }

    function openPanel() {
        const overlay = document.getElementById('lhOverlay');
        overlay.classList.add('open');
        loadKatex().then(renderPreview).catch(() => {
            document.getElementById('lhPreview').innerHTML = '<span class="lh-err">Could not load math renderer. Check your connection.</span>';
        });
        setTimeout(() => document.getElementById('lhInput').focus(), 50);
    }

    function closePanel() {
        document.getElementById('lhOverlay').classList.remove('open');
    }

    function toast(msg, color) {
        const t = document.getElementById('lhToast');
        t.textContent = msg;
        if (color) t.style.background = color; else t.style.background = '#16a34a';
        t.classList.add('show');
        setTimeout(() => t.classList.remove('show'), 1800);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', buildUI);
    } else {
        buildUI();
    }
})();
