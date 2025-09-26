const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "eclipse2024";

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.static("public"));

const dbFile = path.join(__dirname, "database.json");
const screenshotsDir = path.join(__dirname, "screenshots");

if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
}

const defaultApps = [
    { id: "eclipse", name: "Eclipse", owner: "admin", version: "1.2", status: "active" },
    { id: "neon", name: "Neon", owner: "admin", version: "2.1", status: "active" },
    { id: "phantom", name: "Phantom", owner: "admin", version: "1.0", status: "active" }
];

function loadDatabase() {
    if (!fs.existsSync(dbFile)) {
        const initialData = {
            apps: defaultApps,
            keys: [],
            settings: {
                maxActivations: 3,
                screenshotEnabled: true,
                hwidLock: true
            },
            statistics: {
                totalLogins: 0,
                totalInjections: 0,
                totalScreenshots: 0
            }
        };
        fs.writeFileSync(dbFile, JSON.stringify(initialData, null, 2));
    }
    return JSON.parse(fs.readFileSync(dbFile, "utf-8"));
}

function saveDatabase(data) {
    fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
}

function generateLicenseKey(appId, durationMs, maxActivations = 1) {
    const segments = [];
    for (let i = 0; i < 3; i++) {
        segments.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }
    
    return {
        id: crypto.randomBytes(8).toString('hex'),
        value: `ECLIPSE-${segments[0]}-${segments[1]}-${segments[2]}`,
        appId: appId,
        banned: false,
        expiresAt: durationMs ? new Date(Date.now() + durationMs).toISOString() : null,
        createdAt: new Date().toISOString(),
        hwid: null,
        activations: 0,
        maxActivations: maxActivations,
        lastActivation: null,
        screenshots: [],
        notes: ""
    };
}

app.post("/api/auth/login", (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        res.json({ 
            success: true, 
            token: crypto.randomBytes(32).toString('hex'),
            user: { name: "Admin", role: "administrator" }
        });
    } else {
        res.status(401).json({ success: false, message: "Invalid credentials" });
    }
});

app.get("/api/apps", (req, res) => {
    const db = loadDatabase();
    res.json(db.apps);
});

app.post("/api/apps", (req, res) => {
    const { name, owner, version } = req.body;
    const db = loadDatabase();
    
    const newApp = {
        id: name.toLowerCase().replace(/\s+/g, '-'),
        name: name,
        owner: owner,
        version: version,
        status: "active",
        createdAt: new Date().toISOString()
    };
    
    db.apps.push(newApp);
    saveDatabase(db);
    
    res.json({ success: true, app: newApp });
});

app.get("/api/keys", (req, res) => {
    const db = loadDatabase();
    res.json(db.keys);
});

app.post("/api/keys", (req, res) => {
    const { appId, durationMs, maxActivations = 1, notes = "" } = req.body;
    const db = loadDatabase();
    
    const key = generateLicenseKey(appId, durationMs, maxActivations);
    key.notes = notes;
    db.keys.push(key);
    
    db.statistics.totalKeys = db.keys.length;
    saveDatabase(db);
    
    res.json({ success: true, key: key });
});

app.post("/api/keys/validate", (req, res) => {
    const { key, hwid, app, owner } = req.body;
    const db = loadDatabase();
    
    const keyData = db.keys.find(k => k.value === key && k.appId === app);
    
    if (!keyData) {
        return res.json({ 
            valid: false, 
            reason: "not_found",
            message: "License key not found for this application"
        });
    }
    
    if (keyData.banned) {
        return res.json({ 
            valid: false, 
            reason: "banned",
            message: "This key has been banned"
        });
    }
    
    if (keyData.expiresAt && new Date(keyData.expiresAt) < new Date()) {
        return res.json({ 
            valid: false, 
            reason: "expired",
            message: "License key has expired"
        });
    }
    
    if (keyData.hwid && keyData.hwid !== hwid) {
        return res.json({ 
            valid: false, 
            reason: "hwid_mismatch",
            message: "HWID does not match registered device"
        });
    }
    
    if (!keyData.hwid && keyData.activations >= keyData.maxActivations) {
        return res.json({ 
            valid: false, 
            reason: "max_activations",
            message: "Maximum activations reached"
        });
    }
    
    if (!keyData.hwid) {
        keyData.hwid = hwid;
        keyData.activations += 1;
        keyData.lastActivation = new Date().toISOString();
        db.statistics.totalLogins += 1;
    }
    
    saveDatabase(db);
    
    res.json({ 
        valid: true, 
        app: keyData.appId,
        expiresAt: keyData.expiresAt,
        createdAt: keyData.createdAt,
        activations: keyData.activations,
        maxActivations: keyData.maxActivations
    });
});

