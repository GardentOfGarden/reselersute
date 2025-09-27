const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "eclipse_super_secret_key";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "your-google-client-id";

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static("public"));

const dbFile = path.join(__dirname, "database.json");

const defaultDatabase = {
    apps: [],
    users: [],
    keys: [],
    settings: {
        maxKeysPerReseller: 100,
        defaultKeyDuration: 2592000000
    },
    version: "2.0"
};

function loadDatabase() {
    if (!fs.existsSync(dbFile)) {
        fs.writeFileSync(dbFile, JSON.stringify(defaultDatabase, null, 2));
    }
    return JSON.parse(fs.readFileSync(dbFile, "utf-8"));
}

function saveDatabase(db) {
    fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
}

function generateAppId() {
    return "app_" + crypto.randomBytes(8).toString('hex');
}

function generateKey() {
    const segments = [];
    for (let i = 0; i < 3; i++) {
        segments.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }
    return "ECLIPSE-" + segments.join("-");
}

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: "Access token required" });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ success: false, message: "Invalid token" });
    }
}

function requireRole(role) {
    return (req, res, next) => {
        if (req.user.role !== role && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: "Insufficient permissions" });
        }
        next();
    };
}

app.post("/api/auth/google", async (req, res) => {
    const { token } = req.body;

    try {
        const ticket = await googleClient.verifyIdToken({
            idToken: token,
            audience: GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();
        const db = loadDatabase();

        let user = db.users.find(u => u.email === payload.email);
        
        if (!user) {
            user = {
                id: crypto.randomBytes(16).toString('hex'),
                email: payload.email,
                name: payload.name,
                picture: payload.picture,
                role: 'user',
                createdAt: new Date().toISOString(),
                lastLogin: new Date().toISOString()
            };
            db.users.push(user);
        } else {
            user.lastLogin = new Date().toISOString();
        }

        const jwtToken = jwt.sign(
            { userId: user.id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        saveDatabase(db);

        res.json({
            success: true,
            token: jwtToken,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                picture: user.picture,
                role: user.role
            }
        });
    } catch (error) {
        res.status(401).json({ success: false, message: "Google authentication failed" });
    }
});

app.post("/api/auth/login", (req, res) => {
    const { key, hwid, appId, ownerId } = req.body;
    const db = loadDatabase();

    const app = db.apps.find(a => a.id === appId && a.ownerId === ownerId);
    if (!app || !app.enabled) {
        return res.json({ success: false, message: "Application not available" });
    }

    const keyData = db.keys.find(k => k.value === key && k.appId === appId);
    if (!keyData) {
        return res.json({ success: false, message: "Invalid license key" });
    }

    if (keyData.banned) {
        return res.json({ success: false, message: "Key is banned" });
    }

    if (keyData.expiresAt && new Date(keyData.expiresAt) < new Date()) {
        return res.json({ success: false, message: "Key has expired" });
    }

    if (keyData.hwid && keyData.hwid !== hwid) {
        return res.json({ success: false, message: "HWID mismatch" });
    }

    if (!keyData.hwid) {
        keyData.hwid = hwid;
        keyData.activations = (keyData.activations || 0) + 1;
        keyData.lastActivation = new Date().toISOString();
    }

    keyData.lastUsed = new Date().toISOString();
    saveDatabase(db);

    const token = jwt.sign(
        { key: keyData.value, appId, hwid },
        JWT_SECRET,
        { expiresIn: '1h' }
    );

    res.json({
        success: true,
        token: token,
        app: {
            name: app.name,
            version: app.version,
            downloadUrl: app.downloadUrl
        }
    });
});

app.post("/api/apps", authenticateToken, requireRole('admin'), (req, res) => {
    const { name, version, ownerId, downloadUrl } = req.body;
    const db = loadDatabase();

    const app = {
        id: generateAppId(),
        name,
        version,
        ownerId,
        downloadUrl,
        enabled: true,
        createdAt: new Date().toISOString(),
        createdBy: req.user.userId
    };

    db.apps.push(app);
    saveDatabase(db);

    res.json({ success: true, app });
});

app.get("/api/apps", authenticateToken, (req, res) => {
    const db = loadDatabase();
    let apps = db.apps;

    if (req.user.role !== 'admin') {
        apps = apps.filter(app => app.ownerId === req.user.userId);
    }

    res.json({ success: true, apps });
});

app.post("/api/keys/generate", authenticateToken, (req, res) => {
    const { appId, duration, maxActivations = 1, note } = req.body;
    const db = loadDatabase();

    if (req.user.role === 'reseller') {
        const userKeys = db.keys.filter(k => k.createdBy === req.user.userId);
        if (userKeys.length >= db.settings.maxKeysPerReseller) {
            return res.json({ success: false, message: "Key limit reached" });
        }

        if (!duration || duration > 2592000000) {
            return res.json({ success: false, message: "Invalid duration for reseller" });
        }
    }

    const app = db.apps.find(a => a.id === appId);
    if (!app) {
        return res.json({ success: false, message: "Application not found" });
    }

    const key = {
        value: generateKey(),
        appId,
        appName: app.name,
        banned: false,
        expiresAt: duration ? new Date(Date.now() + duration).toISOString() : null,
        createdAt: new Date().toISOString(),
        createdBy: req.user.userId,
        creatorRole: req.user.role,
        hwid: null,
        activations: 0,
        maxActivations,
        lastActivation: null,
        lastUsed: null,
        note: note || ""
    };

    db.keys.push(key);
    saveDatabase(db);

    res.json({ success: true, key });
});

app.get("/api/keys", authenticateToken, (req, res) => {
    const db = loadDatabase();
    let keys = db.keys;

    if (req.user.role !== 'admin') {
        keys = keys.filter(key => key.createdBy === req.user.userId);
    }

    res.json({ success: true, keys });
});

app.get("/api/stats", authenticateToken, (req, res) => {
    const db = loadDatabase();

    const stats = {
        totalApps: db.apps.length,
        totalKeys: db.keys.length,
        totalUsers: db.users.length,
        activeKeys: db.keys.filter(k => !k.banned && (!k.expiresAt || new Date(k.expiresAt) > new Date())).length,
        bannedKeys: db.keys.filter(k => k.banned).length,
        expiredKeys: db.keys.filter(k => !k.banned && k.expiresAt && new Date(k.expiresAt) < new Date()).length,
        resellerKeys: db.keys.filter(k => k.creatorRole === 'reseller').length
    };

    res.json({ success: true, stats });
});

app.post("/api/users/promote", authenticateToken, requireRole('admin'), (req, res) => {
    const { userId, role } = req.body;
    const db = loadDatabase();

    const user = db.users.find(u => u.id === userId);
    if (!user) {
        return res.json({ success: false, message: "User not found" });
    }

    user.role = role;
    saveDatabase(db);

    res.json({ success: true, message: "User role updated" });
});

app.listen(PORT, () => {
    console.log(`🚀 Eclipse Panel v2.0 running on port ${PORT}`);
    console.log(`🔐 JWT Secret: ${JWT_SECRET.substring(0, 10)}...`);
    console.log(`📊 API endpoints available at http://localhost:${PORT}/api`);
});
