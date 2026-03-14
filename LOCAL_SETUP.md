# Running SchoolByte Locally (Chrome / Any Browser)

## ERR_CONNECTION_REFUSED?

If you see **"This site can't be reached - localhost refused to connect"**, the server is not running. Start it first (see Quick Start below), then open `http://localhost:5000` in your browser.

## Quick Start

1. **Install dependencies**
   ```bash
   cd schoolbytebackend
   npm install
   ```

2. **Configure environment**
   - Copy `.env.example` to `.env` if you haven't already
   - Ensure `MONGODB_URI` and `JWT_SECRET` are set (they are in `.env.example`)

3. **Start the server**
   ```bash
   npm start
   ```
   The server runs on **port 5000** by default. You should see:
   ```
   🚀 SchoolByte server running on port 5000
   🌐 Server accessible at: http://0.0.0.0:5000
   ```

4. **Open the app in Chrome**
   - **Recommended:** Go to `http://localhost:5000` in your browser
   - Or open `http://localhost:5000/studentlogin.html` directly

## Why "Network Error" on Login?

If you see **"Network error"** when signing in, it usually means one of these:

| Cause | Fix |
|-------|-----|
| **Opening HTML files directly** (double-click, `file:///...`) | Use `http://localhost:5000/studentlogin.html` instead. The app needs the backend server. |
| **Server not running** | Run `npm start` in the `schoolbytebackend` folder first. |
| **Wrong port** | The server uses port 5000. If you use a different PORT in `.env`, use that port in the URL. |
| **MongoDB connection failed** | Check `MONGODB_URI` in `.env` and your internet connection. |

## File vs. Localhost

- `file:///C:/.../studentlogin.html` → API calls fail (browser security blocks them)
- `http://localhost:5000/studentlogin.html` → Works when the server is running

The app includes a fallback: if you open via `file://`, it will try `http://localhost:5000` for API calls. You still need the server running.

## Chat (ByteNexus)

The chat uses Socket.io and REST APIs. Both work when you use:

- `http://localhost:5000/bytenexus-chat.html`

Log in first, then open the chat. Messages are sent and received through your local server.

## No Replit Needed

This project runs fully locally. There are no Replit-specific URLs. All API calls use your current origin or `http://localhost:5000`.
