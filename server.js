import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import { v4 as uuidv4 } from 'uuid';
import moment from 'moment';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'quantum-super-secret-key-change-in-production';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'QuantumAdmin123!';

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"]
        }
    }
}));

app.use(compression());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static("public"));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Database file paths
const dbFile = path.join(__dirname, "data", "quantum-db.json");
const logsDir = path.join(__dirname, "logs");
const screenshotsDir = path.join(__dirname, "screenshots");

// Ensure directories exist
[path.dirname(dbFile), logsDir, screenshotsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Logging function
function log(message, type = 'info') {
    const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
    const logMessage = `[${timestamp}] ${message}`;
    
    const colors = {
        info: chalk.blue,
        success: chalk.green,
        warning: chalk.yellow,
        error: chalk.red,
        debug: chalk.magenta
    };
    
    console.log(colors[type]?.(logMessage) || logMessage);
    
    // Write to file
    const logFile = path.join(logsDir, `quantum-${moment().format('YYYY-MM-DD')}.log`);
    fs.appendFileSync(logFile, logMessage + '\n');
}

// Database functions
function initDatabase() {
    if (!fs.existsSync(dbFile)) {
        const defaultData = {
            system: {
                version: "3.0.0",
                initialized: moment().toISOString(),
                stats: {
                    totalLogins: 0,
                    totalRequests: 0,
                    uptime: 0
                }
            },
            users: [
                {
                    id: "admin",
                    username: "admin",
                    password: bcrypt.hashSync(ADMIN_PASSWORD, 12),
                    email: "admin@quantumauth.com",
                    role: "superadmin",
                    permissions: ["*"],
                    createdAt: moment().toISOString(),
                    lastLogin: null,
                    isActive: true,
                    metadata: {
                        theme: "quantum",
                        language: "en"
                    }
                }
            ],
            apps: [],
            sessions: [],
            auditLog: []
        };
        
        fs.writeFileSync(dbFile, JSON.stringify(defaultData, null, 2));
        log('Quantum database initialized successfully', 'success');
    }
    
    return JSON.parse(fs.readFileSync(dbFile, 'utf-8'));
}

function saveDatabase(data) {
    fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
}

function auditLog(action, user, details = {}) {
    const db = initDatabase();
    const logEntry = {
        id: uuidv4(),
        action,
        user: user?.id || 'system',
        timestamp: moment().toISOString(),
        ip: details.ip || 'unknown',
        userAgent: details.userAgent || 'unknown',
        details
    };
    
    db.auditLog.unshift(logEntry);
    // Keep only last 1000 log entries
    if (db.auditLog.length > 1000) {
        db.auditLog = db.auditLog.slice(0, 1000);
    }
    
    saveDatabase(db);
    log(`Audit: ${action} by ${user?.username || 'system'}`, 'debug');
}

// JWT middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ success: false, message: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, message: 'Invalid or expired token' });
        }
        
        const db = initDatabase();
        const userData = db.users.find(u => u.id === user.id && u.isActive);
        if (!userData) {
            return res.status(403).json({ success: false, message: 'User not found or inactive' });
        }
        
        req.user = userData;
        next();
    });
}

// Generate app secret
function generateAppSecret() {
    return jwt.sign({ type: 'app', timestamp: Date.now() }, JWT_SECRET);
}

// Generate license key
function generateLicenseKey(appId, prefix = 'QNTM') {
    const segments = [
        prefix,
        appId.slice(0, 4).toUpperCase(),
        Math.random().toString(36).substr(2, 6).toUpperCase(),
        Math.random().toString(36).substr(2, 6).toUpperCase(),
        Math.random().toString(36).substr(2, 6).toUpperCase()
    ];
    return segments.join('-');
}

// Routes

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        version: '3.0.0',
        timestamp: moment().toISOString(),
        uptime: process.uptime()
    });
});

// Authentication routes
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password, userAgent } = req.body;
        const db = initDatabase();
        
        log(`Login attempt: ${username}`, 'info');
        
        const user = db.users.find(u => u.username === username && u.isActive);
        if (!user) {
            auditLog('LOGIN_FAILED', null, { username, reason: 'user_not_found', ip: req.ip, userAgent });
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid credentials' 
            });
        }
        
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            auditLog('LOGIN_FAILED', user, { reason: 'invalid_password', ip: req.ip, userAgent });
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid credentials' 
            });
        }
        
        // Update user stats
        user.lastLogin = moment().toISOString();
        db.system.stats.totalLogins++;
        
        // Generate JWT token
        const token = jwt.sign(
            { 
                id: user.id, 
                username: user.username,
                role: user.role 
            }, 
            JWT_SECRET, 
            { expiresIn: '24h' }
        );
        
        // Create session
        const session = {
            id: uuidv4(),
            userId: user.id,
            token,
            ip: req.ip,
            userAgent: userAgent || req.get('User-Agent'),
            createdAt: moment().toISOString(),
            lastActive: moment().toISOString(),
            isActive: true
        };
        
        db.sessions.push(session);
        saveDatabase(db);
        
        auditLog('LOGIN_SUCCESS', user, { ip: req.ip, userAgent });
        
        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                metadata: user.metadata
            }
        });
        
    } catch (error) {
        log(`Login error: ${error.message}`, 'error');
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
});

