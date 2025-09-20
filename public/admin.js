let allKeys = [];
let currentSection = 'dashboard';
let charts = {};

document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    bindEvents();
    checkAuth();
    loadSettings();
    initCharts();
}

function bindEvents() {
    document.getElementById('authButton').addEventListener('click', login);
    document.getElementById('adminPassword').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') login();
    });

    document.getElementById('generateKeyBtn').addEventListener('click', generateKey);
    document.getElementById('copyKeyBtn').addEventListener('click', copyKey);
    document.getElementById('logoutBtn').addEventListener('click', logout);

    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.getAttribute('data-section');
            showSection(section);
        });
    });

    document.getElementById('globalSearch').addEventListener('input', handleGlobalSearch);
    document.getElementById('keyFilter').addEventListener('change', filterKeys);
    document.getElementById('hwidSearch').addEventListener('input', filterHwids);
    document.getElementById('timeFilter').addEventListener('change', updateActivationChart);
}

async function login() {
    const password = document.getElementById('adminPassword').value;
    
    if (!password) {
        showNotification('Please enter password', 'error');
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
            document.getElementById('authScreen').classList.add("hidden");
            document.getElementById('mainSystem').classList.remove("hidden");
            localStorage.setItem('eclipse_auth', 'true');
            loadKeys();
            loadStats();
            loadHwidData();
        } else {
            showNotification(data.message || "Wrong password!", 'error');
        }
    } catch (error) {
        showNotification("Login failed!", 'error');
    }
}

function checkAuth() {
    const isAuthenticated = localStorage.getItem('eclipse_auth');
    if (isAuthenticated) {
        document.getElementById('authScreen').classList.add("hidden");
        document.getElementById('mainSystem').classList.remove("hidden");
        loadKeys();
        loadStats();
        loadHwidData();
    }
}

async function loadKeys() {
    try {
        const res = await fetch("/api/keys");
        allKeys = await res.json();
        displayKeys(allKeys);
    } catch (error) {
        showNotification("Failed to load keys", 'error');
    }
}

