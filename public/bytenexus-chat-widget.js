
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
        .bytenexus-chat-overlay {
          position: fixed;
          bottom: 0;
          right: 20px;
          width: 400px;
          height: 600px;
          background: white;
          border-radius: 16px 16px 0 0;
          box-shadow: 0 0 24px rgba(0, 0, 0, 0.15);
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

        .bytenexus-chat-header {
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: white;
          padding: 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
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
          border-right: 1px solid #e5e7eb;
          background: #f9fafb;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
        }

        .bytenexus-contacts-sidebar.with-chat {
          display: none;
        }

        .bytenexus-search-box {
          padding: 12px;
          background: white;
          border-bottom: 1px solid #e5e7eb;
        }

        .bytenexus-search-input {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 20px;
          outline: none;
          font-size: 14px;
        }

        .bytenexus-search-input:focus {
          border-color: #6366f1;
        }

        .bytenexus-contact-item {
          padding: 12px 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          transition: background 0.2s;
          border-bottom: 1px solid #e5e7eb;
        }

        .bytenexus-contact-item:hover {
          background: white;
        }

        .bytenexus-contact-item.active {
          background: #eef2ff;
        }

        .bytenexus-contact-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
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
          color: #1f2937;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .bytenexus-contact-preview {
          font-size: 12px;
          color: #6b7280;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .bytenexus-chat-area {
          flex: 1;
          display: none;
          flex-direction: column;
          background: white;
        }

        .bytenexus-chat-area.active {
          display: flex;
        }

        .bytenexus-chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          background: #f9fafb;
        }

        .bytenexus-message {
          display: flex;
          margin-bottom: 12px;
          animation: slideIn 0.3s ease;
        }

        @keyframes slideIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .bytenexus-message.sent {
          justify-content: flex-end;
        }

        .bytenexus-message-bubble {
          max-width: 70%;
          padding: 10px 14px;
          border-radius: 18px;
          font-size: 14px;
          word-wrap: break-word;
        }

        .bytenexus-message.received .bytenexus-message-bubble {
          background: #e5e7eb;
          color: #1f2937;
          border-bottom-left-radius: 4px;
        }

        .bytenexus-message.sent .bytenexus-message-bubble {
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: white;
          border-bottom-right-radius: 4px;
        }

        .bytenexus-message-time {
          font-size: 11px;
          margin-top: 4px;
          opacity: 0.7;
        }

        .bytenexus-chat-input-container {
          padding: 12px;
          background: white;
          border-top: 1px solid #e5e7eb;
          display: flex;
          gap: 8px;
        }

        .bytenexus-chat-input {
          flex: 1;
          padding: 10px 14px;
          border: 1px solid #d1d5db;
          border-radius: 20px;
          outline: none;
          font-size: 14px;
          resize: none;
          max-height: 100px;
        }

        .bytenexus-chat-input:focus {
          border-color: #6366f1;
        }

        .bytenexus-send-btn {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
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
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: white;
          border: none;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
          z-index: 99998;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          transition: all 0.3s;
        }

        .bytenexus-chat-fab:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 16px rgba(99, 102, 241, 0.5);
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
          color: #6b7280;
          padding: 20px;
          text-align: center;
        }

        .bytenexus-empty-state i {
          font-size: 48px;
          margin-bottom: 16px;
          color: #9ca3af;
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

      <div class="bytenexus-chat-overlay ${isMinimized ? 'minimized' : ''} ${!isOpen ? 'closed' : ''}" id="bytenexusChatOverlay">
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
            <button class="bytenexus-chat-action-btn" id="bytenexusMinimizeBtn">
              <i class="fas fa-minus"></i>
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
    const minimizeBtn = document.getElementById('bytenexusMinimizeBtn');
    const closeBtn = document.getElementById('bytenexusCloseBtn');
    const header = document.getElementById('bytenexusChatHeader');
    const backBtn = document.getElementById('bytenexusBackBtn');
    const sendBtn = document.getElementById('bytenexusSendBtn');
    const chatInput = document.getElementById('bytenexusChatInput');

    fab.addEventListener('click', () => {
      overlay.classList.remove('closed');
      overlay.classList.remove('minimized');
      fab.classList.add('hidden');
      localStorage.setItem('chatOpen', 'true');
      localStorage.setItem('chatMinimized', 'false');
    });

    minimizeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      overlay.classList.toggle('minimized');
      const isMin = overlay.classList.contains('minimized');
      localStorage.setItem('chatMinimized', isMin);
    });

    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      overlay.classList.add('closed');
      fab.classList.remove('hidden');
      localStorage.setItem('chatOpen', 'false');
    });

    header.addEventListener('click', () => {
      if (overlay.classList.contains('minimized')) {
        overlay.classList.remove('minimized');
        localStorage.setItem('chatMinimized', 'false');
      }
    });

    backBtn.addEventListener('click', () => {
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

    container.innerHTML = messages.map(msg => {
      const isSent = msg.sender_id === currentUser.id;
      const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      return `
        <div class="bytenexus-message ${isSent ? 'sent' : 'received'}">
          <div class="bytenexus-message-bubble">
            <div>${msg.content}</div>
            <div class="bytenexus-message-time">${time}</div>
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
      tempId: tempId
    };

    messages.push(tempMessage);
    displayMessages();

    socket.emit('send_personal_message', {
      recipientId: activeContact.id,
      content: content,
      tempId: tempId
    });

    input.value = '';
    input.style.height = 'auto';
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectChatWidget);
  } else {
    injectChatWidget();
  }
})();
