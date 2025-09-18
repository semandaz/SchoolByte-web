import React, { useState, useEffect, useCallback, useRef } from 'https://esm.sh/react@18.2.0';
import ReactDOM from 'https://esm.sh/react-dom@18.2.0/client';

// Backend API URL (adjust if your Replit server is on a different URL/port)
const API_BASE_URL = window.location.origin; // Assumes backend is on the same origin

// IMPORTANT: window.showMessageBox is now defined in index.html before React loads.

function App() {
    // User and Auth states
    const [studentNameDisplay, setStudentNameDisplay] = useState('Student');
    const [bytesCount, setBytesCount] = useState(0);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [loginError, setLoginError] = useState('');

    // Game State
    const [gameTitle, setGameTitle] = useState('');
    const [sessionId, setSessionId] = useState(null);
    const [currentScene, setCurrentScene] = useState('');
    const [currentChoices, setCurrentChoices] = useState([]);
    const [playerStats, setPlayerStats] = useState(null);
    const [ethicalScore, setEthicalScore] = useState(0);
    const [totalBytesEarnedInSession, setTotalBytesEarnedInSession] = useState(0);
    const [gameMessage, setGameMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [gameEndedSummary, setGameEndedSummary] = useState(null);
    const [viewMode, setViewMode] = useState('start'); // 'login', 'start', 'playing', 'ended', 'history', 'profile'
    const [sessionHistory, setSessionHistory] = useState([]);
    const [studentProfileData, setStudentProfileData] = useState(null); // For profile view

    const initialLoadRef = useRef(true);

    // --- Authentication and Initial Data Fetch ---
    const fetchStudentDashboardData = useCallback(async (token) => {
        try {
            const response = await fetch(`${API_BASE_URL}/student/dashboard`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.message || 'Failed to fetch student data.');
            }

            const data = await response.json();
            setStudentNameDisplay(data.student.studentName || 'Student');
            setBytesCount(data.student.bytes || 0);
            setStudentProfileData(data.student); // Store full student data for profile view
            if (initialLoadRef.current) {
                setViewMode('start'); // Only set to start if it's the initial load
                initialLoadRef.current = false;
            }
        } catch (err) {
            console.error("Error fetching student dashboard data:", err);
            setError(`Error fetching student data: ${err.message}. Please log in again.`);
            setIsLoggedIn(false);
            setViewMode('login'); // Force login if data fetch fails
        }
    }, []);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            setIsLoggedIn(true);
            fetchStudentDashboardData(token);
        } else {
            setViewMode('login'); // Show login screen if no token
        }

        // Listen for custom events from vanilla JS navigation buttons
        const handleViewModeChange = (event) => {
            const newMode = event.detail;
            if (newMode === 'history') {
                fetchSessionHistory(); // Call history fetch directly
            } else if (newMode === 'profile') {
                // Re-fetch profile data to ensure it's fresh if navigating back
                const token = localStorage.getItem('token');
                if (token) {
                    fetchStudentDashboardData(token);
                }
                setViewMode('profile');
            } else {
                setViewMode(newMode);
            }
        };

        window.addEventListener('changeViewMode', handleViewModeChange);

        return () => {
            window.removeEventListener('changeViewMode', handleViewModeChange);
        };
    }, [fetchStudentDashboardData]); // Dependency added for safety

    // Update global header elements when React state changes
    useEffect(() => {
        const nameElement = document.getElementById('studentNameDisplay');
        const bytesElement = document.getElementById('bytesCount');
        if (nameElement) nameElement.textContent = studentNameDisplay;
        if (bytesElement) bytesElement.textContent = bytesCount;
    }, [studentNameDisplay, bytesCount]);


    const handleLogin = async (e) => {
        e.preventDefault();
        setLoginError('');
        setIsLoading(true);

        try {
            // Check if this is an admin login attempt
            const adminPrefixRegex = /^admin:\s*/i;
            let actualEmail = loginEmail;

            if (adminPrefixRegex.test(loginEmail)) {
                // Extract the actual email after the "admin:" prefix (with optional space)
                actualEmail = loginEmail.replace(adminPrefixRegex, '').trim();
                
                // Validate the extracted email with proper regex
                const emailRegex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
                if (!actualEmail || !emailRegex.test(actualEmail)) {
                    throw new Error('Please enter a valid email after "admin:"');
                }
                
                // For admin login, redirect directly to admin.html
                window.location.href = 'admin.html';
                return;
            }
            
            // For regular login, validate the email format
            const emailRegex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
            if (!emailRegex.test(actualEmail)) {
                throw new Error('Please enter a valid email address');
            }

            const response = await fetch(`${API_BASE_URL}/login-student`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: actualEmail, password: loginPassword })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.message || 'Login failed.');
            }

            const data = await response.json();
            localStorage.setItem('token', data.token);

            setIsLoggedIn(true);
            setLoginEmail('');
            setLoginPassword('');
            setStudentNameDisplay(data.student.studentName); // Update React state
            setBytesCount(data.student.bytes); // Update React state
            setStudentProfileData(data.student);
            setViewMode('start'); // Go to game start screen

        } catch (err) {
            console.error('Login error:', err);
            setLoginError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    // --- Preader Game Logic ---

    const handleStartGame = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        setGameMessage('');
        setGameEndedSummary(null);

        if (!gameTitle.trim()) {
            window.showMessageBox('Input Required', 'Please enter a title for your story.', 'alert');
            setIsLoading(false);
            return;
        }

        const token = localStorage.getItem('token');
        if (!token) {
            window.showMessageBox('Authentication Error', 'You are not logged in. Please log in to start a game.', 'alert');
            setIsLoading(false);
            setViewMode('login');
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/student/preader-games/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ gameTitle })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.message || 'Failed to start game.');
            }

            const data = await response.json();
            setSessionId(data.sessionId);
            setCurrentScene(data.scene);
            setCurrentChoices(data.choices);
            setPlayerStats(data.playerStats);
            setEthicalScore(data.currentEthicalScore);
            setTotalBytesEarnedInSession(data.totalBytesEarnedInSession || 0); // Ensure it's initialized
            setViewMode('playing');
            setGameMessage(data.message);

        } catch (err) {
            console.error('Error starting game:', err);
            setError(`Failed to start game: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleMakeChoice = async (choiceIndex) => {
        setIsLoading(true);
        setError('');
        setGameMessage('');

        const token = localStorage.getItem('token');
        if (!token) {
            window.showMessageBox('Authentication Error', 'You are not logged in. Please log in to continue.', 'alert');
            setIsLoading(false);
            setViewMode('login');
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/student/preader-games/${sessionId}/make-choice`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ choiceIndex })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.message || 'Failed to make choice.');
            }

            const data = await response.json();
            setCurrentScene(data.scene);
            setCurrentChoices(data.choices);
            setPlayerStats(data.playerStats);
            setEthicalScore(data.currentEthicalScore);
            setTotalBytesEarnedInSession(data.totalBytesEarnedInSession); // Update accumulated bytes
            setGameMessage(data.message);

        } catch (err) {
            console.error('Error making choice:', err);
            setError(`Failed to make choice: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleEndGame = async () => {
        const confirmEnd = await window.showMessageBox('End Game?', 'Are you sure you want to end this game session?', 'confirm');
        if (!confirmEnd) {
            return; // User cancelled
        }

        setIsLoading(true);
        setError('');
        setGameMessage('');

        const token = localStorage.getItem('token');
        if (!token) {
            window.showMessageBox('Authentication Error', 'You are not logged in. Please log in.', 'alert');
            setIsLoading(false);
            setViewMode('login');
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/student/preader-games/${sessionId}/end`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.message || 'Failed to end game.');
            }

            const data = await response.json();
            setGameEndedSummary(data);
            setSessionId(null); // Clear active session
            setGameTitle(''); // Clear title input
            setViewMode('ended');
            setGameMessage(data.message);

            // Update bytesCount state, which will then update the global header via useEffect
            setBytesCount(data.studentCurrentBytes);
            localStorage.setItem('bytesCount', data.studentCurrentBytes);

            // Refresh student profile data to show updated total game time
            fetchStudentDashboardData(token);

        } catch (err) {
            console.error('Error ending game:', err);
            setError(`Failed to end game: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchSessionHistory = useCallback(async () => {
        setIsLoading(true);
        setError('');
        setGameMessage('');

        const token = localStorage.getItem('token');
        if (!token) {
            window.showMessageBox('Authentication Error', 'You are not logged in. Please log in to view history.', 'alert');
            setIsLoading(false);
            setViewMode('login');
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/student/preader-games/history`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.message || 'Failed to fetch session history.');
            }

            const data = await response.json();
            setSessionHistory(data.history);
            setViewMode('history');

        } catch (err) {
            console.error('Error fetching session history:', err);
            setError(`Failed to fetch session history: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    }, [fetchStudentDashboardData]); // Dependency added for safety


    // Render logic based on viewMode
    const renderContent = () => {
        if (!isLoggedIn) {
            return (
                <div className="login-form-container">
                    <h2>Login to Preader Games</h2>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="form-group">
                            <label htmlFor="loginEmail" className="form-label">Email</label>
                            <input
                                type="text"
                                id="loginEmail"
                                value={loginEmail}
                                onChange={(e) => setLoginEmail(e.target.value)}
                                placeholder="your@email.com or admin: your@email.com"
                                className="form-input"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="loginPassword" className="form-label">Password</label>
                            <input
                                type="password"
                                id="loginPassword"
                                value={loginPassword}
                                onChange={(e) => setLoginPassword(e.target.value)}
                                placeholder="••••••••"
                                className="form-input"
                                required
                            />
                        </div>
                        {loginError && <p className="text-red-500 text-sm">{loginError}</p>}
                        <button
                            type="submit"
                            className="btn"
                            disabled={isLoading}
                        >
                            {isLoading ? 'Logging In...' : 'Login'}
                        </button>
                    </form>
                </div>
            );
        }

        switch (viewMode) {
            case 'start':
                return (
                    <div className="game-state active" id="startState">
                        <div className="start-form">
                            <h2 className="text-3xl font-bold text-indigo-700 mb-6">Create Your Adventure</h2>
                            <p className="mb-8 text-gray-600">Begin your unique story by giving it a title. The AI will generate a thrilling adventure based on your input!</p>

                            <div className="form-group">
                                <label htmlFor="gameTitle" className="form-label">Your Story Title</label>
                                <input
                                    type="text"
                                    id="gameTitle"
                                    className="form-input"
                                    placeholder="e.g., The Lost Treasure of Zanzibar"
                                    value={gameTitle}
                                    onChange={(e) => setGameTitle(e.target.value)}
                                    required
                                />
                            </div>

                            <button className="btn" onClick={handleStartGame} disabled={isLoading}>
                                {isLoading ? 'Generating Story...' : 'Start Adventure'}
                            </button>
                        </div>
                    </div>
                );
            case 'playing':
                return (
                    <div className="game-state active" id="playState">
                        <div className="stats-container" id="statsContainer">
                            {playerStats && Object.entries(playerStats).map(([stat, value]) => (
                                <div className="stat-card" key={stat}>
                                    <div className="stat-name">{stat.charAt(0).toUpperCase() + stat.slice(1)}</div>
                                    <div className="stat-value">{value}</div>
                                </div>
                            ))}
                            <div className="stat-card">
                                <div className="stat-name">Ethical Score</div>
                                <div className="stat-value ethical-score">{ethicalScore}</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-name">Bytes Earned (Session)</div>
                                <div className="stat-value">{totalBytesEarnedInSession}</div>
                            </div>
                        </div>

                        <div className="game-scene">
                            <div className="scene-text" id="sceneText">
                                {currentScene}
                            </div>

                            <div className="choices-container" id="choicesContainer">
                                {currentChoices.map((choice, index) => (
                                    <button
                                        key={index}
                                        className={`choice-btn ${isLoading ? 'disabled' : ''}`}
                                        onClick={() => handleMakeChoice(index)}
                                        disabled={isLoading}
                                    >
                                        {choice.choiceText}
                                        {/* You can add logic here to display unavailableReason if needed */}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="game-nav">
                            <button className="btn btn-secondary" onClick={handleEndGame} disabled={isLoading}>
                                End Game
                            </button>
                        </div>
                    </div>
                );
            case 'ended':
                return (
                    <div className="game-state active" id="endState">
                        <div className="end-screen">
                            <h2 className="text-3xl font-bold text-indigo-700 mb-4">Game Completed!</h2>
                            <p className="text-gray-700 mb-2">You've earned:</p>
                            <div className="bytes-earned" id="bytesEarned">{gameEndedSummary?.totalBytesEarned || 0} Bytes</div>

                            <div className="game-summary">
                                <h3 className="text-xl font-semibold text-indigo-600 mb-3">Game Summary</h3>
                                <div className="summary-item">
                                    <strong>Title:</strong> <span id="summaryTitle">{gameEndedSummary?.initialTitle || 'N/A'}</span>
                                </div>
                                <div className="summary-item">
                                    <strong>Duration:</strong> <span id="summaryDuration">{gameEndedSummary?.sessionDurationMinutes || 0} minutes</span>
                                </div>
                                <div className="summary-item">
                                    <strong>Final Ethical Score:</strong> <span id="summaryEthicalScore">{gameEndedSummary?.finalEthicalScore || 0}</span>
                                </div>
                            </div>

                            <button className="btn" onClick={() => setViewMode('start')} style={{marginTop: '2rem'}}>Start New Game</button>
                        </div>
                    </div>
                );
            case 'history':
                return (
                    <div className="game-state active" id="historyState">
                        <h2 className="text-3xl font-bold text-indigo-700 mb-6 text-center">Your Game History</h2>
                        {studentProfileData && (
                            <p className="mb-6 text-center text-gray-700">
                                Total Preader Game Time: <span className="font-semibold">{studentProfileData.totalPreaderGameTimeMinutes || 0} minutes</span>
                            </p>
                        )}

                        <div className="history-container" id="historyContainer">
                            {sessionHistory.length === 0 ? (
                                <p className="text-gray-500 text-center">No game history yet. Start a new game to begin your adventures!</p>
                            ) : (
                                sessionHistory.map((session, index) => (
                                    <div className="history-item" key={index}>
                                        <div className="history-title">{session.initialTitle}</div>
                                        <div className="history-meta">
                                            <span>{new Date(session.startTime).toLocaleDateString()}</span>
                                            <span>{session.durationMinutes} minutes</span>
                                        </div>
                                        <div className="history-stats">
                                            <div className="history-stat"><span>{session.bytesEarned}</span> bytes earned</div>
                                            <div className="history-stat"><span>{session.finalEthicalScore}</span> ethical score</div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <button className="btn" onClick={() => setViewMode('start')} style={{marginTop: '2rem'}}>Back to Main Menu</button>
                    </div>
                );
            case 'profile':
                return (
                    <div className="game-state active" id="profileState">
                        <h2 className="text-3xl font-bold text-indigo-700 mb-6 text-center">Your Profile</h2>
                        {studentProfileData ? (
                            <div className="space-y-3 p-6 bg-gray-50 rounded-lg shadow-sm text-gray-700">
                                <p><strong>Name:</strong> {studentProfileData.studentName}</p>
                                <p><strong>Email:</strong> {studentProfileData.email}</p>
                                <p><strong>Class:</strong> {studentProfileData.class}</p>
                                <p><strong>Stream:</strong> {studentProfileData.stream}</p>
                                <p><strong>Current Bytes:</strong> {studentProfileData.bytes}</p>
                                <p><strong>Total Preader Game Time:</strong> {studentProfileData.totalPreaderGameTimeMinutes || 0} minutes</p>
                            </div>
                        ) : (
                            <p className="text-gray-500 text-center">Loading profile data...</p>
                        )}
                        <button className="btn" onClick={() => setViewMode('start')} style={{marginTop: '2rem'}}>Back to Main Menu</button>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <>
            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md relative mb-4 max-w-lg w-full mx-auto" role="alert">
                    <strong className="font-bold">Error!</strong>
                    <span className="block sm:inline"> {error}</span>
                </div>
            )}

            {isLoading && (
                <div className="absolute inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"></div>
                    <p className="ml-4 text-white text-lg">Loading...</p>
                </div>
            )}

            {renderContent()}
        </>
    );
}

export default App;
