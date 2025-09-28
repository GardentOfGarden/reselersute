let authToken = null;
let currentUser = null;

document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    initializeEventListeners();
});

function checkAuth() {
    const token = localStorage.getItem('eclipse_token');
    const user = localStorage.getItem('eclipse_user');
    
    if (token && user) {
        authToken = token;
        currentUser = JSON.parse(user);
        showMainPanel();
        loadDashboard();
    }
}

function initializeEventListeners() {
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('createAppBtn').addEventListener('click', showCreateAppModal);
    document.getElementById('createUserBtn').addEventListener('click', showCreateUserModal);
    document.getElementById('generateKeyBtn').addEventListener('click', showGenerateKeyModal);
    document.getElementById('logoutBtn').addEventListener('click', logout);
    
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function() {
            const section = this.getAttribute('data-section');
            showSection(section);
        });
    });

    // Добавляем обработчики для модальных окон
    document.getElementById('createAppForm').addEventListener('submit', function(e) {
        e.preventDefault();
        createApp();
    });

    document.getElementById('createUserForm').addEventListener('submit', function(e) {
        e.preventDefault();
        createUser();
    });

    document.getElementById('generateKeyForm').addEventListener('submit', function(e) {
        e.preventDefault();
        generateKey();
    });
}

async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    if (!username || !password) {
        showNotification('Please enter both username and password', 'error');
        return;
    }

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            authToken = data.token;
            currentUser = data.user;
            
            localStorage.setItem('eclipse_token', authToken);
            localStorage.setItem('eclipse_user', JSON.stringify(currentUser));
            
            showMainPanel();
            loadDashboard();
            showNotification('Login successful!', 'success');
        } else {
            showNotification(data.message || 'Login failed', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showNotification('Login failed. Please try again.', 'error');
    }
}

function showMainPanel() {
    document.getElementById('authContainer').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    
    document.getElementById('userName').textContent = currentUser.username;
    document.getElementById('userRole').textContent = currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1);
    document.getElementById('userAvatar').textContent = currentUser.username.charAt(0).toUpperCase();
    
    if (currentUser.role !== 'admin') {
        document.getElementById('usersTab').style.display = 'none';
        document.getElementById('settingsTab').style.display = 'none';
        document.getElementById('createUserBtn').style.display = 'none';
        document.getElementById('quickUserBtn').style.display = 'none';
    } else {
        document.getElementById('createUserBtn').style.display = 'inline-flex';
        document.getElementById('quickUserBtn').style.display = 'inline-flex';
    }
}

function showSection(section) {
    document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    document.getElementById(section + 'Section').classList.remove('hidden');
    document.querySelector(`[data-section="${section}"]`).classList.add('active');
    
    document.getElementById('pageTitle').textContent = 
        section.charAt(0).toUpperCase() + section.slice(1);
    
    switch(section) {
        case 'dashboard': loadDashboard(); break;
        case 'apps': loadApps(); break;
        case 'keys': loadKeys(); break;
        case 'users': loadUsers(); break;
        case 'settings': loadSettings(); break;
    }
}

async function loadDashboard() {
    try {
        const response = await fetch('/api/stats', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('statApps').textContent = data.stats.totalApps;
            document.getElementById('statKeys').textContent = data.stats.totalKeys;
            document.getElementById('statActiveKeys').textContent = data.stats.activeKeys;
            document.getElementById('statBannedKeys').textContent = data.stats.bannedKeys;
        }
    } catch (error) {
        showNotification('Failed to load dashboard data', 'error');
    }
}

