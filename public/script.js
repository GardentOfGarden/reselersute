let allKeys = [];
let currentSection = 'dashboard';

// Инициализация
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    bindEvents();
    checkAuth();
}

function bindEvents() {
    // Login
    document.getElementById('loginBtn').addEventListener('click', login);
    document.getElementById('adminPass').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') login();
    });

    // Generate Key
    document.getElementById('generateBtn').addEventListener('click', generateKey);
    document.getElementById('copyKeyBtn').addEventListener('click', copyKey);

    // Search
    document.getElementById('searchInput').addEventListener('input', (e) => {
        filterKeys(e.target.value);
    });
}

async function login() {
    const password = document.getElementById('adminPass').value;
    const message = document.getElementById('loginMsg');

    if (!password) {
        message.textContent = 'Please enter password';
        return;
    }

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ password })
        });

        const data = await res.json();

        if (data.success) {
            document.getElementById('loginScreen').classList.add('hidden');
            document.getElementById('panelBox').classList.remove('hidden');
            localStorage.setItem('eclipse_auth', 'true');
            loadKeys();
        } else {
            message.textContent = data.message || 'Wrong password!';
        }
    } catch (error) {
        message.textContent = 'Login failed!';
    }
}

function checkAuth() {
    const isAuthenticated = localStorage.getItem('eclipse_auth');
    if (isAuthenticated) {
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('panelBox').classList.remove('hidden');
        loadKeys();
    }
}

async function loadKeys() {
    try {
        const res = await fetch('/api/keys');
        allKeys = await res.json();
        displayKeys(allKeys);
        updateStats();
        loadBannedKeys();
    } catch (error) {
        console.error('Failed to load keys:', error);
    }
}

function displayKeys(keys) {
    const tbody = document.querySelector('#keysTable tbody');
    tbody.innerHTML = '';

    keys.forEach(key => {
        const row = document.createElement('tr');
        
        const statusClass = key.banned ? 'status-banned' : 
                          new Date(key.expiresAt) < new Date() ? 'status-expired' : 'status-active';
        const statusText = key.banned ? 'Banned' : 
                         new Date(key.expiresAt) < new Date() ? 'Expired' : 'Active';

        row.innerHTML = `
            <td><code>${key.key || 'N/A'}</code></td>
            <td>${key.createdAt ? new Date(key.createdAt).toLocaleDateString() : 'N/A'}</td>
            <td>${key.expiresAt ? new Date(key.expiresAt).toLocaleDateString() : 'Never'}</td>
            <td>${key.duration || 'N/A'}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td>
                ${!key.banned ? `
                <button class="btn-secondary" onclick="banKey(${key.id})">
                    <i class="fas fa-ban"></i>
                    Ban
                </button>
                ` : 'Already banned'}
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
            <td><code>${key.key || 'N/A'}</code></td>
            <td>${key.createdAt ? new Date(key.createdAt).toLocaleDateString() : 'N/A'}</td>
            <td>${key.expiresAt ? new Date(key.expiresAt).toLocaleDateString() : 'Never'}</td>
            <td>${key.duration || 'N/A'}</td>
            <td><span class="status-badge status-banned">Banned</span></td>
        `;
        
        tbody.appendChild(row);
    });
}

function updateStats() {
    const totalKeys = allKeys.length;
    const activeKeys = allKeys.filter(k => !k.banned && new Date(k.expiresAt) > new Date()).length;
    const bannedKeys = allKeys.filter(k => k.banned).length;
    const expiredKeys = allKeys.filter(k => !k.banned && new Date(k.expiresAt) < new Date()).length;

    document.getElementById('totalKeys').textContent = totalKeys;
    document.getElementById('activeKeys').textContent = activeKeys;
    document.getElementById('bannedKeys').textContent = bannedKeys;
    document.getElementById('expiredKeys').textContent = expiredKeys;
}

async function generateKey() {
    const duration = document.getElementById('durationValue').value;
    const unit = document.getElementById('durationUnit').value;

    if (!duration || duration < 1) {
        alert('Please enter valid duration');
        return;
    }

    try {
        const res = await fetch('/api/keys', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ duration: parseInt(duration), unit })
        });
        
        const data = await res.json();
        
        if (data.success) {
            document.getElementById('generatedKeyText').textContent = data.key.key;
            document.getElementById('genMsg').classList.remove('hidden');
            loadKeys();
        } else {
            alert('Failed to generate key: ' + data.message);
        }
    } catch (error) {
        alert('Failed to generate key');
    }
}

function copyKey() {
    const key = document.getElementById('generatedKeyText').textContent;
    navigator.clipboard.writeText(key).then(() => {
        alert('Key copied to clipboard!');
    });
}

async function banKey(keyId) {
    if (!confirm('Are you sure you want to ban this key?')) return;

    try {
        const res = await fetch(`/api/keys/${keyId}/ban`, {
            method: 'POST'
        });
        
        const data = await res.json();
        
        if (data.success) {
            loadKeys();
        } else {
            alert('Failed to ban key');
        }
    } catch (error) {
        alert('Failed to ban key');
    }
}

function filterKeys(searchTerm) {
    const filteredKeys = allKeys.filter(key => 
        (key.key && key.key.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (key.duration && key.duration.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (key.status && key.status.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    displayKeys(filteredKeys);
}

function showSection(section) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
    
    // Show selected section
    document.getElementById(section + 'Section').classList.remove('hidden');
    
    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.querySelector(`[onclick="showSection('${section}')"]`).classList.add('active');
    
    // Update title
    document.getElementById('sectionTitle').textContent = 
        section.charAt(0).toUpperCase() + section.slice(1);
    
    currentSection = section;
    
    // Load section-specific data
    if (section === 'banned') {
        loadBannedKeys();
    }
}

function saveSettings() {
    const autoRefresh = document.getElementById('autoRefresh').value;
    const theme = document.getElementById('theme').value;
    
    localStorage.setItem('autoRefresh', autoRefresh);
    localStorage.setItem('theme', theme);
    
    alert('Settings saved!');
}

function logout() {
    localStorage.removeItem('eclipse_auth');
    window.location.reload();
}
