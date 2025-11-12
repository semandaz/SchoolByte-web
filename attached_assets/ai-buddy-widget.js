// AI Buddy Widget - Study assistant chat in PIP mode only
(function() {
  'use strict';

  const API_URL = window.location.origin;
  let token = localStorage.getItem('token');
  let messages = [];
  let chatHistory = [];

  if (!token) {
    console.log('No token found, AI Buddy widget disabled');
    return;
  }

  function injectAIBuddyWidget() {
    if (document.getElementById('ai-buddy-widget')) return;

    const widgetHTML = `
      <style>
        .ai-buddy-overlay {
          position: fixed;
          bottom: 20px;
          right: 380px;
          width: 400px;
          height: 550px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 16px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          z-index: 99997;
          display: none;
          flex-direction: column;
          overflow: hidden;
        }

        .ai-buddy-overlay.open {
          display: flex;
        }

        .ai-buddy-overlay.minimized-pip {
          width: 280px;
          height: 350px;
        }

        .ai-buddy-overlay.maximized-pip {
          width: 550px;
          height: 700px;
        }

        .ai-buddy-header {
          padding: 16px 20px;
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255, 255, 255, 0.2);
        }

        .ai-buddy-title {
          display: flex;
          align-items: center;
          gap: 10px;
          color: white;
          font-weight: 600;
          font-size: 16px;
        }

        .ai-buddy-status {
          width: 8px;
          height: 8px;
          background: #10b981;
          border-radius: 50%;
          box-shadow: 0 0 8px #10b981;
        }

        .ai-buddy-controls {
          display: flex;
          gap: 8px;
        }

        .ai-buddy-control-btn {
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

        .ai-buddy-control-btn:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        .ai-buddy-messages {
          flex: 1;
          padding: 20px;
          overflow-y: auto;
          background: white;
        }

        .ai-buddy-message {
          margin-bottom: 16px;
          display: flex;
          flex-direction: column;
        }

        .ai-buddy-message.user {
          align-items: flex-end;
        }

        .ai-buddy-message.ai {
          align-items: flex-start;
        }

        .ai-buddy-message-bubble {
          max-width: 85%;
          padding: 12px 16px;
          border-radius: 16px;
          font-size: 14px;
          line-height: 1.5;
          word-wrap: break-word;
        }

        .ai-buddy-message.user .ai-buddy-message-bubble {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-bottom-right-radius: 4px;
        }

        .ai-buddy-message.ai .ai-buddy-message-bubble {
          background: #f3f4f6;
          color: #1f2937;
          border-bottom-left-radius: 4px;
        }

        .ai-buddy-input-area {
          padding: 16px 20px;
          background: white;
          border-top: 1px solid #e5e7eb;
          display: flex;
          gap: 12px;
        }

        .ai-buddy-input {
          flex: 1;
          padding: 12px 16px;
          border: 1px solid #e5e7eb;
          border-radius: 24px;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
        }

        .ai-buddy-input:focus {
          border-color: #667eea;
        }

        .ai-buddy-send-btn {
          width: 48px;
          height: 48px;
          border: none;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s;
        }

        .ai-buddy-send-btn:hover {
          transform: scale(1.05);
        }

        .ai-buddy-send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .ai-buddy-loading {
          display: flex;
          gap: 4px;
          padding: 8px;
        }

        .ai-buddy-loading-dot {
          width: 8px;
          height: 8px;
          background: #667eea;
          border-radius: 50%;
          animation: ai-buddy-bounce 1.4s infinite ease-in-out both;
        }

        .ai-buddy-loading-dot:nth-child(1) { animation-delay: -0.32s; }
        .ai-buddy-loading-dot:nth-child(2) { animation-delay: -0.16s; }

        @keyframes ai-buddy-bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }

        .ai-buddy-fab {
          position: fixed;
          bottom: 20px;
          right: 100px;
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
          z-index: 99996;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          transition: all 0.3s;
        }

        .ai-buddy-fab:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 16px rgba(102, 126, 234, 0.5);
        }

        .ai-buddy-fab.hidden {
          display: none;
        }
      </style>

      <button class="ai-buddy-fab" id="aiBuddyFab" style="display: none;">
        <i class="fas fa-robot"></i>
      </button>

      <div id="aiBuddyOverlay" class="ai-buddy-overlay">
        <div class="ai-buddy-header">
          <div class="ai-buddy-title">
            <span class="ai-buddy-status"></span>
            <span>AI Buddy</span>
          </div>
          <div class="ai-buddy-controls">
            <button id="aiBuddyPipMinusBtn" class="ai-buddy-control-btn" title="Minimize">−</button>
            <button id="aiBuddyPipPlusBtn" class="ai-buddy-control-btn" title="Maximize">+</button>
            <button id="aiBuddyCloseBtn" class="ai-buddy-control-btn" title="Close">×</button>
          </div>
        </div>
        <div id="aiBuddyMessages" class="ai-buddy-messages"></div>
        <div class="ai-buddy-input-area">
          <input type="text" id="aiBuddyInput" class="ai-buddy-input" placeholder="Ask me anything about your studies..." />
          <button id="aiBuddySendBtn" class="ai-buddy-send-btn">
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
      content: "Hi! I'm AI Buddy, your study assistant. I can help you with homework, explain concepts, provide study tips, and answer questions about any subject. What would you like to learn about today?"
    });
    displayMessages();
  }

  function initEventListeners() {
    const overlay = document.getElementById('aiBuddyOverlay');
    const fab = document.getElementById('aiBuddyFab');
    const closeBtn = document.getElementById('aiBuddyCloseBtn');
    const sendBtn = document.getElementById('aiBuddySendBtn');
    const input = document.getElementById('aiBuddyInput');
    const pipMinusBtn = document.getElementById('aiBuddyPipMinusBtn');
    const pipPlusBtn = document.getElementById('aiBuddyPipPlusBtn');

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
    const input = document.getElementById('aiBuddyInput');
    const sendBtn = document.getElementById('aiBuddySendBtn');
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
      const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 second timeout

      const response = await fetch(`${API_URL}/api/ai-buddy/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: messageText,
          chatHistory: chatHistory.slice(-6) // Only send last 3 exchanges for context
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(errorData.message || 'Failed to get AI response');
      }

      const data = await response.json();
      
      // Remove loading message
      messages = messages.filter(m => !m.loading);
      
      // Add AI response
      messages.push({ role: 'ai', content: data.reply });
      chatHistory.push({ role: 'assistant', content: data.reply });
      displayMessages();
    } catch (error) {
      console.error('AI Buddy error:', error);
      
      messages = messages.filter(m => !m.loading);
      
      let errorMessage = "Sorry, I'm having trouble responding. ";
      
      if (error.name === 'AbortError') {
        errorMessage += "The request timed out. Please try a simpler question or try again.";
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
    const container = document.getElementById('aiBuddyMessages');
    
    container.innerHTML = messages.map(msg => {
      if (msg.loading) {
        return `
          <div class="ai-buddy-message ai">
            <div class="ai-buddy-message-bubble">
              <div class="ai-buddy-loading">
                <div class="ai-buddy-loading-dot"></div>
                <div class="ai-buddy-loading-dot"></div>
                <div class="ai-buddy-loading-dot"></div>
              </div>
            </div>
          </div>
        `;
      }
      
      return `
        <div class="ai-buddy-message ${msg.role}">
          <div class="ai-buddy-message-bubble">${escapeHtml(msg.content)}</div>
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

  window.openAIBuddy = function() {
    const overlay = document.getElementById('aiBuddyOverlay');
    const fab = document.getElementById('aiBuddyFab');
    if (overlay) {
      overlay.classList.add('open');
      if (fab) fab.classList.add('hidden');
      document.getElementById('aiBuddyInput').focus();
    }
  };

  // Initialize widget
  injectAIBuddyWidget();
  
  // Show FAB after initialization
  setTimeout(() => {
    const fab = document.getElementById('aiBuddyFab');
    if (fab) fab.style.display = 'flex';
  }, 1000);
})();
