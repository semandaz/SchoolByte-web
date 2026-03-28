(function () {
    'use strict';

    var COST_PER_DOWNLOAD = null;

    function getToken() {
        return localStorage.getItem('token');
    }

    function getBytesEl() {
        return document.getElementById('bytesCount');
    }

    function showToast(msg, ok) {
        var t = document.createElement('div');
        t.textContent = msg;
        t.style.cssText = 'position:fixed;bottom:5.5rem;right:2rem;z-index:99999;padding:.75rem 1.25rem;border-radius:10px;font-weight:600;font-size:.9rem;color:#fff;background:' + (ok ? '#16a34a' : '#dc2626') + ';box-shadow:0 4px 16px rgba(0,0,0,.2);transition:opacity .4s;';
        document.body.appendChild(t);
        setTimeout(function () { t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 400); }, 3500);
    }

    async function downloadWorkFile(workFileId, costBytes, title) {
        var tok = getToken();
        if (!tok) { showToast('Please log in to download files.', false); return; }

        var cost = costBytes || 5;
        var currentBytes = parseInt((getBytesEl() || {}).textContent) || 0;

        if (currentBytes < cost) {
            showToast('Not enough Bytes! You need ' + cost + ' Bytes but have ' + currentBytes + '.', false);
            return;
        }

        if (!confirm('Download "' + title + '"?\n\nCost: ' + cost + ' Bytes\nYour balance: ' + currentBytes + ' Bytes')) return;

        try {
            var res = await fetch('/student/download-workfile/' + workFileId, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + tok, 'Content-Type': 'application/json' }
            });
            var data = await res.json();

            if (res.ok && data.downloadUrl) {
                var bytesEl = getBytesEl();
                if (bytesEl) bytesEl.textContent = data.remainingBytes;
                localStorage.setItem('bytesCount', data.remainingBytes);
                showToast('Download started! ' + data.bytesDeducted + ' Bytes deducted.', true);
                var a = document.createElement('a');
                a.href = data.downloadUrl;
                a.target = '_blank';
                a.rel = 'noopener';
                document.body.appendChild(a);
                a.click();
                a.remove();
            } else {
                showToast(data.message || 'Download failed. Please try again.', false);
            }
        } catch (e) {
            console.error('Download error:', e);
            showToast('Connection error. Please try again.', false);
        }
    }

    function buildCard(file) {
        var ext = (file.fileUrl || '').split('.').pop().toUpperCase();
        if (!['PDF', 'DOCX', 'DOC', 'PPTX', 'XLSX'].includes(ext)) ext = 'PDF';
        var icon = ext === 'PDF' ? 'fa-file-pdf' : (ext.startsWith('DOC') ? 'fa-file-word' : 'fa-file');

        var card = document.createElement('div');
        card.className = 'resource-card';
        card.innerHTML =
            '<h3 class="resource-name">' + escHtml(file.title) + '</h3>' +
            '<div class="resource-meta">' +
            '  <span><i class="fas ' + icon + '"></i> ' + ext + '</span>' +
            '  <span class="resource-class">' + escHtml(file.intendedClass || '') + '</span>' +
            '</div>' +
            (file.description ? '<p class="resource-description">' + escHtml(file.description) + '</p>' : '') +
            '<div class="resource-stats">' +
            '  <div class="stat-item"><i class="fas fa-download"></i> ' + (file.downloadCount || 0) + ' downloads</div>' +
            '  <div class="stat-item"><i class="fas fa-coins" style="color:#f59e0b;"></i> ' + (file.costBytes || 5) + ' Bytes</div>' +
            '</div>' +
            '<a href="#" class="download-btn" onclick="event.preventDefault();notesDownload(\'' + file._id + '\',' + (file.costBytes || 5) + ',\'' + escJs(file.title) + '\');return false;">' +
            '  <i class="fas fa-download"></i> Download (' + (file.costBytes || 5) + ' Bytes)' +
            '</a>';
        return card;
    }

    function escHtml(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function escJs(s) {
        return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    }

    async function loadNotesForSubject(subject) {
        if (!subject) return;
        var tok = getToken();
        if (!tok) return;

        try {
            var res = await fetch('/student/workfiles?subject=' + encodeURIComponent(subject), {
                headers: { 'Authorization': 'Bearer ' + tok }
            });
            if (!res.ok) return;
            var data = await res.json();
            var files = data.workFiles || [];
            if (!files.length) return;

            var section = document.createElement('div');
            section.className = 'popular-resources';
            section.innerHTML = '<h2 class="section-title"><i class="fas fa-book-open"></i> Available Notes for Download</h2>' +
                '<p style="margin-bottom:1rem;color:#6b7280;font-size:.9rem;"><i class="fas fa-info-circle"></i> These notes are provided by your teachers. Each download costs Bytes from your balance.</p>' +
                '<div class="resource-cards" id="notesLoaderCards"></div>';

            var cardsContainer = section.querySelector('#notesLoaderCards');
            files.forEach(function (file) {
                cardsContainer.appendChild(buildCard(file));
            });

            var container = document.querySelector('.container') || document.querySelector('main') || document.body;
            var firstSection = container.querySelector('.popular-resources, .search-results, .resource-cards');
            if (firstSection) {
                container.insertBefore(section, firstSection);
            } else {
                container.appendChild(section);
            }
        } catch (e) {
            console.warn('Notes loader error:', e);
        }
    }

    async function syncBytesFromServer() {
        var tok = getToken();
        if (!tok) return;
        try {
            var res = await fetch('/student/dashboard', { headers: { 'Authorization': 'Bearer ' + tok } });
            if (res.ok) {
                var d = await res.json();
                var b = d.student && d.student.bytes;
                if (b !== undefined) {
                    var el = getBytesEl();
                    if (el) el.textContent = b;
                    localStorage.setItem('bytesCount', b);
                    if (d.student.preferences && d.student.preferences.fontFamily) {
                        localStorage.setItem('sb_preferred_font', d.student.preferences.fontFamily);
                        document.body.style.fontFamily = d.student.preferences.fontFamily;
                    }
                }
            }
        } catch (e) {}
    }

    window.notesDownload = downloadWorkFile;

    document.addEventListener('DOMContentLoaded', function () {
        // Override the old placeholder - runs after the page's own DOMContentLoaded handlers
        window.downloadResource = function (filename) {
            showToast('This is a sample preview card. Scroll up for real teacher-uploaded files.', false);
            return false;
        };

        var subject = window.NOTES_SUBJECT || document.body.dataset.subject;
        syncBytesFromServer();
        if (subject) loadNotesForSubject(subject);
    });
})();
