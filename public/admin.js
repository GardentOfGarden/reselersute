let allKeys = [];
let currentSection = 'dashboard';
let keysChart = null;

document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    bindEvents();
    checkAuth();
    loadSettings();
}

function bindEvents() {
    document.getElementById('loginBtn').addEventListener('click', login);
    document.getElementById('adminPass').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') login();
    });

    document.getElementById('generateBtn').addEventListener('click', generateKey);
    document.getElementById('copyKeyBtn').addEventListener('click', copyKey);
    
    document.getElementById('searchInput').addEventListener('input', filterKeys);
    document.getElementById('screenshotSearch').addEventListener('input', filterScreenshots);
}

async function login() {
    const password = document.getElementById('adminPass').value;
    const message = document.getElementById('loginMsg');

    if (!password) {
        message.textContent = "Please enter password";
        return;
    }

    try {
        const res = await fetch("/api/login", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ password })
        });
        
        const data = await res.json();
        
        if (data.success) {
            document.getElementById('loginBox').classList.add("hidden");
            document.getElementById('panelBox').classList.remove("hidden");
            localStorage.setItem('eclipse_auth', 'true');
            loadKeys();
            loadStats();
        } else {
            message.textContent = data.message || "Wrong password!";
        }
    } catch (error) {
        message.textContent = "Login failed!";
    }
}

function checkAuth() {
    const isAuthenticated = localStorage.getItem('eclipse_auth');
    if (isAuthenticated) {
        document.getElementById('loginBox').classList.add("hidden");
        document.getElementById('panelBox').classList.remove("hidden");
        loadKeys();
        loadStats();
    }
}

async function loadKeys() {
    try {
        const res = await fetch("/api/keys");
        allKeys = await res.json();
        displayKeys(allKeys);
        updateStats();
        loadBannedKeys();
    } catch (error) {
        console.error("Failed to load keys:", error);
    }
}

