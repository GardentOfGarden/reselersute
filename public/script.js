class EclipsePanel {
    constructor() {
        this.isLoggedIn = false;
        this.keys = [];
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkAuth();
    }

    bindEvents() {
        // Login
        document.getElementById('loginBtn').addEventListener('click', () => this.login());
        document.getElementById('passwordInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.login();
        });

        // Generate Key
        document.getElementById('generateKeyBtn').addEventListener('click', () => this.generateKey());
        document.getElementById('copyKeyBtn').addEventListener('click', () => this.copyKey());

        // Search
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.filterKeys(e.target.value);
        });
    }

    async login() {
        const password = document.getElementById('passwordInput').value;
        const message = document.getElementById('loginMessage');

        if (!password) {
            message.textContent = 'Please enter password';
            return;
        }

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ password })
            });

            const data = await response.json();

            if (data.success) {
                this.isLoggedIn = true;
                localStorage.setItem('eclipse_auth', 'true');
                this.showMainPanel();
                this.loadKeys();
            } else {
                message.textContent = data.message || 'Invalid password';
            }
        } catch (error) {
            message.textContent = 'Login failed. Please try again.';
        }
    }

    checkAuth() {
        const isAuthenticated = localStorage.getItem('eclipse_auth');
        if (isAuthenticated) {
            this.isLoggedIn = true;
            this.showMainPanel();
            this.loadKeys();
        }
    }

    showMainPanel() {
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('mainPanel').classList.remove('hidden');
    }

    async loadKeys() {
        try {
            const response = await fetch('/api/keys');
            this.keys = await response.json();
            this.displayKeys();
            this.updateStats();
        } catch (error) {
            console.error('Failed to load keys:', error);
        }
    }

    displayKeys() {
        const tbody = document.querySelector('#keysTable tbody');
        tbody.innerHTML = '';

        this.keys.forEach(key => {
            const row = document.createElement('tr');
            
            const statusClass = key.banned ? 'status-banned' : 
                              new Date(key.expiresAt) < new Date() ? 'status-expired' : 'status-active';
            const statusText = key.banned ? 'Banned' : 
                             new Date(key.expiresAt) < new Date() ? 'Expired' : 'Active';

            row.innerHTML = `
                <td><code>${key.key}</code></td>
                <td>${new Date(key.createdAt).toLocaleDateString()}</td>
                <td>${new Date(key.expiresAt).toLocaleDateString()}</td>
                <td>${key.duration}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>
                    ${!key.banned ? `
                    <button class="btn-secondary" onclick="eclipsePanel.banKey(${key.id})">
                        <i class="fas fa-ban"></i>
                        Ban
                    </button>
                    ` : ''}
                </td>
            `;
            
            tbody.appendChild(row);
        });
    }

    updateStats() {
        const totalKeys = this.keys.length;
        const activeKeys = this.keys.filter(k => !k.banned && new Date(k.expiresAt) > new Date()).length;
        const bannedKeys = this.keys.filter(k => k.banned).length;
        const expiredKeys = this.keys.filter(k => !k.banned && new Date(k.expiresAt) < new Date()).length;

        document.getElementById('totalKeys').textContent = totalKeys;
        document.getElementById('activeKeys').textContent = activeKeys;
        document.getElementById('bannedKeys').textContent = bannedKeys;
        document.getElementById('expiredKeys').textContent = expiredKeys;
    }

    async generateKey() {
        const duration = document.getElementById('durationValue').value;
        const unit = document.getElementById('durationUnit').value;

        if (!duration || duration < 1) {
            alert('Please enter a valid duration');
            return;
        }

        try {
            const response = await fetch('/api/keys', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ duration: parseInt(duration), unit })
            });

            const data = await response.json();

            if (data.success) {
                this.showGeneratedKey(data.key.key);
                this.loadKeys();
            } else {
                alert('Failed to generate key: ' + data.message);
            }
        } catch (error) {
            alert('Failed to generate key. Please try again.');
        }
    }

    showGeneratedKey(key) {
        const container = document.getElementById('generatedKeyContainer');
        const keyElement = document.getElementById('generatedKey');
        
        keyElement.textContent = key;
        container.classList.remove('hidden');
    }

    copyKey() {
        const key = document.getElementById('generatedKey').textContent;
        navigator.clipboard.writeText(key).then(() => {
            alert('Key copied to clipboard!');
        });
    }

    async banKey(keyId) {
        if (!confirm('Are you sure you want to ban this key?')) return;

        try {
            const response = await fetch(`/api/keys/${keyId}/ban`, {
                method: 'POST'
            });

            const data = await response.json();

            if (data.success) {
                this.loadKeys();
            } else {
                alert('Failed to ban key');
            }
        } catch (error) {
            alert('Failed to ban key. Please try again.');
        }
    }

    filterKeys(searchTerm) {
        const filteredKeys = this.keys.filter(key => 
            key.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
            key.duration.toLowerCase().includes(searchTerm.toLowerCase()) ||
            key.status.toLowerCase().includes(searchTerm.toLowerCase())
        );

        this.displayFilteredKeys(filteredKeys);
    }

    displayFilteredKeys(keys) {
        const tbody = document.querySelector('#keysTable tbody');
        tbody.innerHTML = '';

        keys.forEach(key => {
            const row = document.createElement('tr');
            
            const statusClass = key.banned ? 'status-banned' : 
                              new Date(key.expiresAt) < new Date() ? 'status-expired' : 'status-active';
            const statusText = key.banned ? 'Banned' : 
                             new Date(key.expiresAt) < new Date() ? 'Expired' : 'Active';

            row.innerHTML = `
                <td><code>${key.key}</code></td>
                <td>${new Date(key.createdAt).toLocaleDateString()}</td>
                <td>${new Date(key.expiresAt).toLocaleDateString()}</td>
                <td>${key.duration}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>
                    ${!key.banned ? `
                    <button class="btn-secondary" onclick="eclipsePanel.banKey(${key.id})">
                        <i class="fas fa-ban"></i>
                        Ban
                    </button>
                    ` : ''}
                </td>
            `;
            
            tbody.appendChild(row);
        });
    }
}

function logout() {
    localStorage.removeItem('eclipse_auth');
    window.location.reload();
}

// Initialize the panel
const eclipsePanel = new EclipsePanel();
