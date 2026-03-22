// Enhanced Floating Icons Module - Professional & Draggable
(function() {
    'use strict';

    // Check if user is authenticated
    const token = localStorage.getItem('token');
    if (!token) {
        return;
    }

    // Only initialize once
    if (window.floatingIconsInitialized) {
        return;
    }
    window.floatingIconsInitialized = true;

    // Create main container
    const container = document.createElement('div');
    container.id = 'floating-icons-container';
    document.body.appendChild(container);

    // Add professional styles
    const styles = document.createElement('style');
    styles.textContent = `
        .floating-icon {
            position: fixed;
            width: 60px;
            height: 60px;
            background: linear-gradient(135deg, var(--color-brand-primary), var(--color-brand-secondary));
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: grab;
            z-index: 9998;
            box-shadow: 0 6px 25px rgba(0, 0, 0, 0.3);
            transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            font-size: 22px;
            user-select: none;
            touch-action: none;
            border: 3px solid rgba(255, 255, 255, 0.1);
        }

        .floating-icon:hover {
            transform: scale(1.15) rotate(5deg);
            box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
            cursor: pointer;
        }

        .floating-icon:active {
            cursor: grabbing;
            transform: scale(1.1);
            transition: transform 0.1s;
        }

        .floating-icon.dragging {
            z-index: 10001;
            opacity: 0.9;
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
        }

        .floating-icon .tooltip {
            position: absolute;
            right: 70px;
            background: var(--overlay-dark);
            color: white;
            padding: 10px 15px;
            border-radius: 12px;
            font-size: 13px;
            font-weight: 600;
            white-space: nowrap;
            opacity: 0;
            visibility: hidden;
            transition: all 0.3s;
            pointer-events: none;
            z-index: 10000;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .floating-icon:hover .tooltip {
            opacity: 1;
            visibility: visible;
            transform: translateX(-5px);
        }

        /* Individual icon styles using SchoolByte brand colors */
        .floating-icon.notifications {
            background: linear-gradient(135deg, var(--color-brand-primary), var(--color-brand-secondary));
        }

        .floating-icon.ai-buddy {
            background: linear-gradient(135deg, #6366f1, var(--color-brand-primary));
        }

        .floating-icon.counselling {
            background: linear-gradient(135deg, var(--color-success-green), #10b981);
        }

        .floating-icon.career {
            background: linear-gradient(135deg, var(--color-brand-gold), var(--color-brand-orange));
        }

        .floating-icon.bytenexus {
            background: linear-gradient(135deg, var(--color-brand-secondary), #b21f1f);
        }

        /* Notification badge */
        .floating-icon.notifications.has-notifications::after {
            content: '';
            position: absolute;
            top: 2px;
            right: 2px;
            width: 16px;
            height: 16px;
            background: var(--color-brand-gold);
            border-radius: 50%;
            border: 2px solid white;
            animation: pulse 2s infinite;
            box-shadow: 0 0 10px var(--color-brand-gold);
        }

        /* Widget Styles */
        .widget-modal {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(0.9);
            width: 90%;
            max-width: 500px;
            max-height: 80vh;
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            z-index: 10002;
            opacity: 0;
            visibility: hidden;
            transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .widget-modal.active {
            opacity: 1;
            visibility: visible;
            transform: translate(-50%, -50%) scale(1);
        }

        .widget-header {
            background: linear-gradient(135deg, var(--color-brand-primary), var(--color-brand-secondary));
            color: white;
            padding: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            position: relative;
        }

        .widget-header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: linear-gradient(90deg, var(--color-brand-gold), var(--color-brand-orange));
        }

        .widget-header h3 {
            margin: 0;
            font-size: 1.3rem;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .widget-header h3 i {
            color: var(--color-brand-gold);
        }

        .close-widget {
            background: rgba(255, 255, 255, 0.2);
            border: none;
            color: white;
            font-size: 1.1rem;
            cursor: pointer;
            padding: 8px;
            border-radius: 50%;
            width: 35px;
            height: 35px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s;
            backdrop-filter: blur(10px);
        }

        .close-widget:hover {
            background: rgba(255, 255, 255, 0.3);
            transform: rotate(90deg);
        }

        .widget-content {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            background: var(--color-neutral-lightest);
            max-height: 400px;
        }

        /* AI Buddy Specific Styles */
        .ai-buddy-content {
            text-align: center;
        }

        .ai-avatar {
            font-size: 4rem;
            color: var(--color-brand-primary);
            margin-bottom: 1rem;
        }

        .ai-input-group {
            display: flex;
            gap: 10px;
            margin-top: 20px;
        }

        .ai-input {
            flex: 1;
            padding: 12px 15px;
            border: 2px solid var(--color-neutral-light);
            border-radius: 10px;
            font-size: 0.9rem;
            transition: all 0.3s;
        }

        .ai-input:focus {
            outline: none;
            border-color: var(--color-brand-primary);
        }

        .ai-send-btn {
            background: linear-gradient(135deg, var(--color-brand-primary), var(--color-brand-secondary));
            color: white;
            border: none;
            padding: 12px 20px;
            border-radius: 10px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.3s;
        }

        .ai-send-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
        }

        /* Career Guidance Specific Styles */
        .career-options {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
            gap: 15px;
            margin-top: 20px;
        }

        .career-option {
            background: white;
            padding: 15px;
            border-radius: 10px;
            text-align: center;
            cursor: pointer;
            transition: all 0.3s;
            border: 2px solid transparent;
        }

        .career-option:hover {
            border-color: var(--color-brand-primary);
            transform: translateY(-3px);
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
        }

        .career-icon {
            font-size: 2rem;
            color: var(--color-brand-primary);
            margin-bottom: 10px;
        }

        /* Counselling Specific Styles */
        .counselling-options {
            display: flex;
            flex-direction: column;
            gap: 15px;
            margin-top: 20px;
        }

        .counselling-option {
            background: white;
            padding: 20px;
            border-radius: 10px;
            cursor: pointer;
            transition: all 0.3s;
            border-left: 4px solid var(--color-success-green);
        }

        .counselling-option:hover {
            transform: translateX(5px);
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
        }

        /* ByteNexus Chat Specific Styles */
        .chat-messages {
            height: 300px;
            overflow-y: auto;
            padding: 15px;
            background: white;
            border-radius: 10px;
            margin-bottom: 15px;
        }

        .message {
            margin-bottom: 15px;
            padding: 10px 15px;
            border-radius: 15px;
            max-width: 80%;
        }

        .message.user {
            background: linear-gradient(135deg, var(--color-brand-primary), var(--color-brand-secondary));
            color: white;
            margin-left: auto;
        }

        .message.bot {
            background: var(--color-neutral-lightest);
            color: var(--color-neutral-dark);
        }

        .chat-input-group {
            display: flex;
            gap: 10px;
        }

        .chat-input {
            flex: 1;
            padding: 12px 15px;
            border: 2px solid var(--color-neutral-light);
            border-radius: 10px;
            font-size: 0.9rem;
        }

        .chat-send-btn {
            background: linear-gradient(135deg, var(--color-brand-primary), var(--color-brand-secondary));
            color: white;
            border: none;
            padding: 12px 20px;
            border-radius: 10px;
            cursor: pointer;
            font-weight: 600;
        }

        /* Activity Feed Styles */
        .activity-feed-modal {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(0.9);
            width: 90%;
            max-width: 450px;
            max-height: 80vh;
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            z-index: 10002;
            opacity: 0;
            visibility: hidden;
            transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .activity-feed-modal.active {
            opacity: 1;
            visibility: visible;
            transform: translate(-50%, -50%) scale(1);
        }

        .activity-feed-header {
            background: linear-gradient(135deg, var(--color-brand-primary), var(--color-brand-secondary));
            color: white;
            padding: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            position: relative;
        }

        .activity-feed-header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: linear-gradient(90deg, var(--color-brand-gold), var(--color-brand-orange));
        }

        .feed-items-container {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            background: var(--color-neutral-lightest);
            max-height: 400px;
        }

        .activity-item {
            background: white;
            padding: 15px;
            margin-bottom: 12px;
            border-radius: 12px;
            border-left: 5px solid var(--color-brand-primary);
            animation: slideInUp 0.4s ease-out;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
            position: relative;
            padding-right: 45px;
            transition: all 0.3s;
            border: 1px solid rgba(0, 0, 0, 0.05);
        }

        .activity-item:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);
        }

        .activity-icon {
            font-size: 1.1rem;
            margin-right: 10px;
            color: var(--color-brand-primary);
        }

        .activity-text {
            font-size: 0.9rem;
            color: var(--color-neutral-dark);
            line-height: 1.5;
            font-weight: 500;
        }

        .activity-time {
            font-size: 0.75rem;
            color: var(--color-neutral-medium);
            margin-top: 5px;
            font-weight: 600;
        }

        .dismiss-btn {
            position: absolute;
            top: 12px;
            right: 12px;
            background: var(--color-neutral-lightest);
            border: none;
            color: var(--color-neutral-medium);
            cursor: pointer;
            font-size: 0.8rem;
            padding: 5px;
            border-radius: 50%;
            width: 25px;
            height: 25px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s;
        }

        .dismiss-btn:hover {
            background: var(--color-error-red);
            color: white;
            transform: scale(1.1);
        }

        .no-notifications {
            text-align: center;
            color: var(--color-neutral-medium);
            padding: 40px 20px;
            font-style: italic;
            font-size: 1rem;
        }

        .feed-actions {
            padding: 20px;
            border-top: 1px solid var(--color-neutral-light);
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: white;
        }

        .notification-count {
            background: linear-gradient(135deg, var(--color-brand-primary), var(--color-brand-secondary));
            color: white;
            border-radius: 15px;
            padding: 6px 12px;
            font-size: 0.8rem;
            font-weight: 700;
        }

        .clear-all-btn {
            background: var(--color-error-red);
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 20px;
            cursor: pointer;
            font-size: 0.85rem;
            font-weight: 600;
            transition: all 0.3s;
            display: flex;
            align-items: center;
            gap: 5px;
        }

        .clear-all-btn:hover {
            background: var(--color-error-red-dark);
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(231, 76, 60, 0.3);
        }

        /* Overlay */
        .widget-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.6);
            z-index: 10001;
            opacity: 0;
            visibility: hidden;
            transition: all 0.4s ease;
            backdrop-filter: blur(8px);
        }

        .widget-overlay.active {
            opacity: 1;
            visibility: visible;
        }

        /* Animations */
        @keyframes pulse {
            0% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.2); opacity: 0.8; }
            100% { transform: scale(1); opacity: 1; }
        }

        @keyframes slideInUp {
            from {
                transform: translateY(15px);
                opacity: 0;
            }
            to {
                transform: translateY(0);
                opacity: 1;
            }
        }

        @keyframes bounceIn {
            0% { transform: scale(0.3); opacity: 0; }
            50% { transform: scale(1.05); opacity: 1; }
            70% { transform: scale(0.9); }
            100% { transform: scale(1); opacity: 1; }
        }

        /* Safe zone indicator */
        .bytes-counter-safe-zone {
            position: fixed;
            bottom: 80px;
            right: 80px;
            width: 150px;
            height: 150px;
            z-index: 9997;
            pointer-events: none;
            display: none;
        }

        /* Responsive Design */
        @media (max-width: 768px) {
            .floating-icon {
                width: 55px;
                height: 55px;
                font-size: 20px;
            }

            .widget-modal, .activity-feed-modal {
                width: 95%;
                max-height: 85vh;
            }

            .floating-icon .tooltip {
                right: 65px;
                font-size: 12px;
                padding: 8px 12px;
            }
        }
    `;
    document.head.appendChild(styles);

    // Create safe zone for bytes counter
    const safeZone = document.createElement('div');
    safeZone.className = 'bytes-counter-safe-zone';
    document.body.appendChild(safeZone);

    // Floating Icons Manager Class
    class FloatingIconsManager {
        constructor() {
            this.icons = [];
            this.activities = [];
            this.notificationCount = 0;
            this.positions = this.loadPositions();
            this.currentWidget = null;
            this.init();
        }

        init() {
            this.createIcons();
            this.createActivityFeed();
            this.createWidgets();
            this.loadActivities();
            this.makeIconsDraggable();
        }

        createIcons() {
            const iconsConfig = [
                {
                    id: 'notificationsIcon',
                    icon: 'fas fa-bell',
                    tooltip: 'Notifications',
                    className: 'notifications',
                    defaultLeft: 20,
                    defaultTop: 120
                },
                {
                    id: 'aiBuddyIcon',
                    icon: 'fas fa-robot',
                    tooltip: 'AI Study Buddy',
                    className: 'ai-buddy',
                    defaultLeft: 20,
                    defaultTop: 200
                },
                {
                    id: 'counsellingIcon',
                    icon: 'fas fa-heart',
                    tooltip: 'Counselling',
                    className: 'counselling',
                    defaultLeft: 20,
                    defaultTop: 280
                },
                {
                    id: 'careerIcon',
                    icon: 'fas fa-briefcase',
                    tooltip: 'Career Guidance',
                    className: 'career',
                    defaultLeft: 20,
                    defaultTop: 360
                }
            ];

            iconsConfig.forEach(config => {
                const icon = this.createIconElement(config);
                container.appendChild(icon);
                this.icons.push(icon);
            });
        }

        createIconElement(config) {
            const icon = document.createElement('div');
            icon.className = `floating-icon ${config.className}`;
            icon.id = config.id;
            icon.innerHTML = `
                <i class="${config.icon}"></i>
                <span class="tooltip">${config.tooltip}</span>
            `;

            // Set position from saved or default
            const savedPosition = this.positions[config.id];
            if (savedPosition) {
                icon.style.left = `${savedPosition.x}px`;
                icon.style.top = `${savedPosition.y}px`;
            } else {
                icon.style.left = `${config.defaultLeft}px`;
                icon.style.top = `${config.defaultTop}px`;
            }

            this.addClickHandler(icon, config.id);
            return icon;
        }

        addClickHandler(icon, id) {
            icon.addEventListener('click', (e) => {
                if (icon.classList.contains('dragging')) return;

                switch(id) {
                    case 'notificationsIcon':
                        this.toggleActivityFeed();
                        break;
                    case 'aiBuddyIcon':
                        this.openAIBuddy();
                        break;
                    case 'counsellingIcon':
                        this.openCounselling();
                        break;
                    case 'careerIcon':
                        this.openCareerGuidance();
                        break;
                }
            });
        }

        // AI Buddy Functionality
        openAIBuddy(contextType, contextLabel) {
            if (contextType && contextLabel) {
                this._aiContext = this._aiContext || {};
                // Update the modal header text to reflect context
                const header = document.querySelector('#aiBuddyModal .widget-header h3');
                if (header) {
                    if (contextType === 'career') {
                        header.innerHTML = '<i class="fas fa-briefcase"></i> Career Advisor · ' + contextLabel.split(' ').slice(0,3).join(' ');
                    } else if (contextType === 'counselling') {
                        header.innerHTML = '<i class="fas fa-heart"></i> ' + contextLabel;
                    }
                }
                // Set a context prompt in the input
                const input = document.querySelector('#aiChatInput');
                if (input && !input.value) {
                    if (contextType === 'career') input.placeholder = 'Ask about ' + contextLabel + ' careers...';
                    else if (contextType === 'counselling') input.placeholder = 'Share what's on your mind...';
                }
                this.addActivity('AI ' + (contextType === 'career' ? 'Career Advisor' : 'Counsellor') + ' opened', 'info');
            } else {
                this._aiContext = null;
                const header = document.querySelector('#aiBuddyModal .widget-header h3');
                if (header) header.innerHTML = '<i class="fas fa-robot"></i> AI Study Buddy';
                const input = document.querySelector('#aiChatInput');
                if (input) input.placeholder = 'Ask me anything...';
                this.addActivity('Opened AI Study Buddy', 'info');
            }
            this.showWidget('aiBuddyModal', null, null);
        }

        // Career Guidance Functionality
        openCareerGuidance() {
            this.showWidget('careerModal', 'Career Guidance', 'fas fa-briefcase');
            this.addActivity('Opened Career Guidance', 'info');
        }

        // Counselling Functionality
        openCounselling() {
            this.showWidget('counsellingModal', 'Counselling Support', 'fas fa-heart');
            this.addActivity('Opened Counselling Support', 'info');
        }

        createWidgets() {
            // Create overlay
            this.overlay = document.createElement('div');
            this.overlay.className = 'widget-overlay';
            this.overlay.addEventListener('click', () => this.closeCurrentWidget());
            document.body.appendChild(this.overlay);

            // AI Buddy Modal
            this.createAIBuddyModal();

            // Career Guidance Modal
            this.createCareerModal();

            // Counselling Modal
            this.createCounsellingModal();
        }

        createAIBuddyModal() {
            const modal = document.createElement('div');
            modal.className = 'widget-modal';
            modal.id = 'aiBuddyModal';
            modal.style.cssText = 'max-width: 520px; display: flex; flex-direction: column;';
            modal.innerHTML = `
                <div class="widget-header" style="flex-shrink:0;">
                    <h3><i class="fas fa-robot"></i> AI Study Buddy</h3>
                    <button class="close-widget"><i class="fas fa-times"></i></button>
                </div>
                <div class="ai-chat-messages" id="aiChatMessages" style="
                    flex: 1;
                    overflow-y: auto;
                    padding: 16px;
                    background: #f8f9fc;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    min-height: 280px;
                    max-height: 380px;
                ">
                    <div class="ai-welcome-msg" style="
                        display: flex; align-items: flex-start; gap: 10px;
                    ">
                        <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#818cf8);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                            <i class="fas fa-robot" style="color:white;font-size:14px;"></i>
                        </div>
                        <div style="background:white;border-radius:0 12px 12px 12px;padding:10px 14px;box-shadow:0 1px 4px rgba(0,0,0,0.08);max-width:85%;font-size:0.875rem;line-height:1.5;color:#374151;">
                            Hi! I'm your AI Study Buddy. Ask me anything about your subjects, homework, or concepts you want to understand better!
                        </div>
                    </div>
                </div>
                <div style="padding:12px 16px;border-top:1px solid #e5e7eb;background:white;flex-shrink:0;">
                    <div style="display:flex;gap:8px;align-items:center;">
                        <input
                            type="text"
                            id="aiChatInput"
                            placeholder="Ask a question..."
                            style="flex:1;padding:10px 14px;border:2px solid #e5e7eb;border-radius:24px;font-size:0.875rem;outline:none;transition:border-color 0.2s;font-family:inherit;"
                            autocomplete="off"
                        />
                        <button id="aiSendBtn" style="
                            width:40px;height:40px;border-radius:50%;
                            background:linear-gradient(135deg,#6366f1,#818cf8);
                            border:none;color:white;font-size:16px;
                            cursor:pointer;display:flex;align-items:center;justify-content:center;
                            flex-shrink:0;transition:opacity 0.2s;
                        ">
                            <i class="fas fa-paper-plane"></i>
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            const chatMessages = modal.querySelector('#aiChatMessages');
            const chatInput = modal.querySelector('#aiChatInput');
            const sendBtn = modal.querySelector('#aiSendBtn');

            chatInput.addEventListener('focus', () => { chatInput.style.borderColor = '#6366f1'; });
            chatInput.addEventListener('blur', () => { chatInput.style.borderColor = '#e5e7eb'; });

            modal.querySelector('.close-widget').addEventListener('click', () => this.closeCurrentWidget());
            sendBtn.addEventListener('click', () => this.handleAIChat());
            chatInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.handleAIChat(); }
            });

            this._aiChatMessages = chatMessages;
            this._aiChatInput = chatInput;
            this._aiSendBtn = sendBtn;
        }

        createCareerModal() {
            const modal = document.createElement('div');
            modal.className = 'widget-modal';
            modal.id = 'careerModal';
            modal.innerHTML = `
                <div class="widget-header">
                    <h3><i class="fas fa-briefcase"></i> Career Guidance</h3>
                    <button class="close-widget">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="widget-content">
                    <p>Explore different career paths and discover what suits you best!</p>

                    <div class="career-options">
                        <div class="career-option" data-career="stem">
                            <div class="career-icon"><i class="fas fa-atom"></i></div>
                            <div>STEM Careers</div>
                        </div>
                        <div class="career-option" data-career="arts">
                            <div class="career-icon"><i class="fas fa-palette"></i></div>
                            <div>Arts & Design</div>
                        </div>
                        <div class="career-option" data-career="business">
                            <div class="career-icon"><i class="fas fa-chart-line"></i></div>
                            <div>Business</div>
                        </div>
                        <div class="career-option" data-career="health">
                            <div class="career-icon"><i class="fas fa-heartbeat"></i></div>
                            <div>Healthcare</div>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            modal.querySelector('.close-widget').addEventListener('click', () => this.closeCurrentWidget());
            modal.querySelectorAll('.career-option').forEach(option => {
                option.addEventListener('click', (e) => {
                    const career = e.currentTarget.dataset.career;
                    this.showCareerDetails(career);
                });
            });
        }

        createCounsellingModal() {
            const modal = document.createElement('div');
            modal.className = 'widget-modal';
            modal.id = 'counsellingModal';
            modal.innerHTML = `
                <div class="widget-header">
                    <h3><i class="fas fa-heart"></i> Counselling Support</h3>
                    <button class="close-widget">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="widget-content">
                    <p>We're here to support you. Choose the type of support you need:</p>

                    <div class="counselling-options">
                        <div class="counselling-option" data-type="academic">
                            <h4>Academic Support</h4>
                            <p>Get help with study stress, time management, and academic challenges</p>
                        </div>
                        <div class="counselling-option" data-type="emotional">
                            <h4>Emotional Support</h4>
                            <p>Talk about feelings, relationships, and personal challenges</p>
                        </div>
                        <div class="counselling-option" data-type="crisis">
                            <h4>Crisis Support</h4>
                            <p>Immediate help for urgent situations</p>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            modal.querySelector('.close-widget').addEventListener('click', () => this.closeCurrentWidget());
            modal.querySelectorAll('.counselling-option').forEach(option => {
                option.addEventListener('click', (e) => {
                    const type = e.currentTarget.dataset.type;
                    this.connectToCounsellor(type);
                });
            });
        }

        showWidget(widgetId, title, icon) {
            this.closeCurrentWidget();
            this.currentWidget = document.getElementById(widgetId);
            this.currentWidget.classList.add('active');
            this.overlay.classList.add('active');
        }

        closeCurrentWidget() {
            if (this.currentWidget) {
                this.currentWidget.classList.remove('active');
            }
            this.overlay.classList.remove('active');
            this.currentWidget = null;
        }

        async handleAIChat() {
            const input = this._aiChatInput || document.querySelector('#aiChatInput');
            const question = input ? input.value.trim() : '';
            if (!question) return;

            const sendBtn = this._aiSendBtn || document.querySelector('#aiSendBtn');
            const chatMessages = this._aiChatMessages || document.querySelector('#aiChatMessages');

            // Immediately show the user's message
            const userBubble = document.createElement('div');
            userBubble.style.cssText = 'display:flex;justify-content:flex-end;';
            userBubble.innerHTML = `
                <div style="background:linear-gradient(135deg,#6366f1,#818cf8);color:white;border-radius:12px 0 12px 12px;padding:10px 14px;max-width:85%;font-size:0.875rem;line-height:1.5;">
                    ${question.replace(/</g,'&lt;').replace(/>/g,'&gt;')}
                </div>
            `;
            chatMessages.appendChild(userBubble);
            chatMessages.scrollTop = chatMessages.scrollHeight;

            // Clear input and disable controls
            input.value = '';
            input.disabled = true;
            sendBtn.disabled = true;
            sendBtn.style.opacity = '0.5';

            // Show typing indicator
            const typingRow = document.createElement('div');
            typingRow.style.cssText = 'display:flex;align-items:flex-start;gap:10px;';
            typingRow.innerHTML = `
                <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#818cf8);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                    <i class="fas fa-robot" style="color:white;font-size:14px;"></i>
                </div>
                <div class="ai-typing-indicator" style="background:white;border-radius:0 12px 12px 12px;padding:10px 16px;box-shadow:0 1px 4px rgba(0,0,0,0.08);display:flex;gap:4px;align-items:center;">
                    <span style="width:7px;height:7px;border-radius:50%;background:#6366f1;animation:aiBounce 1s infinite 0s;display:inline-block;"></span>
                    <span style="width:7px;height:7px;border-radius:50%;background:#6366f1;animation:aiBounce 1s infinite 0.15s;display:inline-block;"></span>
                    <span style="width:7px;height:7px;border-radius:50%;background:#6366f1;animation:aiBounce 1s infinite 0.3s;display:inline-block;"></span>
                </div>
            `;
            chatMessages.appendChild(typingRow);
            chatMessages.scrollTop = chatMessages.scrollHeight;

            // Ensure animation keyframes injected once
            if (!document.getElementById('aiBounceStyle')) {
                const s = document.createElement('style');
                s.id = 'aiBounceStyle';
                s.textContent = '@keyframes aiBounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}';
                document.head.appendChild(s);
            }

            this.addActivity('Asked AI: ' + question, 'info');

            try {
                const authToken = localStorage.getItem('token');
                if (!authToken) throw new Error('Not authenticated');

                const response = await fetch('/api/ai-buddy/chat', {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + authToken,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ message: question, context: this._aiContext || null })
                });

                if (!response.ok || !response.body) {
                    let errMsg = 'Failed to get AI response';
                    try { const d = await response.json(); errMsg = d.error || errMsg; } catch(e){}
                    throw new Error(errMsg);
                }

                // Replace typing indicator with AI message bubble
                const aiBubbleRow = document.createElement('div');
                aiBubbleRow.style.cssText = 'display:flex;align-items:flex-start;gap:10px;';
                aiBubbleRow.innerHTML = `
                    <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#818cf8);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                        <i class="fas fa-robot" style="color:white;font-size:14px;"></i>
                    </div>
                    <div class="ai-response-text" style="background:white;border-radius:0 12px 12px 12px;padding:10px 14px;box-shadow:0 1px 4px rgba(0,0,0,0.08);max-width:85%;font-size:0.875rem;line-height:1.6;color:#374151;white-space:pre-wrap;word-break:break-word;"></div>
                `;

                typingRow.replaceWith(aiBubbleRow);
                const responseText = aiBubbleRow.querySelector('.ai-response-text');

                // Stream reading
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                let fullText = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop(); // Keep incomplete line

                    for (const line of lines) {
                        if (!line.startsWith('data: ')) continue;
                        const jsonStr = line.slice(6).trim();
                        if (!jsonStr) continue;
                        try {
                            const parsed = JSON.parse(jsonStr);
                            if (parsed.error) { responseText.textContent = parsed.error; break; }
                            if (parsed.token) {
                                fullText += parsed.token;
                                responseText.textContent = fullText;
                                chatMessages.scrollTop = chatMessages.scrollHeight;
                            }
                            if (parsed.done) break;
                        } catch(e) {}
                    }
                }

                if (!fullText) responseText.textContent = 'Sorry, I could not generate a response. Please try again.';

            } catch (error) {
                console.error('AI chat error:', error);
                typingRow.remove();
                const errRow = document.createElement('div');
                errRow.style.cssText = 'display:flex;align-items:flex-start;gap:10px;';
                errRow.innerHTML = `
                    <div style="width:32px;height:32px;border-radius:50%;background:#ef4444;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                        <i class="fas fa-robot" style="color:white;font-size:14px;"></i>
                    </div>
                    <div style="background:#fef2f2;border-radius:0 12px 12px 12px;padding:10px 14px;max-width:85%;font-size:0.875rem;line-height:1.5;color:#991b1b;">
                        ${error.message || 'Something went wrong. Please try again.'}
                    </div>
                `;
                chatMessages.appendChild(errRow);
            } finally {
                input.disabled = false;
                sendBtn.disabled = false;
                sendBtn.style.opacity = '1';
                input.focus();
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        }

        showAIChatResponse(response) {
            // Legacy: now handled inline in handleAIChat streaming
        }

        showCareerDetails(career) {
            const careerTitles = { stem: 'Science, Technology, Engineering & Mathematics', arts: 'Arts & Creative Careers', business: 'Business & Entrepreneurship', health: 'Healthcare & Medicine' };
            const careerDesc = careerTitles[career] || career;
            this.addActivity('Exploring ' + careerDesc + ' careers', 'info');
            this._aiContext = { type: 'career', topic: career };
            this.closeCurrentWidget();
            setTimeout(() => { this.openAIBuddy('career', careerDesc); }, 200);
        }

        connectToCounsellor(type) {
            const types = {
                academic: "Academic Counsellor",
                emotional: "Emotional Support Specialist",
                crisis: "Crisis Support Team"
            };
            const typeDesc = types[type] || 'Counsellor';
            this.addActivity('Connected to ' + typeDesc, 'info');
            this._aiContext = { type: 'counselling', topic: type };
            this.closeCurrentWidget();
            setTimeout(() => {
                this.openAIBuddy('counselling', typeDesc);
            }, 200);
        }

        makeIconsDraggable() {
            this.icons.forEach(icon => {
                this.makeDraggable(icon);
            });
        }

        makeDraggable(element) {
            let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
            let isDragging = false;
            let dragStartTime = 0;
            const self = this;

            element.addEventListener('mousedown', dragMouseDown);
            element.addEventListener('touchstart', dragTouchStart, { passive: false });

            function dragMouseDown(e) {
                if (e.button !== 0) return;

                e.preventDefault();
                e.stopPropagation();
                isDragging = false;
                dragStartTime = Date.now();
                pos3 = e.clientX;
                pos4 = e.clientY;

                document.addEventListener('mouseup', closeDragElement);
                document.addEventListener('mousemove', elementDrag);
                element.classList.add('dragging');

                setTimeout(() => { isDragging = true; }, 150);
            }

            function dragTouchStart(e) {
                e.preventDefault();
                const touch = e.touches[0];
                isDragging = false;
                dragStartTime = Date.now();
                pos3 = touch.clientX;
                pos4 = touch.clientY;

                document.addEventListener('touchend', closeDragElement);
                document.addEventListener('touchmove', elementDragTouch, { passive: false });
                element.classList.add('dragging');

                setTimeout(() => { isDragging = true; }, 150);
            }

            function elementDrag(e) {
                if (!isDragging) return;

                e.preventDefault();
                pos1 = pos3 - e.clientX;
                pos2 = pos4 - e.clientY;
                pos3 = e.clientX;
                pos4 = e.clientY;

                const newTop = element.offsetTop - pos2;
                const newLeft = element.offsetLeft - pos1;

                if (isPositionValid(newLeft, newTop, element)) {
                    element.style.top = newTop + "px";
                    element.style.left = newLeft + "px";
                    element.style.right = "auto";
                }
            }

            function elementDragTouch(e) {
                if (!isDragging) return;

                e.preventDefault();
                const touch = e.touches[0];
                pos1 = pos3 - touch.clientX;
                pos2 = pos4 - touch.clientY;
                pos3 = touch.clientX;
                pos4 = touch.clientY;

                const newTop = element.offsetTop - pos2;
                const newLeft = element.offsetLeft - pos1;

                if (isPositionValid(newLeft, newTop, element)) {
                    element.style.top = newTop + "px";
                    element.style.left = newLeft + "px";
                    element.style.right = "auto";
                }
            }

            function closeDragElement(e) {
                document.removeEventListener('mouseup', closeDragElement);
                document.removeEventListener('mousemove', elementDrag);
                document.removeEventListener('touchend', closeDragElement);
                document.removeEventListener('touchmove', elementDragTouch);
                element.classList.remove('dragging');

                const dragDuration = Date.now() - dragStartTime;

                if (isDragging && dragDuration > 200) {
                    const rect = element.getBoundingClientRect();
                    self.savePosition(element.id, {
                        x: rect.left,
                        y: rect.top
                    });
                    e.preventDefault();
                    e.stopPropagation();
                }

                isDragging = false;
            }

            function isPositionValid(x, y, element) {
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;
                const elementSize = 60;

                const bytesCounter = document.querySelector('.bytes-counter');
                let bytesCounterRect = { left: 0, top: 0, right: 0, bottom: 0 };

                if (bytesCounter) {
                    bytesCounterRect = bytesCounter.getBoundingClientRect();
                    const safeZonePadding = 20;
                    bytesCounterRect.left -= safeZonePadding;
                    bytesCounterRect.top -= safeZonePadding;
                    bytesCounterRect.right += safeZonePadding;
                    bytesCounterRect.bottom += safeZonePadding;
                }

                const isInViewport = x >= 0 &&
                                   x <= viewportWidth - elementSize &&
                                   y >= 0 &&
                                   y <= viewportHeight - elementSize;

                const isInBytesCounterZone = x >= bytesCounterRect.left &&
                                          x <= bytesCounterRect.right &&
                                          y >= bytesCounterRect.top &&
                                          y <= bytesCounterRect.bottom;

                return isInViewport && !isInBytesCounterZone;
            }
        }

        createActivityFeed() {
            // Create activity feed modal
            this.feed = document.createElement('div');
            this.feed.className = 'activity-feed-modal';
            this.feed.innerHTML = `
                <div class="activity-feed-header">
                    <h3><i class="fas fa-bell"></i> Notifications</h3>
                    <button class="close-widget">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="feed-items-container" id="floatingFeedItems">
                    <div class="no-notifications">
                        <i class="fas fa-bell-slash"></i>
                        No notifications yet
                    </div>
                </div>
                <div class="feed-actions">
                    <div class="notification-count">0 notifications</div>
                    <button class="clear-all-btn">
                        <i class="fas fa-trash"></i> Clear All
                    </button>
                </div>
            `;
            document.body.appendChild(this.feed);

            this.feed.querySelector('.close-widget').addEventListener('click', () => this.toggleActivityFeed());
            this.feed.querySelector('.clear-all-btn').addEventListener('click', () => this.clearAllActivities());
        }

        toggleActivityFeed() {
            this.feed.classList.toggle('active');
            this.overlay.classList.toggle('active');

            if (this.feed.classList.contains('active')) {
                this.resetNotificationBadge();
                this.fetchNotifications(); // Fetch notifications when feed is opened
            }
        }

        async fetchNotifications() {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`${window.location.origin}/api/notifications`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (!response.ok) throw new Error('Failed to fetch notifications');
                const data = await response.json();
                this.activities = data.notifications.map(n => ({
                    text: n.message,
                    type: n.type || 'info', // Default to 'info' if type is missing
                    icon: this.getIconForType(n.type),
                    time: new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    timestamp: new Date(n.createdAt).getTime(),
                    id: n._id // Store the notification ID
                }));
                this.renderActivities();
                this.updateNotificationBadge();
            } catch (error) {
                console.error('Error fetching notifications:', error);
                // Optionally display an error message to the user
            }
        }

        getIconForType(type) {
            const icons = {
                'coin': 'fas fa-coins',
                'quiz': 'fas fa-question-circle',
                'game': 'fas fa-gamepad',
                'info': 'fas fa-info-circle',
                'welcome': 'fas fa-handshake',
                'activity': 'fas fa-running'
            };
            return icons[type] || 'fas fa-bell';
        }


        addActivity(text, type = 'info') {
            const now = new Date();
            const activity = {
                text,
                type,
                icon: this.getIconForType(type),
                time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                timestamp: now.getTime()
            };

            this.activities.unshift(activity);
            this.saveActivities(); // This will now be a no-op or do nothing related to local storage
            this.renderActivities();
            this.updateNotificationBadge();
        }

        renderActivities() {
            const feedItems = this.feed.querySelector('#floatingFeedItems');
            const noNotifications = feedItems.querySelector('.no-notifications');

            if (this.activities.length === 0) {
                noNotifications.style.display = 'block';
                feedItems.innerHTML = ''; // Clear existing items if any
                return;
            }

            noNotifications.style.display = 'none';

            feedItems.innerHTML = this.activities.map(activity => `
                <div class="activity-item" data-id="${activity.id || activity.timestamp}">
                    <i class="${activity.icon} activity-icon"></i>
                    <div class="activity-text">${activity.text}</div>
                    <div class="activity-time">${activity.time}</div>
                    <button class="dismiss-btn" data-timestamp="${activity.timestamp}" data-id="${activity.id || activity.timestamp}">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `).join('');

            feedItems.querySelectorAll('.dismiss-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const notificationId = btn.dataset.id;
                    this.removeActivity(notificationId);
                });
            });
        }

        async removeActivity(id) {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`${window.location.origin}/api/notifications/${id}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (!response.ok) throw new Error('Failed to dismiss notification');

                this.activities = this.activities.filter(activity => activity.id !== id);
                this.saveActivities(); // No-op
                this.renderActivities();
                this.updateNotificationBadge();
            } catch (error) {
                console.error('Error removing notification:', error);
                // Optionally display an error message
            }
        }

        clearAllActivities() {
            // Implement backend call to clear all notifications
            fetch(`${window.location.origin}/api/notifications/clear-all`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            })
            .then(response => {
                if (!response.ok) throw new Error('Failed to clear all notifications');
                this.activities = [];
                this.saveActivities(); // No-op
                this.renderActivities();
                this.updateNotificationBadge();
                this.toggleActivityFeed();
            })
            .catch(error => {
                console.error('Error clearing all notifications:', error);
                // Optionally display an error message
            });
        }

        updateNotificationBadge() {
            this.notificationCount = this.activities.length;
            const notificationsIcon = document.getElementById('notificationsIcon');
            const countElement = this.feed.querySelector('.notification-count');

            countElement.textContent = `${this.notificationCount} notification${this.notificationCount !== 1 ? 's' : ''}`;

            if (this.notificationCount > 0) {
                notificationsIcon.classList.add('has-notifications');
            } else {
                notificationsIcon.classList.remove('has-notifications');
            }
        }

        resetNotificationBadge() {
            const notificationsIcon = document.getElementById('notificationsIcon');
            notificationsIcon.classList.remove('has-notifications');
        }

        saveActivities() {
            // Notifications now come from backend, no need to save locally
        }

        async loadActivities() {
            // Fetch notifications from the backend API
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`${window.location.origin}/api/notifications`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (!response.ok) {
                    // Handle specific error codes if necessary, e.g., 401 for unauthorized
                    if (response.status === 401) {
                        console.error('Authentication error fetching notifications.');
                        return;
                    }
                    throw new Error('Failed to fetch notifications');
                }
                const data = await response.json();

                this.activities = data.notifications.map(n => ({
                    text: n.message,
                    type: n.type || 'info',
                    icon: this.getIconForType(n.type),
                    time: new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    timestamp: new Date(n.createdAt).getTime(),
                    id: n._id // Ensure we have the unique ID from the backend
                }));

                this.renderActivities();
                this.updateNotificationBadge();

            } catch (error) {
                console.error('Error loading notifications:', error);
                // Display a user-friendly error message if needed
                const feedItems = this.feed.querySelector('#floatingFeedItems');
                feedItems.innerHTML = '<div class="no-notifications">Could not load notifications. Please try again later.</div>';
            }
        }


        savePosition(iconId, position) {
            this.positions[iconId] = position;
            localStorage.setItem('floatingIconsPositions', JSON.stringify(this.positions));
        }

        loadPositions() {
            const saved = localStorage.getItem('floatingIconsPositions');
            return saved ? JSON.parse(saved) : {};
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.floatingIcons = new FloatingIconsManager();
        });
    } else {
        window.floatingIcons = new FloatingIconsManager();
    }

    // Add welcome activities after initialization
    setTimeout(() => {
        if (window.floatingIcons && window.floatingIcons.activities.length === 0) {
            // These will be added locally if no backend notifications exist on first load
            // The backend should ideally handle initial welcome notifications.
            // window.floatingIcons.addActivity('Welcome to SchoolByte! 🎉', 'info');
            // window.floatingIcons.addActivity('Drag icons to move them around', 'info');
            // window.floatingIcons.addActivity('Click icons to access features', 'info');
        }
    }, 2000);

})();

//i created this myself
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