app.post('/api/auth/logout', authenticateToken, (req, res) => {
    const db = initDatabase();
    
    // Remove active sessions for user
    db.sessions = db.sessions.filter(s => s.userId !== req.user.id || !s.isActive);
    
    saveDatabase(db);
    auditLog('LOGOUT', req.user, { ip: req.ip });
    
    res.json({ success: true, message: 'Logged out successfully' });
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
    res.json({
        success: true,
        user: {
            id: req.user.id,
            username: req.user.username,
            email: req.user.email,
            role: req.user.role,
            metadata: req.user.metadata
        }
    });
});

// Applications management
app.get('/api/apps', authenticateToken, (req, res) => {
    const db = initDatabase();
    const userApps = db.apps.filter(app => 
        app.ownerId === req.user.id || req.user.role === 'superadmin'
    );
    
    res.json({
        success: true,
        apps: userApps.map(app => ({
            id: app.id,
            name: app.name,
            description: app.description,
            status: app.status,
            stats: app.stats,
            createdAt: app.createdAt,
            secret: req.user.role === 'superadmin' ? app.secret : undefined
        }))
    });
});

app.post('/api/apps', authenticateToken, (req, res) => {
    try {
        const { name, description, settings } = req.body;
        const db = initDatabase();
        
        const newApp = {
            id: uuidv4(),
            name: name.trim(),
            description: description || '',
            secret: generateAppSecret(),
            ownerId: req.user.id,
            ownerName: req.user.username,
            settings: {
                hwidLock: settings?.hwidLock !== false,
                screenshotRequired: settings?.screenshotRequired !== false,
                maxActivations: settings?.maxActivations || 1,
                keyPrefix: settings?.keyPrefix || 'QNTM',
                ...settings
            },
            keys: [],
            stats: {
                totalKeys: 0,
                activeSessions: 0,
                totalScreenshots: 0,
                totalRevenue: 0,
                lastActive: null
            },
            createdAt: moment().toISOString(),
            updatedAt: moment().toISOString(),
            status: 'active'
        };
        
        db.apps.push(newApp);
        saveDatabase(db);
        
        auditLog('APP_CREATED', req.user, { appId: newApp.id, appName: newApp.name });
        
        res.json({
            success: true,
            app: newApp
        });
        
    } catch (error) {
        log(`App creation error: ${error.message}`, 'error');
        res.status(500).json({ 
            success: false, 
            message: 'Failed to create application' 
        });
    }
});

// License keys management
app.post('/api/apps/:appId/keys', authenticateToken, (req, res) => {
    try {
        const { durationDays, maxActivations, metadata } = req.body;
        const db = initDatabase();
        const app = db.apps.find(a => a.id === req.params.appId);
        
        if (!app) {
            return res.status(404).json({ 
                success: false, 
                message: 'Application not found' 
            });
        }
        
        if (app.ownerId !== req.user.id && req.user.role !== 'superadmin') {
            return res.status(403).json({ 
                success: false, 
                message: 'Access denied' 
            });
        }
        
        const key = {
            id: uuidv4(),
            value: generateLicenseKey(app.id, app.settings.keyPrefix),
            appId: app.id,
            appName: app.name,
            banned: false,
            expiresAt: durationDays ? 
                moment().add(durationDays, 'days').toISOString() : null,
            createdAt: moment().toISOString(),
            hwid: null,
            activations: 0,
            maxActivations: maxActivations || app.settings.maxActivations,
            lastActivation: null,
            screenshots: [],
            metadata: metadata || {},
            createdBy: req.user.username
        };
        
        app.keys.push(key);
        app.stats.totalKeys++;
        app.updatedAt = moment().toISOString();
        saveDatabase(db);
        
        auditLog('KEY_GENERATED', req.user, { 
            appId: app.id, 
            keyId: key.id,
            keyValue: key.value 
        });
        
        res.json({
            success: true,
            key: {
                ...key,
                expiresIn: durationDays ? `${durationDays} days` : 'Never'
            }
        });
        
    } catch (error) {
        log(`Key generation error: ${error.message}`, 'error');
        res.status(500).json({ 
            success: false, 
            message: 'Failed to generate key' 
        });
    }
});

