
// Career Guidance Widget - PIP mode similar to AI Buddy
(function() {
  'use strict';

  const API_URL = window.location.origin;
  let token = localStorage.getItem('token');
  let messages = [];
  let chatHistory = [];

  if (!token) {
    console.log('No token found, Career Guidance widget disabled');
    return;
  }

  function injectCareerWidget() {
    if (document.getElementById('career-widget')) return;

    const widgetHTML = `
      <style>
        .career-overlay {
          position: fixed;
          bottom: 20px;
          right: 760px;
          width: 400px;
          height: 550px;
          background: linear-gradient(135deg, #1a2a6c 0%, #b21f1f 100%);
          border-radius: 16px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          z-index: 99995;
          display: none;
          flex-direction: column;
          overflow: hidden;
        }

        .career-overlay.open {
          display: flex;
        }

        .career-overlay.minimized-pip {
          width: 280px;
          height: 350px;
        }

        .career-overlay.maximized-pip {
          width: 550px;
          height: 700px;
        }

        .career-header {
          padding: 16px 20px;
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255, 255, 255, 0.2);
        }

        .career-title {
          display: flex;
          align-items: center;
          gap: 10px;
          color: white;
          font-weight: 600;
          font-size: 16px;
        }

        .career-status {
          width: 8px;
          height: 8px;
          background: #10b981;
          border-radius: 50%;
          box-shadow: 0 0 8px #10b981;
        }

        .career-controls {
          display: flex;
          gap: 8px;
        }

        .career-control-btn {
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

        .career-control-btn:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        .career-messages {
          flex: 1;
          padding: 20px;
          overflow-y: auto;
          background: white;
        }

        .career-message {
          margin-bottom: 16px;
          display: flex;
          flex-direction: column;
        }

        .career-message.user {
          align-items: flex-end;
        }

        .career-message.ai {
          align-items: flex-start;
        }

        .career-message-bubble {
          max-width: 85%;
          padding: 12px 16px;
          border-radius: 16px;
          font-size: 14px;
          line-height: 1.5;
          word-wrap: break-word;
          word-break: break-word;
          white-space: pre-wrap;
        }

        .career-message.user .career-message-bubble {
          background: linear-gradient(135deg, #1a2a6c 0%, #b21f1f 100%);
          color: white;
          border-bottom-right-radius: 4px;
        }

        .career-message.ai .career-message-bubble {
          background: #f3f4f6;
          color: #1f2937;
          border-bottom-left-radius: 4px;
        }

        .career-input-area {
          padding: 16px 20px;
          background: white;
          border-top: 1px solid #e5e7eb;
          display: flex;
          gap: 12px;
        }

        .career-input {
          flex: 1;
          padding: 12px 16px;
          border: 1px solid #e5e7eb;
          border-radius: 24px;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
        }

        .career-input:focus {
          border-color: #1a2a6c;
        }

        .career-send-btn {
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

        .career-send-btn:hover {
          transform: scale(1.05);
        }

        .career-send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .career-loading {
          display: flex;
          gap: 4px;
          padding: 8px;
        }

        .career-loading-dot {
          width: 8px;
          height: 8px;
          background: #1a2a6c;
          border-radius: 50%;
          animation: career-bounce 1.4s infinite ease-in-out both;
        }

        .career-loading-dot:nth-child(1) { animation-delay: -0.32s; }
        .career-loading-dot:nth-child(2) { animation-delay: -0.16s; }

        @keyframes career-bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }

        .career-fab {
          position: fixed;
          bottom: 20px;
          right: 180px;
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: linear-gradient(135deg, #1a2a6c 0%, #b21f1f 100%);
          color: white;
          border: none;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(26, 42, 108, 0.4);
          z-index: 99994;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          transition: all 0.3s;
        }

        .career-fab:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 16px rgba(26, 42, 108, 0.5);
        }

        .career-fab.hidden {
          display: none;
        }
      </style>

      <button class="career-fab" id="careerFab" style="display: none;">
        <i class="fas fa-briefcase"></i>
      </button>

      <div id="careerOverlay" class="career-overlay">
        <div class="career-header">
          <div class="career-title">
            <span class="career-status"></span>
            <span>Career Counselor</span>
          </div>
          <div class="career-controls">
            <button id="careerPipMinusBtn" class="career-control-btn" title="Minimize">−</button>
            <button id="careerPipPlusBtn" class="career-control-btn" title="Maximize">+</button>
            <button id="careerCloseBtn" class="career-control-btn" title="Close">×</button>
          </div>
        </div>
        <div id="careerMessages" class="career-messages"></div>
        <div class="career-input-area">
          <input type="text" id="careerInput" class="career-input" placeholder="Ask about careers and your future..." />
          <button id="careerSendBtn" class="career-send-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
            </svg>
          </button>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', widgetHTML);
    initEventListeners();
    
    messages.push({
      role: 'ai',
      content: "Hi! I'm your AI Career Counselor. I can help you explore career paths based on your academic performance, suggest study strategies, and guide you toward your future goals. What would you like to know?"
    });
    displayMessages();
  }

  function initEventListeners() {
    const overlay = document.getElementById('careerOverlay');
    const fab = document.getElementById('careerFab');
    const closeBtn = document.getElementById('careerCloseBtn');
    const sendBtn = document.getElementById('careerSendBtn');
    const input = document.getElementById('careerInput');
    const pipMinusBtn = document.getElementById('careerPipMinusBtn');
    const pipPlusBtn = document.getElementById('careerPipPlusBtn');

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
    const input = document.getElementById('careerInput');
    const sendBtn = document.getElementById('careerSendBtn');
    const messageText = input.value.trim();

    if (!messageText) return;

    messages.push({ role: 'user', content: messageText });
    chatHistory.push({ role: 'student', content: messageText });
    input.value = '';
    displayMessages();

    sendBtn.disabled = true;
    input.disabled = true;

    const loadingMessage = { role: 'ai', content: '', loading: true };
    messages.push(loadingMessage);
    displayMessages();

    try {
      const response = await fetch(`${API_URL}/api/career-guidance/chat`, {
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

      if (!response.ok) throw new Error('Failed to get response');

      const data = await response.json();
      
      messages = messages.filter(m => !m.loading);
      messages.push({ role: 'ai', content: data.reply });
      chatHistory.push({ role: 'counselor', content: data.reply });
      displayMessages();
    } catch (error) {
      console.error('Career guidance error:', error);
      messages = messages.filter(m => !m.loading);
      messages.push({ role: 'ai', content: "Sorry, I'm having trouble responding right now. Please try again in a moment." });
      displayMessages();
    } finally {
      sendBtn.disabled = false;
      input.disabled = false;
      input.focus();
    }
  }

  function displayMessages() {
    const container = document.getElementById('careerMessages');
    
    container.innerHTML = messages.map(msg => {
      if (msg.loading) {
        return `
          <div class="career-message ai">
            <div class="career-message-bubble">
              <div class="career-loading">
                <div class="career-loading-dot"></div>
                <div class="career-loading-dot"></div>
                <div class="career-loading-dot"></div>
              </div>
            </div>
          </div>
        `;
      }
      
      return `
        <div class="career-message ${msg.role}">
          <div class="career-message-bubble">${escapeHtml(msg.content)}</div>
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

  window.openCareerGuidance = function() {
    const overlay = document.getElementById('careerOverlay');
    const fab = document.getElementById('careerFab');
    if (overlay) {
      overlay.classList.add('open');
      if (fab) fab.classList.add('hidden');
      document.getElementById('careerInput').focus();
    }
  };

  injectCareerWidget();
  
  setTimeout(() => {
    const fab = document.getElementById('careerFab');
    if (fab) fab.style.display = 'flex';
  }, 1000);
})();
