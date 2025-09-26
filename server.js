const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static("public"));

const dbFile = path.join(__dirname, "data", "database.json");
const screenshotsDir = path.join(__dirname, "screenshots");

// Создаем необходимые директории
if (!fs.existsSync(path.dirname(dbFile))) {
    fs.mkdirSync(path.dirname(dbFile), { recursive: true });
}
if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
}

// Функции для работы с базой данных
function initDatabase() {
    if (!fs.existsSync(dbFile)) {
        const defaultData = {
            users: [
                {
                    id: "admin",
                    username: "admin",
                    password: bcrypt.hashSync(ADMIN_PASSWORD, 10),
                    role: "superadmin",
                    createdAt: new Date().toISOString()
                }
            ],
            apps: [],
            settings: {
                siteTitle: "Quantum Auth Panel",
                theme: "dark",
                maxLoginAttempts: 5
            }
        };
        fs.writeFileSync(dbFile, JSON.stringify(defaultData, null, 2));
    }
    return JSON.parse(fs.readFileSync(dbFile, "utf-8"));
}

function saveDatabase(data) {
    fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
}

// Генерация ключа приложения
function generateAppSecret() {
    return crypto.randomBytes(32).toString('hex');
}

function generateLicenseKey(appId) {
    const segments = [
        crypto.randomBytes(4).toString('hex').toUpperCase(),
        crypto.randomBytes(4).toString('hex').toUpperCase(),
        crypto.randomBytes(4).toString('hex').toUpperCase(),
        crypto.randomBytes(4).toString('hex').toUpperCase()
    ];
    return `${appId.toUpperCase()}-${segments.join('-')}`;
}

// Middleware для аутентификации
function authenticate(req, res, next) {
    const token = req.headers.authorization;
    if (!token) {
        return res.status(401).json({ error: "Authentication required" });
    }
    
    const db = initDatabase();
    const user = db.users.find(u => u.id === token);
    if (!user) {
        return res.status(401).json({ error: "Invalid token" });
    }
    
    req.user = user;
    next();
}

// Routes
app.post("/api/auth/login", async (req, res) => {
    try {
        const { username, password } = req.body;
        const db = initDatabase();
        
        const user = db.users.find(u => u.username === username);
        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: "Invalid credentials" 
            });
        }
        
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ 
                success: false, 
                message: "Invalid credentials" 
            });
        }
        
        // Генерируем токен сессии
        const sessionToken = crypto.randomBytes(32).toString('hex');
        user.lastLogin = new Date().toISOString();
        user.sessionToken = sessionToken;
        saveDatabase(db);
        
        res.json({ 
            success: true, 
            token: sessionToken,
            user: {
                id: user.id,
                username: user.username,
                role: user.role
            }
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: "Server error" 
        });
    }
});

app.post("/api/auth/logout", authenticate, (req, res) => {
    const db = initDatabase();
    const user = db.users.find(u => u.id === req.user.id);
    if (user) {
        delete user.sessionToken;
        saveDatabase(db);
    }
    res.json({ success: true });
});

app.get("/api/auth/me", authenticate, (req, res) => {
    res.json({
        user: {
            id: req.user.id,
            username: req.user.username,
            role: req.user.role
        }
    });
});

// Apps management
app.get("/api/apps", authenticate, (req, res) => {
    const db = initDatabase();
    res.json(db.apps);
});

app.post("/api/apps", authenticate, (req, res) => {
    const { name, description, settings } = req.body;
    const db = initDatabase();
    
    const newApp = {
        id: crypto.randomBytes(8).toString('hex'),
        name: name,
        description: description || "",
        secret: generateAppSecret(),
        ownerId: req.user.id,
        settings: {
            hwidLock: settings?.hwidLock !== false,
            screenshotRequired: settings?.screenshotRequired !== false,
            maxActivations: settings?.maxActivations || 1,
            ...settings
        },
        keys: [],
        stats: {
            totalKeys: 0,
            activeSessions: 0,
            totalScreenshots: 0,
            totalRevenue: 0
        },
        createdAt: new Date().toISOString(),
        status: "active"
    };
    
    db.apps.push(newApp);
    saveDatabase(db);
    
    res.json({ success: true, app: newApp });
});

app.post("/api/apps/:appId/keys", authenticate, (req, res) => {
    const { durationDays, maxActivations, metadata } = req.body;
    const db = initDatabase();
    const app = db.apps.find(a => a.id === req.params.appId);
    
    if (!app) {
        return res.status(404).json({ error: "App not found" });
    }
    
    if (app.ownerId !== req.user.id && req.user.role !== "superadmin") {
        return res.status(403).json({ error: "Access denied" });
    }
    
    const key = {
        id: crypto.randomBytes(16).toString('hex'),
        value: generateLicenseKey(app.id),
        appId: app.id,
        banned: false,
        expiresAt: durationDays ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString() : null,
        createdAt: new Date().toISOString(),
        hwid: null,
        activations: 0,
        maxActivations: maxActivations || app.settings.maxActivations,
        lastActivation: null,
        screenshots: [],
        metadata: metadata || {}
    };
    
    app.keys.push(key);
    app.stats.totalKeys++;
    saveDatabase(db);
    
    res.json({ success: true, key });
});

app.post("/api/apps/:appId/check", (req, res) => {
    const { key, hwid, appSecret } = req.body;
    const db = initDatabase();
    const app = db.apps.find(a => a.id === req.params.appId);
    
    if (!app || appSecret !== app.secret) {
        return res.json({ valid: false, reason: "invalid_app" });
    }
    
    const licenseKey = app.keys.find(k => k.value === key);
    if (!licenseKey) {
        return res.json({ valid: false, reason: "key_not_found" });
    }
    
    if (licenseKey.banned) {
        return res.json({ valid: false, reason: "banned" });
    }
    
    if (licenseKey.expiresAt && new Date(licenseKey.expiresAt) < new Date()) {
        return res.json({ valid: false, reason: "expired" });
    }
    
    if (app.settings.hwidLock) {
        if (licenseKey.hwid && licenseKey.hwid !== hwid) {
            return res.json({ valid: false, reason: "hwid_mismatch" });
        }
        
        if (!licenseKey.hwid && licenseKey.activations >= licenseKey.maxActivations) {
            return res.json({ valid: false, reason: "max_activations" });
        }
    }
    
    // Обновляем статистику активации
    if (!licenseKey.hwid && app.settings.hwidLock) {
        licenseKey.hwid = hwid;
        licenseKey.activations++;
        licenseKey.lastActivation = new Date().toISOString();
        app.stats.activeSessions++;
        saveDatabase(db);
    }
    
    res.json({ 
        valid: true, 
        appName: app.name,
        expiresAt: licenseKey.expiresAt,
        createdAt: licenseKey.createdAt
    });
});

// Dashboard statistics
app.get("/api/dashboard/stats", authenticate, (req, res) => {
    const db = initDatabase();
    const userApps = db.apps.filter(app => app.ownerId === req.user.id || req.user.role === "superadmin");
    
    const stats = {
        totalApps: userApps.length,
        totalKeys: userApps.reduce((sum, app) => sum + app.stats.totalKeys, 0),
        activeSessions: userApps.reduce((sum, app) => sum + app.stats.activeSessions, 0),
        totalRevenue: userApps.reduce((sum, app) => sum + app.stats.totalRevenue, 0),
        recentActivity: []
    };
    
    res.json(stats);
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
    console.log(`🚀 Quantum Auth Panel running on port ${PORT}`);
    console.log(`🔐 Default admin password: ${ADMIN_PASSWORD}`);
});