// Key validation endpoint (public)
app.post('/api/apps/:appId/check', (req, res) => {
    try {
        const { key, hwid, appSecret } = req.body;
        const db = initDatabase();
        const app = db.apps.find(a => a.id === req.params.appId && a.status === 'active');
        
        if (!app || appSecret !== app.secret) {
            return res.json({ 
                valid: false, 
                reason: 'invalid_app',
                message: 'Invalid application or secret' 
            });
        }
        
        const licenseKey = app.keys.find(k => k.value === key);
        if (!licenseKey) {
            return res.json({ 
                valid: false, 
                reason: 'key_not_found',
                message: 'License key not found' 
            });
        }
        
        if (licenseKey.banned) {
            return res.json({ 
                valid: false, 
                reason: 'banned',
                message: 'This key has been banned' 
            });
        }
        
        if (licenseKey.expiresAt && moment(licenseKey.expiresAt).isBefore(moment())) {
            return res.json({ 
                valid: false, 
                reason: 'expired',
                message: 'License key has expired' 
            });
        }
        
        if (app.settings.hwidLock) {
            if (licenseKey.hwid && licenseKey.hwid !== hwid) {
                return res.json({ 
                    valid: false, 
                    reason: 'hwid_mismatch',
                    message: 'HWID does not match' 
                });
            }
            
            if (!licenseKey.hwid && licenseKey.activations >= licenseKey.maxActivations) {
                return res.json({ 
                    valid: false, 
                    reason: 'max_activations',
                    message: 'Maximum activations reached' 
                });
            }
        }
        
        // Update activation stats
        if (!licenseKey.hwid && app.settings.hwidLock) {
            licenseKey.hwid = hwid;
            licenseKey.activations++;
            licenseKey.lastActivation = moment().toISOString();
            app.stats.activeSessions++;
            app.stats.lastActive = moment().toISOString();
        }
        
        saveDatabase(db);
        
        res.json({ 
            valid: true,
            appName: app.name,
            expiresAt: licenseKey.expiresAt,
            createdAt: licenseKey.createdAt,
            message: 'License key is valid'
        });
        
    } catch (error) {
        log(`Key check error: ${error.message}`, 'error');
        res.status(500).json({ 
            valid: false, 
            reason: 'server_error',
            message: 'Internal server error' 
        });
    }
});

// Dashboard statistics
app.get('/api/dashboard/stats', authenticateToken, (req, res) => {
    const db = initDatabase();
    const userApps = db.apps.filter(app => 
        app.ownerId === req.user.id || req.user.role === 'superadmin'
    );
    
    const stats = {
        totalApps: userApps.length,
        totalKeys: userApps.reduce((sum, app) => sum + app.stats.totalKeys, 0),
        activeSessions: userApps.reduce((sum, app) => sum + app.stats.activeSessions, 0),
        totalRevenue: userApps.reduce((sum, app) => sum + app.stats.totalRevenue, 0),
        totalScreenshots: userApps.reduce((sum, app) => sum + app.stats.totalScreenshots, 0),
        recentActivity: db.auditLog
            .filter(log => log.user === req.user.id)
            .slice(0, 10)
            .map(log => ({
                action: log.action,
                timestamp: log.timestamp,
                details: log.details
            }))
    };
    
    res.json({
        success: true,
        stats
    });
});

// System info
app.get('/api/system/info', authenticateToken, (req, res) => {
    if (req.user.role !== 'superadmin') {
        return res.status(403).json({ 
            success: false, 
            message: 'Access denied' 
        });
    }
    
    const db = initDatabase();
    res.json({
        success: true,
        system: db.system,
        users: db.users.length,
        apps: db.apps.length,
        sessions: db.sessions.filter(s => s.isActive).length
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    log(`Unhandled error: ${err.message}`, 'error');
    res.status(500).json({ 
        success: false, 
        message: 'Internal server error' 
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ 
        success: false, 
        message: 'Endpoint not found' 
    });
});

// Start server
app.listen(PORT, () => {
    log(`🚀 Quantum Auth System v3.0.0 running on port ${PORT}`, 'success');
    log(`🔐 Admin panel: http://localhost:${PORT}`, 'info');
    log(`👤 Default credentials: admin / ${ADMIN_PASSWORD}`, 'warning');
    log(`📊 Database: ${dbFile}`, 'debug');
    
    // Initialize database on startup
    initDatabase();
});

// Graceful shutdown
process.on('SIGINT', () => {
    log('Shutting down Quantum system gracefully...', 'warning');
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    log(`Uncaught exception: ${error.message}`, 'error');
    process.exit(1);
});
