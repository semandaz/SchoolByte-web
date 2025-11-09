
// Floating Icons Module - Include this in any authenticated student page
(function() {
  'use strict';

  // Check if user is authenticated
  const token = localStorage.getItem('token');
  if (!token) {
    console.log('No token found, skipping floating icons');
    return;
  }

  // Only initialize once
  if (document.getElementById('floating-icons-container')) {
    return;
  }

  // Create container
  const container = document.createElement('div');
  container.id = 'floating-icons-container';
  container.innerHTML = `
    <style>
      .floating-icon {
        position: fixed;
        width: 50px;
        height: 50px;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        color: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 9999;
        box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
        transition: all 0.3s ease;
        font-size: 20px;
      }

      .floating-icon:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 20px rgba(99, 102, 241, 0.6);
      }

      .floating-icon .tooltip {
        position: absolute;
        right: 60px;
        background-color: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 8px 12px;
        border-radius: 8px;
        font-size: 14px;
        white-space: nowrap;
        opacity: 0;
        visibility: hidden;
        transition: all 0.3s;
        pointer-events: none;
      }

      .floating-icon:hover .tooltip {
        opacity: 1;
        visibility: visible;
      }

      .floating-icon.bytenexus {
        bottom: 160px;
        right: 20px;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
      }

      .floating-icon.ai-buddy {
        bottom: 90px;
        right: 20px;
        background: linear-gradient(135deg, #ec4899, #f43f5e);
      }

      .floating-icon.counselling {
        bottom: 20px;
        right: 20px;
        background: linear-gradient(135deg, #10b981, #059669);
      }

      @media (max-width: 768px) {
        .floating-icon {
          width: 45px;
          height: 45px;
          font-size: 18px;
        }

        .floating-icon.bytenexus {
          bottom: 140px;
          right: 15px;
        }

        .floating-icon.ai-buddy {
          bottom: 80px;
          right: 15px;
        }

        .floating-icon.counselling {
          bottom: 20px;
          right: 15px;
        }
      }
    </style>

    <div class="floating-icon bytenexus" id="bytenexusIcon">
      <i class="fas fa-comments"></i>
      <span class="tooltip">ByteNexus Chat</span>
    </div>

    <div class="floating-icon ai-buddy" id="aiBuddyIcon">
      <i class="fas fa-robot"></i>
      <span class="tooltip">AI Buddy</span>
    </div>

    <div class="floating-icon support" id="supportIcon">
      <i class="fas fa-headset"></i>
      <span class="tooltip">ByteNexus Support</span>
    </div>

    <div class="floating-icon counselling" id="counsellingIcon">
      <i class="fas fa-hands-helping"></i>
      <span class="tooltip">Career Guidance</span>
    </div>
  `;

  document.body.appendChild(container);

  // Add event listeners
  // ByteNexus chat is now handled by the widget
  const bytenexusIcon = document.getElementById('bytenexusIcon');
  if (bytenexusIcon) {
    bytenexusIcon.remove(); // Remove since widget provides its own FAB
  }

  document.getElementById('aiBuddyIcon').addEventListener('click', function() {
    if (window.openAIBuddy) {
      window.openAIBuddy();
    }
  });

  document.getElementById('supportIcon').addEventListener('click', function() {
    if (window.openByteNexusSupport) {
      window.openByteNexusSupport();
    }
  });

  document.getElementById('counsellingIcon').addEventListener('click', function() {
    window.location.href = 'career-guidance.html';
  });
})();
