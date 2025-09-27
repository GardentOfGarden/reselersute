const express = require("express");
const session = require("express-session");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static("public"));

app.use(session({
    secret: process.env.SESSION_SECRET || "eclipse-super-secret-2024",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

app.use(passport.initialize());
app.use(passport.session());

const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = {
    users: loadJSON("users.json", []),
    apps: loadJSON("apps.json", []),
    keys: loadJSON("keys.json", []),
    settings: loadJSON("settings.json", { 
        googleClientId: "", 
        googleClientSecret: "",
        adminEmails: ["admin@eclipse.com"]
    })
};

function loadJSON(filename, defaultValue) {
    const filepath = path.join(dataDir, filename);
    if (!fs.existsSync(filepath)) {
        fs.writeFileSync(filepath, JSON.stringify(defaultValue, null, 2));
        return defaultValue;
    }
    return JSON.parse(fs.readFileSync(filepath, "utf-8"));
}

function saveJSON(filename, data) {
    fs.writeFileSync(path.join(dataDir, filename), JSON.stringify(data, null, 2));
}

passport.use(new GoogleStrategy({
    clientID: db.settings.googleClientId,
    clientSecret: db.settings.googleClientSecret,
    callbackURL: "/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
    try {
        let user = db.users.find(u => u.googleId === profile.id);
        
        if (!user) {
            user = {
                id: crypto.randomBytes(16).toString('hex'),
                googleId: profile.id,
                email: profile.emails[0].value,
                name: profile.displayName,
                avatar: profile.photos[0].value,
                role: db.settings.adminEmails.includes(profile.emails[0].value) ? 'admin' : 'reseller',
                permissions: {},
                createdAt: new Date().toISOString(),
                isActive: true
            };
            db.users.push(user);
            saveJSON("users.json", db.users);
        }
        
        return done(null, user);
    } catch (error) {
        return done(error, null);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    const user = db.users.find(u => u.id === id);
    done(null, user);
});

function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ error: "Not authenticated" });
}

function ensureAdmin(req, res, next) {
    if (req.isAuthenticated() && req.user.role === 'admin') return next();
    res.status(403).json({ error: "Admin access required" });
}

function ensureAppAccess(appId, req, res, next) {
    if (req.user.role === 'admin') return next();
    
    const app = db.apps.find(a => a.id === appId);
    if (app && app.ownerId === req.user.id) return next();
    
    res.status(403).json({ error: "No access to this application" });
}

app.get('/auth/google', passport.authenticate('google', { 
    scope: ['profile', 'email'] 
}));

app.get('/auth/google/callback', passport.authenticate('google', { 
    failureRedirect: '/login.html' 
}), (req, res) => {
    res.redirect('/admin.html');
});

app.get('/auth/user', ensureAuthenticated, (req, res) => {
    res.json(req.user);
});

app.post('/auth/logout', (req, res) => {
    req.logout(() => {
        res.json({ success: true });
    });
});

app.get('/api/apps', ensureAuthenticated, (req, res) => {
    const apps = req.user.role === 'admin' 
        ? db.apps 
        : db.apps.filter(app => app.ownerId === req.user.id);
    res.json(apps);
});

app.post('/api/apps', ensureAuthenticated, (req, res) => {
    const { name, description, settings } = req.body;
    
    if (req.user.role === 'reseller' && db.apps.filter(a => a.ownerId === req.user.id).length >= 5) {
        return res.status(400).json({ error: "Reseller app limit reached" });
    }
    
    const app = {
        id: crypto.randomBytes(16).toString('hex'),
        name,
        description: description || "",
        ownerId: req.user.id,
        ownerName: req.user.name,
        settings: {
            maxActivations: settings?.maxActivations || 1,
            allowScreenshots: settings?.allowScreenshots !== false,
            enableMonitoring: settings?.enableMonitoring !== false,
            isActive: true,
            ...settings
        },
        createdAt: new Date().toISOString(),
        stats: { totalKeys: 0, activeKeys: 0, bannedKeys: 0 }
    };
    
    db.apps.push(app);
    saveJSON("apps.json", db.apps);
    res.json(app);
});

app.put('/api/apps/:id', ensureAuthenticated, (req, res) => {
    const app = db.apps.find(a => a.id === req.params.id);
    if (!app) return res.status(404).json({ error: "App not found" });
    
    ensureAppAccess(app.id, req, res, () => {
        Object.assign(app, req.body);
        saveJSON("apps.json", db.apps);
        res.json(app);
    });
});

app.post('/api/apps/:id/generate-key', ensureAuthenticated, (req, res) => {
    const { durationMs, maxActivations, note } = req.body;
    const app = db.apps.find(a => a.id === req.params.id);
    
    if (!app) return res.status(404).json({ error: "App not found" });
    
    ensureAppAccess(app.id, req, res, () => {
        if (req.user.role === 'reseller' && (!durationMs || durationMs > 30 * 24 * 60 * 60 * 1000)) {
            return res.status(400).json({ error: "Resellers can only create temporary keys (max 30 days)" });
        }
        
        const key = {
            id: crypto.randomBytes(16).toString('hex'),
            value: generateKeyString(),
            appId: app.id,
            appName: app.name,
            createdBy: req.user.id,
            createdByName: req.user.name,
            createdAt: new Date().toISOString(),
            expiresAt: durationMs ? new Date(Date.now() + durationMs).toISOString() : null,
            maxActivations: maxActivations || 1,
            activations: 0,
            hwid: null,
            banned: false,
            note: note || "",
            lastActivation: null,
            screenshots: []
        };
        
        db.keys.push(key);
        saveJSON("keys.json", db.keys);
        
        app.stats.totalKeys++;
        app.stats.activeKeys++;
        saveJSON("apps.json", db.apps);
        
        res.json(key);
    });
});

app.get('/api/apps/:id/keys', ensureAuthenticated, (req, res) => {
    const app = db.apps.find(a => a.id === req.params.id);
    if (!app) return res.status(404).json({ error: "App not found" });
    
    ensureAppAccess(app.id, req, res, () => {
        const keys = db.keys.filter(k => k.appId === app.id);
        res.json(keys);
    });
});

app.post('/api/keys/:id/ban', ensureAuthenticated, (req, res) => {
    const key = db.keys.find(k => k.id === req.params.id);
    if (!key) return res.status(404).json({ error: "Key not found" });
    
    ensureAppAccess(key.appId, req, res, () => {
        key.banned = true;
        saveJSON("keys.json", db.keys);
        
        const app = db.apps.find(a => a.id === key.appId);
        if (app) {
            app.stats.activeKeys--;
            app.stats.bannedKeys++;
            saveJSON("apps.json", db.apps);
        }
        
        res.json({ success: true });
    });
});

app.post('/api/keys/:id/unban', ensureAuthenticated, (req, res) => {
    const key = db.keys.find(k => k.id === req.params.id);
    if (!key) return res.status(404).json({ error: "Key not found" });
    
    ensureAppAccess(key.appId, req, res, () => {
        key.banned = false;
        saveJSON("keys.json", db.keys);
        
        const app = db.apps.find(a => a.id === key.appId);
        if (app) {
            app.stats.activeKeys++;
            app.stats.bannedKeys--;
            saveJSON("apps.json", db.apps);
        }
        
        res.json({ success: true });
    });
});

app.delete('/api/keys/:id', ensureAuthenticated, (req, res) => {
    const keyIndex = db.keys.findIndex(k => k.id === req.params.id);
    if (keyIndex === -1) return res.status(404).json({ error: "Key not found" });
    
    const key = db.keys[keyIndex];
    ensureAppAccess(key.appId, req, res, () => {
        db.keys.splice(keyIndex, 1);
        saveJSON("keys.json", db.keys);
        
        const app = db.apps.find(a => a.id === key.appId);
        if (app) {
            app.stats.totalKeys--;
            if (!key.banned) app.stats.activeKeys--;
            else app.stats.bannedKeys--;
            saveJSON("apps.json", db.apps);
        }
        
        res.json({ success: true });
    });
});

app.post('/api/validate', (req, res) => {
    const { appId, key, hwid } = req.body;
    
    const app = db.apps.find(a => a.id === appId);
    if (!app || !app.settings.isActive) {
        return res.json({ valid: false, reason: "app_disabled" });
    }
    
    const keyData = db.keys.find(k => k.value === key && k.appId === appId);
    if (!keyData) return res.json({ valid: false, reason: "key_not_found" });
    if (keyData.banned) return res.json({ valid: false, reason: "banned" });
    
    if (keyData.expiresAt && new Date(keyData.expiresAt) < new Date()) {
        return res.json({ valid: false, reason: "expired" });
    }
    
    if (keyData.hwid && keyData.hwid !== hwid) {
        return res.json({ valid: false, reason: "hwid_mismatch" });
    }
    
    if (!keyData.hwid && keyData.activations >= keyData.maxActivations) {
        return res.json({ valid: false, reason: "max_activations" });
    }
    
    if (!keyData.hwid) {
        keyData.hwid = hwid;
        keyData.activations++;
        keyData.lastActivation = new Date().toISOString();
        saveJSON("keys.json", db.keys);
    }
    
    res.json({ 
        valid: true, 
        appName: app.name,
        expiresAt: keyData.expiresAt,
        createdAt: keyData.createdAt
    });
});

app.post('/api/screenshot', (req, res) => {
    const { appId, key, hwid, screenshot } = req.body;
    
    const keyData = db.keys.find(k => k.value === key && k.appId === appId);
    if (!keyData) return res.status(404).json({ error: "Key not found" });
    
    if (keyData.hwid !== hwid) {
        return res.status(403).json({ error: "HWID mismatch" });
    }
    
    const screenshotId = Date.now() + '-' + crypto.randomBytes(8).toString('hex');
    const screenshotsDir = path.join(dataDir, 'screenshots');
    if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });
    
    const screenshotPath = path.join(screenshotsDir, `${screenshotId}.png`);
    const base64Data = screenshot.replace(/^data:image\/png;base64,/, "");
    
    fs.writeFile(screenshotPath, base64Data, 'base64', (err) => {
        if (err) {
            console.error("Error saving screenshot:", err);
            return res.status(500).json({ error: "Failed to save screenshot" });
        }
        
        keyData.screenshots.push({
            id: screenshotId,
            timestamp: new Date().toISOString(),
            path: screenshotPath
        });
        
        saveJSON("keys.json", db.keys);
        res.json({ success: true, id: screenshotId });
    });
});

