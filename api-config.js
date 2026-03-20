/**
 * API base URL for frontend fetch/socket calls.
 * When opening HTML via file:// (e.g. double-click), window.location.origin is "null",
 * so we fall back to localhost so login/API calls reach your local server.
 * Always run: npm start (or node server.js) before using the app.
 */
(function () {
    const origin = window.location.origin;
    const isFileProtocol =
        !origin ||
        origin === "null" ||
        origin === "file://" ||
        origin.startsWith("file://");
    window.API_BASE_URL = isFileProtocol ? "http://localhost:3002" : origin;
})();
