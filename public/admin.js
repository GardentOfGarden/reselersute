let currentUser = null;
let authToken = null;

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    checkAuthStatus();
    initializeGoogleAuth();
});

function initializeGoogleAuth() {
    // Google Sign-In will be initialized automatically via HTML
}

async function checkAuthStatus() {
    const savedToken = localStorage.getItem('eclipse_token');
    const savedUser = localStorage.getItem('eclipse_user');
    
    if (savedToken && savedUser) {
        try {
            authToken = savedToken;
            currentUser = JSON.parse(savedUser);
            showMainPanel();
            await loadDashboardData();
        } catch (error) {
            logout();
        }
    }
}

function showAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('passwordAuth').classList.add('hidden');
    document.getElementById('googleAuth').classList.add('hidden');
    
    event.target.classList.add('active');
    document.getElementById(tab + 'Auth').classList.remove('hidden');
}

async function login() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    if (!email || !password) {
        showMessage('Please fill all fields', 'error');
        return;
    }

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            authToken = data.token;
            currentUser = data.user;
            saveAuthData();
            showMainPanel();
            await loadDashboardData();
        } else {
            showMessage(data.message, 'error');
        }
    } catch (error) {
        showMessage('Login failed. Please try again.', 'error');
    }
}

function handleGoogleSignIn(response) {
    const token = response.credential;
    
    fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            authToken = data.token;
            currentUser = data.user;
            saveAuthData();
            showMainPanel();
            loadDashboardData();
        } else {
            showMessage(data.message, 'error');
        }
    })
    .catch(error => {
        showMessage('Google login failed', 'error');
    });
}

function saveAuthData() {
    localStorage.setItem('eclipse_token', authToken);
    localStorage.setItem('eclipse_user', JSON.stringify(currentUser));
}

function showMainPanel() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('mainPanel').classList.remove('hidden');
    
    // Update user info
    document.getElementById('userName').textContent = currentUser.name;
    document.getElementById('userRole').textContent = currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1);
    
    if (currentUser.picture) {
        document.getElementById('userAvatar').innerHTML = `<img src="${currentUser.picture}" alt="${currentUser.name}">`;
    } else {
        document.getElementById('userAvatar').innerHTML = currentUser.name.charAt(0).toUpperCase();
    }
}

function showSection(section) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
    
    // Remove active class from all nav items
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    // Show selected section
    document.getElementById(section + 'Section').classList.remove('hidden');
    
    // Add active class to clicked nav item
    event.target.classList.add('active');
    
    // Update page title
    updatePageTitle(section);
    
    // Load section data
    loadSectionData(section);
}

function updatePageTitle(section) {
    const titles = {
        'dashboard': 'Dashboard Overview',
        'apps': 'Applications Management',
        'keys': 'License Keys',
        'users': 'Users Management',
        'settings': 'System Settings'
    };
    
    document.getElementById('pageTitle').textContent = titles[section] || 'Eclipse Panel';
}

async function loadSectionData(section) {
    switch(section) {
        case 'dashboard':
            await loadDashboardData();
            break;
        case 'apps':
            await loadApps();
            break;
        case 'keys':
            await loadKeys();
            break;
        case 'users':
            await loadUsers();
            break;
        case 'settings':
            await loadSettings();
            break;
    }
}

