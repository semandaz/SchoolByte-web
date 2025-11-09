// ByteNexus Support Team Widget - SchoolByte platform help in PIP mode only
(function() {
  'use strict';

  const API_URL = window.location.origin;
  let token = localStorage.getItem('token');
  let messages = [];
  let chatHistory = [];

  if (!token) {
    console.log('No token found, ByteNexus Support widget disabled');
    return;
  }

  function injectSupportWidget() {
    if (document.getElementById('support-widget')) return;

    const widgetHTML = `
      <style>
        .support-overlay {
          position: fixed;
          bottom: 20px;
          right: 20px;
          width: 400px;
          height: 550px;
          background: linear-gradient(135deg, #1a2a6c 0%, #b21f1f 50%, #fdbb2d 100%);
          border-radius: 16px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          z-index: 99997;
          display: none;
          flex-direction: column;
          overflow: hidden;
        }

        .support-overlay.open {
          display: flex;
        }

        .support-overlay.minimized-pip {
          width: 280px;
          height: 350px;
        }

        .support-overlay.maximized-pip {
          width: 550px;
          height: 700px;
        }

        .support-header {
          padding: 16px 20px;
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255, 255, 255, 0.2);
        }

        .support-title {
          display: flex;
          align-items: center;
          gap: 10px;
          color: white;
          font-weight: 600;
          font-size: 16px;
        }

        .support-status {
          width: 8px;
          height: 8px;
          background: #10b981;
          border-radius: 50%;
          box-shadow: 0 0 8px #10b981;
        }

        .support-controls {
          display: flex;
          gap: 8px;
        }

        .support-control-btn {
          width: 32px;
          height: 32px;
          border: none;
          background: rgba(255, 255, 255, 0.2);
          color: white;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s;
        }

        .support-control-btn:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        .support-messages {
          flex: 1;
          padding: 20px;
          overflow-y: auto;
          background: white;
        }

        .support-message {
          margin-bottom: 16px;
          display: flex;
          flex-direction: column;
        }

        .support-message.user {
          align-items: flex-end;
        }

        .support-message.support {
          align-items: flex-start;
        }

        .support-message-bubble {
          max-width: 85%;
          padding: 12px 16px;
          border-radius: 16px;
          font-size: 14px;
          line-height: 1.5;
          word-wrap: break-word;
        }

        .support-message.user .support-message-bubble {
          background: linear-gradient(135deg, #1a2a6c 0%, #b21f1f 100%);
          color: white;
          border-bottom-right-radius: 4px;
        }

        .support-message.support .support-message-bubble {
          background: #f3f4f6;
          color: #1f2937;
          border-bottom-left-radius: 4px;
        }

        .support-input-area {
          padding: 16px 20px;
          background: white;
          border-top: 1px solid #e5e7eb;
          display: flex;
          gap: 12px;
        }

        .support-input {
          flex: 1;
          padding: 12px 16px;
          border: 1px solid #e5e7eb;
          border-radius: 24px;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
        }

        .support-input:focus {
          border-color: #1a2a6c;
        }

        .support-send-btn {
          width: 48px;
          height: 48px;
          border: none;
          background: linear-gradient(135deg, #1a2a6c 0%, #b21f1f 100%);
          color: white;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s;
        }

        .support-send-btn:hover {
          transform: scale(1.05);
        }

        .support-send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .support-loading {
          display: flex;
          gap: 4px;
          padding: 8px;
        }

        .support-loading-dot {
          width: 8px;
          height: 8px;
          background: #1a2a6c;
          border-radius: 50%;
          animation: support-bounce 1.4s infinite ease-in-out both;
        }

        .support-loading-dot:nth-child(1) { animation-delay: -0.32s; }
        .support-loading-dot:nth-child(2) { animation-delay: -0.16s; }

        @keyframes support-bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
      </style>

      <div id="supportOverlay" class="support-overlay">
        <div class="support-header">
          <div class="support-title">
            <span class="support-status"></span>
            <span>ByteNexus Support</span>
          </div>
          <div class="support-controls">
            <button id="supportPipMinusBtn" class="support-control-btn" title="Minimize">−</button>
            <button id="supportPipPlusBtn" class="support-control-btn" title="Maximize">+</button>
            <button id="supportCloseBtn" class="support-control-btn" title="Close">×</button>
          </div>
        </div>
        <div id="supportMessages" class="support-messages"></div>
        <div class="support-input-area">
          <input type="text" id="supportInput" class="support-input" placeholder="Ask about SchoolByte features..." />
          <button id="supportSendBtn" class="support-send-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
            </svg>
          </button>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', widgetHTML);
    initEventListeners();
    
    // Add welcome message
    messages.push({
      role: 'support',
      content: "Welcome to ByteNexus Support! I'm here to help you navigate SchoolByte and make the most of all our features. Whether you have questions about quizzes, Preader Games, the XP system, or anything else, feel free to ask!"
    });
    displayMessages();
  }

  function initEventListeners() {
    const overlay = document.getElementById('supportOverlay');
    const closeBtn = document.getElementById('supportCloseBtn');
    const sendBtn = document.getElementById('supportSendBtn');
    const input = document.getElementById('supportInput');
    const pipMinusBtn = document.getElementById('supportPipMinusBtn');
    const pipPlusBtn = document.getElementById('supportPipPlusBtn');

    closeBtn.addEventListener('click', () => {
      overlay.classList.remove('open');
    });

    pipMinusBtn.addEventListener('click', () => {
      overlay.classList.toggle('minimized-pip');
      overlay.classList.remove('maximized-pip');
    });

    pipPlusBtn.addEventListener('click', () => {
      overlay.classList.toggle('maximized-pip');
      overlay.classList.remove('minimized-pip');
    });

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !sendBtn.disabled) {
        sendMessage();
      }
    });
  }

  async function sendMessage() {
    const input = document.getElementById('supportInput');
    const sendBtn = document.getElementById('supportSendBtn');
    const messageText = input.value.trim();

    if (!messageText) return;

    // Add user message
    messages.push({ role: 'user', content: messageText });
    chatHistory.push({ role: 'user', content: messageText });
    input.value = '';
    displayMessages();

    // Disable input
    sendBtn.disabled = true;
    input.disabled = true;

    // Show loading
    const loadingMessage = { role: 'support', content: '', loading: true };
    messages.push(loadingMessage);
    displayMessages();

    try {
      const response = await fetch(`${API_URL}/api/bytenexus-support/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: messageText,
          chatHistory: chatHistory
        })
      });

      if (!response.ok) throw new Error('Failed to get support response');

      const data = await response.json();
      
      // Remove loading message
      messages = messages.filter(m => !m.loading);
      
      // Add support response
      messages.push({ role: 'support', content: data.reply });
      chatHistory.push({ role: 'assistant', content: data.reply });
      displayMessages();
    } catch (error) {
      console.error('ByteNexus Support error:', error);
      messages = messages.filter(m => !m.loading);
      messages.push({ role: 'support', content: "Sorry, I'm having trouble responding right now. Please try again in a moment." });
      displayMessages();
    } finally {
      sendBtn.disabled = false;
      input.disabled = false;
      input.focus();
    }
  }

  function displayMessages() {
    const container = document.getElementById('supportMessages');
    
    container.innerHTML = messages.map(msg => {
      if (msg.loading) {
        return `
          <div class="support-message support">
            <div class="support-message-bubble">
              <div class="support-loading">
                <div class="support-loading-dot"></div>
                <div class="support-loading-dot"></div>
                <div class="support-loading-dot"></div>
              </div>
            </div>
          </div>
        `;
      }
      
      return `
        <div class="support-message ${msg.role}">
          <div class="support-message-bubble">${escapeHtml(msg.content)}</div>
        </div>
      `;
    }).join('');

    container.scrollTop = container.scrollHeight;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  window.openByteNexusSupport = function() {
    const overlay = document.getElementById('supportOverlay');
    if (overlay) {
      overlay.classList.add('open');
      document.getElementById('supportInput').focus();
    }
  };

  // Initialize widget
  injectSupportWidget();
})();
