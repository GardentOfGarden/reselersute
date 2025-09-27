<!DOCTYPE html>
<html lang="en" data-theme="dark-red">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Eclipse | Admin Panel v2.0</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #ff2a2a;
            --primary-dark: #cc0000;
            --primary-light: #ff5c5c;
            --secondary: #6c757d;
            --success: #00e676;
            --danger: #ff3d00;
            --warning: #ffc400;
            --info: #00b0ff;
            --dark: #0a0a0a;
            --light: #f8f9fa;
            --background: #0f0f0f;
            --card-bg: rgba(30, 30, 30, 0.95);
            --text: #ffffff;
            --text-muted: #a0a0a0;
            --border: rgba(255, 255, 255, 0.1);
            --sidebar-width: 280px;
            --header-height: 70px;
        }

        [data-theme="dark-blue"] {
            --primary: #2962ff;
            --primary-dark: #0039cb;
            --primary-light: #768fff;
        }

        [data-theme="dark-green"] {
            --primary: #00c853;
            --primary-dark: #009624;
            --primary-light: #5efc82;
        }

        [data-theme="dark-purple"] {
            --primary: #aa00ff;
            --primary-dark: #7200ca;
            --primary-light: #e254ff;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Inter', sans-serif;
            background: var(--background);
            color: var(--text);
            line-height: 1.6;
            overflow-x: hidden;
        }

        .login-container {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%);
            position: relative;
            overflow: hidden;
        }

        .login-container::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, var(--primary) 0%, transparent 70%);
            opacity: 0.05;
            animation: rotate 30s linear infinite;
        }

        @keyframes rotate {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .login-box {
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 20px;
            padding: 40px;
            width: 100%;
            max-width: 440px;
            backdrop-filter: blur(10px);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
            position: relative;
            z-index: 1;
        }

        .logo {
            text-align: center;
            margin-bottom: 30px;
        }

        .logo i {
            font-size: 3.5rem;
            color: var(--primary);
            margin-bottom: 15px;
            text-shadow: 0 0 20px var(--primary-light);
        }

        .logo h1 {
            font-size: 2.5rem;
            font-weight: 700;
            background: linear-gradient(45deg, var(--primary), var(--primary-light));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 5px;
        }

        .logo .version {
            color: var(--text-muted);
            font-size: 0.9rem;
        }

        .auth-tabs {
            display: flex;
            margin-bottom: 25px;
            border-bottom: 1px solid var(--border);
        }

        .auth-tab {
            flex: 1;
            padding: 12px;
            text-align: center;
            cursor: pointer;
            border-bottom: 2px solid transparent;
            transition: all 0.3s ease;
        }

        .auth-tab.active {
            border-bottom-color: var(--primary);
            color: var(--primary);
        }

        .input-group {
            margin-bottom: 20px;
        }

        .input-group label {
            display: block;
            margin-bottom: 8px;
            color: var(--text-muted);
            font-weight: 500;
        }

        .input-group input, .input-group select {
            width: 100%;
            padding: 14px 16px;
            border: 1px solid var(--border);
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.05);
            color: var(--text);
            font-size: 15px;
            transition: all 0.3s ease;
        }

        .input-group input:focus, .input-group select:focus {
            outline: none;
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(255, 42, 42, 0.1);
        }

        .btn {
            padding: 14px 20px;
            border: none;
            border-radius: 10px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            width: 100%;
        }

        .btn-primary {
            background: var(--primary);
            color: white;
        }

        .btn-primary:hover {
            background: var(--primary-dark);
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(255, 42, 42, 0.3);
        }

        .btn-google {
            background: #4285f4;
            color: white;
        }

        .btn-google:hover {
            background: #3367d6;
        }

        .main-panel {
            display: flex;
            min-height: 100vh;
        }

        .sidebar {
            width: var(--sidebar-width);
            background: var(--card-bg);
            border-right: 1px solid var(--border);
            position: fixed;
            height: 100vh;
            overflow-y: auto;
            z-index: 100;
        }

        .sidebar-header {
            padding: 25px;
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .sidebar-header i {
            font-size: 1.8rem;
            color: var(--primary);
        }

        .sidebar-header h2 {
            font-size: 1.4rem;
            font-weight: 700;
            background: linear-gradient(45deg, var(--primary), var(--primary-light));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .nav-section {
            padding: 20px 0;
        }

        .nav-section h3 {
            padding: 0 25px 15px;
            color: var(--text-muted);
            font-size: 0.8rem;
            text-transform: uppercase;
            letter-spacing: 1px;
            font-weight: 600;
        }

        .nav-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 25px;
            color: var(--text-muted);
            text-decoration: none;
            transition: all 0.3s ease;
            border-left: 3px solid transparent;
        }

        .nav-item:hover, .nav-item.active {
            background: rgba(255, 255, 255, 0.03);
            color: var(--text);
            border-left-color: var(--primary);
        }

        .nav-item i {
            width: 20px;
            text-align: center;
        }

        .main-content {
            flex: 1;
            margin-left: var(--sidebar-width);
            background: var(--background);
        }

        .content-header {
            height: var(--header-height);
            background: var(--card-bg);
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 30px;
            position: sticky;
            top: 0;
            z-index: 90;
        }

        .content-header h1 {
            font-size: 1.6rem;
            font-weight: 600;
        }

        .user-info {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .user-avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: var(--primary);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 600;
        }

        .content-body {
            padding: 30px;
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }

        .stat-card {
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 15px;
            padding: 25px;
            display: flex;
            align-items: center;
            gap: 20px;
            transition: all 0.3s ease;
        }

        .stat-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 15px 30px rgba(0, 0, 0, 0.2);
        }

        .stat-icon {
            width: 60px;
            height: 60px;
            border-radius: 15px;
            background: rgba(255, 42, 42, 0.1);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.8rem;
            color: var(--primary);
        }

        .stat-info h3 {
            font-size: 0.9rem;
            color: var(--text-muted);
            margin-bottom: 5px;
        }

        .stat-info span {
            font-size: 2rem;
            font-weight: 700;
        }

        .card {
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 15px;
            margin-bottom: 25px;
            overflow: hidden;
        }

        .card-header {
            padding: 20px 25px;
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .card-header h2 {
            font-size: 1.3rem;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .card-header h2 i {
            color: var(--primary);
        }

        .card-body {
            padding: 25px;
        }

        .form-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
        }

        .table-container {
            overflow-x: auto;
            border-radius: 10px;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            background: var(--card-bg);
        }

        th, td {
            padding: 15px;
            text-align: left;
            border-bottom: 1px solid var(--border);
        }

        th {
            background: rgba(0, 0, 0, 0.3);
            font-weight: 600;
            color: var(--text);
        }

        .status-badge {
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: 600;
        }

        .status-active { background: rgba(0, 230, 118, 0.1); color: #00e676; }
        .status-banned { background: rgba(255, 61, 0, 0.1); color: #ff3d00; }
        .status-expired { background: rgba(255, 196, 0, 0.1); color: #ffc400; }

        .action-buttons {
            display: flex;
            gap: 8px;
        }

        .btn-small {
            padding: 6px 12px;
            font-size: 0.8rem;
            border-radius: 6px;
        }

        .modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            backdrop-filter: blur(5px);
        }

        .modal-content {
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 15px;
            width: 90%;
            max-width: 500px;
            max-height: 90vh;
            overflow: hidden;
        }

        .modal-header {
            padding: 20px 25px;
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .modal-body {
            padding: 25px;
            max-height: calc(90vh - 100px);
            overflow-y: auto;
        }

        .hidden {
            display: none !important;
        }

        @media (max-width: 1024px) {
            .sidebar {
                transform: translateX(-100%);
                transition: transform 0.3s ease;
            }
            .sidebar.open {
                transform: translateX(0);
            }
            .main-content {
                margin-left: 0;
            }
        }

        @media (max-width: 768px) {
            .stats-grid {
                grid-template-columns: 1fr;
            }
            .form-grid {
                grid-template-columns: 1fr;
            }
            .content-body {
                padding: 20px;
            }
        }
    </style>
</head>
<body>
    <!-- Login Screen -->
    <div id="loginScreen" class="login-container">
        <div class="login-box">
            <div class="logo">
                <i class="fas fa-fire"></i>
                <h1>ECLIPSE</h1>
                <div class="version">Admin Panel v2.0</div>
            </div>
            
            <div class="auth-tabs">
                <div class="auth-tab active" onclick="showAuthTab('password')">
                    <i class="fas fa-key"></i> Password
                </div>
                <div class="auth-tab" onclick="showAuthTab('google')">
                    <i class="fab fa-google"></i> Google
                </div>
            </div>

            <div id="passwordAuth">
                <div class="input-group">
                    <label for="email">Email</label>
                    <input type="email" id="email" placeholder="admin@example.com">
                </div>
                <div class="input-group">
                    <label for="password">Password</label>
                    <input type="password" id="password" placeholder="Enter your password">
                </div>
                <button class="btn btn-primary" onclick="login()">
                    <i class="fas fa-sign-in-alt"></i> Login
                </button>
            </div>

            <div id="googleAuth" class="hidden">
                <button class="btn btn-google" onclick="googleLogin()">
                    <i class="fab fa-google"></i> Sign in with Google
                </button>
            </div>

            <div id="loginMessage" style="margin-top: 15px; text-align: center; color: var(--danger);"></div>
        </div>
    </div>

    <!-- Main Panel -->
    <div id="mainPanel" class="main-panel hidden">
        <!-- Sidebar -->
        <div class="sidebar">
            <div class="sidebar-header">
                <i class="fas fa-fire"></i>
                <h2>ECLIPSE</h2>
            </div>

            <nav class="sidebar-nav">
                <div class="nav-section">
                    <h3>Dashboard</h3>
                    <a href="#" class="nav-item active" onclick="showSection('dashboard')">
                        <i class="fas fa-chart-bar"></i> Overview
                    </a>
                    <a href="#" class="nav-item" onclick="showSection('apps')">
                        <i class="fas fa-cube"></i> Applications
                    </a>
                </div>

                <div class="nav-section">
                    <h3>Management</h3>
                    <a href="#" class="nav-item" onclick="showSection('keys')">
                        <i class="fas fa-key"></i> License Keys
                    </a>
                    <a href="#" class="nav-item" onclick="showSection('users')">
                        <i class="fas fa-users"></i> Users
                    </a>
                </div>

                <div class="nav-section">
                    <h3>Settings</h3>
                    <a href="#" class="nav-item" onclick="showSection('settings')">
                        <i class="fas fa-cog"></i> System Settings
                    </a>
                    <a href="#" class="nav-item" onclick="logout()">
                        <i class="fas fa-sign-out-alt"></i> Logout
                    </a>
                </div>
            </nav>
        </div>

        <!-- Main Content -->
        <div class="main-content">
            <header class="content-header">
                <h1 id="pageTitle">Dashboard Overview</h1>
                <div class="user-info">
                    <div class="user-avatar" id="userAvatar">A</div>
                    <div>
                        <div id="userName">Admin User</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted);" id="userRole">Administrator</div>
                    </div>
                </div>
            </header>

            <div class="content-body">
                <!-- Dashboard Section -->
                <div id="dashboardSection" class="section">
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-icon">
                                <i class="fas fa-cube"></i>
                            </div>
                            <div class="stat-info">
                                <h3>Applications</h3>
                                <span id="statApps">0</span>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">
                                <i class="fas fa-key"></i>
                            </div>
                            <div class="stat-info">
                                <h3>Total Keys</h3>
                                <span id="statKeys">0</span>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">
                                <i class="fas fa-user"></i>
                            </div>
                            <div class="stat-info">
                                <h3>Users</h3>
                                <span id="statUsers">0</span>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">
                                <i class="fas fa-chart-line"></i>
                            </div>
                            <div class="stat-info">
                                <h3>Active Today</h3>
                                <span id="statActive">0</span>
                            </div>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <h2><i class="fas fa-rocket"></i> Quick Actions</h2>
                        </div>
                        <div class="card-body">
                            <div class="form-grid">
                                <button class="btn btn-primary" onclick="showSection('apps')">
                                    <i class="fas fa-plus"></i> Create App
                                </button>
                                <button class="btn btn-primary" onclick="showSection('keys')">
                                    <i class="fas fa-key"></i> Generate Key
                                </button>
                                <button class="btn btn-primary" onclick="showSection('users')">
                                    <i class="fas fa-user-plus"></i> Add User
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Applications Section -->
                <div id="appsSection" class="section hidden">
                    <div class="card">
                        <div class="card-header">
                            <h2><i class="fas fa-cube"></i> Applications</h2>
                            <button class="btn btn-primary" onclick="showCreateAppModal()">
                                <i class="fas fa-plus"></i> New Application
                            </button>
                        </div>
                        <div class="card-body">
                            <div class="table-container">
                                <table id="appsTable">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>App ID</th>
                                            <th>Owner</th>
                                            <th>Version</th>
                                            <th>Status</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody></tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Keys Section -->
                <div id="keysSection" class="section hidden">
                    <div class="card">
                        <div class="card-header">
                            <h2><i class="fas fa-key"></i> License Keys</h2>
                            <button class="btn btn-primary" onclick="showGenerateKeyModal()">
                                <i class="fas fa-plus"></i> Generate Key
                            </button>
                        </div>
                        <div class="card-body">
                            <div class="table-container">
                                <table id="keysTable">
                                    <thead>
                                        <tr>
                                            <th>Key</th>
                                            <th>Application</th>
                                            <th>Created</th>
                                            <th>Expires</th>
                                            <th>Status</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody></tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Users Section -->
                <div id="usersSection" class="section hidden">
                    <div class="card">
                        <div class="card-header">
                            <h2><i class="fas fa-users"></i> Users Management</h2>
                        </div>
                        <div class="card-body">
                            <div class="table-container">
                                <table id="usersTable">
                                    <thead>
                                        <tr>
                                            <th>User</th>
                                            <th>Email</th>
                                            <th>Role</th>
                                            <th>Last Login</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody></tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Settings Section -->
                <div id="settingsSection" class="section hidden">
                    <div class="card">
                        <div class="card-header">
                            <h2><i class="fas fa-cog"></i> System Settings</h2>
                        </div>
                        <div class="card-body">
                            <div class="form-grid">
                                <div class="input-group">
                                    <label>Max Keys per Reseller</label>
                                    <input type="number" id="maxKeys" value="100">
                                </div>
                                <div class="input-group">
                                    <label>Default Key Duration (days)</label>
                                    <input type="number" id="keyDuration" value="30">
                                </div>
                            </div>
                            <button class="btn btn-primary" onclick="saveSettings()">
                                <i class="fas fa-save"></i> Save Settings
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Create App Modal -->
    <div id="createAppModal" class="modal hidden">
        <div class="modal-content">
            <div class="modal-header">
                <h3>Create New Application</h3>
                <span class="close" onclick="closeModal('createAppModal')">&times;</span>
            </div>
            <div class="modal-body">
                <div class="input-group">
                    <label>Application Name</label>
                    <input type="text" id="appName" placeholder="My Awesome App">
                </div>
                <div class="input-group">
                    <label>Version</label>
                    <input type="text" id="appVersion" placeholder="1.0.0">
                </div>
                <div class="input-group">
                    <label>Download URL</label>
                    <input type="text" id="appDownloadUrl" placeholder="https://example.com/app.dll">
                </div>
                <button class="btn btn-primary" onclick="createApp()">Create Application</button>
            </div>
        </div>
    </div>

    <!-- Generate Key Modal -->
    <div id="generateKeyModal" class="modal hidden">
        <div class="modal-content">
            <div class="modal-header">
                <h3>Generate License Key</h3>
                <span class="close" onclick="closeModal('generateKeyModal')">&times;</span>
            </div>
            <div class="modal-body">
                <div class="input-group">
                    <label>Application</label>
                    <select id="keyAppId"></select>
                </div>
                <div class="input-group">
                    <label>Duration (days)</label>
                    <input type="number" id="keyDuration" value="30" min="1">
                </div>
                <div class="input-group">
                    <label>Max Activations</label>
                    <input type="number" id="keyMaxActivations" value="1" min="1">
                </div>
                <button class="btn btn-primary" onclick="generateKey()">Generate Key</button>
            </div>
        </div>
    </div>

    <script src="https://accounts.google.com/gsi/client" async defer></script>
    <script>
        let currentUser = null;
        let authToken = null;

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
                    initializePanel();
                } else {
                    showMessage(data.message, 'error');
                }
            } catch (error) {
                showMessage('Login failed', 'error');
            }
        }

        function googleLogin() {
            // Google OAuth implementation would go here
            showMessage('Google login would be implemented with OAuth', 'info');
        }

        function initializePanel() {
            document.getElementById('loginScreen').classList.add('hidden');
            document.getElementById('mainPanel').classList.remove('hidden');
            
            if (currentUser) {
                document.getElementById('userName').textContent = currentUser.name;
                document.getElementById('userRole').textContent = currentUser.role;
                document.getElementById('userAvatar').textContent = currentUser.name.charAt(0).toUpperCase();
            }
            
            loadStats();
            loadApps();
            loadKeys();
            loadUsers();
        }

        function showSection(section) {
            document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            
            document.getElementById(section + 'Section').classList.remove('hidden');
            event.target.classList.add('active');
            
            document.getElementById('pageTitle').textContent = 
                document.querySelector(`.nav-item[onclick="showSection('${section}')"]`).textContent;
        }

        function showCreateAppModal() {
            document.getElementById('createAppModal').classList.remove('hidden');
        }

        function showGenerateKeyModal() {
            document.getElementById('generateKeyModal').classList.remove('hidden');
        }

        function closeModal(modalId) {
            document.getElementById(modalId).classList.add('hidden');
        }

        async function loadStats() {
            try {
                const response = await fetch('/api/stats', {
                    headers: { 'Authorization': `Bearer ${authToken}` }
                });
                
                const data = await response.json();
                
                if (data.success) {
                    document.getElementById('statApps').textContent = data.stats.totalApps;
                    document.getElementById('statKeys').textContent = data.stats.totalKeys;
                    document.getElementById('statUsers').textContent = data.stats.totalUsers;
                    document.getElementById('statActive').textContent = data.stats.activeKeys;
                }
            } catch (error) {
                console.error('Failed to load stats:', error);
            }
        }

        async function loadApps() {
            // Implementation for loading apps
        }

        async function loadKeys() {
            // Implementation for loading keys
        }

        async function loadUsers() {
            // Implementation for loading users
        }

        function showMessage(message, type) {
            const messageEl = document.getElementById('loginMessage');
            messageEl.textContent = message;
            messageEl.style.color = type === 'error' ? 'var(--danger)' : 
                                  type === 'success' ? 'var(--success)' : 'var(--info)';
        }

        function logout() {
            authToken = null;
            currentUser = null;
            document.getElementById('mainPanel').classList.add('hidden');
            document.getElementById('loginScreen').classList.remove('hidden');
        }

        // Initialize Google OAuth
        window.onload = function() {
            google.accounts.id.initialize({
                client_id: 'YOUR_GOOGLE_CLIENT_ID',
                callback: handleGoogleSignIn
            });
        };

        function handleGoogleSignIn(response) {
            // Handle Google sign-in response
        }
    </script>
</body>
</html>
