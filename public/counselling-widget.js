// Counselling Widget - Emotional and academic support in PIP mode
(function() {
  'use strict';

  const API_URL = window.location.origin;
  let token = localStorage.getItem('token');
  let messages = [];
  let chatHistory = [];
  let counsellingType = 'academic'; // Default type

  if (!token) {
    console.log('No token found, Counselling widget disabled');
    return;
  }

  function injectCounsellingWidget() {
    if (document.getElementById('counselling-widget')) return;

    const widgetHTML = `
      <style>
        .counselling-overlay {
          position: fixed;
          bottom: 20px;
          right: 570px;
          width: 400px;
          height: 550px;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          border-radius: 16px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          z-index: 99994;
          display: none;
          flex-direction: column;
          overflow: hidden;
        }

        .counselling-overlay.open {
          display: flex;
        }

        .counselling-overlay.minimized-pip {
          width: 280px;
          height: 350px;
        }

        .counselling-overlay.maximized-pip {
          width: 550px;
          height: 700px;
        }

        .counselling-header {
          padding: 16px 20px;
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255, 255, 255, 0.2);
        }

        .counselling-title {
          display: flex;
          align-items: center;
          gap: 10px;
          color: white;
          font-weight: 600;
          font-size: 16px;
        }

        .counselling-status {
          width: 8px;
          height: 8px;
          background: #fbbf24;
          border-radius: 50%;
          box-shadow: 0 0 8px #fbbf24;
        }

        .counselling-controls {
          display: flex;
          gap: 8px;
        }

        .counselling-control-btn {
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

        .counselling-control-btn:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        .counselling-messages {
          flex: 1;
          padding: 20px;
          overflow-y: auto;
          background: white;
        }

        .counselling-message {
          margin-bottom: 16px;
          display: flex;
          flex-direction: column;
        }

        .counselling-message.user {
          align-items: flex-end;
        }

        .counselling-message.ai {
          align-items: flex-start;
        }

        .counselling-message-bubble {
          max-width: 85%;
          padding: 12px 16px;
          border-radius: 16px;
          font-size: 14px;
          line-height: 1.5;
          word-wrap: break-word;
        }

        .counselling-message.user .counselling-message-bubble {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
          border-bottom-right-radius: 4px;
        }

        .counselling-message.ai .counselling-message-bubble {
          background: #f3f4f6;
          color: #1f2937;
          border-bottom-left-radius: 4px;
        }

        .counselling-input-area {
          padding: 16px 20px;
          background: white;
          border-top: 1px solid #e5e7eb;
          display: flex;
          gap: 12px;
        }

        .counselling-input {
          flex: 1;
          padding: 12px 16px;
          border: 1px solid #e5e7eb;
          border-radius: 24px;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
        }

        .counselling-input:focus {
          border-color: #10b981;
        }

        .counselling-send-btn {
          width: 48px;
          height: 48px;
          border: none;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s;
        }

        .counselling-send-btn:hover {
          transform: scale(1.05);
        }

        .counselling-send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .counselling-loading {
          display: flex;
          gap: 4px;
          padding: 8px;
        }

        .counselling-loading-dot {
          width: 8px;
          height: 8px;
          background: #10b981;
          border-radius: 50%;
          animation: counselling-bounce 1.4s infinite ease-in-out both;
        }

        .counselling-loading-dot:nth-child(1) { animation-delay: -0.32s; }
        .counselling-loading-dot:nth-child(2) { animation-delay: -0.16s; }

        @keyframes counselling-bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }

        .counselling-fab {
          position: fixed;
          bottom: 20px;
          right: 180px;
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
          border: none;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
          z-index: 99993;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          transition: all 0.3s;
        }

        .counselling-fab:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 16px rgba(16, 185, 129, 0.5);
        }

        .counselling-fab.hidden {
          display: none;
        }
      </style>

      <button class="counselling-fab" id="counsellingFab" style="display: none;">
        <i class="fas fa-heart"></i>
      </button>

      <div id="counsellingOverlay" class="counselling-overlay">
        <div class="counselling-header">
          <div class="counselling-title">
            <span class="counselling-status"></span>
            <span>Counselling Support</span>
          </div>
          <div class="counselling-controls">
            <button id="counsellingPipMinusBtn" class="counselling-control-btn" title="Minimize">−</button>
            <button id="counsellingPipPlusBtn" class="counselling-control-btn" title="Maximize">+</button>
            <button id="counsellingCloseBtn" class="counselling-control-btn" title="Close">×</button>
          </div>
        </div>
        <div id="counsellingMessages" class="counselling-messages"></div>
        <div class="counselling-input-area">
          <input type="text" id="counsellingInput" class="counselling-input" placeholder="Share what's on your mind..." />
          <button id="counsellingSendBtn" class="counselling-send-btn">
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
      role: 'ai',
      content: "Hi, I'm here to support you. You can talk to me about academic challenges, emotional concerns, or if you're facing a difficult situation. Everything we discuss is confidential. How can I help you today?"
    });
    displayMessages();
  }

  function initEventListeners() {
    const overlay = document.getElementById('counsellingOverlay');
    const fab = document.getElementById('counsellingFab');
    const closeBtn = document.getElementById('counsellingCloseBtn');
    const sendBtn = document.getElementById('counsellingSendBtn');
    const input = document.getElementById('counsellingInput');
    const pipMinusBtn = document.getElementById('counsellingPipMinusBtn');
    const pipPlusBtn = document.getElementById('counsellingPipPlusBtn');

    fab.addEventListener('click', () => {
      overlay.classList.add('open');
      fab.classList.add('hidden');
      input.focus();
    });

    closeBtn.addEventListener('click', () => {
      overlay.classList.remove('open');
      fab.classList.remove('hidden');
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
    const input = document.getElementById('counsellingInput');
    const sendBtn = document.getElementById('counsellingSendBtn');
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
    const loadingMessage = { role: 'ai', content: '', loading: true };
    messages.push(loadingMessage);
    displayMessages();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 50000);

      const response = await fetch(`${API_URL}/api/counselling/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: messageText,
          chatHistory: chatHistory.slice(-6),
          counsellingType: counsellingType // academic, emotional, or crisis
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(errorData.message || 'Failed to get counselling response');
      }

      const data = await response.json();
      
      // Remove loading message
      messages = messages.filter(m => !m.loading);
      
      // Add counsellor response
      messages.push({ role: 'ai', content: data.reply });
      chatHistory.push({ role: 'assistant', content: data.reply });
      displayMessages();
    } catch (error) {
      console.error('Counselling error:', error);
      
      messages = messages.filter(m => !m.loading);
      
      let errorMessage = "I'm having trouble responding right now. ";
      
      if (error.name === 'AbortError') {
        errorMessage += "The request took too long. Please try again.";
      } else if (error.message.includes('Failed to fetch')) {
        errorMessage += "Connection issue. Please check your internet and try again.";
      } else {
        errorMessage += "Please try again in a moment.";
      }
      
      messages.push({ role: 'ai', content: errorMessage });
      displayMessages();
    } finally {
      sendBtn.disabled = false;
      input.disabled = false;
      input.focus();
    }
  }

  function displayMessages() {
    const container = document.getElementById('counsellingMessages');
    
    container.innerHTML = messages.map(msg => {
      if (msg.loading) {
        return `
          <div class="counselling-message ai">
            <div class="counselling-message-bubble">
              <div class="counselling-loading">
                <div class="counselling-loading-dot"></div>
                <div class="counselling-loading-dot"></div>
                <div class="counselling-loading-dot"></div>
              </div>
            </div>
          </div>
        `;
      }
      
      return `
        <div class="counselling-message ${msg.role}">
          <div class="counselling-message-bubble">${escapeHtml(msg.content)}</div>
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

  window.openCounselling = function(type = 'academic') {
    // Validate and set counselling type
    const validTypes = ['academic', 'emotional', 'crisis'];
    counsellingType = validTypes.includes(type) ? type : 'academic';
    
    console.log('Counselling widget opened with type:', counsellingType);
    
    const overlay = document.getElementById('counsellingOverlay');
    const fab = document.getElementById('counsellingFab');
    if (overlay) {
      overlay.classList.add('open');
      if (fab) fab.classList.add('hidden');
      document.getElementById('counsellingInput').focus();
    }
  };

  // Initialize widget
  injectCounsellingWidget();
  
  // Show FAB after initialization
  setTimeout(() => {
    const fab = document.getElementById('counsellingFab');
    if (fab) fab.style.display = 'flex';
  }, 1000);
})();
