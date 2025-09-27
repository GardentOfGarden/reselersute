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
            localStorage.setItem('keyauth_auth', 'true');
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
    if (localStorage.getItem('keyauth_auth')) {
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
        loadStats();
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
            <td><a href="${app.dll_url}" target="_blank">Link</a></td>
            <td>${new Date(app.created_at).toLocaleDateString()}</td>
        `;
        tbody.appendChild(row);
    });
}

function populateAppSelect() {
    const select = document.getElementById('appSelect');
    select.innerHTML = '';
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
        const appNames = key.app_ids.map(id => allApps.find(a => a.id === id)?.name || 'Unknown').join(', ');
        const statusClass = key.banned ? 'status-banned' : 
                           key.expires_at && new Date(key.expires_at) < new Date() ? 'status-expired' : 'status-active';
        const statusText = key.banned ? 'Banned' : 
                          key.expires_at && new Date(key.expires_at) < new Date() ? 'Expired' : 'Active';
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><code>${key.value}</code></td>
            <td>${appNames}</td>
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
        document.getElementById('statActiveKeys').textContent = stats.activeKeys;
        document.getElementById('statBannedKeys').textContent = stats.bannedKeys;
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
    const dllUrl = document.getElementById('dllUrl').value;
    if (!name || !ownerId || !dllUrl) {
        alert("Please fill all fields");
        return;
    }
    try {
        const res = await fetch("/api/apps", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ name, owner_id: ownerId, dll_url: dllUrl })
        });
        if (res.ok) {
            document.getElementById('appName').value = '';
            document.getElementById('ownerId').value = '';
            document.getElementById('dllUrl').value = '';
            loadApps();
        } else {
            const data = await res.json();
            alert(data.message || "Failed to create app");
        }
    } catch (error) {
        alert("Failed to create app");
    }
}

async function generateKey() {
    const appIds = Array.from(document.getElementById('appSelect').selectedOptions).map(option => option.value);
    const durationMs = parseInt(document.getElementById('durationSelect').value);
    const maxActivations = parseInt(document.getElementById('maxActivations').value) || 1;
    const ownerId = document.getElementById('ownerIdKey').value;
    if (!appIds.length || !ownerId) {
        alert("Please select at least one application and enter owner ID");
        return;
    }
    try {
        const res = await fetch("/api/keys", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ app_ids: appIds, duration_ms: durationMs, owner_id: ownerId, max_activations: maxActivations })
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

function filterKeys() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const filteredKeys = allKeys.filter(key => 
        key.value.toLowerCase().includes(searchTerm) ||
        (key.hwid && key.hwid.toLowerCase().includes(searchTerm)) ||
        (key.owner_id && key.owner_id.toLowerCase().includes(searchTerm)) ||
        key.app_ids.some(id => allApps.find(a => a.id === id)?.name.toLowerCase().includes(searchTerm))
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
    else if (section === 'stats') loadStats();
}

function logout() {
    localStorage.removeItem('keyauth_auth');
    window.location.reload();
}
