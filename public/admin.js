class AuthPanel {
    constructor() {
        this.apps = [];
        this.currentApp = null;
        this.isAuthenticated = false;
        this.init();
    }

    async init() {
        this.bindEvents();
        await this.checkAuth();
    }

    bindEvents() {
        document.getElementById('loginBtn').addEventListener('click', () => this.login());
        document.getElementById('passwordInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.login();
        });

        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                this.showSection(item.dataset.section);
            });
        });

        document.getElementById('createAppForm').addEventListener('submit', (e) => this.createApp(e));
        document.getElementById('generateKeyBtn').addEventListener('click', () => this.generateKey());
        document.getElementById('keySearch').addEventListener('input', (e) => this.searchKeys(e.target.value));
        document.getElementById('appSelector').addEventListener('change', (e) => this.loadAppKeys(e.target.value));
    }

    async checkAuth() {
        const token = localStorage.getItem('auth_token');
        if (token) {
            this.isAuthenticated = true;
            this.showPanel();
            await this.loadApps();
        }
    }

    async login() {
        const password = document.getElementById('passwordInput').value;
        if (!password) {
            this.showMessage('Please enter password', 'error');
            return;
        }

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });

            const data = await response.json();
            if (data.success) {
                localStorage.setItem('auth_token', 'authenticated');
                this.isAuthenticated = true;
                this.showPanel();
                await this.loadApps();
            } else {
                this.showMessage(data.message || 'Login failed', 'error');
            }
        } catch (error) {
            this.showMessage('Network error', 'error');
        }
    }

    showPanel() {
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('mainPanel').classList.remove('hidden');
    }

    async loadApps() {
        try {
            const response = await fetch('/api/apps');
            this.apps = await response.json();
            this.renderApps();
            this.updateStats();
        } catch (error) {
            console.error('Failed to load apps:', error);
        }
    }

    renderApps() {
        const grid = document.getElementById('appsGrid');
        grid.innerHTML = this.apps.map(app => `
            <div class="app-card" data-app-id="${app.id}">
                <div class="app-icon"><i class="fas fa-cube"></i></div>
                <div class="app-info">
                    <h3>${app.name}</h3>
                    <p>ID: ${app.id}</p>
                    <p>Keys: ${app.stats.totalKeys}</p>
                    <p>Active: ${app.stats.activeSessions}</p>
                </div>
                <div class="app-actions">
                    <button class="btn-small" onclick="authPanel.viewApp('${app.id}')">Manage</button>
                    <button class="btn-small btn-danger" onclick="authPanel.deleteApp('${app.id}')">Delete</button>
                </div>
            </div>
        `).join('');
    }

    async createApp(e) {
        e.preventDefault();
        
        const appData = {
            name: document.getElementById('appName').value,
            ownerId: document.getElementById('ownerId').value,
            settings: {
                hwidLock: document.getElementById('hwidLock').checked,
                screenshotRequired: document.getElementById('screenshotRequired').checked
            }
        };

        try {
            const response = await fetch('/api/apps/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(appData)
            });

            if (response.ok) {
                this.showMessage('Application created successfully', 'success');
                document.getElementById('createAppForm').reset();
                await this.loadApps();
                this.showSection('apps');
            } else {
                this.showMessage('Failed to create application', 'error');
            }
        } catch (error) {
            this.showMessage('Network error', 'error');
        }
    }

    async generateKey() {
        if (!this.currentApp) {
            this.showMessage('Please select an application', 'error');
            return;
        }

        const duration = prompt('Enter duration in days:');
        if (!duration) return;

        try {
            const response = await fetch(`/api/apps/${this.currentApp}/keys`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ durationMs: parseInt(duration) * 24 * 60 * 60 * 1000 })
            });

            if (response.ok) {
                this.showMessage('Key generated successfully', 'success');
                await this.loadAppKeys(this.currentApp);
            }
        } catch (error) {
            this.showMessage('Failed to generate key', 'error');
        }
    }

    async loadAppKeys(appId) {
        this.currentApp = appId;
        try {
            const response = await fetch(`/api/apps/${appId}/keys`);
            const keys = await response.json();
            this.renderKeys(keys);
        } catch (error) {
            console.error('Failed to load keys:', error);
        }
    }

    renderKeys(keys) {
        const tbody = document.querySelector('#keysTable tbody');
        tbody.innerHTML = keys.map(key => `
            <tr>
                <td><code>${key.value}</code></td>
                <td>${key.appId}</td>
                <td>${new Date(key.createdAt).toLocaleDateString()}</td>
                <td>${key.expiresAt ? new Date(key.expiresAt).toLocaleDateString() : 'Never'}</td>
                <td><span class="status-badge ${key.banned ? 'status-banned' : 'status-active'}">${key.banned ? 'Banned' : 'Active'}</span></td>
                <td>
                    <button class="btn-small ${key.banned ? 'btn-success' : 'btn-warning'}" 
                            onclick="authPanel.toggleBan('${key.id}', ${!key.banned})">
                        ${key.banned ? 'Unban' : 'Ban'}
                    </button>
                    <button class="btn-small btn-danger" onclick="authPanel.deleteKey('${key.id}')">Delete</button>
                </td>
            </tr>
        `).join('');
    }

    async toggleBan(keyId, ban) {
        try {
            const response = await fetch(`/api/apps/${this.currentApp}/keys/${keyId}/ban`, {
                method: 'POST'
            });

            if (response.ok) {
                this.showMessage(`Key ${ban ? 'banned' : 'unbanned'} successfully`, 'success');
                await this.loadAppKeys(this.currentApp);
            }
        } catch (error) {
            this.showMessage('Operation failed', 'error');
        }
    }

    showSection(section) {
        document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        
        document.getElementById(section + 'Section').classList.remove('hidden');
        document.querySelector(`[data-section="${section}"]`).classList.add('active');
        document.getElementById('pageTitle').textContent = section.charAt(0).toUpperCase() + section.slice(1);
    }

    showMessage(message, type) {
        const messageEl = document.getElementById('loginMessage');
        messageEl.textContent = message;
        messageEl.className = type;
        setTimeout(() => messageEl.textContent = '', 3000);
    }

    updateStats() {
        document.getElementById('totalApps').textContent = this.apps.length;
        document.getElementById('totalKeys').textContent = this.apps.reduce((sum, app) => sum + app.stats.totalKeys, 0);
        document.getElementById('activeSessions').textContent = this.apps.reduce((sum, app) => sum + app.stats.activeSessions, 0);
        document.getElementById('totalScreenshots').textContent = this.apps.reduce((sum, app) => sum + app.stats.totalScreenshots, 0);
    }
}

const authPanel = new AuthPanel();