app.get('/api/admin/stats', ensureAdmin, (req, res) => {
    const stats = {
        totalUsers: db.users.length,
        totalApps: db.apps.length,
        totalKeys: db.keys.length,
        activeKeys: db.keys.filter(k => !k.banned && (!k.expiresAt || new Date(k.expiresAt) > new Date())).length,
        bannedKeys: db.keys.filter(k => k.banned).length,
        recentActivity: db.keys.slice(-10).map(k => ({
            key: k.value.substring(0, 8) + '...',
            app: k.appName,
            action: k.activations > 0 ? 'activated' : 'created',
            time: k.lastActivation || k.createdAt
        }))
    };
    res.json(stats);
});

app.put('/api/admin/settings', ensureAdmin, (req, res) => {
    Object.assign(db.settings, req.body);
    saveJSON("settings.json", db.settings);
    res.json({ success: true });
});

app.get('/api/admin/users', ensureAdmin, (req, res) => {
    res.json(db.users);
});

app.put('/api/admin/users/:id', ensureAdmin, (req, res) => {
    const user = db.users.find(u => u.id === req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    
    Object.assign(user, req.body);
    saveJSON("users.json", db.users);
    res.json(user);
});

function generateKeyString() {
    const segments = [];
    for (let i = 0; i < 4; i++) {
        segments.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }
    return segments.join('-');
}

setInterval(() => {
    db.apps.forEach(app => {
        const keys = db.keys.filter(k => k.appId === app.id);
        app.stats.totalKeys = keys.length;
        app.stats.activeKeys = keys.filter(k => !k.banned && (!k.expiresAt || new Date(k.expiresAt) > new Date())).length;
        app.stats.bannedKeys = keys.filter(k => k.banned).length;
    });
    saveJSON("apps.json", db.apps);
}, 60000);

app.listen(PORT, () => {
    console.log(`🚀 Eclipse Multi-App System running on port ${PORT}`);
    console.log(`🔐 Google OAuth enabled: ${!!db.settings.googleClientId}`);
});
