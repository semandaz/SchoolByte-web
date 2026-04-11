// Floating Icons Module — Fixed & Fully Functional
(function () {
    'use strict';

    const token = localStorage.getItem('token');
    if (!token) return;

    if (window.floatingIconsInitialized) return;
    window.floatingIconsInitialized = true;

    /* ── Apply preferred font from localStorage ──────────────────────────── */
    (function applyFont() {
        const f = localStorage.getItem("sb_preferred_font");
        if (f) document.body.style.fontFamily = f;
    })();

    /* ── Styles ──────────────────────────────────────────────────────────── */
    const style = document.createElement('style');
    style.textContent = `
        #floating-icons-container {
            position: fixed;
            top: 0; left: 0;
            pointer-events: none;
            z-index: 9998;
        }
        .fi-icon {
            position: fixed;
            width: 56px;
            height: 56px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: grab;
            pointer-events: all;
            box-shadow: 0 6px 24px rgba(0,0,0,.30);
            transition: transform .25s ease, box-shadow .25s ease;
            font-size: 21px;
            color: #fff;
            user-select: none;
            touch-action: none;
            border: 3px solid rgba(255,255,255,.18);
        }
        .fi-icon:hover  { transform: scale(1.14) rotate(4deg); box-shadow: 0 10px 30px rgba(0,0,0,.38); }
        .fi-icon:active { cursor: grabbing; }
        .fi-icon.dragging { opacity: .88; z-index: 10001; transition: none; }

        .fi-icon.fi-notifications { background: linear-gradient(135deg,#1a2a6c,#b21f1f); }
        .fi-icon.fi-ai-buddy      { background: linear-gradient(135deg,#6366f1,#1a2a6c); }
        .fi-icon.fi-counselling   { background: linear-gradient(135deg,#10b981,#059669); }
        .fi-icon.fi-career        { background: linear-gradient(135deg,#ffd700,#ffa500); }
        .fi-icon.fi-bytenexus     { background: linear-gradient(135deg,#b21f1f,#7f1313); }
        .fi-icon.fi-themes        { background: linear-gradient(135deg,#7c3aed,#f59e0b); }

        /* ── Theme picker grid (inside modal) ── */
        .fi-theme-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(138px, 1fr));
            gap: 10px;
            margin-top: 6px;
        }
        .fi-theme-swatch {
            border-radius: 10px;
            overflow: hidden;
            cursor: pointer;
            border: 3px solid transparent;
            transition: border-color .2s, transform .2s, box-shadow .2s;
            box-shadow: 0 2px 8px rgba(0,0,0,.10);
        }
        .fi-theme-swatch:hover  { transform: translateY(-3px); box-shadow: 0 6px 18px rgba(0,0,0,.15); }
        .fi-theme-swatch.active { border-color: #f59e0b; }
        .fi-theme-preview {
            height: 52px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 7px;
        }
        .fi-theme-info { background: #fff; padding: 8px 10px; }
        .fi-theme-name { font-size: .78rem; font-weight: 700; color: #1f2937; margin-bottom: 2px; }
        .fi-theme-desc { font-size: .68rem; color: #6b7280; line-height: 1.3; }

        /* notification badge */
        .fi-icon.fi-notifications.has-notifs::after {
            content: '';
            position: absolute;
            top: 2px; right: 2px;
            width: 14px; height: 14px;
            background: #ffd700;
            border-radius: 50%;
            border: 2px solid #fff;
            animation: fi-pulse 2s infinite;
        }
        @keyframes fi-pulse {
            0%,100% { transform: scale(1);   opacity: 1; }
            50%      { transform: scale(1.2); opacity: .8; }
        }

        /* tooltip */
        .fi-tooltip {
            position: absolute;
            left: 64px;
            top: 50%;
            transform: translateY(-50%);
            background: rgba(30,30,60,.92);
            color: #fff;
            padding: 7px 13px;
            border-radius: 10px;
            font-size: 12px;
            font-weight: 600;
            white-space: nowrap;
            opacity: 0;
            visibility: hidden;
            transition: opacity .25s, visibility .25s;
            pointer-events: none;
            backdrop-filter: blur(6px);
            border: 1px solid rgba(255,255,255,.12);
        }
        .fi-icon:hover .fi-tooltip { opacity: 1; visibility: visible; }

        /* ── Overlay ── */
        .fi-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,.55);
            backdrop-filter: blur(6px);
            z-index: 10001;
            opacity: 0;
            visibility: hidden;
            transition: opacity .35s, visibility .35s;
        }
        .fi-overlay.active { opacity: 1; visibility: visible; }

        /* ── Modal base ── */
        .fi-modal {
            position: fixed;
            top: 50%; left: 50%;
            transform: translate(-50%,-50%) scale(.92);
            width: min(92vw, 500px);
            max-height: 82vh;
            background: #fff;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,.30);
            z-index: 10002;
            opacity: 0;
            visibility: hidden;
            transition: opacity .35s cubic-bezier(.25,.46,.45,.94),
                        transform .35s cubic-bezier(.25,.46,.45,.94),
                        visibility .35s;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        .fi-modal.active {
            opacity: 1;
            visibility: visible;
            transform: translate(-50%,-50%) scale(1);
        }

        /* modal header */
        .fi-modal-header {
            background: linear-gradient(135deg,#1a2a6c,#b21f1f);
            color: #fff;
            padding: 18px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-shrink: 0;
        }
        .fi-modal-header::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0;
            height: 3px;
            background: linear-gradient(90deg,#ffd700,#ffa500);
        }
        .fi-modal-header h3 {
            margin: 0;
            font-size: 1.15rem;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 9px;
        }
        .fi-modal-header h3 i { color: #ffd700; }
        .fi-close-btn {
            background: rgba(255,255,255,.2);
            border: none;
            color: #fff;
            width: 34px; height: 34px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            font-size: 1rem;
            transition: background .2s, transform .25s;
        }
        .fi-close-btn:hover { background: rgba(255,255,255,.32); transform: rotate(90deg); }

        /* modal body */
        .fi-modal-body {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            background: #f5f7fb;
        }

        /* ── Notification feed ── */
        .fi-notif-item {
            background: #fff;
            border-radius: 12px;
            padding: 13px 40px 13px 13px;
            margin-bottom: 10px;
            border-left: 4px solid #1a2a6c;
            box-shadow: 0 2px 10px rgba(0,0,0,.06);
            position: relative;
            animation: fi-slideup .35s ease;
        }
        @keyframes fi-slideup {
            from { transform: translateY(12px); opacity: 0; }
            to   { transform: translateY(0);    opacity: 1; }
        }
        .fi-notif-icon { color: #1a2a6c; margin-right: 8px; font-size: 1rem; }
        .fi-notif-text { font-size: .88rem; color: #374151; line-height: 1.5; font-weight: 500; }
        .fi-notif-time { font-size: .75rem; color: #9ca3af; margin-top: 4px; font-weight: 600; }
        .fi-notif-dismiss {
            position: absolute;
            top: 10px; right: 10px;
            background: #f3f4f6;
            border: none;
            color: #6b7280;
            width: 24px; height: 24px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            font-size: .75rem;
            transition: background .2s, color .2s;
        }
        .fi-notif-dismiss:hover { background: #e74c3c; color: #fff; }
        .fi-empty {
            text-align: center;
            color: #9ca3af;
            padding: 36px 20px;
            font-style: italic;
        }

        /* notif footer */
        .fi-notif-footer {
            padding: 14px 20px;
            border-top: 1px solid #e5e7eb;
            background: #fff;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-shrink: 0;
        }
        .fi-count-badge {
            background: linear-gradient(135deg,#1a2a6c,#b21f1f);
            color: #fff;
            border-radius: 14px;
            padding: 5px 12px;
            font-size: .8rem;
            font-weight: 700;
        }
        .fi-clear-btn {
            background: #e74c3c;
            color: #fff;
            border: none;
            padding: 7px 15px;
            border-radius: 18px;
            cursor: pointer;
            font-size: .82rem;
            font-weight: 600;
            transition: background .2s, transform .2s;
            display: flex;
            align-items: center;
            gap: 5px;
        }
        .fi-clear-btn:hover { background: #c0392b; transform: translateY(-1px); }

        /* ── AI Chat ── */
        .fi-ai-messages {
            display: flex;
            flex-direction: column;
            gap: 12px;
            min-height: 260px;
            max-height: 360px;
            overflow-y: auto;
            padding: 16px;
            background: #f8f9fc;
        }
        .fi-ai-input-row {
            padding: 12px 16px;
            border-top: 1px solid #e5e7eb;
            background: #fff;
            display: flex;
            gap: 8px;
            align-items: center;
            flex-shrink: 0;
        }
        .fi-ai-input {
            flex: 1;
            padding: 10px 14px;
            border: 2px solid #e5e7eb;
            border-radius: 24px;
            font-size: .875rem;
            outline: none;
            transition: border-color .2s;
            font-family: inherit;
        }
        .fi-ai-input:focus { border-color: #6366f1; }
        .fi-ai-send {
            width: 40px; height: 40px;
            border-radius: 50%;
            background: linear-gradient(135deg,#6366f1,#818cf8);
            border: none;
            color: #fff;
            font-size: 15px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            transition: opacity .2s;
        }
        .fi-ai-send:disabled { opacity: .45; cursor: not-allowed; }

        /* ── Career & Counselling cards ── */
        .fi-card-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-top: 14px;
        }
        .fi-card {
            background: #fff;
            border: 2px solid transparent;
            border-radius: 12px;
            padding: 16px 12px;
            text-align: center;
            cursor: pointer;
            transition: border-color .25s, transform .25s, box-shadow .25s;
        }
        .fi-card:hover {
            border-color: #1a2a6c;
            transform: translateY(-3px);
            box-shadow: 0 6px 18px rgba(0,0,0,.1);
        }
        .fi-card-icon { font-size: 2rem; color: #1a2a6c; margin-bottom: 8px; }
        .fi-card-label { font-size: .85rem; font-weight: 600; color: #374151; }

        .fi-list { display: flex; flex-direction: column; gap: 12px; margin-top: 14px; }
        .fi-list-item {
            background: #fff;
            border-left: 4px solid #10b981;
            border-radius: 10px;
            padding: 16px;
            cursor: pointer;
            transition: transform .25s, box-shadow .25s;
        }
        .fi-list-item:hover { transform: translateX(4px); box-shadow: 0 4px 14px rgba(0,0,0,.09); }
        .fi-list-item h4 { margin: 0 0 4px; color: #1a2a6c; font-size: .95rem; }
        .fi-list-item p  { margin: 0; color: #6b7280; font-size: .82rem; }

        @media (max-width: 600px) {
            .fi-icon { width: 50px; height: 50px; font-size: 18px; }
            .fi-tooltip { left: 58px; }
            .fi-card-grid { grid-template-columns: 1fr; }
        }

        /* ── ByteNexus PiP ──────────────────────────────────────────────────── */
        #bn-pip {
            position: fixed;
            bottom: 24px; right: 24px;
            width: 360px; height: 520px;
            background: #111827;
            border: 1px solid rgba(178,31,31,0.5);
            border-radius: 16px;
            z-index: 10100;
            display: flex;
            flex-direction: column;
            box-shadow: 0 20px 60px rgba(0,0,0,.6);
            overflow: hidden;
            transition: all 0.3s cubic-bezier(.4,0,.2,1);
        }
        #bn-pip.hidden { display: none !important; }
        #bn-pip-bar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 14px;
            background: linear-gradient(135deg,#b21f1f,#7f1313);
            flex-shrink: 0;
        }
        #bn-pip-bar span {
            color: #fff;
            font-weight: 700;
            font-size: 0.9rem;
            display: flex;
            align-items: center;
            gap: 7px;
        }
        #bn-pip-bar .pip-controls {
            display: flex;
            gap: 6px;
        }
        #bn-pip-bar .pip-controls button {
            background: rgba(255,255,255,0.15);
            border: none;
            color: #fff;
            width: 28px; height: 28px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 0.85rem;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s;
        }
        #bn-pip-bar .pip-controls button:hover { background: rgba(255,255,255,0.28); }
        #bn-pip iframe {
            flex: 1;
            border: none;
            width: 100%;
            height: 100%;
        }

    `;
    document.head.appendChild(style);

    /* ── Container ───────────────────────────────────────────────────────── */
    const container = document.createElement('div');
    container.id = 'floating-icons-container';
    document.body.appendChild(container);

    /* ── Overlay ─────────────────────────────────────────────────────────── */
    const overlay = document.createElement('div');
    overlay.className = 'fi-overlay';
    document.body.appendChild(overlay);

    /* ── Icons config ────────────────────────────────────────────────────── */
    const iconsConfig = [
        { id: 'fi-notifications', cls: 'fi-notifications', icon: 'fas fa-bell',     tip: 'Notifications',    defaultLeft: 18, defaultTop: 120 },
        { id: 'fi-ai-buddy',      cls: 'fi-ai-buddy',      icon: 'fas fa-robot',    tip: 'AI Study Buddy',   defaultLeft: 18, defaultTop: 196 },
        { id: 'fi-counselling',   cls: 'fi-counselling',   icon: 'fas fa-heart',    tip: 'Counselling',      defaultLeft: 18, defaultTop: 272 },
        { id: 'fi-career',        cls: 'fi-career',        icon: 'fas fa-briefcase',tip: 'Career Guidance',  defaultLeft: 18, defaultTop: 348 },
        { id: 'fi-bytenexus',     cls: 'fi-bytenexus',     icon: 'fas fa-comments', tip: 'ByteNexus Chat',   defaultLeft: 18, defaultTop: 424 },
        { id: 'fi-themes',        cls: 'fi-themes',        icon: 'fas fa-palette',  tip: 'Change Theme',     defaultLeft: 18, defaultTop: 500 }
    ];

    const savedPositions = (() => {
        try { return JSON.parse(localStorage.getItem('floatingIconsPositions') || '{}'); }
        catch (e) { return {}; }
    })();

    function savePositions() {
        localStorage.setItem('floatingIconsPositions', JSON.stringify(savedPositions));
    }

    /* ── Drag logic ──────────────────────────────────────────────────────── */
    function makeDraggable(el) {
        let startX, startY, origLeft, origTop;
        let dragging = false;
        let dragTimer;

        function onDown(cx, cy) {
            startX = cx; startY = cy;
            origLeft = el.offsetLeft;
            origTop  = el.offsetTop;
            dragging = false;
            dragTimer = setTimeout(() => { dragging = true; el.classList.add('dragging'); }, 120);
        }
        function onMove(cx, cy) {
            if (!dragging) return;
            const nx = origLeft + (cx - startX);
            const ny = origTop  + (cy - startY);
            const maxX = window.innerWidth  - el.offsetWidth;
            const maxY = window.innerHeight - el.offsetHeight;
            el.style.left = Math.max(0, Math.min(nx, maxX)) + 'px';
            el.style.top  = Math.max(0, Math.min(ny, maxY)) + 'px';
            el.style.right = 'auto';
        }
        function onUp() {
            clearTimeout(dragTimer);
            el.classList.remove('dragging');
            if (dragging) {
                savedPositions[el.id] = { x: el.offsetLeft, y: el.offsetTop };
                savePositions();
            }
            dragging = false;
        }

        el.addEventListener('mousedown', e => {
            if (e.button !== 0) return;
            e.preventDefault();
            onDown(e.clientX, e.clientY);
            const mm = e2 => onMove(e2.clientX, e2.clientY);
            const mu = () => { onUp(); document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu); };
            document.addEventListener('mousemove', mm);
            document.addEventListener('mouseup', mu);
        });

        el.addEventListener('touchstart', e => {
            e.preventDefault();
            const t = e.touches[0];
            onDown(t.clientX, t.clientY);
            const tm = e2 => { const t2 = e2.touches[0]; onMove(t2.clientX, t2.clientY); };
            const tu = () => { onUp(); document.removeEventListener('touchmove', tm); document.removeEventListener('touchend', tu); };
            document.addEventListener('touchmove', tm, { passive: false });
            document.addEventListener('touchend', tu);
        }, { passive: false });
    }

    /* ── Build icons ─────────────────────────────────────────────────────── */
    iconsConfig.forEach(cfg => {
        const el = document.createElement('div');
        el.className = `fi-icon ${cfg.cls}`;
        el.id = cfg.id;
        el.innerHTML = `<i class="${cfg.icon}"></i><span class="fi-tooltip">${cfg.tip}</span>`;

        const pos = savedPositions[cfg.id];
        el.style.left = (pos ? pos.x : cfg.defaultLeft) + 'px';
        el.style.top  = (pos ? pos.y : cfg.defaultTop)  + 'px';

        container.appendChild(el);
        makeDraggable(el);
    });

    /* ── Modals ──────────────────────────────────────────────────────────── */
    let currentModal = null;

    function openModal(modal) {
        if (currentModal && currentModal !== modal) closeModal();
        currentModal = modal;
        modal.classList.add('active');
        overlay.classList.add('active');
    }

    function closeModal() {
        if (currentModal) { currentModal.classList.remove('active'); currentModal = null; }
        overlay.classList.remove('active');
    }

    overlay.addEventListener('click', closeModal);

    function makeModal(id, headerHTML, bodyHTML, footerHTML) {
        const m = document.createElement('div');
        m.className = 'fi-modal';
        m.id = id;
        m.innerHTML = `
            <div class="fi-modal-header" style="position:relative;">
                <h3>${headerHTML}</h3>
                <button class="fi-close-btn"><i class="fas fa-times"></i></button>
            </div>
            <div class="fi-modal-body">${bodyHTML}</div>
            ${footerHTML ? `<div class="fi-notif-footer">${footerHTML}</div>` : ''}
        `;
        m.querySelector('.fi-close-btn').addEventListener('click', closeModal);
        document.body.appendChild(m);
        return m;
    }

    /* ── Notifications modal ─────────────────────────────────────────────── */
    const notifModal = document.createElement('div');
    notifModal.className = 'fi-modal';
    notifModal.id = 'fi-notif-modal';
    notifModal.innerHTML = `
        <div class="fi-modal-header" style="position:relative;">
            <h3><i class="fas fa-bell"></i> Notifications</h3>
            <button class="fi-close-btn"><i class="fas fa-times"></i></button>
        </div>
        <div class="fi-modal-body" id="fi-notif-body">
            <div class="fi-empty"><i class="fas fa-bell-slash"></i><br>No notifications yet</div>
        </div>
        <div class="fi-notif-footer">
            <span class="fi-count-badge" id="fi-notif-count">0 notifications</span>
            <button class="fi-clear-btn" id="fi-clear-all-btn"><i class="fas fa-check-double"></i> Mark All Read</button>
        </div>
    `;
    notifModal.querySelector('.fi-close-btn').addEventListener('click', closeModal);
    document.body.appendChild(notifModal);

    const notifBody    = document.getElementById('fi-notif-body');
    const notifCount   = document.getElementById('fi-notif-count');
    const clearAllBtn  = document.getElementById('fi-clear-all-btn');
    const notifBell    = document.getElementById('fi-notifications');

    let notifications = [];

    function getIconForType(type) {
        const map = { coin:'fas fa-coins', quiz:'fas fa-question-circle', game:'fas fa-gamepad', info:'fas fa-info-circle', welcome:'fas fa-handshake', activity:'fas fa-running' };
        return map[type] || 'fas fa-bell';
    }

    function renderNotifications() {
        const unread = notifications.filter(n => !n.isRead);
        notifCount.textContent = `${unread.length} notification${unread.length !== 1 ? 's' : ''}`;

        if (unread.length > 0) {
            notifBell.classList.add('has-notifs');
        } else {
            notifBell.classList.remove('has-notifs');
        }

        if (notifications.length === 0) {
            notifBody.innerHTML = '<div class="fi-empty"><i class="fas fa-bell-slash"></i><br>No notifications yet</div>';
            return;
        }

        notifBody.innerHTML = notifications.map(n => `
            <div class="fi-notif-item" data-id="${n._id}" style="opacity:${n.isRead ? .55 : 1};">
                <i class="${getIconForType(n.type)} fi-notif-icon"></i>
                <span class="fi-notif-text">${n.message}</span>
                <div class="fi-notif-time">${new Date(n.createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div>
                ${!n.isRead ? `<button class="fi-notif-dismiss" data-id="${n._id}" title="Mark as read"><i class="fas fa-check"></i></button>` : ''}
            </div>
        `).join('');

        notifBody.querySelectorAll('.fi-notif-dismiss').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                markNotificationRead(btn.dataset.id);
            });
        });
    }

    async function fetchNotifications() {
        try {
            const res = await fetch('/api/notifications', { headers: { 'Authorization': 'Bearer ' + token } });
            if (!res.ok) return;
            const data = await res.json();
            notifications = data.notifications || [];
            renderNotifications();
        } catch (e) {
            console.error('Error fetching notifications:', e);
        }
    }

    async function markNotificationRead(id) {
        try {
            const res = await fetch(`/api/notifications/${id}/read`, {
                method: 'PATCH',
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (!res.ok) return;
            const n = notifications.find(x => x._id === id);
            if (n) n.isRead = true;
            renderNotifications();
        } catch (e) {
            console.error('Error marking notification:', e);
        }
    }

    async function markAllRead() {
        try {
            const res = await fetch('/api/notifications/mark-all-read', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (!res.ok) return;
            notifications.forEach(n => { n.isRead = true; });
            renderNotifications();
        } catch (e) {
            console.error('Error marking all read:', e);
        }
    }

    clearAllBtn.addEventListener('click', markAllRead);

    document.getElementById('fi-notifications').addEventListener('click', e => {
        if (e.currentTarget.classList.contains('dragging')) return;
        openModal(notifModal);
        fetchNotifications();
    });

    /* ── AI Study Buddy modal ────────────────────────────────────────────── */
    const aiModal = document.createElement('div');
    aiModal.className = 'fi-modal';
    aiModal.id = 'fi-ai-modal';
    aiModal.style.maxWidth = '520px';
    aiModal.innerHTML = `
        <div class="fi-modal-header" style="position:relative;">
            <h3><i class="fas fa-robot"></i> AI Study Buddy</h3>
            <button class="fi-close-btn"><i class="fas fa-times"></i></button>
        </div>
        <div class="fi-ai-messages" id="fi-ai-messages">
            <div style="display:flex;align-items:flex-start;gap:10px;">
                <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#818cf8);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                    <i class="fas fa-robot" style="color:#fff;font-size:13px;"></i>
                </div>
                <div style="background:#fff;border-radius:0 12px 12px 12px;padding:10px 14px;box-shadow:0 1px 4px rgba(0,0,0,.08);max-width:85%;font-size:.875rem;line-height:1.5;color:#374151;">
                    Hi! I'm your AI Study Buddy powered by Groq. Ask me anything about your subjects, homework, or concepts you want to understand better!
                </div>
            </div>
        </div>
        <div class="fi-ai-input-row">
            <input type="text" class="fi-ai-input" id="fi-ai-input" placeholder="Ask a question..." autocomplete="off">
            <button class="fi-ai-send" id="fi-ai-send"><i class="fas fa-paper-plane"></i></button>
        </div>
    `;
    aiModal.querySelector('.fi-close-btn').addEventListener('click', closeModal);
    document.body.appendChild(aiModal);

    const aiMessages = document.getElementById('fi-ai-messages');
    const aiInput    = document.getElementById('fi-ai-input');
    const aiSendBtn  = document.getElementById('fi-ai-send');

    let aiContext = null;

    async function sendAIMessage() {
        const question = aiInput.value.trim();
        if (!question) return;

        // User bubble
        const userRow = document.createElement('div');
        userRow.style.cssText = 'display:flex;justify-content:flex-end;';
        userRow.innerHTML = `<div style="background:linear-gradient(135deg,#6366f1,#818cf8);color:#fff;border-radius:12px 0 12px 12px;padding:10px 14px;max-width:85%;font-size:.875rem;line-height:1.5;">${question.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>`;
        aiMessages.appendChild(userRow);
        aiMessages.scrollTop = aiMessages.scrollHeight;

        aiInput.value = '';
        aiInput.disabled = true;
        aiSendBtn.disabled = true;

        // Typing indicator
        const typingRow = document.createElement('div');
        typingRow.style.cssText = 'display:flex;align-items:flex-start;gap:10px;';
        typingRow.innerHTML = `
            <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#818cf8);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <i class="fas fa-robot" style="color:#fff;font-size:13px;"></i>
            </div>
            <div style="background:#fff;border-radius:0 12px 12px 12px;padding:10px 14px;box-shadow:0 1px 4px rgba(0,0,0,.08);display:flex;gap:5px;align-items:center;">
                <span style="width:7px;height:7px;border-radius:50%;background:#6366f1;animation:fi-bounce 1s infinite 0s;display:inline-block;"></span>
                <span style="width:7px;height:7px;border-radius:50%;background:#6366f1;animation:fi-bounce 1s infinite .15s;display:inline-block;"></span>
                <span style="width:7px;height:7px;border-radius:50%;background:#6366f1;animation:fi-bounce 1s infinite .3s;display:inline-block;"></span>
            </div>`;

        if (!document.getElementById('fi-bounce-style')) {
            const bs = document.createElement('style');
            bs.id = 'fi-bounce-style';
            bs.textContent = '@keyframes fi-bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}';
            document.head.appendChild(bs);
        }

        aiMessages.appendChild(typingRow);
        aiMessages.scrollTop = aiMessages.scrollHeight;

        try {
            const res = await fetch('/api/ai-buddy/chat', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: question, context: aiContext || null })
            });

            if (!res.ok || !res.body) {
                let err = 'Failed to get AI response';
                try { const d = await res.json(); err = d.error || err; } catch(ex) {}
                throw new Error(err);
            }

            // Build AI reply bubble (replacing typing indicator)
            const aiRow = document.createElement('div');
            aiRow.style.cssText = 'display:flex;align-items:flex-start;gap:10px;';
            aiRow.innerHTML = `
                <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#818cf8);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                    <i class="fas fa-robot" style="color:#fff;font-size:13px;"></i>
                </div>
                <div class="fi-ai-resp" style="background:#fff;border-radius:0 12px 12px 12px;padding:10px 14px;box-shadow:0 1px 4px rgba(0,0,0,.08);max-width:85%;font-size:.875rem;line-height:1.6;color:#374151;white-space:pre-wrap;word-break:break-word;"></div>
            `;
            typingRow.replaceWith(aiRow);
            const respEl = aiRow.querySelector('.fi-ai-resp');

            // Stream reading
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buf = '', fullText = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buf += decoder.decode(value, { stream: true });
                const lines = buf.split('\n');
                buf = lines.pop();
                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const json = line.slice(6).trim();
                    if (!json) continue;
                    try {
                        const parsed = JSON.parse(json);
                        if (parsed.error) { respEl.textContent = parsed.error; break; }
                        if (parsed.token) { fullText += parsed.token; respEl.textContent = fullText; aiMessages.scrollTop = aiMessages.scrollHeight; }
                        if (parsed.done) break;
                    } catch (ex) {}
                }
            }

            if (!fullText) respEl.textContent = 'Sorry, I could not generate a response. Please try again.';

        } catch (err) {
            console.error('AI chat error:', err);
            typingRow.remove();
            const errRow = document.createElement('div');
            errRow.style.cssText = 'display:flex;align-items:flex-start;gap:10px;';
            errRow.innerHTML = `
                <div style="width:32px;height:32px;border-radius:50%;background:#ef4444;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                    <i class="fas fa-robot" style="color:#fff;font-size:13px;"></i>
                </div>
                <div style="background:#fef2f2;border-radius:0 12px 12px 12px;padding:10px 14px;max-width:85%;font-size:.875rem;color:#991b1b;">${err.message || 'Something went wrong. Please try again.'}</div>
            `;
            aiMessages.appendChild(errRow);
        } finally {
            aiInput.disabled = false;
            aiSendBtn.disabled = false;
            aiInput.focus();
            aiMessages.scrollTop = aiMessages.scrollHeight;
        }
    }

    aiSendBtn.addEventListener('click', sendAIMessage);
    aiInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAIMessage(); } });

    function openAIBuddy(contextType, contextLabel) {
        aiContext = contextType ? { type: contextType, topic: contextType } : null;
        const h3 = aiModal.querySelector('.fi-modal-header h3');
        if (contextType === 'career')      h3.innerHTML = '<i class="fas fa-briefcase"></i> Career Advisor · ' + contextLabel;
        else if (contextType === 'counselling') h3.innerHTML = '<i class="fas fa-heart"></i> ' + contextLabel;
        else                               h3.innerHTML = '<i class="fas fa-robot"></i> AI Study Buddy';
        if (contextLabel && contextType)   aiInput.placeholder = 'Ask about ' + contextLabel + '...';
        else                               aiInput.placeholder = 'Ask a question...';
        openModal(aiModal);
    }

    document.getElementById('fi-ai-buddy').addEventListener('click', e => {
        if (e.currentTarget.classList.contains('dragging')) return;
        openAIBuddy(null, null);
    });

    /* ── Career Guidance modal ───────────────────────────────────────────── */
    const careerModal = makeModal(
        'fi-career-modal',
        '<i class="fas fa-briefcase"></i> Career Guidance',
        `<p style="color:#6b7280;font-size:.9rem;">Explore career paths that match your interests and strengths!</p>
        <div class="fi-card-grid">
            <div class="fi-card" data-career="stem">
                <div class="fi-card-icon"><i class="fas fa-atom"></i></div>
                <div class="fi-card-label">STEM Careers</div>
            </div>
            <div class="fi-card" data-career="arts">
                <div class="fi-card-icon"><i class="fas fa-palette"></i></div>
                <div class="fi-card-label">Arts & Design</div>
            </div>
            <div class="fi-card" data-career="business">
                <div class="fi-card-icon"><i class="fas fa-chart-line"></i></div>
                <div class="fi-card-label">Business</div>
            </div>
            <div class="fi-card" data-career="health">
                <div class="fi-card-icon"><i class="fas fa-heartbeat"></i></div>
                <div class="fi-card-label">Healthcare</div>
            </div>
        </div>`,
        null
    );

    const careerLabels = { stem: 'Science, Technology, Engineering & Mathematics', arts: 'Arts & Creative Careers', business: 'Business & Entrepreneurship', health: 'Healthcare & Medicine' };
    careerModal.querySelectorAll('.fi-card').forEach(card => {
        card.addEventListener('click', () => {
            const career = card.dataset.career;
            closeModal();
            setTimeout(() => openAIBuddy('career', careerLabels[career] || career), 200);
        });
    });

    document.getElementById('fi-career').addEventListener('click', e => {
        if (e.currentTarget.classList.contains('dragging')) return;
        openModal(careerModal);
    });

    /* ── Counselling modal ───────────────────────────────────────────────── */
    const counselModal = makeModal(
        'fi-counsel-modal',
        '<i class="fas fa-heart"></i> Counselling Support',
        `<p style="color:#6b7280;font-size:.9rem;">We're here to support you. Choose the type of support you need:</p>
        <div class="fi-list">
            <div class="fi-list-item" data-type="academic">
                <h4>Academic Support</h4>
                <p>Help with study stress, time management, and academic challenges</p>
            </div>
            <div class="fi-list-item" data-type="emotional">
                <h4>Emotional Support</h4>
                <p>Talk about feelings, relationships, and personal challenges</p>
            </div>
            <div class="fi-list-item" data-type="crisis">
                <h4>Crisis Support</h4>
                <p>Immediate help for urgent situations</p>
            </div>
        </div>`,
        null
    );

    const counselLabels = { academic: 'Academic Counsellor', emotional: 'Emotional Support Specialist', crisis: 'Crisis Support Team' };
    counselModal.querySelectorAll('.fi-list-item').forEach(item => {
        item.addEventListener('click', () => {
            const type = item.dataset.type;
            closeModal();
            setTimeout(() => openAIBuddy('counselling', counselLabels[type] || 'Counsellor'), 200);
        });
    });

    document.getElementById('fi-counselling').addEventListener('click', e => {
        if (e.currentTarget.classList.contains('dragging')) return;
        openModal(counselModal);
    });

    /* ── ByteNexus icon → PiP chat ─────────────────────────────────────── */
    (function initBnPip() {
        const pip = document.createElement('div');
        pip.id = 'bn-pip';
        pip.classList.add('hidden');
        pip.innerHTML = `
            <div id="bn-pip-bar">
                <span><i class="fas fa-comments"></i> ByteNexus Chat</span>
                <div class="pip-controls">
                    <button title="Full screen" onclick="window.open('bytenexus-chat.html','_self')">
                        <i class="fas fa-expand"></i>
                    </button>
                    <button title="Close PiP" onclick="document.getElementById('bn-pip').classList.add('hidden')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            <iframe src="bytenexus-chat.html" id="bn-pip-frame" allow="microphone" loading="lazy"></iframe>
        `;
        document.body.appendChild(pip);

        document.getElementById('fi-bytenexus').addEventListener('click', e => {
            if (e.currentTarget.classList.contains('dragging')) return;
            const pip = document.getElementById('bn-pip');
            pip.classList.toggle('hidden');
            // Reload iframe when opening so it picks up fresh auth
            if (!pip.classList.contains('hidden')) {
                const frame = document.getElementById('bn-pip-frame');
                if (!frame.src || frame.src === 'about:blank') frame.src = 'bytenexus-chat.html';
            }
        });
    })();

    /* ── Theme Picker modal ──────────────────────────────────────────────── */
    (function initThemePicker() {
        const themeModal = document.createElement('div');
        themeModal.className = 'fi-modal';
        themeModal.id = 'fi-theme-modal';
        themeModal.style.width = 'min(94vw, 560px)';
        themeModal.innerHTML = `
            <div class="fi-modal-header" style="position:relative;background:linear-gradient(135deg,#7c3aed,#f59e0b);">
                <h3><i class="fas fa-palette"></i> Choose a Theme</h3>
                <button class="fi-close-btn"><i class="fas fa-times"></i></button>
            </div>
            <div class="fi-modal-body" id="fi-theme-modal-body" style="padding:16px;">
                <p style="color:#6b7280;font-size:.85rem;margin:0 0 12px;">Pick a colour palette — it applies instantly across all pages.</p>
                <div class="fi-theme-grid" id="fi-theme-grid"></div>
            </div>
        `;
        themeModal.querySelector('.fi-close-btn').addEventListener('click', closeModal);
        document.body.appendChild(themeModal);

        function buildThemeGrid() {
            const grid = document.getElementById('fi-theme-grid');
            if (!grid) return;
            grid.innerHTML = '';

            const sbTheme = window.SchoolByteTheme;
            if (!sbTheme) {
                grid.innerHTML = '<p style="color:#9ca3af;font-size:.85rem;">Theme engine not loaded on this page.</p>';
                return;
            }

            const themes  = sbTheme.themes;
            const current = sbTheme.getCurrent();

            Object.keys(themes).forEach(function (key) {
                var t = themes[key];
                var swatch = document.createElement('div');
                swatch.className = 'fi-theme-swatch' + (key === current ? ' active' : '');
                swatch.dataset.key = key;

                var preview = document.createElement('div');
                preview.className = 'fi-theme-preview';
                preview.style.background = 'linear-gradient(135deg,' + t.primary + ',' + t.secondary + ')';

                var dot1 = document.createElement('span');
                dot1.style.cssText = 'width:14px;height:14px;border-radius:50%;background:' + t.gold + ';display:inline-block;';
                var dot2 = document.createElement('span');
                dot2.style.cssText = 'width:14px;height:14px;border-radius:50%;background:' + t.orange + ';display:inline-block;';
                preview.appendChild(dot1);
                preview.appendChild(dot2);

                var info = document.createElement('div');
                info.className = 'fi-theme-info';
                info.innerHTML = '<div class="fi-theme-name">' + t.name + '</div><div class="fi-theme-desc">' + t.description + '</div>';

                swatch.appendChild(preview);
                swatch.appendChild(info);

                swatch.addEventListener('click', function () {
                    sbTheme.apply(key);
                    grid.querySelectorAll('.fi-theme-swatch').forEach(function (s) { s.classList.remove('active'); });
                    swatch.classList.add('active');

                    // Persist to server if possible
                    var tok = localStorage.getItem('token');
                    if (tok) {
                        fetch('/student/preferences', {
                            method: 'PUT',
                            headers: { 'Authorization': 'Bearer ' + tok, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ theme: key })
                        }).catch(function () {});
                    }
                });

                grid.appendChild(swatch);
            });
        }

        document.getElementById('fi-themes').addEventListener('click', function (e) {
            if (e.currentTarget.classList.contains('dragging')) return;
            buildThemeGrid();
            openModal(themeModal);
        });
    })();

    /* ── Expose addActivity for external use ─────────────────────────────── */
    window.floatingIcons = {
        addActivity: function (text, type) {
            // Refresh notifications from server so the bell badge stays accurate
            fetchNotifications();
        }
    };

    /* ── Initial notification load ───────────────────────────────────────── */
    fetchNotifications();

})();