async function loadApps() {
    try {
        const response = await fetch('/api/apps', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const data = await response.json();
        const tbody = document.querySelector('#appsTable tbody');
        tbody.innerHTML = '';
        
        if (data.success) {
            data.apps.forEach(app => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>
                        <div class="app-name">${app.name}</div>
                        <div class="app-desc">${app.description || 'No description'}</div>
                    </td>
                    <td><code>${app.id}</code></td>
                    <td>${app.ownerName}</td>
                    <td><span class="status-badge status-${app.status}">${app.status}</span></td>
                    <td>${app.totalKeys || 0}</td>
                    <td>${app.activeKeys || 0}</td>
                    <td>${new Date(app.createdAt).toLocaleDateString()}</td>
                    <td>
                        <button class="btn-secondary btn-small" onclick="toggleAppStatus('${app.id}')">
                            ${app.status === 'active' ? 'Disable' : 'Enable'}
                        </button>
                        <button class="btn-danger btn-small" onclick="deleteApp('${app.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        }
    } catch (error) {
        showNotification('Failed to load applications', 'error');
    }
}

async function loadKeys() {
    try {
        const response = await fetch('/api/keys', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const data = await response.json();
        const tbody = document.querySelector('#keysTable tbody');
        tbody.innerHTML = '';
        
        if (data.success) {
            data.keys.forEach(key => {
                const isExpired = new Date(key.expiresAt) < new Date();
                const status = key.status === 'banned' ? 'banned' : isExpired ? 'expired' : 'active';
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><code>${key.key}</code></td>
                    <td>${key.appName}</td>
                    <td>${key.ownerName}</td>
                    <td>${key.duration} days</td>
                    <td>${new Date(key.expiresAt).toLocaleDateString()}</td>
                    <td>${key.activations}/${key.maxActivations}</td>
                    <td><span class="status-badge status-${status}">${status}</span></td>
                    <td>
                        ${key.status === 'active' ? `
                        <button class="btn-danger btn-small" onclick="banKey(${key.id})">
                            <i class="fas fa-ban"></i>
                        </button>
                        ` : ''}
                    </td>
                `;
                tbody.appendChild(row);
            });
        }
    } catch (error) {
        showNotification('Failed to load keys', 'error');
    }
}

async function loadUsers() {
    if (currentUser.role !== 'admin') return;
    
    try {
        const response = await fetch('/api/users', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const data = await response.json();
        const tbody = document.querySelector('#usersTable tbody');
        tbody.innerHTML = '';
        
        if (data.success) {
            data.users.forEach(user => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${user.username}</td>
                    <td>${user.email || 'N/A'}</td>
                    <td><span class="status-badge status-${user.role}">${user.role}</span></td>
                    <td>${new Date(user.createdAt).toLocaleDateString()}</td>
                    <td>
                        <select onchange="updateUserRole(${user.id}, this.value)" ${user.id === currentUser.id ? 'disabled' : ''}>
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
        showNotification('Failed to load users', 'error');
    }
}

async function loadSettings() {
    if (currentUser.role !== 'admin') return;
    
    try {
        const response = await fetch('/api/settings', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('maxResellerKeys').value = data.settings.maxResellerKeys;
            document.getElementById('defaultKeyDuration').value = data.settings.defaultKeyDuration;
            document.getElementById('screenshotEnabled').checked = data.settings.screenshotEnabled;
        }
    } catch (error) {
        showNotification('Failed to load settings', 'error');
    }
}

function showCreateAppModal() {
    const modal = document.getElementById('createAppModal');
    modal.classList.remove('hidden');
}

function hideCreateAppModal() {
    document.getElementById('createAppModal').classList.add('hidden');
    document.getElementById('createAppForm').reset();
}

async function createApp() {
    const formData = new FormData(document.getElementById('createAppForm'));
    const appData = {
        name: formData.get('name'),
        description: formData.get('description'),
        dllUrl: formData.get('dllUrl'),
        status: formData.get('status')
    };
    
    try {
        const response = await fetch('/api/apps', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(appData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            hideCreateAppModal();
            loadApps();
            showNotification('Application created successfully!', 'success');
        } else {
            showNotification(data.message, 'error');
        }
    } catch (error) {
        showNotification('Failed to create application', 'error');
    }
}

function showCreateUserModal() {
    document.getElementById('createUserModal').classList.remove('hidden');
}

function hideCreateUserModal() {
    document.getElementById('createUserModal').classList.add('hidden');
    document.getElementById('createUserForm').reset();
}

async function createUser() {
    const formData = new FormData(document.getElementById('createUserForm'));
    const userData = {
        username: formData.get('username'),
        password: formData.get('password'),
        role: formData.get('role'),
        email: formData.get('email')
    };
    
    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(userData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            hideCreateUserModal();
            loadUsers();
            showNotification('User created successfully!', 'success');
        } else {
            showNotification(data.message, 'error');
        }
    } catch (error) {
        showNotification('Failed to create user', 'error');
    }
}

function showGenerateKeyModal() {
    loadAppsForSelect();
    document.getElementById('generateKeyModal').classList.remove('hidden');
}

function hideGenerateKeyModal() {
    document.getElementById('generateKeyModal').classList.add('hidden');
    document.getElementById('generateKeyForm').reset();
    document.getElementById('keyResult').classList.add('hidden');
}

async function loadAppsForSelect() {
    try {
        const response = await fetch('/api/apps', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const data = await response.json();
        const select = document.getElementById('keyAppId');
        select.innerHTML = '<option value="">Select Application</option>';
        
        if (data.success) {
            data.apps.forEach(app => {
                if (app.status === 'active') {
                    const option = document.createElement('option');
                    option.value = app.id;
                    option.textContent = app.name;
                    select.appendChild(option);
                }
            });
        }
    } catch (error) {
        showNotification('Failed to load applications', 'error');
    }
}

async function generateKey() {
    const formData = new FormData(document.getElementById('generateKeyForm'));
    const keyData = {
        appId: formData.get('appId'),
        duration: formData.get('duration'),
        maxActivations: formData.get('maxActivations'),
        note: formData.get('note')
    };
    
    try {
        const response = await fetch('/api/keys/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(keyData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('generatedKey').textContent = data.key.key;
            document.getElementById('keyResult').classList.remove('hidden');
            loadKeys();
            showNotification('Key generated successfully!', 'success');
        } else {
            showNotification(data.message, 'error');
        }
    } catch (error) {
        showNotification('Failed to generate key', 'error');
    }
}

function copyGeneratedKey() {
    const key = document.getElementById('generatedKey').textContent;
    navigator.clipboard.writeText(key).then(() => {
        showNotification('Key copied to clipboard!', 'success');
    });
}

async function toggleAppStatus(appId) {
    try {
        const appsResponse = await fetch('/api/apps', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const appsData = await appsResponse.json();
        const app = appsData.apps.find(a => a.id === appId);
        
        if (!app) {
            showNotification('App not found', 'error');
            return;
        }

        const newStatus = app.status === 'active' ? 'disabled' : 'active';
        
        const response = await fetch(`/api/apps/${appId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ status: newStatus })
        });
        
        const data = await response.json();
        
        if (data.success) {
            loadApps();
            showNotification(`App ${newStatus === 'active' ? 'enabled' : 'disabled'} successfully`, 'success');
        } else {
            showNotification(data.message, 'error');
        }
    } catch (error) {
        showNotification('Failed to update app status', 'error');
    }
}

async function deleteApp(appId) {
    if (!confirm('Are you sure you want to delete this application? This action cannot be undone.')) {
        return;
    }

    showNotification('App deletion not implemented in this version', 'error');
}

async function banKey(keyId) {
    if (!confirm('Are you sure you want to ban this key?')) return;
    
    try {
        const response = await fetch(`/api/keys/${keyId}/ban`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            loadKeys();
            showNotification('Key banned successfully', 'success');
        } else {
            showNotification(data.message, 'error');
        }
    } catch (error) {
        showNotification('Failed to ban key', 'error');
    }
}

async function updateUserRole(userId, newRole) {
    try {
        showNotification('User role update not fully implemented in this version', 'warning');
    } catch (error) {
        showNotification('Failed to update user role', 'error');
    }
}

async function saveSettings() {
    const settings = {
        maxResellerKeys: parseInt(document.getElementById('maxResellerKeys').value),
        defaultKeyDuration: parseInt(document.getElementById('defaultKeyDuration').value),
        screenshotEnabled: document.getElementById('screenshotEnabled').checked
    };
    
    try {
        const response = await fetch('/api/settings', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(settings)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Settings saved successfully', 'success');
        } else {
            showNotification(data.message, 'error');
        }
    } catch (error) {
        showNotification('Failed to save settings', 'error');
    }
}

function showNotification(message, type) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification notification-${type} show`;
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 5000);
}

function logout() {
    localStorage.removeItem('eclipse_token');
    localStorage.removeItem('eclipse_user');
    authToken = null;
    currentUser = null;
    
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('authContainer').classList.remove('hidden');
    
    showNotification('Logged out successfully', 'success');
}
