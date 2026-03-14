// Fast-start shim: open port immediately, then load full server
const http = require('http');
const path = require('path');

const PORT = process.env.PORT || 5000;

// Create a minimal server immediately so Replit detects the port
const tmpServer = http.createServer((req, res) => {
  res.writeHead(503, { 'Content-Type': 'text/html' });
  res.end('<html><body><h2>SchoolByte is starting...</h2></body></html>');
});

tmpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[start] Port ${PORT} open. Loading SchoolByte...`);

  // Now load the real server in the next tick
  setImmediate(() => {
    tmpServer.close(() => {
      // Hand off to the real server
      require('./server.js');
    });
  });
});