function displayKeys(keys) {
    const tbody = document.querySelector('#keysTable tbody');
    tbody.innerHTML = '';

    const filter = document.getElementById('keyFilter').value;
    let filteredKeys = keys;

    if (filter !== 'all') {
        filteredKeys = keys.filter(key => {
            if (filter === 'active') return !key.banned && (!key.expiresAt || new Date(key.expiresAt) > new Date());
            if (filter === 'banned') return key.banned;
            if (filter === 'expired') return !key.banned && key.expiresAt && new Date(key.expiresAt) < new Date();
            return true;
        });
    }

    filteredKeys.forEach(key => {
        const row = document.createElement('tr');
        
        const statusClass = key.banned ? 'status-banned' : 
                          new Date(key.expiresAt) < new Date() ? 'status-expired' : 'status-active';
        const statusText = key.banned ? 'Banned' : 
                         new Date(key.expiresAt) < new Date() ? 'Expired' : 'Active';

        row.innerHTML = `
            <td><code>${key.value || 'N/A'}</code></td>
            <td>${key.createdAt ? new Date(key.createdAt).toLocaleDateString() : 'N/A'}</td>
            <td>${key.expiresAt ? new Date(key.expiresAt).toLocaleDateString() : 'Never'}</td>
            <td>${key.usedHwids ? key.usedHwids.length + '/' + key.maxHwids : '0/1'}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td>
                <div class="action-buttons">
                    ${!key.banned ? `
                    <button class="btn-icon" onclick="banKey('${key.value}')" title="Ban Key">
                        <i class="fas fa-ban"></i>
                    </button>
                    ` : ''}
                    <button class="btn-icon" onclick="showKeyDetails('${key.value}')" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-icon btn-danger" onclick="deleteKey('${key.value}')" title="Delete Key">
                        <i class="fas fa-trash"></i>
                    </button>
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
        
        document.getElementById('totalKeys').textContent = stats.totalKeys;
        document.getElementById('activeHwids').textContent = stats.totalActivations;
        document.getElementById('bannedKeys').textContent = stats.bannedKeys;
        document.getElementById('activationRate').textContent = stats.activationRate;
        document.getElementById('totalActivations').textContent = stats.totalActivations;
        document.getElementById('usageRate').textContent = stats.activationRate;
        document.getElementById('avgActivations').textContent = stats.totalKeys > 0 ? (stats.totalActivations / stats.totalKeys).toFixed(1) : '0';
        
    } catch (error) {
        console.error("Failed to load stats:", error);
    }
}

async function loadHwidData() {
    try {
        const res = await fetch("/api/hwid-logs");
        const logs = await res.json();
        displayHwids(logs);
    } catch (error) {
        console.error("Failed to load HWID data:", error);
    }
}

function displayHwids(logs) {
    const tbody = document.querySelector('#hwidTable tbody');
    tbody.innerHTML = '';

    const searchTerm = document.getElementById('hwidSearch').value.toLowerCase();
    const filteredLogs = logs.filter(log => 
        log.hwid.toLowerCase().includes(searchTerm) ||
        log.key.toLowerCase().includes(searchTerm)
    );

    filteredLogs.forEach(log => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td><code>${log.hwid.substring(0, 16)}...</code></td>
            <td>${log.key}</td>
            <td>${new Date(log.timestamp).toLocaleDateString()}</td>
            <td>${new Date(log.timestamp).toLocaleString()}</td>
            <td><span class="status-badge status-active">Active</span></td>
            <td>
                <button class="btn-icon" onclick="resetHwid('${log.key}', '${log.hwid}')" title="Reset HWID">
                    <i class="fas fa-sync"></i>
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

async function generateKey() {
    const durationValue = parseInt(document.getElementById('durationValue').value);
    const durationUnit = document.getElementById('durationUnit').value;
    const maxHwids = parseInt(document.getElementById('maxHwids').value);

    if (!durationValue || durationValue < 1) {
        showNotification('Please enter valid duration', 'error');
        return;
    }

    let durationMs = durationValue * 1000;
    switch (durationUnit) {
        case 'minutes': durationMs *= 60; break;
        case 'hours': durationMs *= 3600; break;
        case 'days': durationMs *= 86400; break;
        case 'weeks': durationMs *= 604800; break;
        case 'months': durationMs *= 2592000; break;
    }

    try {
        const res = await fetch("/api/keys", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ durationMs, maxHwids })
        });
        
        const key = await res.json();
        
        document.getElementById('generatedKey').textContent = key.value;
        document.getElementById('keyHwidLimit').textContent = key.maxHwids;
        document.getElementById('keyExpiry').textContent = key.expiresAt ? new Date(key.expiresAt).toLocaleDateString() : 'Never';
        document.getElementById('generatedKeyContainer').classList.remove("hidden");
        
        showNotification('Key generated successfully!', 'success');
        loadKeys();
        loadStats();
        
    } catch (error) {
        showNotification('Failed to generate key', 'error');
    }
}

function copyKey() {
    const key = document.getElementById('generatedKey').textContent;
    navigator.clipboard.writeText(key).then(() => {
        showNotification('Key copied to clipboard!', 'success');
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
            showNotification('Key banned successfully', 'success');
            loadKeys();
            loadStats();
        } else {
            showNotification('Failed to ban key', 'error');
        }
    } catch (error) {
        showNotification('Failed to ban key', 'error');
    }
}

async function resetHwid(keyValue, hwid) {
    if (!confirm("Are you sure you want to reset this HWID?")) return;

    try {
        const res = await fetch(`/api/key/${keyValue}/reset-hwid`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ hwid })
        });
        
        if (res.ok) {
            showNotification('HWID reset successfully', 'success');
            loadHwidData();
            loadStats();
        } else {
            showNotification('Failed to reset HWID', 'error');
        }
    } catch (error) {
        showNotification('Failed to reset HWID', 'error');
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
            showNotification('Key deleted successfully', 'success');
            loadKeys();
            loadStats();
        } else {
            showNotification('Failed to delete key', 'error');
        }
    } catch (error) {
        showNotification('Failed to delete key', 'error');
    }
}

function showSection(section) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    
    document.getElementById(section + 'Section').classList.add('active');
    document.querySelector(`[data-section="${section}"]`).classList.add('active');
    
    document.getElementById('currentSection').textContent = section.charAt(0).toUpperCase() + section.slice(1);
    
    currentSection = section;
    
    if (section === 'activations') {
        updateActivationChart();
    } else if (section === 'hwid') {
        loadHwidData();
    }
}

function filterKeys() {
    displayKeys(allKeys);
}

function filterHwids() {
    loadHwidData();
}

function handleGlobalSearch(e) {
    const term = e.target.value.toLowerCase();
    
    if (currentSection === 'dashboard') {
        const filteredKeys = allKeys.filter(key => 
            key.value.toLowerCase().includes(term) ||
            (key.usedHwids && key.usedHwids.some(hwid => hwid.toLowerCase().includes(term)))
        );
        displayKeys(filteredKeys);
    }
}

function initCharts() {
    const keyCtx = document.getElementById('keyDistributionChart');
    if (keyCtx) {
        charts.keyDistribution = new Chart(keyCtx, {
            type: 'doughnut',
            data: {
                labels: ['Active', 'Banned', 'Expired'],
                datasets: [{
                    data: [0, 0, 0],
                    backgroundColor: ['#00cc66', '#ff4444', '#ffcc00']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }
}

function updateActivationChart() {
    const timeFilter = document.getElementById('timeFilter').value;
    
    if (charts.activation) {
        charts.activation.destroy();
    }
    
    const ctx = document.getElementById('activationChart');
    if (ctx) {
        charts.activation = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    label: 'Activations',
                    data: [12, 19, 8, 15, 22, 18, 25],
                    borderColor: '#ff2a2a',
                    tension: 0.4,
                    fill: true,
                    backgroundColor: 'rgba(255, 42, 42, 0.1)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }
}

function loadSettings() {
    const autoRefresh = localStorage.getItem('autoRefresh') || '30';
    const theme = localStorage.getItem('theme') || 'dark';
    const hwidLimit = localStorage.getItem('defaultHwidLimit') || '1';
    
    document.getElementById('autoRefresh').value = autoRefresh;
    document.getElementById('themeSelect').value = theme;
    document.getElementById('defaultHwidLimit').value = hwidLimit;
    
    applyTheme(theme);
}

function saveSettings() {
    const autoRefresh = document.getElementById('autoRefresh').value;
    const theme = document.getElementById('themeSelect').value;
    const hwidLimit = document.getElementById('defaultHwidLimit').value;
    
    localStorage.setItem('autoRefresh', autoRefresh);
    localStorage.setItem('theme', theme);
    localStorage.setItem('defaultHwidLimit', hwidLimit);
    
    applyTheme(theme);
    showNotification('Settings saved successfully!', 'success');
}

function applyTheme(theme) {
    if (theme === 'light') {
        document.body.classList.add('light-theme');
    } else {
        document.body.classList.remove('light-theme');
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation' : 'info'}-circle"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

function logout() {
    localStorage.removeItem('eclipse_auth');
    window.location.reload();
}

setInterval(() => {
    if (currentSection === 'dashboard') {
        loadKeys();
        loadStats();
    }
}, 30000);
