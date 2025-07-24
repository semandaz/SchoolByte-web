import React, { useState, useEffect, useCallback, useRef } from 'https://esm.sh/react@18.2.0';
import ReactDOM from 'https://esm.sh/react-dom@18.2.0/client';

// Backend API URL (adjust if your Replit server is on a different URL/port)
const API_BASE_URL = window.location.origin; // Assumes backend is on the same origin

// Custom Message Box Functionality (replaces alert/confirm)
// This needs to be defined globally or passed down, but for a single-file HTML,
// it's often easiest to have it accessible by the React app.
// We'll ensure it's defined in the HTML before the React app runs.

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
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            setIsLoggedIn(true);
            // Fetch student dashboard data if already logged in
            fetchStudentDashboardData(token);
        } else {
            setViewMode('login'); // Show login screen if no token
        }
    }, []); // Run once on component mount

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

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoginError('');
        setIsLoading(true);

        try {
            const response = await fetch(`${API_BASE_URL}/login-student`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: loginEmail, password: loginPassword })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.message || 'Login failed.');
            }

            const data = await response.json();
            localStorage.setItem('token', data.token);
            // Update the display elements directly as they are outside React's root
            document.getElementById('studentNameDisplay').textContent = data.student.studentName;
            document.getElementById('bytesCount').textContent = data.student.bytes;

            setIsLoggedIn(true);
            setLoginEmail('');
            setLoginPassword('');
            setStudentNameDisplay(data.student.studentName); // Update React state as well
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
            // Use the global showMessageBox function
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

            // Update global bytes counter
            setBytesCount(data.studentCurrentBytes);
            document.getElementById('bytesCount').textContent = data.studentCurrentBytes;
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
                                type="email"
                                id="loginEmail"
                                value={loginEmail}
                                onChange={(e) => setLoginEmail(e.target.value)}
                                placeholder="your@email.com"
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
                            <h2 style={{color: 'var(--color-brand-primary)', marginBottom: '1.5rem'}}>Create Your Adventure</h2>
                            <p style={{marginBottom: '2rem'}}>Begin your unique story by giving it a title. The AI will generate a thrilling adventure based on your input!</p>

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
                            <h2 style={{color: 'var(--color-brand-primary)', marginBottom: '1rem'}}>Game Completed!</h2>
                            <p>You've earned:</p>
                            <div className="bytes-earned" id="bytesEarned">{gameEndedSummary?.totalBytesEarned || 0} Bytes</div>

                            <div className="game-summary">
                                <h3 style={{color: 'var(--color-brand-primary)', marginBottom: '1rem'}}>Game Summary</h3>
                                <div className="summary-item">
                                    <strong>Title:</strong> <span id="summaryTitle">{gameEndedSummary?.initialTitle || 'N/A'}</span>
                                </div>
                                <div className="summary-item">
                                    <strong>Duration:</strong> <span id="summaryDuration">{gameEndedSummary?.sessionDurationMinutes || 0} minutes</span>
                                </div>
                                <div className="summary-item">
                                    <strong>Final Ethical Score:</strong> <span id="summaryEthicalScore">{gameEndedSummary?.finalEthicalScore || 0}</span>
                                </div>
                                {/* The backend doesn't return choicesCount directly in summary, so we remove it here */}
                                {/* <div className="summary-item">
                                    <strong>Choices Made:</strong> <span id="summaryChoices">{gameEndedSummary?.choicesCount || 'N/A'}</span>
                                </div> */}
                            </div>

                            <button className="btn" onClick={() => setViewMode('start')} style={{marginTop: '2rem'}}>Start New Game</button>
                        </div>
                    </div>
                );
            case 'history':
                return (
                    <div className="game-state active" id="historyState">
                        <h2 style={{color: 'var(--color-brand-primary)', marginBottom: '1.5rem'}}>Your Game History</h2>
                        {studentProfileData && (
                            <p style={{marginBottom: '1.5rem', color: 'var(--color-neutral-dark)'}}>
                                Total Preader Game Time: <span className="font-semibold">{studentProfileData.totalPreaderGameTimeMinutes || 0} minutes</span>
                            </p>
                        )}

                        <div className="history-container" id="historyContainer">
                            {sessionHistory.length === 0 ? (
                                <p style={{color: 'var(--color-neutral-medium)', textAlign: 'center'}}>No game history yet. Start a new game to begin your adventures!</p>
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
                                            {/* Choices length is not directly in log, but could be added if needed */}
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
                        <h2 style={{color: 'var(--color-brand-primary)', marginBottom: '1.5rem', textAlign: 'center'}}>Your Profile</h2>
                        {studentProfileData ? (
                            <div className="space-y-3 p-4 bg-gray-50 rounded-lg shadow-sm text-gray-700">
                                <p><strong>Name:</strong> {studentProfileData.studentName}</p>
                                <p><strong>Email:</strong> {studentProfileData.email}</p>
                                <p><strong>Class:</strong> {studentProfileData.class}</p>
                                <p><strong>Stream:</strong> {studentProfileData.stream}</p>
                                <p><strong>Current Bytes:</strong> {studentProfileData.bytes}</p>
                                <p><strong>Total Preader Game Time:</strong> {studentProfileData.totalPreaderGameTimeMinutes || 0} minutes</p>
                            </div>
                        ) : (
                            <p style={{textAlign: 'center', color: 'var(--color-neutral-medium)'}}>Loading profile data...</p>
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
            {/* These buttons are outside the React root, so they will be managed by vanilla JS or directly in HTML */}
            {/* <div className="flex space-x-4 mb-6 justify-center">
                <button
                    onClick={() => setViewMode('start')}
                    className={`px-6 py-2 rounded-full font-semibold transition duration-300 ${viewMode === 'start' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-blue-800 hover:bg-blue-50'}`}
                    disabled={!isLoggedIn}
                >
                    New Game
                </button>
                <button
                    onClick={fetchSessionHistory}
                    className={`px-6 py-2 rounded-full font-semibold transition duration-300 ${viewMode === 'history' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-blue-800 hover:bg-blue-50'}`}
                    disabled={!isLoggedIn}
                >
                    Game History
                </button>
                <button
                    onClick={() => setViewMode('profile')}
                    className={`px-6 py-2 rounded-full font-semibold transition duration-300 ${viewMode === 'profile' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-blue-800 hover:bg-blue-50'}`}
                    disabled={!isLoggedIn}
                >
                    My Profile
                </button>
            </div> */}

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