function displayKeys(keys) {
    const tbody = document.querySelector('#keysTable tbody');
    tbody.innerHTML = '';

    keys.forEach(key => {
        const statusClass = key.banned ? 'status-banned' : 
                          key.expiresAt && new Date(key.expiresAt) < new Date() ? 'status-expired' : 'status-active';
        const statusText = key.banned ? 'Banned' : 
                         key.expiresAt && new Date(key.expiresAt) < new Date() ? 'Expired' : 'Active';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td><code>${key.value}</code></td>
            <td>${key.createdAt ? new Date(key.createdAt).toLocaleDateString() : 'N/A'}</td>
            <td>${key.expiresAt ? new Date(key.expiresAt).toLocaleDateString() : 'Never'}</td>
            <td><code class="hwid">${key.hwid ? key.hwid.substring(0, 8) + '...' : 'Not set'}</code></td>
            <td>${key.activations || 0}/${key.maxActivations || 1}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td>
                <div class="key-actions">
                    ${!key.banned ? `
                    <button class="btn-secondary btn-small" onclick="banKey('${key.value}')">
                        <i class="fas fa-ban"></i>
                        Ban
                    </button>
                    ` : `
                    <button class="btn-secondary btn-small" onclick="unbanKey('${key.value}')">
                        <i class="fas fa-check"></i>
                        Unban
                    </button>
                    `}
                    <button class="btn-secondary btn-small btn-danger" onclick="deleteKey('${key.value}')">
                        <i class="fas fa-trash"></i>
                        Delete
                    </button>
                </div>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

function loadBannedKeys() {
    const bannedKeys = allKeys.filter(key => key.banned);
    const tbody = document.querySelector('#bannedTable tbody');
    
    if (!tbody) return;
    
    tbody.innerHTML = '';

    bannedKeys.forEach(key => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><code>${key.value}</code></td>
            <td>${key.createdAt ? new Date(key.createdAt).toLocaleDateString() : 'N/A'}</td>
            <td><code class="hwid">${key.hwid ? key.hwid.substring(0, 8) + '...' : 'Not set'}</code></td>
            <td>
                <div class="key-actions">
                    <button class="btn-secondary btn-small" onclick="unbanKey('${key.value}')">
                        <i class="fas fa-check"></i>
                        Unban
                    </button>
                    <button class="btn-secondary btn-small btn-danger" onclick="deleteKey('${key.value}')">
                        <i class="fas fa-trash"></i>
                        Delete
                    </button>
                </div>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

async function loadScreenshots() {
    try {
        const res = await fetch("/api/keys");
        const keys = await res.json();
        const screenshotsGrid = document.getElementById('screenshotsGrid');
        screenshotsGrid.innerHTML = '';
        
        let screenshotCount = 0;
        
        keys.forEach(key => {
            if (key.screenshots && key.screenshots.length > 0) {
                key.screenshots.forEach(screenshot => {
                    const screenshotElement = document.createElement('div');
                    screenshotElement.className = 'screenshot-item';
                    screenshotElement.innerHTML = `
                        <div class="screenshot-thumb" onclick="viewScreenshot('${key.value}', '${screenshot.id}')">
                            <img src="/api/screenshot/${key.value}/${screenshot.id}" alt="Screenshot">
                        </div>
                        <div class="screenshot-details">
                            <p><strong>Key:</strong> ${key.value.substring(0, 10)}...</p>
                            <p><strong>Date:</strong> ${new Date(screenshot.timestamp).toLocaleString()}</p>
                        </div>
                    `;
                    screenshotsGrid.appendChild(screenshotElement);
                    screenshotCount++;
                });
            }
        });
        
        if (screenshotCount === 0) {
            screenshotsGrid.innerHTML = '<p class="no-screenshots">No screenshots available</p>';
        }
        
        document.getElementById('statScreenshots').textContent = screenshotCount;
    } catch (error) {
        console.error("Failed to load screenshots:", error);
    }
}

function filterScreenshots() {
    const searchTerm = document.getElementById('screenshotSearch').value.toLowerCase();
    const items = document.querySelectorAll('.screenshot-item');
    
    items.forEach(item => {
        const keyText = item.querySelector('.screenshot-details p:first-child').textContent.toLowerCase();
        if (keyText.includes(searchTerm)) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
}

async function viewScreenshot(key, id) {
    try {
        const image = document.getElementById('screenshotImage');
        const keySpan = document.getElementById('screenshotKey');
        const timestampSpan = document.getElementById('screenshotTimestamp');
        
        image.src = `/api/screenshot/${key}/${id}`;
        keySpan.textContent = key;
        
        const keys = await fetch("/api/keys");
        const keysData = await keys.json();
        const keyData = keysData.find(k => k.value === key);
        
        if (keyData) {
            const screenshot = keyData.screenshots.find(s => s.id === id);
            if (screenshot) {
                timestampSpan.textContent = new Date(screenshot.timestamp).toLocaleString();
            }
        }
        
        document.getElementById('screenshotModal').classList.remove('hidden');
    } catch (error) {
        console.error("Failed to load screenshot:", error);
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

async function loadStats() {
    try {
        const res = await fetch("/api/stats");
        const stats = await res.json();
        
        document.getElementById('totalKeys').textContent = stats.totalKeys;
        document.getElementById('activeKeys').textContent = stats.activeKeys;
        document.getElementById('bannedKeys').textContent = stats.bannedKeys;
        document.getElementById('expiredKeys').textContent = stats.expiredKeys;
        
        document.getElementById('statTotalKeys').textContent = stats.totalKeys;
        document.getElementById('statActiveSessions').textContent = stats.activeKeys;
        
        updateChart(stats);
    } catch (error) {
        console.error("Failed to load stats:", error);
    }
}

function updateChart(stats) {
    const ctx = document.getElementById('keysChart').getContext('2d');
    
    if (keysChart) {
        keysChart.destroy();
    }
    
    keysChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Active', 'Banned', 'Expired'],
            datasets: [{
                data: [stats.activeKeys, stats.bannedKeys, stats.expiredKeys],
                backgroundColor: [
                    'rgba(0, 230, 118, 0.8)',
                    'rgba(255, 61, 0, 0.8)',
                    'rgba(255, 196, 0, 0.8)'
                ],
                borderColor: [
                    'rgba(0, 230, 118, 1)',
                    'rgba(255, 61, 0, 1)',
                    'rgba(255, 196, 0, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#fff'
                    }
                }
            }
        }
    });
}

async function generateKey() {
    const durationMs = parseInt(document.getElementById('durationSelect').value);
    const maxActivations = parseInt(document.getElementById('maxActivations').value) || 1;
    
    try {
        const res = await fetch("/api/keys", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ durationMs, maxActivations })
        });
        
        const key = await res.json();
        document.getElementById('generatedKeyText').textContent = key.value;
        document.getElementById('genMsg').classList.remove("hidden");
        loadKeys();
        loadStats();
    } catch (error) {
        alert("Failed to generate key");
    }
}

function copyKey() {
    const key = document.getElementById('generatedKeyText').textContent;
    navigator.clipboard.writeText(key).then(() => {
        alert("Key copied to clipboard!");
    });
}

async function banKey(keyValue) {
    if (!confirm("Are you sure you want to ban this key?")) return;

    try {
        const res = await fetch("/api/ban", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ value: keyValue })
        });
        
        const data = await res.json();
        
        if (data.success) {
            loadKeys();
            loadStats();
        } else {
            alert("Failed to ban key");
        }
    } catch (error) {
        alert("Failed to ban key");
    }
}

