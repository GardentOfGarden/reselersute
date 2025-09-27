let allApps = [];
let allKeys = [];
let currentSection = 'dashboard';
let keysChart = null;

document.addEventListener('DOMContentLoaded', () => {
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

    document.getElementById('createAppBtn').addEventListener('click', createApp);
    document.getElementById('generateKeyBtn').addEventListener('click', generateKey);
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
            loadApps();
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
    if (localStorage.getItem('eclipse_auth')) {
        document.getElementById('loginBox').classList.add("hidden");
        document.getElementById('panelBox').classList.remove("hidden");
        loadApps();
        loadKeys();
        loadStats();
    }
}

async function loadApps() {
    try {
        const res = await fetch("/api/apps");
        allApps = await res.json();
        displayApps();
        populateAppSelect();
    } catch (error) {
        console.error("Failed to load apps:", error);
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

function displayApps() {
    const tbody = document.querySelector('#appsTable tbody');
    tbody.innerHTML = '';

    allApps.forEach(app => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${app.name}</td>
            <td><code>${app.id}</code></td>
            <td><code>${app.owner_id}</code></td>
            <td>${new Date(app.created_at).toLocaleDateString()}</td>
            <td>
                <button class="btn-secondary btn-small btn-danger" onclick="deleteApp('${app.id}')">
                    <i class="fas fa-trash"></i>
                    Delete
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function populateAppSelect() {
    const select = document.getElementById('appSelect');
    select.innerHTML = '<option value="">Select Application</option>';
    allApps.forEach(app => {
        const option = document.createElement('option');
        option.value = app.id;
        option.textContent = app.name;
        select.appendChild(option);
    });
}

function displayKeys(keys) {
    const tbody = document.querySelector('#keysTable tbody');
    tbody.innerHTML = '';

    keys.forEach(key => {
        const app = allApps.find(a => a.id === key.app_id) || { name: 'Unknown' };
        const statusClass = key.banned ? 'status-banned' : 
                           key.expires_at && new Date(key.expires_at) < new Date() ? 'status-expired' : 'status-active';
        const statusText = key.banned ? 'Banned' : 
                          key.expires_at && new Date(key.expires_at) < new Date() ? 'Expired' : 'Active';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td><code>${key.value}</code></td>
            <td>${app.name}</td>
            <td><code>${key.owner_id || 'N/A'}</code></td>
            <td>${key.created_at ? new Date(key.created_at).toLocaleDateString() : 'N/A'}</td>
            <td>${key.expires_at ? new Date(key.expires_at).toLocaleDateString() : 'Never'}</td>
            <td><code class="hwid">${key.hwid ? key.hwid.substring(0, 8) + '...' : 'Not set'}</code></td>
            <td>${key.activations || 0}/${key.max_activations || 1}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td>
                <div class="key-actions">
                    ${!key.banned ? `
                    <button class="btn-secondary btn-small" onclick="banKey('${key.value}')"><i class="fas fa-ban"></i> Ban</button>
                    ` : `
                    <button class="btn-secondary btn-small" onclick="unbanKey('${key.value}')"><i class="fas fa-check"></i> Unban</button>
                    `}
                    <button class="btn-secondary btn-small btn-danger" onclick="deleteKey('${key.value}')"><i class="fas fa-trash"></i> Delete</button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function loadBannedKeys() {
    const bannedKeys = allKeys.filter(key => key.banned);
    const tbody = document.querySelector('#bannedTable tbody');
    tbody.innerHTML = '';

    bannedKeys.forEach(key => {
        const app = allApps.find(a => a.id === key.app_id) || { name: 'Unknown' };
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><code>${key.value}</code></td>
            <td>${app.name}</td>
            <td><code>${key.owner_id || 'N/A'}</code></td>
            <td>${key.created_at ? new Date(key.created_at).toLocaleDateString() : 'N/A'}</td>
            <td><code class="hwid">${key.hwid ? key.hwid.substring(0, 8) + '...' : 'Not set'}</code></td>
            <td>
                <div class="key-actions">
                    <button class="btn-secondary btn-small" onclick="unbanKey('${key.value}')"><i class="fas fa-check"></i> Unban</button>
                    <button class="btn-secondary btn-small btn-danger" onclick="deleteKey('${key.value}')"><i class="fas fa-trash"></i> Delete</button>
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
                const app = allApps.find(a => a.id === key.app_id) || { name: 'Unknown' };
                key.screenshots.forEach(screenshot => {
                    const screenshotElement = document.createElement('div');
                    screenshotElement.className = 'screenshot-item';
                    screenshotElement.innerHTML = `
                        <div class="screenshot-thumb" onclick="viewScreenshot('${key.value}', '${screenshot.id}', '${app.name}')">
                            <img src="/api/screenshot/${key.value}/${screenshot.id}" alt="Screenshot">
                        </div>
                        <div class="screenshot-details">
                            <p><strong>Key:</strong> ${key.value.substring(0, 10)}...</p>
                            <p><strong>App:</strong> ${app.name}</p>
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

async function loadLogs() {
    try {
        const res = await fetch("/api/keys");
        const keys = await res.json();
        const tbody = document.querySelector('#logsTable tbody');
        tbody.innerHTML = '';

        keys.forEach(key => {
            if (key.usage_logs && key.usage_logs.length > 0) {
                const app = allApps.find(a => a.id === key.app_id) || { name: 'Unknown' };
                key.usage_logs.forEach(log => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td><code>${key.value}</code></td>
                        <td>${app.name}</td>
                        <td>${log.action}</td>
                        <td><code class="hwid">${log.hwid ? log.hwid.substring(0, 8) + '...' : 'N/A'}</code></td>
                        <td>${new Date(log.timestamp).toLocaleString()}</td>
                    `;
                    tbody.appendChild(row);
                });
            }
        });
    } catch (error) {
        console.error("Failed to load logs:", error);
    }
}

function filterScreenshots() {
    const searchTerm = document.getElementById('screenshotSearch').value.toLowerCase();
    const items = document.querySelectorAll('.screenshot-item');

    items.forEach(item => {
        const keyText = item.querySelector('.screenshot-details p:first-child').textContent.toLowerCase();
        const appText = item.querySelector('.screenshot-details p:nth-child(2)').textContent.toLowerCase();
        item.style.display = keyText.includes(searchTerm) || appText.includes(searchTerm) ? 'block' : 'none';
    });
}

async function viewScreenshot(key, id, appName) {
    try {
        const image = document.getElementById('screenshotImage');
        const keySpan = document.getElementById('screenshotKey');
        const appSpan = document.getElementById('screenshotApp');
        const timestampSpan = document.getElementById('screenshotTimestamp');

        image.src = `/api/screenshot/${key}/${id}`;
        keySpan.textContent = key;
        appSpan.textContent = appName;

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
        const appsRes = await fetch("/api/apps");
        const apps = await appsRes.json();

        document.getElementById('totalApps').textContent = apps.length;
        document.getElementById('totalKeys').textContent = stats.totalKeys;
        document.getElementById('activeKeys').textContent = stats.activeKeys;
        document.getElementById('bannedKeys').textContent = stats.bannedKeys;
        document.getElementById('statTotalKeys').textContent = stats.totalKeys;
        document.getElementById('statActiveSessions').textContent = stats.activeKeys;

        updateChart(stats);
    } catch (error) {
        console.error("Failed to load stats:", error);
    }
}

function updateChart(stats) {
    const ctx = document.getElementById('keysChart').getContext('2d');
    if (keysChart) keysChart.destroy();

    keysChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Active', 'Banned', 'Expired'],
            datasets: [{
                data: [stats.activeKeys, stats.bannedKeys, stats.expiredKeys],
                backgroundColor: ['#00e676', '#ff1744', '#ffca28'],
                borderColor: ['#00c853', '#d81b60', '#ffb300'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'bottom', labels: { color: '#fff' } } }
        }
    });
}

async function createApp() {
    const name = document.getElementById('appName').value;
    const ownerId = document.getElementById('ownerId').value;

    if (!name || !ownerId) {
        alert("Please enter app name and owner ID");
        return;
    }

    try {
        const res = await fetch("/api/apps", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ name, owner_id: ownerId })
        });

        if (res.ok) {
            document.getElementById('appName').value = '';
            document.getElementById('ownerId').value = '';
            loadApps();
        } else {
            alert("Failed to create app");
        }
    } catch (error) {
        alert("Failed to create app");
    }
}

async function generateKey() {
    const appId = document.getElementById('appSelect').value;
    const durationMs = parseInt(document.getElementById('durationSelect').value);
    const maxActivations = parseInt(document.getElementById('maxActivations').value) || 1;
    const ownerId = document.getElementById('ownerIdKey').value;

    if (!appId || !ownerId) {
        alert("Please select an application and enter owner ID");
        return;
    }

    try {
        const res = await fetch("/api/keys", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ app_id: appId, duration_ms: durationMs, owner_id: ownerId, max_activations: maxActivations })
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

        if (res.ok) {
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
    if (!confirm("Are you sure you want to delete this key?")) return;

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

async function deleteApp(appId) {
    if (!confirm("Are you sure you want to delete this app?")) return;

    try {
        const res = await fetch("/api/apps/delete", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ id: appId })
        });

        if (res.ok) {
            loadApps();
        } else {
            alert("Failed to delete app");
        }
    } catch (error) {
        alert("Failed to delete app");
    }
}

