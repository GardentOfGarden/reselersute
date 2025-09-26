class QuantumAuthPanel {
    constructor() {
        this.currentUser = null;
        this.authToken = localStorage.getItem('quantum_token');
        this.apps = [];
        this.stats = {};
        this.init();
    }

    async init() {
        this.bindEvents();
        this.hidePreloader();
        
        if (this.authToken) {
            await this.checkAuth();
        } else {
            this.showLogin();
        }
    }

    bindEvents() {
        // Login form
        document.getElementById('loginForm').addEventListener('submit', (e) => this.handleLogin(e));
        
        // Password toggle
        document.getElementById('passwordToggle').addEventListener('click', () => this.togglePassword());
        
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const section = item.dataset.section;
                this.showSection(section);
            });
        });
        
        // Logout
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
        
        // Notifications
        document.getElementById('notificationsBtn').addEventListener('click', () => this.toggleNotifications());
        document.getElementById('notificationsClose').addEventListener('click', () => this.toggleNotifications());
        
        // Sidebar toggle for mobile
        document.getElementById('sidebarToggle').addEventListener('click', () => this.toggleSidebar());
    }

    hidePreloader() {
        setTimeout(() => {
            document.getElementById('preloader').style.opacity = '0';
            setTimeout(() => {
                document.getElementById('preloader').style.display = 'none';
            }, 300);
        }, 1000);
    }

    showLogin() {
        document.getElementById('loginScreen').classList.remove('hidden');
        document.getElementById('mainPanel').classList.add('hidden');
    }

    showPanel() {
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('mainPanel').classList.remove('hidden');
        this.loadDashboard();
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const messageEl = document.getElementById('loginMessage');
        
        if (!username || !password) {
            this.showMessage('Please enter both username and password', 'error');
            return;
        }

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();
            
            if (data.success) {
                this.authToken = data.token;
                this.currentUser = data.user;
                
                localStorage.setItem('quantum_token', this.authToken);
                this.showMessage('Quantum access granted!', 'success');
                
                setTimeout(() => {
                    this.showPanel();
                }, 1000);
            } else {
                this.showMessage(data.message || 'Authentication failed', 'error');
            }
        } catch (error) {
            this.showMessage('Quantum connection failed. Check your network.', 'error');
            console.error('Login error:', error);
        }
    }

    async checkAuth() {
        try {
            const response = await fetch('/api/auth/me', {
                headers: {
                    'Authorization': this.authToken
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.currentUser = data.user;
                this.showPanel();
            } else {
                this.showLogin();
            }
        } catch (error) {
            this.showLogin();
        }
    }

    async loadDashboard() {
        try {
            // Load stats
            const statsResponse = await fetch('/api/dashboard/stats', {
                headers: { 'Authorization': this.authToken }
            });
            
            if (statsResponse.ok) {
                this.stats = await statsResponse.json();
                this.updateDashboard();
            }
            
            // Load apps
            const appsResponse = await fetch('/api/apps', {
                headers: { 'Authorization': this.authToken }
            });
            
            if (appsResponse.ok) {
                this.apps = await appsResponse.json();
                this.updateAppsCount();
            }
            
            // Update user info
            this.updateUserInfo();
            
        } catch (error) {
            console.error('Failed to load dashboard:', error);
        }
    }

    updateDashboard() {
        document.getElementById('statApps').textContent = this.stats.totalApps;
        document.getElementById('statKeys').textContent = this.stats.totalKeys;
        document.getElementById('statSessions').textContent = this.stats.activeSessions;
        document.getElementById('statRevenue').textContent = `$${this.stats.totalRevenue}`;
        
        document.getElementById('appsCount').textContent = this.stats.totalApps;
        document.getElementById('keysCount').textContent = this.stats.totalKeys;
    }

    updateAppsCount() {
        document.getElementById('appsCount').textContent = this.apps.length;
    }

    updateUserInfo() {
        if (this.currentUser) {
            document.getElementById('sidebarUsername').textContent = this.currentUser.username;
            document.getElementById('headerUsername').textContent = this.currentUser.username;
            document.getElementById('sidebarRole').textContent = this.currentUser.role === 'superadmin' ? 'Super Administrator' : 'Administrator';
        }
    }

    showSection(section) {
        // Hide all sections
        document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
        
        // Show selected section
        document.getElementById(section + 'Section').classList.remove('hidden');
        
        // Update active nav item
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        document.querySelector(`[data-section="${section}"]`).classList.add('active');
        
        // Update page title
        const titles = {
            dashboard: 'Quantum Dashboard',
            applications: 'Application Management',
            keys: 'License Keys',
            analytics: 'Quantum Analytics',
            security: 'Security Center',
            users: 'User Management',
            settings: 'Quantum Settings'
        };
        
        document.getElementById('pageTitle').textContent = titles[section] || section;
        document.getElementById('breadcrumbCurrent').textContent = titles[section] || section;
        
        // Load section-specific data
        if (section === 'applications') {
            this.loadApplications();
        } else if (section === 'keys') {
            this.loadKeys();
        }
    }

    togglePassword() {
        const passwordInput = document.getElementById('password');
        const toggleIcon = document.getElementById('passwordToggle').querySelector('i');
        
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            toggleIcon.className = 'fas fa-eye-slash';
        } else {
            passwordInput.type = 'password';
            toggleIcon.className = 'fas fa-eye';
        }
    }

    toggleNotifications() {
        const panel = document.getElementById('notificationsPanel');
        panel.classList.toggle('open');
    }

    toggleSidebar() {
        const sidebar = document.querySelector('.quantum-sidebar');
        sidebar.classList.toggle('open');
    }

    showMessage(message, type) {
        const messageEl = document.getElementById('loginMessage');
        messageEl.textContent = message;
        messageEl.className = `message-box ${type}`;
        
        setTimeout(() => {
            messageEl.textContent = '';
            messageEl.className = 'message-box';
        }, 5000);
    }

    async logout() {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: { 'Authorization': this.authToken }
            });
        } catch (error) {
            // Ignore errors during logout
        }
        
        localStorage.removeItem('quantum_token');
        this.authToken = null;
        this.currentUser = null;
        this.showLogin();
    }

    // Placeholder methods for section loading
    loadApplications() {
        // Implementation for applications section
        console.log('Loading applications...');
    }

    loadKeys() {
        // Implementation for keys section
        console.log('Loading keys...');
    }
}

// Initialize the panel when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.quantumPanel = new QuantumAuthPanel();
});

// Utility functions
function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function generateId() {
    return Math.random().toString(36).substr(2, 9);
}