async function loadDashboardData() {
    try {
        const response = await fetch('/api/stats', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('statApps').textContent = data.stats.totalApps;
            document.getElementById('statKeys').textContent = data.stats.totalKeys;
            document.getElementById('statUsers').textContent = data.stats.totalUsers;
            document.getElementById('statActive').textContent = data.stats.todayActivations;
        }
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

async function loadApps() {
    try {
        const response = await fetch('/api/apps', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            const tbody = document.querySelector('#appsTable tbody');
            tbody.innerHTML = '';
            
            data.apps.forEach(app => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${app.name}</td>
                    <td><code>${app.id}</code></td>
                    <td>${app.version}</td>
                    <td><span class="status-badge ${app.enabled ? 'status-active' : 'status-banned'}">${app.enabled ? 'Active' : 'Disabled'}</span></td>
                    <td>
                        <button class="btn-secondary btn-small" onclick="toggleApp('${app.id}', ${!app.enabled})">
                            ${app.enabled ? 'Disable' : 'Enable'}
                        </button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        }
    } catch (error) {
        console.error('Failed to load apps:', error);
    }
}

async function loadKeys() {
    try {
        const response = await fetch('/api/keys', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            const tbody = document.querySelector('#keysTable tbody');
            tbody.innerHTML = '';
            
            data.keys.forEach(key => {
                const status = key.banned ? 'banned' : 
                             (key.expiresAt && new Date(key.expiresAt) < new Date()) ? 'expired' : 'active';
                const statusText = key.banned ? 'Banned' : 
                                 (key.expiresAt && new Date(key.expiresAt) < new Date()) ? 'Expired' : 'Active';
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><code>${key.value}</code></td>
                    <td>${key.appName}</td>
                    <td>${new Date(key.createdAt).toLocaleDateString()}</td>
                    <td>${key.expiresAt ? new Date(key.expiresAt).toLocaleDateString() : 'Never'}</td>
                    <td><span class="status-badge status-${status}">${statusText}</span></td>
                    <td>
                        ${!key.banned ? `
                        <button class="btn-danger btn-small" onclick="banKey('${key.value}')">
                            Ban
                        </button>
                        ` : ''}
                    </td>
                `;
                tbody.appendChild(row);
            });
        }
    } catch (error) {
        console.error('Failed to load keys:', error);
    }
}

async function loadUsers() {
    if (currentUser.role !== 'admin') {
        document.getElementById('usersSection').innerHTML = '<div class="card"><div class="card-body"><p>Access denied. Admin rights required.</p></div></div>';
        return;
    }
    
    try {
        const response = await fetch('/api/users', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            const tbody = document.querySelector('#usersTable tbody');
            tbody.innerHTML = '';
            
            data.users.forEach(user => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${user.name}</td>
                    <td>${user.email}</td>
                    <td><span class="status-badge status-active">${user.role}</span></td>
                    <td>${new Date(user.lastLogin).toLocaleDateString()}</td>
                    <td>
                        <select onchange="changeUserRole('${user.id}', this.value)">
                            <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
                            <option value="reseller" ${user.role === 'reseller' ? 'selected' : ''}>Reseller</option>
                            <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                        </select>
                    </td>
                `;
                tbody.appendChild(row);
            });
        }
    } catch (error) {
        console.error('Failed to load users:', error);
    }
}

async function loadSettings() {
    if (currentUser.role !== 'admin') {
        document.getElementById('settingsSection').innerHTML = '<div class="card"><div class="card-body"><p>Access denied. Admin rights required.</p></div></div>';
        return;
    }
    
    try {
        const response = await fetch('/api/settings', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('maxKeys').value = data.settings.maxKeysPerReseller;
            document.getElementById('keyDuration').value = data.settings.defaultKeyDuration / (1000 * 60 * 60 * 24);
            document.getElementById('googleAuthEnabled').value = data.settings.googleAuthEnabled.toString();
        }
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
}

// Modal functions
function showCreateAppModal() {
    // Implementation for app creation modal
    alert('App creation modal would open here');
}

function showGenerateKeyModal() {
    // Implementation for key generation modal
    alert('Key generation modal would open here');
}

// Action functions
async function toggleApp(appId, enabled) {
    try {
        const response = await fetch(`/api/apps/${appId}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ enabled })
        });
        
        const data = await response.json();
        
        if (data.success) {
            await loadApps();
            showMessage(`App ${enabled ? 'enabled' : 'disabled'} successfully`, 'success');
        } else {
            showMessage(data.message, 'error');
        }
    } catch (error) {
        showMessage('Failed to update app', 'error');
    }
}

async function banKey(keyValue) {
    if (!confirm('Are you sure you want to ban this key?')) return;
    
    try {
        const response = await fetch(`/api/keys/${keyValue}/ban`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            await loadKeys();
            showMessage('Key banned successfully', 'success');
        } else {
            showMessage(data.message, 'error');
        }
    } catch (error) {
        showMessage('Failed to ban key', 'error');
    }
}

async function changeUserRole(userId, newRole) {
    try {
        const response = await fetch('/api/users/promote', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ userId, role: newRole })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showMessage(`User role changed to ${newRole}`, 'success');
        } else {
            showMessage(data.message, 'error');
        }
    } catch (error) {
        showMessage('Failed to change user role', 'error');
    }
}

async function saveSettings() {
    const settings = {
        maxKeysPerReseller: parseInt(document.getElementById('maxKeys').value),
        defaultKeyDuration: parseInt(document.getElementById('keyDuration').value) * 24 * 60 * 60 * 1000,
        googleAuthEnabled: document.getElementById('googleAuthEnabled').value === 'true'
    };
    
    try {
        const response = await fetch('/api/settings', {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ settings })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showMessage('Settings saved successfully', 'success');
        } else {
            showMessage(data.message, 'error');
        }
    } catch (error) {
        showMessage('Failed to save settings', 'error');
    }
}

function showMessage(message, type) {
    const messageEl = document.getElementById('loginMsg');
    messageEl.textContent = message;
    messageEl.className = `login-message ${type}`;
    messageEl.style.display = 'block';
    
    setTimeout(() => {
        messageEl.style.display = 'none';
    }, 5000);
}

function logout() {
    localStorage.removeItem('eclipse_token');
    localStorage.removeItem('eclipse_user');
    authToken = null;
    currentUser = null;
    
    document.getElementById('mainPanel').classList.add('hidden');
    document.getElementById('loginScreen').classList.remove('hidden');
    
    // Reset Google Sign-In
    google.accounts.id.revoke(localStorage.getItem('email'), done => {
        console.log('Google session revoked');
    });
}
