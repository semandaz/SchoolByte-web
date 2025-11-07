const fs = require('fs');
const path = require('path');

const previewFunctions = `
        // Preview Resource Function
        async function previewResource(workFileId, title) {
            try {
                const token = localStorage.getItem('studentToken') || localStorage.getItem('token');
                if (!token) {
                    alert('Please log in to preview files');
                    window.location.href = 'studentlogin.html';
                    return;
                }

                const response = await fetch(\`/api/workfiles/\${workFileId}/preview\`, {
                    method: 'GET',
                    headers: {
                        'Authorization': \`Bearer \${token}\`
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    
                    const modal = document.createElement('div');
                    modal.id = 'previewModal';
                    modal.style.cssText = \`
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background: rgba(0, 0, 0, 0.9);
                        z-index: 10000;
                        display: flex;
                        flex-direction: column;
                    \`;

                    modal.innerHTML = \`
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem 2rem; background: #1a2a6c; color: white;">
                            <h2 style="margin: 0; font-size: 1.5rem;">\${title}</h2>
                            <button onclick="closePreview()" style="background: #e74c3c; color: white; border: none; padding: 0.5rem 1rem; border-radius: 5px; cursor: pointer; font-size: 1rem; font-weight: 600;">
                                <i class="fas fa-times"></i> Close
                            </button>
                        </div>
                        <iframe 
                            src="\${data.previewUrl}" 
                            style="flex: 1; width: 100%; border: none; background: white;"
                            title="PDF Preview"
                        ></iframe>
                        <div style="padding: 1rem; background: #2c3e50; color: white; text-align: center;">
                            <p style="margin: 0;">This is a free preview. To download this file for offline use, you need \${data.costBytes} bytes.</p>
                        </div>
                    \`;

                    document.body.appendChild(modal);

                } else if (response.status === 401 || response.status === 403) {
                    alert('Session expired. Please log in again.');
                    localStorage.removeItem('token');
                    localStorage.removeItem('studentToken');
                    window.location.href = 'studentlogin.html';
                } else {
                    const errorData = await response.json().catch(() => ({ message: 'Preview failed' }));
                    alert(errorData.message || 'Failed to load preview. Please try again.');
                }

            } catch (error) {
                console.error('Preview error:', error);
                alert('An error occurred while loading preview: ' + error.message);
            }
        }

        // Close Preview Modal
        function closePreview() {
            const modal = document.getElementById('previewModal');
            if (modal) {
                modal.remove();
            }
        }
`;

const allFiles = fs.readdirSync('public');
const files = allFiles
    .filter(f => f.startsWith('notes') && f.endsWith('studentdashboard.html') && !f.includes('bio'))
    .map(f => path.join('public', f));

console.log(`Found ${files.length} dashboards to update`);

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    
    if (content.includes('function previewResource')) {
        console.log(`${file} already has preview function, skipping...`);
        return;
    }
    
    if (!content.includes('function downloadResource')) {
        console.log(`${file} doesn't have download function, skipping...`);
        return;
    }
    
    const scriptEndPattern = /(\s+)(document\.addEventListener\('DOMContentLoaded'|loadStudentData\(\)|window\.addEventListener)/;
    const match = content.match(scriptEndPattern);
    
    if (match) {
        const insertPosition = content.indexOf(match[0]);
        content = content.slice(0, insertPosition) + previewFunctions + '\n' + content.slice(insertPosition);
        
        const downloadBtnPattern = /(onclick="downloadResource\([^)]+\)">[\s\S]*?<i class="fas fa-download"><\/i> Download)/g;
        content = content.replace(downloadBtnPattern, (match, p1) => {
            const fileMatch = match.match(/downloadResource\('([^']+)',\s*(\d+),\s*'([^']+)',\s*'([^']+)'\)/);
            if (fileMatch) {
                const [, fileId, , fileName] = fileMatch;
                const previewBtn = `<button class="download-btn" onclick="previewResource('${fileId}', '${fileName}')" style="flex: 1; min-width: 120px; background: linear-gradient(to right, #3498db, #2980b9);">
                        <i class="fas fa-eye"></i> Preview (Free)
                    </button>
                    <button class="download-btn" ${match}`;
                return previewBtn;
            }
            return match;
        });
        
        fs.writeFileSync(file, content);
        console.log(`✓ Updated ${file}`);
    } else {
        console.log(`✗ Could not find insertion point in ${file}`);
    }
});

console.log('Done!');