app.post("/api/keys/:id/ban", (req, res) => {
    const { id } = req.params;
    const db = loadDatabase();
    
    const keyIndex = db.keys.findIndex(k => k.id === id);
    if (keyIndex !== -1) {
        db.keys[keyIndex].banned = true;
        saveDatabase(db);
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false, message: "Key not found" });
    }
});

app.post("/api/keys/:id/unban", (req, res) => {
    const { id } = req.params;
    const db = loadDatabase();
    
    const keyIndex = db.keys.findIndex(k => k.id === id);
    if (keyIndex !== -1) {
        db.keys[keyIndex].banned = false;
        saveDatabase(db);
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false, message: "Key not found" });
    }
});

app.delete("/api/keys/:id", (req, res) => {
    const { id } = req.params;
    const db = loadDatabase();
    
    const keyIndex = db.keys.findIndex(k => k.id === id);
    if (keyIndex !== -1) {
        db.keys.splice(keyIndex, 1);
        db.statistics.totalKeys = db.keys.length;
        saveDatabase(db);
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false, message: "Key not found" });
    }
});

app.post("/api/screenshots", (req, res) => {
    const { key, hwid, screenshot, app } = req.body;
    const db = loadDatabase();
    
    const keyData = db.keys.find(k => k.value === key && k.appId === app);
    if (!keyData) {
        return res.status(404).json({ success: false, message: "Key not found" });
    }
    
    if (keyData.hwid && keyData.hwid !== hwid) {
        return res.status(403).json({ success: false, message: "HWID mismatch" });
    }
    
    const screenshotId = crypto.randomBytes(8).toString('hex');
    const screenshotPath = path.join(screenshotsDir, `${screenshotId}.png`);
    
    const base64Data = screenshot.replace(/^data:image\/png;base64,/, "");
    
    fs.writeFile(screenshotPath, base64Data, 'base64', (err) => {
        if (err) {
            console.error("Error saving screenshot:", err);
            return res.status(500).json({ success: false, message: "Failed to save screenshot" });
        }
        
        keyData.screenshots.push({
            id: screenshotId,
            timestamp: new Date().toISOString(),
            path: screenshotPath
        });
        
        db.statistics.totalScreenshots += 1;
        saveDatabase(db);
        
        res.json({ success: true, id: screenshotId });
    });
});

app.get("/api/screenshots/:keyId/:screenshotId", (req, res) => {
    const { keyId, screenshotId } = req.params;
    const db = loadDatabase();
    
    const keyData = db.keys.find(k => k.id === keyId);
    if (!keyData) {
        return res.status(404).send("Key not found");
    }
    
    const screenshot = keyData.screenshots.find(s => s.id === screenshotId);
    if (!screenshot || !fs.existsSync(screenshot.path)) {
        return res.status(404).send("Screenshot not found");
    }
    
    res.sendFile(screenshot.path);
});

app.get("/api/statistics", (req, res) => {
    const db = loadDatabase();
    
    const stats = {
        totalApps: db.apps.length,
        totalKeys: db.keys.length,
        activeKeys: db.keys.filter(k => !k.banned && (!k.expiresAt || new Date(k.expiresAt) > new Date())).length,
        bannedKeys: db.keys.filter(k => k.banned).length,
        expiredKeys: db.keys.filter(k => !k.banned && k.expiresAt && new Date(k.expiresAt) < new Date()).length,
        ...db.statistics
    };
    
    res.json(stats);
});

app.get("/api/analytics/usage", (req, res) => {
    const db = loadDatabase();
    
    const last30Days = Array.from({ length: 30 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (29 - i));
        return date.toISOString().split('T')[0];
    });
    
    const usageByDay = last30Days.map(date => {
        const dayLogins = db.keys.reduce((count, key) => {
            if (key.lastActivation && key.lastActivation.startsWith(date)) {
                return count + 1;
            }
            return count;
        }, 0);
        
        return { date, logins: dayLogins };
    });
    
    const appUsage = db.apps.map(app => {
        const appKeys = db.keys.filter(k => k.appId === app.id);
        return {
            app: app.name,
            totalKeys: appKeys.length,
            activeKeys: appKeys.filter(k => !k.banned && (!k.expiresAt || new Date(k.expiresAt) > new Date())).length
        };
    });
    
    res.json({
        dailyUsage: usageByDay,
        appUsage: appUsage,
        topKeys: db.keys.slice(0, 5).map(k => ({
            value: k.value.substring(0, 8) + '...',
            activations: k.activations,
            lastUsed: k.lastActivation
        }))
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Eclipse Management System running on port ${PORT}`);
    console.log(`🔐 Admin panel: http://localhost:${PORT}`);
    console.log(`📊 Default password: ${ADMIN_PASSWORD}`);
});