async function unbanKey(keyValue) {
    if (!confirm("Are you sure you want to unban this key?")) return;

    try {
        const res = await fetch("/api/unban", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ value: keyValue })
        });
        
        if (res.ok) {
            loadKeys();
            loadStats();
        } else {
            alert("Failed to unban key");
        }
    } catch (error) {
        alert("Failed to unban key");
    }
}

async function deleteKey(keyValue) {
    if (!confirm("Are you sure you want to delete this key? This action cannot be undone!")) return;

    try {
        const res = await fetch("/api/keys/delete", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ value: keyValue })
        });
        
        if (res.ok) {
            loadKeys();
            loadStats();
        } else {
            alert("Failed to delete key");
        }
    } catch (error) {
        alert("Failed to delete key");
    }
}

function filterKeys() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const filteredKeys = allKeys.filter(key => 
        key.value.toLowerCase().includes(searchTerm) ||
        (key.hwid && key.hwid.toLowerCase().includes(searchTerm))
    );
    displayKeys(filteredKeys);
}

function showSection(section) {
    document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
    document.getElementById(section + 'Section').classList.remove('hidden');
    
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.querySelector(`[onclick="showSection('${section}')"]`).classList.add('active');
    
    document.getElementById('sectionTitle').textContent = 
        section.charAt(0).toUpperCase() + section.slice(1);
    
    currentSection = section;
    
    if (section === 'banned') {
        loadBannedKeys();
    } else if (section === 'screenshots') {
        loadScreenshots();
    } else if (section === 'stats') {
        loadStats();
    }
}

function loadSettings() {
    const autoRefresh = localStorage.getItem('autoRefresh') || '30';
    const theme = localStorage.getItem('theme') || 'dark-red';
    
    document.getElementById('autoRefresh').value = autoRefresh;
    document.getElementById('theme').value = theme;
    
    applyTheme(theme);
}

function saveSettings() {
    const autoRefresh = document.getElementById('autoRefresh').value;
    const theme = document.getElementById('theme').value;
    
    localStorage.setItem('autoRefresh', autoRefresh);
    localStorage.setItem('theme', theme);
    
    alert('Settings saved successfully!');
    applyTheme(theme);
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
}

function logout() {
    localStorage.removeItem('eclipse_auth');
    window.location.reload();
}

setInterval(() => {
    if (currentSection === 'dashboard') {
        loadKeys();
    } else if (currentSection === 'stats') {
        loadStats();
    }
}, 30000);
