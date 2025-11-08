// SchoolByte Notifications Widget
(function() {
  'use strict';

  const API_URL = window.location.origin;
  let token = localStorage.getItem('token');
  let notificationsInterval = null;

  if (!token) {
    console.log('No token found, notifications widget disabled');
    return;
  }

  function injectNotificationsWidget() {
    if (document.getElementById('notifications-widget')) return;

    const widgetHTML = `
      <style>
        .notifications-container {
          position: relative;
          display: inline-block;
        }

        .notification-bell {
          position: relative;
          cursor: pointer;
          padding: 8px;
          transition: transform 0.2s;
        }

        .notification-bell:hover {
          transform: scale(1.1);
        }

        .notification-badge {
          position: absolute;
          top: 0;
          right: 0;
          background: #b21f1f;
          color: white;
          border-radius: 10px;
          padding: 2px 6px;
          font-size: 11px;
          font-weight: 600;
          min-width: 18px;
          text-align: center;
        }

        .notification-dropdown {
          position: absolute;
          top: 100%;
          right: 0;
          margin-top: 10px;
          width: 380px;
          max-height: 500px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
          display: none;
          flex-direction: column;
          z-index: 10000;
          overflow: hidden;
        }

        .notification-dropdown.show {
          display: flex;
        }

        .notification-header {
          background: linear-gradient(135deg, #1a2a6c, #b21f1f);
          color: white;
          padding: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .notification-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
        }

        .mark-all-read-btn {
          background: rgba(255, 255, 255, 0.2);
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
          transition: background 0.2s;
        }

        .mark-all-read-btn:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        .notification-list {
          flex: 1;
          overflow-y: auto;
          max-height: 400px;
        }

        .notification-item {
          padding: 16px;
          border-bottom: 1px solid #f0f4f8;
          cursor: pointer;
          transition: background 0.2s;
          display: flex;
          gap: 12px;
          align-items: start;
        }

        .notification-item:hover {
          background: #f9fafb;
        }

        .notification-item.unread {
          background: #e8f0fe;
        }

        .notification-icon {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-size: 20px;
        }

        .notification-icon.achievement {
          background: linear-gradient(135deg, #FFD700, #FFA500);
        }

        .notification-icon.message {
          background: linear-gradient(135deg, #1a2a6c, #b21f1f);
          color: white;
        }

        .notification-icon.system {
          background: linear-gradient(135deg, #3498db, #2ecc71);
          color: white;
        }

        .notification-icon.team {
          background: linear-gradient(135deg, #9b59b6, #3498db);
          color: white;
        }

        .notification-content {
          flex: 1;
          min-width: 0;
        }

        .notification-title {
          font-weight: 600;
          font-size: 14px;
          color: #1a2a6c;
          margin-bottom: 4px;
        }

        .notification-message {
          font-size: 13px;
          color: #4b5563;
          margin-bottom: 4px;
          line-height: 1.4;
        }

        .notification-time {
          font-size: 11px;
          color: #9ca3af;
        }

        .notification-empty {
          padding: 40px 20px;
          text-align: center;
          color: #9ca3af;
        }

        .notification-empty i {
          font-size: 48px;
          margin-bottom: 12px;
          color: #d1d5db;
        }

        @media (max-width: 768px) {
          .notification-dropdown {
            width: 320px;
          }
        }
      </style>

      <div class="notifications-container" id="notificationsContainer">
        <div class="notification-bell" id="notificationBell">
          <i class="fas fa-bell" style="font-size: 20px; color: #1a2a6c;"></i>
          <span class="notification-badge" id="notificationBadge" style="display: none;">0</span>
        </div>

        <div class="notification-dropdown" id="notificationDropdown">
          <div class="notification-header">
            <h3>Notifications</h3>
            <button class="mark-all-read-btn" id="markAllReadBtn">Mark all read</button>
          </div>
          <div class="notification-list" id="notificationList">
            <div class="notification-empty">
              <i class="fas fa-bell-slash"></i>
              <p>No notifications yet</p>
            </div>
          </div>
        </div>
      </div>
    `;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = widgetHTML;
    
    // Extract the style and notifications container from the temp div
    const styleElement = tempDiv.querySelector('style');
    const notificationsContainer = tempDiv.querySelector('.notifications-container');
    
    // Inject style into document head
    if (styleElement) {
      document.head.appendChild(styleElement);
    }
    
    // Find where to inject (next to profile section in header)
    const profileSection = document.querySelector('.profile-section');
    if (profileSection && notificationsContainer) {
      profileSection.insertBefore(notificationsContainer, profileSection.firstChild);
    }

    initializeNotifications();
  }

  function initializeNotifications() {
    const bell = document.getElementById('notificationBell');
    const dropdown = document.getElementById('notificationDropdown');
    const markAllReadBtn = document.getElementById('markAllReadBtn');

    // Toggle dropdown
    bell.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('show');
      if (dropdown.classList.contains('show')) {
        loadNotifications();
      }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.notifications-container')) {
        dropdown.classList.remove('show');
      }
    });

    // Mark all as read
    markAllReadBtn.addEventListener('click', async () => {
      try {
        const response = await fetch(`${API_URL}/api/notifications/mark-all-read`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          loadNotifications();
        }
      } catch (error) {
        console.error('Error marking all notifications as read:', error);
      }
    });

    // Load notifications on page load
    loadNotifications();

    // Poll for new notifications every 30 seconds
    notificationsInterval = setInterval(loadNotifications, 30000);
  }

  async function loadNotifications() {
    try {
      const response = await fetch(`${API_URL}/api/notifications`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to load notifications');

      const data = await response.json();
      updateBadge(data.unreadCount);
      renderNotifications(data.notifications);
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  }

  function updateBadge(count) {
    const badge = document.getElementById('notificationBadge');
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = 'block';
    } else {
      badge.style.display = 'none';
    }
  }

  function renderNotifications(notifications) {
    const list = document.getElementById('notificationList');
    
    if (!notifications || notifications.length === 0) {
      list.innerHTML = `
        <div class="notification-empty">
          <i class="fas fa-bell-slash"></i>
          <p>No notifications yet</p>
        </div>
      `;
      return;
    }

    list.innerHTML = notifications.map(notif => {
      const icon = getNotificationIcon(notif.type, notif.data);
      const timeAgo = getTimeAgo(notif.createdAt);
      
      return `
        <div class="notification-item ${!notif.isRead ? 'unread' : ''}" data-id="${notif._id}" onclick="markNotificationRead('${notif._id}')">
          <div class="notification-icon ${notif.type}">
            ${icon}
          </div>
          <div class="notification-content">
            <div class="notification-title">${notif.title}</div>
            <div class="notification-message">${notif.message}</div>
            <div class="notification-time">${timeAgo}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  function getNotificationIcon(type, data) {
    switch (type) {
      case 'achievement':
        return data?.badgeIcon || '🏆';
      case 'message':
        return '<i class="fas fa-comment"></i>';
      case 'team':
        return '<i class="fas fa-users"></i>';
      case 'quiz':
        return '<i class="fas fa-question-circle"></i>';
      default:
        return '<i class="fas fa-info-circle"></i>';
    }
  }

  function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return new Date(date).toLocaleDateString();
  }

  window.markNotificationRead = async function(notificationId) {
    try {
      const response = await fetch(`${API_URL}/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        loadNotifications();
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Initialize on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectNotificationsWidget);
  } else {
    injectNotificationsWidget();
  }

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (notificationsInterval) {
      clearInterval(notificationsInterval);
    }
  });
})();
