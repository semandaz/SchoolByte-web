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
        openAIBuddy() {
            this.showWidget('aiBuddyModal', 'AI Study Buddy', 'fas fa-robot');
            this.addActivity('Opened AI Study Buddy', 'info');
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
            modal.innerHTML = `
                <div class="widget-header">
                    <h3><i class="fas fa-robot"></i> AI Study Buddy</h3>
                    <button class="close-widget">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="widget-content">
                    <div class="ai-buddy-content">
                        <div class="ai-avatar">
                            <i class="fas fa-robot"></i>
                        </div>
                        <h3>Hello! I'm your AI Study Buddy</h3>
                        <p>I can help you with homework, explanations, and study tips. What would you like to learn today?</p>

                        <div class="ai-input-group">
                            <input type="text" class="ai-input" placeholder="Ask me anything...">
                            <button class="ai-send-btn">Send</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            // Add event listeners
            modal.querySelector('.close-widget').addEventListener('click', () => this.closeCurrentWidget());
            modal.querySelector('.ai-send-btn').addEventListener('click', () => this.handleAIChat());
            modal.querySelector('.ai-input').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleAIChat();
            });
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

        handleAIChat() {
            const input = document.querySelector('#aiBuddyModal .ai-input');
            const question = input.value.trim();
            if (question) {
                this.addActivity(`Asked AI: ${question}`, 'info');
                // Simulate AI response
                setTimeout(() => {
                    this.showAIChatResponse("I'm your AI Study Buddy! In a real implementation, this would connect to an AI service to provide detailed answers to your questions.");
                }, 1000);
                input.value = '';
            }
        }

        showAIChatResponse(response) {
            // In a real implementation, this would display the AI response
            alert(`AI Response: ${response}`);
        }

        showCareerDetails(career) {
            const careerTitles = {
                stem: "Science, Technology, Engineering & Mathematics",
                arts: "Arts & Creative Careers", 
                business: "Business & Entrepreneurship",
                health: "Healthcare & Medicine"
            };
            this.addActivity(`Exploring ${careerTitles[career]} careers`, 'info');
            alert(`In a real implementation, this would show detailed information about ${careerTitles[career]} career paths, required education, and job opportunities.`);
        }

        connectToCounsellor(type) {
            const types = {
                academic: "Academic Counsellor",
                emotional: "Emotional Support Specialist", 
                crisis: "Crisis Support Team"
            };
            this.addActivity(`Connected to ${types[type]}`, 'info');
            this.closeCurrentWidget();
            if (window.openCounselling) {
                window.openCounselling(type);
            }
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
            }
        }

        addActivity(text, type = 'info') {
            const now = new Date();
            const icons = {
                'coin': 'fas fa-coins',
                'quiz': 'fas fa-question-circle',
                'game': 'fas fa-gamepad',
                'info': 'fas fa-info-circle'
            };

            const activity = {
                text,
                type,
                icon: icons[type] || 'fas fa-bell',
                time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                timestamp: now.getTime()
            };

            this.activities.unshift(activity);
            this.saveActivities();
            this.renderActivities();
            this.updateNotificationBadge();
        }

        renderActivities() {
            const feedItems = this.feed.querySelector('#floatingFeedItems');
            const noNotifications = feedItems.querySelector('.no-notifications');

            if (this.activities.length === 0) {
                noNotifications.style.display = 'block';
                return;
            }

            noNotifications.style.display = 'none';

            feedItems.innerHTML = this.activities.map(activity => `
                <div class="activity-item">
                    <i class="${activity.icon} activity-icon"></i>
                    <div class="activity-text">${activity.text}</div>
                    <div class="activity-time">${activity.time}</div>
                    <button class="dismiss-btn" data-timestamp="${activity.timestamp}">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `).join('');

            feedItems.querySelectorAll('.dismiss-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.removeActivity(parseInt(btn.dataset.timestamp));
                });
            });
        }

        removeActivity(timestamp) {
            this.activities = this.activities.filter(activity => activity.timestamp !== timestamp);
            this.saveActivities();
            this.renderActivities();
            this.updateNotificationBadge();
        }

        clearAllActivities() {
            this.activities = [];
            this.saveActivities();
            this.renderActivities();
            this.updateNotificationBadge();
            this.toggleActivityFeed();
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
            localStorage.setItem('floatingIconsActivities', JSON.stringify(this.activities));
        }

        loadActivities() {
            const saved = localStorage.getItem('floatingIconsActivities');
            if (saved) {
                this.activities = JSON.parse(saved);
                this.renderActivities();
                this.updateNotificationBadge();
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
            window.floatingIcons.addActivity('Welcome to SchoolByte! 🎉', 'info');
            window.floatingIcons.addActivity('Drag icons to move them around', 'info');
            window.floatingIcons.addActivity('Click icons to access features', 'info');
        }
    }, 2000);

})();