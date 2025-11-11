// ByteNexus Chat Widget - Instagram-style floating chat
(function() {
  'use strict';

  const API_URL = window.location.origin;
  let token = localStorage.getItem('token');
  let currentUser = null;
  let socket = null;
  let activeContact = null;
  let messages = [];
  let isMinimized = localStorage.getItem('chatMinimized') === 'true';
  let isOpen = localStorage.getItem('chatOpen') === 'true';
  let isPipMode = localStorage.getItem('chatPipMode') === 'true';
  let quotedMessage = null;

  // Check authentication
  if (!token) {
    console.log('No token found, chat widget disabled');
    return;
  }

  // Inject chat widget HTML
  function injectChatWidget() {
    if (document.getElementById('bytenexus-chat-widget')) return;

    const widgetHTML = `
      <style>
        :root {
          --bg-primary: #ffffff;
          --bg-secondary: #f9fafb;
          --text-primary: #1f2937;
          --text-secondary: #6b7280;
          --border-color: #e5e7eb;
          --shadow: 0 0 24px rgba(0, 0, 0, 0.15);
          --shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.3);
          --brand-primary: #1a2a6c;
          --brand-secondary: #b21f1f;
          --brand-gold: #FFD700;
          --brand-orange: #FFA500;
        }

        [data-theme="dark"] {
          --bg-primary: #1e293b;
          --bg-secondary: #0f172a;
          --text-primary: #f1f5f9;
          --text-secondary: #94a3b8;
          --border-color: #334155;
          --shadow: 0 0 24px rgba(0, 0, 0, 0.5);
          --shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.7);
          --brand-primary: #1a2a6c;
          --brand-secondary: #b21f1f;
          --brand-gold: #FFD700;
          --brand-orange: #FFA500;
        }

        .bytenexus-chat-overlay {
          position: fixed;
          bottom: 0;
          right: 20px;
          width: 400px;
          height: 600px;
          background: var(--bg-primary);
          border-radius: 16px 16px 0 0;
          box-shadow: var(--shadow);
          z-index: 99999;
          display: flex;
          flex-direction: column;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          overflow: hidden;
        }

        .bytenexus-chat-overlay.minimized {
          height: 60px;
        }

        .bytenexus-chat-overlay.closed {
          display: none;
        }

        .bytenexus-chat-overlay.pip-mode {
          width: 350px;
          height: 500px;
          bottom: 20px;
          right: 20px;
          border-radius: 16px;
          box-shadow: var(--shadow-lg);
        }

        .bytenexus-chat-overlay.pip-mode.maximized-pip {
          width: 550px;
          height: 700px;
        }

        .bytenexus-chat-overlay.pip-mode.minimized-pip {
          width: 280px;
          height: 350px;
        }

        .bytenexus-chat-overlay.pip-mode .bytenexus-back-btn {
          display: none;
        }

        .bytenexus-chat-overlay.fullscreen-mode {
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          width: 100%;
          height: 100%;
          border-radius: 0;
          z-index: 999999;
        }

        .bytenexus-chat-overlay.pip-mode .bytenexus-contacts-sidebar {
          display: none;
        }

        .bytenexus-chat-overlay.pip-mode .bytenexus-chat-area {
          display: flex !important;
        }

        .bytenexus-chat-overlay.fullscreen-mode .bytenexus-contacts-sidebar {
          display: flex;
        }

        .bytenexus-chat-header {
          background: linear-gradient(135deg, var(--brand-primary), var(--brand-secondary));
          color: white;
          padding: 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          user-select: none;
        }

        .bytenexus-chat-header-left {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
        }

        .bytenexus-chat-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 14px;
        }

        .bytenexus-chat-name {
          font-weight: 600;
          font-size: 14px;
        }

        .bytenexus-chat-actions {
          display: flex;
          gap: 8px;
        }

        .bytenexus-chat-action-btn {
          background: none;
          border: none;
          color: white;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 6px;
          transition: background 0.2s;
        }

        .bytenexus-chat-action-btn:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .bytenexus-chat-body {
          display: flex;
          height: calc(100% - 60px);
        }

        .bytenexus-contacts-sidebar {
          width: 100%;
          border-right: 1px solid var(--border-color);
          background: var(--bg-secondary);
          overflow-y: auto;
          display: flex;
          flex-direction: column;
        }

        .bytenexus-contacts-sidebar.with-chat {
          display: none;
        }

        .bytenexus-search-box {
          padding: 12px;
          background: var(--bg-primary);
          border-bottom: 1px solid var(--border-color);
        }

        .bytenexus-search-input {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid var(--border-color);
          background: var(--bg-secondary);
          color: var(--text-primary);
          border-radius: 20px;
          outline: none;
          font-size: 14px;
        }

        .bytenexus-search-input:focus {
          border-color: var(--brand-primary);
        }

        .bytenexus-contact-item {
          padding: 12px 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          transition: background 0.2s;
          border-bottom: 1px solid var(--border-color);
        }

        .bytenexus-contact-item:hover {
          background: var(--bg-primary);
        }

        .bytenexus-contact-item.active {
          background: rgba(26, 42, 108, 0.1);
        }

        .bytenexus-contact-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--brand-primary), var(--brand-secondary));
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          flex-shrink: 0;
        }

        .bytenexus-contact-info {
          flex: 1;
          min-width: 0;
        }

        .bytenexus-contact-name {
          font-weight: 600;
          font-size: 14px;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .bytenexus-contact-preview {
          font-size: 12px;
          color: var(--text-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .bytenexus-chat-area {
          flex: 1;
          display: none;
          flex-direction: column;
          background: var(--bg-primary);
        }

        .bytenexus-chat-area.active {
          display: flex;
        }

        .bytenexus-chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          background: var(--bg-secondary);
        }

        .bytenexus-message {
          display: flex;
          margin-bottom: 12px;
          max-width: 85%;
          animation: slideIn 0.3s ease;
          position: relative;
          width: fit-content;
        }

        @keyframes slideIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .bytenexus-message.received {
          justify-content: flex-start; /* Align received messages to the left */
        }

        .bytenexus-message.sent {
          justify-content: flex-end; /* Align sent messages to the right */
          margin-left: auto; /* Push sent messages to the right */
        }

        .bytenexus-message-bubble {
            max-width: 100%;
            padding: 10px 14px;
            border-radius: 18px;
            font-size: 14px;
            word-wrap: break-word;
            word-break: break-word;
            overflow-wrap: break-word;
        }

        .bytenexus-message.received .bytenexus-message-bubble {
          background: var(--bg-secondary);
          color: var(--text-primary);
          border-bottom-left-radius: 4px;
          border: 1px solid var(--border-color);
        }

        .bytenexus-message.sent .bytenexus-message-bubble {
          background: linear-gradient(135deg, var(--brand-primary), var(--brand-secondary));
          color: white;
          border-bottom-right-radius: 4px;
        }

        .bytenexus-message-time {
          font-size: 11px;
          margin-top: 4px;
          opacity: 0.7;
        }

        .bytenexus-message-wrapper {
          position: relative;
          margin-bottom: 12px;
          max-width: 100%; /* Ensure wrapper doesn't exceed parent width */
          display: flex; /* Use flex to help align actions */
          flex-direction: column; /* Stack actions above message bubble */
          align-items: flex-end; /* Default to right alignment for sent messages */
        }

        .bytenexus-message.received .bytenexus-message-wrapper {
          align-items: flex-start; /* Align received message wrapper to the left */
        }

        .bytenexus-message-wrapper:hover .bytenexus-message-actions {
          opacity: 1;
          visibility: visible;
        }

        .bytenexus-message-actions {
          position: absolute;
          top: -10px;
          right: 10px;
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 4px;
          display: flex;
          gap: 4px;
          opacity: 0;
          visibility: hidden;
          transition: all 0.2s;
          box-shadow: var(--shadow);
          z-index: 10;
        }

        .bytenexus-message.received .bytenexus-message-actions {
          right: auto;
          left: 10px;
        }

        .bytenexus-action-btn {
          background: none;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          padding: 6px 8px;
          border-radius: 6px;
          font-size: 12px;
          transition: all 0.2s;
        }

        .bytenexus-action-btn:hover {
          background: var(--bg-secondary);
          color: var(--brand-primary);
        }

        .bytenexus-quoted-message {
          background: rgba(26, 42, 108, 0.1);
          border-left: 3px solid var(--brand-primary);
          padding: 8px 12px;
          margin-bottom: 8px;
          border-radius: 8px;
          font-size: 12px;
          color: var(--text-secondary);
        }

        .bytenexus-quoted-message-header {
          font-weight: 600;
          color: var(--brand-primary);
          margin-bottom: 4px;
          font-size: 11px;
        }

        .bytenexus-quoted-message-content {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .bytenexus-quote-preview {
          background: var(--bg-secondary);
          border-left: 3px solid var(--brand-primary);
          padding: 8px 12px;
          margin: 8px 12px;
          border-radius: 8px;
          display: none;
          align-items: center;
          justify-content: space-between;
        }

        .bytenexus-quote-preview.active {
          display: flex;
        }

        .bytenexus-quote-preview-content {
          flex: 1;
          font-size: 12px;
          color: var(--text-secondary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .bytenexus-quote-cancel {
          background: none;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 6px;
          transition: all 0.2s;
        }

        .bytenexus-quote-cancel:hover {
          background: var(--bg-primary);
          color: var(--brand-primary);
        }

        .bytenexus-chat-input-container {
          padding: 12px;
          background: var(--bg-primary);
          border-top: 1px solid var(--border-color);
          display: flex;
          gap: 8px;
        }

        .bytenexus-chat-input {
          flex: 1;
          padding: 10px 14px;
          border: 1px solid var(--border-color);
          background: var(--bg-secondary);
          color: var(--text-primary);
          border-radius: 20px;
          outline: none;
          font-size: 14px;
          resize: none;
          max-height: 100px;
        }

        .bytenexus-chat-input:focus {
          border-color: var(--brand-primary);
        }

        .bytenexus-send-btn {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--brand-primary), var(--brand-secondary));
          color: white;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s;
        }

        .bytenexus-send-btn:hover {
          transform: scale(1.05);
        }

        .bytenexus-chat-fab {
          position: fixed;
          bottom: 20px;
          right: 20px;
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--brand-primary), var(--brand-secondary));
          color: white;
          border: none;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(26, 42, 108, 0.4);
          z-index: 99998;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          transition: all 0.3s;
        }

        .bytenexus-chat-fab:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 16px rgba(26, 42, 108, 0.5);
        }

        .bytenexus-chat-fab.hidden {
          display: none;
        }

        .bytenexus-back-btn {
          background: none;
          border: none;
          color: white;
          cursor: pointer;
          font-size: 20px;
          padding: 0;
          display: none;
        }

        .bytenexus-back-btn.visible {
          display: block;
        }

        .bytenexus-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--text-secondary);
          padding: 20px;
          text-align: center;
        }

        .bytenexus-empty-state i {
          font-size: 48px;
          margin-bottom: 16px;
          color: var(--text-secondary);
        }

        @media (max-width: 768px) {
          .bytenexus-chat-overlay {
            width: 100%;
            right: 0;
            height: 100vh;
            border-radius: 0;
          }

          .bytenexus-chat-overlay.minimized {
            display: none;
          }

          .bytenexus-chat-fab {
            bottom: 80px;
          }
        }
      </style>

      <button class="bytenexus-chat-fab" id="bytenexusChatFab">
        <i class="fas fa-comment-dots"></i>
      </button>

      <div class="bytenexus-chat-overlay ${isMinimized ? 'minimized' : ''} ${!isOpen ? 'closed' : ''} ${isPipMode ? 'pip-mode' : ''}" id="bytenexusChatOverlay">
        <div class="bytenexus-chat-header" id="bytenexusChatHeader">
          <div class="bytenexus-chat-header-left">
            <button class="bytenexus-back-btn" id="bytenexusBackBtn">
              <i class="fas fa-arrow-left"></i>
            </button>
            <div class="bytenexus-chat-avatar" id="bytenexusChatAvatar">
              <i class="fas fa-comments"></i>
            </div>
            <div>
              <div class="bytenexus-chat-name" id="bytenexusChatName">ByteNexus</div>
            </div>
          </div>
          <div class="bytenexus-chat-actions">
            <button class="bytenexus-chat-action-btn" id="bytenexusThemeBtn" title="Toggle Dark Mode">
              <i class="fas fa-moon"></i>
            </button>
            <button class="bytenexus-chat-action-btn" id="bytenexusPipBtn" title="Picture-in-Picture Mode">
              <i class="fas fa-external-link-alt"></i>
            </button>
            <button class="bytenexus-chat-action-btn" id="bytenexusPipMinusBtn" title="Minimize PiP" style="display: none;">
              <i class="fas fa-minus"></i>
            </button>
            <button class="bytenexus-chat-action-btn" id="bytenexusPipPlusBtn" title="Maximize PiP" style="display: none;">
              <i class="fas fa-plus"></i>
            </button>
            <button class="bytenexus-chat-action-btn" id="bytenexusFullscreenBtn" title="Open Full Page" style="display: none;">
              <i class="fas fa-expand"></i>
            </button>
            <button class="bytenexus-chat-action-btn" id="bytenexusMinimizeBtn">
              <i class="fas fa-window-minimize"></i>
            </button>
            <button class="bytenexus-chat-action-btn" id="bytenexusCloseBtn">
              <i class="fas fa-times"></i>
            </button>
          </div>
        </div>

        <div class="bytenexus-chat-body">
          <div class="bytenexus-contacts-sidebar" id="bytenexusContactsSidebar">
            <div class="bytenexus-search-box">
              <input type="text" class="bytenexus-search-input" id="bytenexusSearchInput" placeholder="Search conversations...">
            </div>
            <div id="bytenexusContactsList"></div>
          </div>

          <div class="bytenexus-chat-area" id="bytenexusChatArea">
            <div class="bytenexus-chat-messages" id="bytenexusChatMessages">
              <div class="bytenexus-empty-state">
                <i class="fas fa-comments"></i>
                <p>Select a conversation to start chatting</p>
              </div>
            </div>
            <div class="bytenexus-quote-preview" id="bytenexusQuotePreview">
              <div class="bytenexus-quote-preview-content" id="bytenexusQuoteContent"></div>
              <button class="bytenexus-quote-cancel" id="bytenexusQuoteCancel">
                <i class="fas fa-times"></i>
              </button>
            </div>
            <div class="bytenexus-chat-input-container">
              <textarea class="bytenexus-chat-input" id="bytenexusChatInput" placeholder="Type a message..." rows="1"></textarea>
              <button class="bytenexus-send-btn" id="bytenexusSendBtn">
                <i class="fas fa-paper-plane"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    const container = document.createElement('div');
    container.id = 'bytenexus-chat-widget';
    container.innerHTML = widgetHTML;
    document.body.appendChild(container);

    initializeEventListeners();
    initializeChat();
  }

  function initializeEventListeners() {
    const fab = document.getElementById('bytenexusChatFab');
    const overlay = document.getElementById('bytenexusChatOverlay');
    const themeBtn = document.getElementById('bytenexusThemeBtn');
    const pipBtn = document.getElementById('bytenexusPipBtn');
    const pipMinusBtn = document.getElementById('bytenexusPipMinusBtn');
    const pipPlusBtn = document.getElementById('bytenexusPipPlusBtn');
    const fullscreenBtn = document.getElementById('bytenexusFullscreenBtn');
    const minimizeBtn = document.getElementById('bytenexusMinimizeBtn');
    const closeBtn = document.getElementById('bytenexusCloseBtn');
    const header = document.getElementById('bytenexusChatHeader');
    const backBtn = document.getElementById('bytenexusBackBtn');
    const sendBtn = document.getElementById('bytenexusSendBtn');
    const chatInput = document.getElementById('bytenexusChatInput');
    const quoteCancel = document.getElementById('bytenexusQuoteCancel');

    // Load saved theme
    const savedTheme = localStorage.getItem('chatTheme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    fab.addEventListener('click', () => {
      overlay.classList.remove('closed');
      overlay.classList.remove('minimized');
      fab.classList.add('hidden');
      localStorage.setItem('chatOpen', 'true');
      localStorage.setItem('chatMinimized', 'false');
    });

    // Theme toggle
    themeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const currentTheme = document.body.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.body.setAttribute('data-theme', newTheme);
      localStorage.setItem('chatTheme', newTheme);
      updateThemeIcon(newTheme);
    });

    // PiP mode toggle
    pipBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      overlay.classList.toggle('pip-mode');
      overlay.classList.remove('fullscreen-mode');
      isPipMode = overlay.classList.contains('pip-mode');
      localStorage.setItem('chatPipMode', isPipMode);

      // Show/hide PiP controls
      updatePipControls(isPipMode);

      // If entering PiP mode and no active contact, show first contact
      if (isPipMode && !activeContact) {
        const firstContact = document.querySelector('.bytenexus-contact-item');
        if (firstContact) {
          firstContact.click();
        }
      }
    });

    // PiP minimize (make smaller)
    pipMinusBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      overlay.classList.toggle('minimized-pip');
      overlay.classList.remove('maximized-pip');
    });

    // PiP maximize (make larger)
    pipPlusBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      overlay.classList.toggle('maximized-pip');
      overlay.classList.remove('minimized-pip');
    });

    // Fullscreen mode
    fullscreenBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.location.href = '/bytenexus-chat.html';
    });

    // Regular minimize
    minimizeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      overlay.classList.toggle('minimized');
      const isMin = overlay.classList.contains('minimized');
      localStorage.setItem('chatMinimized', isMin);
    });

    // Close button
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      overlay.classList.add('closed');
      overlay.classList.remove('pip-mode');
      overlay.classList.remove('fullscreen-mode');
      overlay.classList.remove('minimized-pip');
      overlay.classList.remove('maximized-pip');
      fab.classList.remove('hidden');
      localStorage.setItem('chatOpen', 'false');
      localStorage.setItem('chatPipMode', 'false');
      isPipMode = false;
      updatePipControls(false);
    });

    header.addEventListener('click', () => {
      if (overlay.classList.contains('minimized')) {
        overlay.classList.remove('minimized');
        localStorage.setItem('chatMinimized', 'false');
      }
    });

    backBtn.addEventListener('click', () => {
      // Don't allow going back in PiP mode unless fullscreen
      if (isPipMode && !overlay.classList.contains('fullscreen-mode')) return;

      document.getElementById('bytenexusChatArea').classList.remove('active');
      document.getElementById('bytenexusContactsSidebar').classList.remove('with-chat');
      backBtn.classList.remove('visible');
      document.getElementById('bytenexusChatName').textContent = 'ByteNexus';
      activeContact = null;
    });

    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // Auto-resize textarea
    chatInput.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 100) + 'px';
    });

    // Quote cancel button
    quoteCancel.addEventListener('click', cancelQuote);
  }

  function updateThemeIcon(theme) {
    const icon = document.getElementById('bytenexusThemeBtn').querySelector('i');
    if (theme === 'dark') {
      icon.className = 'fas fa-sun';
    } else {
      icon.className = 'fas fa-moon';
    }
  }

  function updatePipControls(isPipMode) {
    const pipMinusBtn = document.getElementById('bytenexusPipMinusBtn');
    const pipPlusBtn = document.getElementById('bytenexusPipPlusBtn');
    const fullscreenBtn = document.getElementById('bytenexusFullscreenBtn');
    const pipBtn = document.getElementById('bytenexusPipBtn');

    if (isPipMode) {
      pipMinusBtn.style.display = 'block';
      pipPlusBtn.style.display = 'block';
      fullscreenBtn.style.display = 'block';
      pipBtn.querySelector('i').className = 'fas fa-compress-alt';
      pipBtn.title = 'Exit Picture-in-Picture';
    } else {
      pipMinusBtn.style.display = 'none';
      pipPlusBtn.style.display = 'none';
      fullscreenBtn.style.display = 'none';
      pipBtn.querySelector('i').className = 'fas fa-external-link-alt';
      pipBtn.title = 'Picture-in-Picture Mode';
    }
  }

  async function initializeChat() {
    try {
      const response = await fetch(`${API_URL}/student/dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Authentication failed');

      const data = await response.json();
      currentUser = {
        id: data.student._id.toString(),
        username: data.student.studentName,
        email: data.student.email
      };

      initSocket();
      loadConversations();
    } catch (error) {
      console.error('Chat initialization error:', error);
    }
  }

  function initSocket() {
    socket = io(API_URL, { auth: { token: token } });

    socket.on('connect', () => {
      console.log('ByteNexus chat connected');
    });

    socket.on('new_personal_message', (message) => {
      if (activeContact && message.sender_id === activeContact.id) {
        messages.push(message);
        displayMessages();
        socket.emit('mark_message_read', { messageId: message._id });
      }
      loadConversations(); // Update conversation list
    });

    socket.on('message_sent_confirmation', (data) => {
      const msgIndex = messages.findIndex(m => m.tempId === data.tempId);
      if (msgIndex !== -1) {
        messages[msgIndex] = data.message;
        displayMessages();
      }
    });
  }

  async function loadConversations() {
    try {
      const response = await fetch(`${API_URL}/api/messages/personal/conversations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to load conversations');

      const conversations = await response.json();
      displayConversations(conversations);
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  }

  function displayConversations(conversations) {
    const container = document.getElementById('bytenexusContactsList');

    if (conversations.length === 0) {
      container.innerHTML = '<div class="bytenexus-empty-state"><p>No conversations yet</p></div>';
      return;
    }

    container.innerHTML = conversations.map(conv => {
      const initials = conv.contactName.split(' ').map(n => n[0]).join('').toUpperCase();
      return `
        <div class="bytenexus-contact-item" data-contact='${JSON.stringify(conv.contact)}'>
          <div class="bytenexus-contact-avatar">${initials}</div>
          <div class="bytenexus-contact-info">
            <div class="bytenexus-contact-name">${conv.contactName}</div>
            <div class="bytenexus-contact-preview">${conv.lastMessage}</div>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.bytenexus-contact-item').forEach(item => {
      item.addEventListener('click', () => {
        const contact = JSON.parse(item.dataset.contact);
        openChat(contact);
      });
    });
  }

  async function openChat(contact) {
    activeContact = contact;

    document.getElementById('bytenexusChatArea').classList.add('active');
    document.getElementById('bytenexusContactsSidebar').classList.add('with-chat');
    document.getElementById('bytenexusBackBtn').classList.add('visible');

    const initials = contact.studentName.split(' ').map(n => n[0]).join('').toUpperCase();
    document.getElementById('bytenexusChatName').textContent = contact.studentName;
    document.getElementById('bytenexusChatAvatar').textContent = initials;

    const conversationId = [currentUser.id, contact.id].sort().join('_');
    socket.emit('join_personal_room', { conversationId });

    await loadMessages(contact.id);
  }

  async function loadMessages(contactId) {
    try {
      const conversationId = [currentUser.id, contactId].sort().join('_');
      const response = await fetch(`${API_URL}/api/messages/personal/${conversationId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        messages = await response.json();
        displayMessages();
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  }

  function displayMessages() {
    const container = document.getElementById('bytenexusChatMessages');

    if (messages.length === 0) {
      container.innerHTML = '<div class="bytenexus-empty-state"><p>No messages yet</p></div>';
      return;
    }

    container.innerHTML = messages.map((msg, index) => {
      const isSent = msg.sender_id === currentUser.id;
      const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      let quotedHTML = '';
      if (msg.replyTo && msg.replyTo.content) {
        const quotedSenderName = msg.replyTo.sender_id === currentUser.id ? 'You' : activeContact.studentName;
        quotedHTML = `
          <div class="bytenexus-quoted-message">
            <div class="bytenexus-quoted-message-header">${quotedSenderName}</div>
            <div class="bytenexus-quoted-message-content">${msg.replyTo.content}</div>
          </div>
        `;
      }

      return `
        <div class="bytenexus-message-wrapper" data-message-id="${msg._id || msg.tempId}">
          <div class="bytenexus-message-actions">
            <button class="bytenexus-action-btn" onclick="window.quoteMessage('${msg._id || msg.tempId}', ${index})" title="Quote">
              <i class="fas fa-reply"></i>
            </button>
          </div>
          <div class="bytenexus-message ${isSent ? 'sent' : 'received'}">
            <div class="bytenexus-message-bubble">
              ${quotedHTML}
              <div class="bytenexus-message-content">${msg.content}</div>
              <div class="bytenexus-message-time">${time}</div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.scrollTop = container.scrollHeight;
  }

  function sendMessage() {
    const input = document.getElementById('bytenexusChatInput');
    const content = input.value.trim();

    if (!content || !activeContact) return;

    const tempId = `temp_${Date.now()}`;
    const tempMessage = {
      sender_id: currentUser.id,
      recipient_id: activeContact.id,
      content: content,
      created_at: new Date(),
      tempId: tempId,
      replyTo: quotedMessage
    };

    messages.push(tempMessage);
    displayMessages();

    socket.emit('send_personal_message', {
      recipientId: activeContact.id,
      content: content,
      tempId: tempId,
      replyTo: quotedMessage
    });

    input.value = '';
    input.style.height = 'auto';

    // Clear quoted message
    quotedMessage = null;
    document.getElementById('bytenexusQuotePreview').classList.remove('active');
  }

  // Quote message handler
  window.quoteMessage = function(messageId, index) {
    const message = messages.find(m => m._id === messageId || m.tempId === messageId);
    if (!message) return;

    quotedMessage = {
      id: message._id || message.tempId,
      content: message.content,
      sender_id: message.sender_id
    };

    const quotePreview = document.getElementById('bytenexusQuotePreview');
    const quoteContent = document.getElementById('bytenexusQuoteContent');

    const senderName = message.sender_id === currentUser.id ? 'You' : activeContact.studentName;
    quoteContent.textContent = `Replying to ${senderName}: ${message.content}`;
    quotePreview.classList.add('active');

    document.getElementById('bytenexusChatInput').focus();
  };

  // Cancel quote
  function cancelQuote() {
    quotedMessage = null;
    document.getElementById('bytenexusQuotePreview').classList.remove('active');
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectChatWidget);
  } else {
    injectChatWidget();
  }
})();