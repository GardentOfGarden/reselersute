class EclipseAuth {
    constructor() {
        this.token = localStorage.getItem('eclipse_token');
        this.user = JSON.parse(localStorage.getItem('eclipse_user') || 'null');
        this.init();
    }

    init() {
        if (this.token && this.user) {
            this.showDashboard();
        } else {
            this.showAuth();
        }
        this.bindEvents();
    }

    bindEvents() {
        document.getElementById('loginForm').addEventListener('submit', (e) => this.login(e));
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
        document.getElementById('createAppBtn').addEventListener('click', () => this.createApp());
        
        document.querySelectorAll('.nav-item').forEach(item => {
            if (item.id !== 'logoutBtn') {
                item.addEventListener('click', (e) => this.showSection(e));
            }
        });
    }

    async login(e) {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();
            
            if (data.success) {
                this.token = data.token;
                this.user = data.user;
                
                localStorage.setItem('eclipse_token', this.token);
                localStorage.setItem('eclipse_user', JSON.stringify(this.user));
                
                this.showDashboard();
            } else {
                alert('Login failed: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            alert('Login error: ' + error.message);
        }
    }

    logout() {
        localStorage.removeItem('eclipse_token');
        localStorage.removeItem('eclipse_user');
        this.token = null;
        this.user = null;
        this.showAuth();
    }

    showAuth() {
        document.getElementById('authContainer').style.display = 'flex';
        document.getElementById('dashboard').style.display = 'none';
    }

    showDashboard() {
        document.getElementById('authContainer').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        
        document.getElementById('userName').textContent = this.user.username;
        document.getElementById('userRole').textContent = this.user.role.charAt(0).toUpperCase() + this.user.role.slice(1);
        document.getElementById('userAvatar').textContent = this.user.username.substring(0, 2).toUpperCase();
        
        this.loadStats();
    }

    async loadStats() {
        try {
            const response = await fetch('/api/admin/stats', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            
            const stats = await response.json();
            
            document.getElementById('statApps').textContent = stats.totalApps;
            document.getElementById('statKeys').textContent = stats.activeKeys;
            document.getElementById('statUsers').textContent = stats.totalUsers;
            
            const activityHTML = stats.recentActivity.map(activity => `
                <div style="padding: 0.5rem 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <strong>${activity.key}</strong> - ${activity.app} 
                    <span style="opacity: 0.7; float: right;">${new Date(activity.time).toLocaleDateString()}</span>
                </div>
            `).join('');
            
            document.getElementById('recentActivity').innerHTML = activityHTML || 'No recent activity';
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    }

    showSection(e) {
        e.preventDefault();
        const section = e.target.closest('.nav-item').dataset.section;
        
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        e.target.closest('.nav-item').classList.add('active');
        
        document.getElementById('pageTitle').textContent = 
            section.charAt(0).toUpperCase() + section.slice(1);
            
        this.loadSection(section);
    }

    async loadSection(section) {
        switch(section) {
            case 'apps':
                await this.loadApps();
                break;
            case 'keys':
                await this.loadKeys();
                break;
            case 'users':
                await this.loadUsers();
                break;
            case 'settings':
                await this.loadSettings();
                break;
        }
    }

    async createApp() {
        const name = prompt('Enter application name:');
        if (!name) return;

        try {
            const response = await fetch('/api/apps', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    name,
                    description: prompt('Enter description:') || '',
                    settings: {
                        requireHWID: confirm('Require HWID?'),
                        captureScreenshots: confirm('Capture screenshots?'),
                        maxActivations: parseInt(prompt('Max activations:') || '1'),
                        defaultExpiry: 30 * 24 * 60 * 60 * 1000 // 30 days
                    }
                })
            });

            const app = await response.json();
            alert(`Application created!\nApp ID: ${app.id}`);
            this.loadApps();
        } catch (error) {
            alert('Failed to create application: ' + error.message);
        }
    }

    async loadApps() {
        try {
            const response = await fetch('/api/apps', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            
            const apps = await response.json();
            const content = apps.map(app => `
                <div class="card">
                    <h3>${app.name}</h3>
                    <p>${app.description}</p>
                    <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                        <span>Status: ${app.settings.status}</span>
                        <span>Keys: ${app.stats.totalKeys}</span>
                        <span>Active: ${app.stats.activeKeys}</span>
                    </div>
                    <button onclick="auth.generateKey('${app.id}')" class="btn btn-primary" style="width: auto; margin-top: 1rem;">
                        Generate Key
                    </button>
                </div>
            `).join('');
            
            document.querySelector('.main-content').innerHTML = `
                <div class="header">
                    <h1>Applications</h1>
                    <button class="btn btn-primary" id="createAppBtn" style="width: auto;">
                        <i class="fas fa-plus"></i> New Application
                    </button>
                </div>
                <div>${content}</div>
            `;
        } catch (error) {
            console.error('Failed to load apps:', error);
        }
    }

    async generateKey(appId) {
        const duration = parseInt(prompt('Duration in days:') || '30');
        const maxActivations = parseInt(prompt('Max activations:') || '1');

        try {
            const response = await fetch('/api/keys/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    appId,
                    duration: duration * 24 * 60 * 60 * 1000,
                    maxActivations
                })
            });

            const key = await response.json();
            alert(`Key generated!\nKey: ${key.value}\nExpires: ${new Date(key.expiresAt).toLocaleDateString()}`);
        } catch (error) {
            alert('Failed to generate key: ' + error.message);
        }
    }
}

const auth = new EclipseAuth();
