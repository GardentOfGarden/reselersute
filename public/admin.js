let allKeys = [];
let currentSection = 'dashboard';

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
    
    document.getElementById('searchInput').addEventListener('input', (e) => {
        filterKeys(e.target.value);
    });
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
    }
}

async function loadKeys() {
    try {
        const res = await fetch("/api/keys");
        allKeys = await res.json();
        displayKeys(allKeys);
        loadBannedKeys();
    } catch (error) {
        console.error("Failed to load keys:", error);
    }
}

function displayKeys(keys) {
    const keysList = document.getElementById('keysList');
    keysList.innerHTML = '';

    keys.forEach(key => {
        const statusClass = key.banned ? 'banned' : 
                          key.expiresAt && new Date(key.expiresAt) < new Date() ? 'expired' : 'active';
        const statusText = key.banned ? "Banned" : 
                         key.expiresAt && new Date(key.expiresAt) < new Date() ? "Expired" : "Active";

        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td><code class="key-value">${key.value}</code></td>
            <td>${key.createdAt ? new Date(key.createdAt).toLocaleDateString() : "N/A"}</td>
            <td>${key.expiresAt ? new Date(key.expiresAt).toLocaleDateString() : "No Expiry"}</td>
            <td>
                <span class="hwid-status ${key.hwidLocked ? 'locked' : 'unlocked'}">
                    ${key.hwidLocked ? 'LOCKED' : 'UNLOCKED'}
                </span>
                ${key.hwid ? `<br><span class="hwid-value" title="${key.hwid}">${key.hwid.substring(0, 12)}...</span>` : ''}
            </td>
            <td><span class="key-status ${statusClass}">${statusText}</span></td>
            <td class="key-actions">
                ${!key.banned ? `
                <button class="btn-secondary btn-small" onclick="banKey('${key.value}')">
                    <i class="fas fa-ban"></i>
                    Ban
                </button>
                <button class="btn-small ${key.hwidLocked ? 'btn-success' : 'btn-secondary'}" onclick="toggleHWIDLock('${key.value}')">
                    <i class="fas ${key.hwidLocked ? 'fa-unlock' : 'fa-lock'}"></i>
                    ${key.hwidLocked ? 'Unlock' : 'Lock'} HWID
                </button>
                ` : ''}
                <button class="btn-secondary btn-small btn-danger" onclick="deleteKey('${key.value}')">
                    <i class="fas fa-trash"></i>
                    Delete
                </button>
            </td>
        `;
        
        keysList.appendChild(row);
    });
}

function loadBannedKeys() {
    const bannedKeys = allKeys.filter(key => key.banned);
    const bannedList = document.getElementById('bannedList');
    
    if (!bannedList) return;
    
    bannedList.innerHTML = '';

    bannedKeys.forEach(key => {
        const statusClass = 'banned';
        const statusText = "Banned";

        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td><code class="key-value">${key.value}</code></td>
            <td>${key.createdAt ? new Date(key.createdAt).toLocaleDateString() : "N/A"}</td>
            <td>${key.expiresAt ? new Date(key.expiresAt).toLocaleDateString() : "No Expiry"}</td>
            <td>
                ${key.hwid ? `<span class="hwid-value" title="${key.hwid}">${key.hwid.substring(0, 12)}...</span>` : 'No HWID'}
            </td>
            <td><span class="key-status ${statusClass}">${statusText}</span></td>
            <td class="key-actions">
                <button class="btn-secondary btn-small" onclick="unbanKey('${key.value}')">
                    <i class="fas fa-check"></i>
                    Unban
                </button>
                <button class="btn-secondary btn-small btn-danger" onclick="deleteKey('${key.value}')">
                    <i class="fas fa-trash"></i>
                    Delete
                </button>
            </td>
        `;
        
        bannedList.appendChild(row);
    });
}

function filterKeys(searchTerm) {
    const filteredKeys = allKeys.filter(key => 
        key.value.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (key.hwid && key.hwid.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (key.expiresAt && new Date(key.expiresAt).toLocaleDateString().toLowerCase().includes(searchTerm.toLowerCase()))
    );
    
    const keysList = document.getElementById('keysList');
    keysList.innerHTML = '';
    
    filteredKeys.forEach(key => {
        const statusClass = key.banned ? 'banned' : 
                          key.expiresAt && new Date(key.expiresAt) < new Date() ? 'expired' : 'active';
        const statusText = key.banned ? "Banned" : 
                         key.expiresAt && new Date(key.expiresAt) < new Date() ? "Expired" : "Active";

        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td><code class="key-value">${key.value}</code></td>
            <td>${key.createdAt ? new Date(key.createdAt).toLocaleDateString() : "N/A"}</td>
            <td>${key.expiresAt ? new Date(key.expiresAt).toLocaleDateString() : "No Expiry"}</td>
            <td>
                <span class="hwid-status ${key.hwidLocked ? 'locked' : 'unlocked'}">
                    ${key.hwidLocked ? 'LOCKED' : 'UNLOCKED'}
                </span>
                ${key.hwid ? `<br><span class="hwid-value" title="${key.hwid}">${key.hwid.substring(0, 12)}...</span>` : ''}
            </td>
            <td><span class="key-status ${statusClass}">${statusText}</span></td>
            <td class="key-actions">
                ${!key.banned ? `
                <button class="btn-secondary btn-small" onclick="banKey('${key.value}')">
                    <i class="fas fa-ban"></i>
                    Ban
                </button>
                <button class="btn-small ${key.hwidLocked ? 'btn-success' : 'btn-secondary'}" onclick="toggleHWIDLock('${key.value}')">
                    <i class="fas ${key.hwidLocked ? 'fa-unlock' : 'fa-lock'}"></i>
                    ${key.hwidLocked ? 'Unlock' : 'Lock'} HWID
                </button>
                ` : ''}
                <button class="btn-secondary btn-small btn-danger" onclick="deleteKey('${key.value}')">
                    <i class="fas fa-trash"></i>
                    Delete
                </button>
            </td>
        `;
        
        keysList.appendChild(row);
    });
}

async function generateKey() {
    const durationMs = parseInt(document.getElementById('durationSelect').value);
    
    try {
        const res = await fetch("/api/keys", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ durationMs })
        });
        
        const key = await res.json();
        document.getElementById('generatedKeyText').textContent = key.value;
        document.getElementById('genMsg').classList.remove("hidden");
        loadKeys();
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
        } else {
            alert("Failed to unban key");
        }
    } catch (error) {
        alert("Failed to unban key");
    }
}

async function toggleHWIDLock(keyValue) {
    try {
        const res = await fetch("/api/toggle-hwid", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ value: keyValue })
        });
        
        const data = await res.json();
        
        if (data.success) {
            loadKeys();
        } else {
            alert("Failed to toggle HWID lock");
        }
    } catch (error) {
        alert("Failed to toggle HWID lock");
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
        } else {
            alert("Failed to delete key");
        }
    } catch (error) {
        alert("Failed to delete key");
    }
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
    }
}

function loadSettings() {
    const autoRefresh = localStorage.getItem('autoRefresh') || '30';
    const theme = localStorage.getItem('theme') || 'dark-red';
    
    document.getElementById('autoRefresh').value = autoRefresh;
    document.getElementById('theme').value = theme;
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

document.getElementById('adminPass').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        login();
    }
});

setInterval(() => {
    if (currentSection === 'dashboard') {
        loadKeys();
    }
}, 30000);
