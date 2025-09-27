let allApps = [];
let allKeys = [];
let currentApp = 'all';

document.addEventListener('DOMContentLoaded', function() {
    initializeAdmin();
});

async function initializeAdmin() {
    await checkAuth();
    bindEvents();
    loadData();
}

function bindEvents() {
    document.getElementById('loginBtn').addEventListener('click', login);
    document.getElementById('adminPass').addEventListener('keypress', e => e.key === 'Enter' && login());
    document.getElementById('generateKeyBtn').addEventListener('click', generateKey);
    document.getElementById('registerAppBtn').addEventListener('click', registerApp);
    document.getElementById('appFilter').addEventListener('change', filterByApp);
}

async function checkAuth() {
    if (localStorage.getItem('admin_token')) {
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('adminPanel').classList.remove('hidden');
        return true;
    }
    return false;
}

async function login() {
    const password = document.getElementById('adminPass').value;
    const message = document.getElementById('loginMessage');

    try {
        const res = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        
        const data = await res.json();
        if (data.success) {
            localStorage.setItem('admin_token', data.token);
            document.getElementById('loginScreen').classList.add('hidden');
            document.getElementById('adminPanel').classList.remove('hidden');
            loadData();
        } else {
            message.textContent = data.message || 'Authentication failed';
        }
    } catch (error) {
        message.textContent = 'Connection error';
    }
}

async function loadData() {
    await loadStats();
    await loadApps();
    await loadKeys();
}

async function loadStats() {
    try {
        const res = await fetch('/api/admin/stats');
        const stats = await res.json();
        
        document.getElementById('totalApps').textContent = stats.totalApps;
        document.getElementById('totalKeys').textContent = stats.totalKeys;
        document.getElementById('activeKeys').textContent = stats.activeKeys;
        document.getElementById('bannedKeys').textContent = stats.bannedKeys;
        document.getElementById('totalScreenshots').textContent = stats.totalScreenshots;
    } catch (error) {
        console.error('Stats loading failed:', error);
    }
}

async function loadApps() {
    try {
        const res = await fetch('/api/admin/keys');
        const data = await res.json();
        allApps = data.apps;
        
        const appFilter = document.getElementById('appFilter');
        appFilter.innerHTML = '<option value="all">All Applications</option>';
        
        allApps.forEach(app => {
            const option = document.createElement('option');
            option.value = app.id;
            option.textContent = `${app.name} (${app.owner})`;
            appFilter.appendChild(option);
        });
    } catch (error) {
        console.error('Apps loading failed:', error);
    }
}

async function loadKeys() {
    try {
        const res = await fetch('/api/admin/keys');
        const data = await res.json();
        allKeys = data.keys;
        displayKeys(allKeys);
    } catch (error) {
        console.error('Keys loading failed:', error);
    }
}

function displayKeys(keys) {
    const tbody = document.querySelector('#keysTable tbody');
    tbody.innerHTML = '';

    keys.forEach(key => {
        const app = allApps.find(a => a.id === key.appid) || {};
        const statusClass = key.banned ? 'status-banned' : 
                          key.expiresAt && new Date(key.expiresAt) < new Date() ? 'status-expired' : 'status-active';
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><code>${key.value}</code></td>
            <td>${app.name || 'N/A'}</td>
            <td>${key.createdAt ? new Date(key.createdAt).toLocaleDateString() : 'N/A'}</td>
            <td>${key.expiresAt ? new Date(key.expiresAt).toLocaleDateString() : 'Never'}</td>
            <td>${key.activations || 0}/${key.maxActivations || 1}</td>
            <td><span class="status-badge ${statusClass}">${key.banned ? 'Banned' : 
                key.expiresAt && new Date(key.expiresAt) < new Date() ? 'Expired' : 'Active'}</span></td>
            <td>
                <div class="key-actions">
                    ${!key.banned ? 
                    `<button class="btn-small btn-warning" onclick="banKey('${key.value}')">Ban</button>` :
                    `<button class="btn-small btn-success" onclick="unbanKey('${key.value}')">Unban</button>`}
                    <button class="btn-small btn-danger" onclick="deleteKey('${key.value}')">Delete</button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function generateKey() {
    const appid = document.getElementById('keyApp').value;
    const duration = document.getElementById('keyDuration').value;
    const maxActivations = document.getElementById('maxActivations').value || 1;
    const note = document.getElementById('keyNote').value;

    if (!appid) {
        alert('Please select an application');
        return;
    }

    try {
        const res = await fetch('/api/admin/keys/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                appid, 
                durationMs: duration * 24 * 60 * 60 * 1000,
                maxActivations,
                note 
            })
        });
        
        const data = await res.json();
        if (data.success) {
            alert(`Key generated: ${data.key.value}`);
            loadKeys();
            loadStats();
        } else {
            alert('Key generation failed');
        }
    } catch (error) {
        alert('Connection error');
    }
}

async function registerApp() {
    const name = document.getElementById('appName').value;
    const owner = document.getElementById('appOwner').value;
    const password = document.getElementById('adminPass').value;

    if (!name || !owner) {
        alert('Please fill all fields');
        return;
    }

    try {
        const res = await fetch('/api/app/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, owner, adminPassword: password })
        });
        
        const data = await res.json();
        if (data.success) {
            alert(`App registered: ${data.app.name}\nToken: ${data.app.token}`);
            loadApps();
        } else {
            alert('App registration failed');
        }
    } catch (error) {
        alert('Connection error');
    }
}

async function banKey(keyValue) {
    if (!confirm('Ban this key?')) return;
    
    await fetch('/api/admin/keys/ban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: keyValue })
    });
    
    loadKeys();
}

async function unbanKey(keyValue) {
    await fetch('/api/admin/keys/unban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: keyValue })
    });
    
    loadKeys();
}

async function deleteKey(keyValue) {
    if (!confirm('Permanently delete this key?')) return;
    
    await fetch(`/api/admin/keys/${keyValue}`, { method: 'DELETE' });
    loadKeys();
}

function filterByApp() {
    const appid = document.getElementById('appFilter').value;
    const filtered = appid === 'all' ? allKeys : allKeys.filter(k => k.appid === appid);
    displayKeys(filtered);
}

function logout() {
    localStorage.removeItem('admin_token');
    location.reload();
}

setInterval(loadStats, 30000);