function filterKeys() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const filteredKeys = allKeys.filter(key => 
        key.value.toLowerCase().includes(searchTerm) ||
        (key.hwid && key.hwid.toLowerCase().includes(searchTerm)) ||
        (key.owner_id && key.owner_id.toLowerCase().includes(searchTerm)) ||
        (allApps.find(a => a.id === key.app_id)?.name.toLowerCase().includes(searchTerm))
    );
    displayKeys(filteredKeys);
}

function showSection(section) {
    document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
    document.getElementById(section + 'Section').classList.remove('hidden');

    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.querySelector(`[onclick="showSection('${section}')"]`).classList.add('active');

    document.getElementById('sectionTitle').textContent = section.charAt(0).toUpperCase() + section.slice(1);
    currentSection = section;

    if (section === 'apps') loadApps();
    else if (section === 'keys') loadKeys();
    else if (section === 'banned') loadBannedKeys();
    else if (section === 'screenshots') loadScreenshots();
    else if (section === 'logs') loadLogs();
    else if (section === 'stats') loadStats();
}

function loadSettings() {
    const autoRefresh = localStorage.getItem('autoRefresh') || '30';
    const theme = localStorage.getItem('theme') || 'dark-neon';
    const notifyExpiring = localStorage.getItem('notifyExpiring') === 'true';

    document.getElementById('autoRefresh').value = autoRefresh;
    document.getElementById('theme').value = theme;
    document.getElementById('notifyExpiring').checked = notifyExpiring;
    applyTheme(theme);
}

function saveSettings() {
    const autoRefresh = document.getElementById('autoRefresh').value;
    const theme = document.getElementById('theme').value;
    const notifyExpiring = document.getElementById('notifyExpiring').checked;

    localStorage.setItem('autoRefresh', autoRefresh);
    localStorage.setItem('theme', theme);
    localStorage.setItem('notifyExpiring', notifyExpiring);
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
    if (currentSection === 'dashboard') loadStats();
    else if (currentSection === 'apps') loadApps();
    else if (currentSection === 'keys') loadKeys();
    else if (currentSection === 'stats') loadStats();
}, 30000);
