import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import { fileURLToPath } from "url";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "your-google-client-id";

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static("public"));

const dbFile = path.join(__dirname, "database.json");

const defaultDatabase = {
    apps: [],
    users: [
        {
            id: "admin",
            email: "admin@eclipse.com",
            password: "$2a$10$8S6Y6Q7Q6Q7Q6Q7Q6Q7Q6O.Q6Q7Q6Q7Q6Q7Q6Q7Q6Q7Q6Q7Q6Q7Q6", // admin123
            name: "Administrator",
            role: "admin",
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString()
        }
    ],
    keys: [],
    settings: {
        maxKeysPerReseller: 100,
        defaultKeyDuration: 2592000000,
        googleAuthEnabled: true
    },
    version: "3.0"
};

function loadDatabase() {
    if (!fs.existsSync(dbFile)) {
        const db = defaultDatabase;
        fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
        console.log("📁 New database created with default admin user");
        console.log("🔑 Default admin: admin@eclipse.com / admin123");
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
    for (let i = 0; i < 4; i++) {
        segments.push(crypto.randomBytes(3).toString('hex').toUpperCase());
    }
    return "ECL-" + segments.join("-");
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

// Google OAuth Login
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
                role: 'reseller',
                createdAt: new Date().toISOString(),
                lastLogin: new Date().toISOString(),
                googleId: payload.sub
            };
            db.users.push(user);
            console.log(`👤 New user created via Google: ${payload.email}`);
        } else {
            user.lastLogin = new Date().toISOString();
            user.picture = payload.picture;
        }

        const jwtToken = jwt.sign(
            { 
                userId: user.id, 
                email: user.email, 
                name: user.name,
                role: user.role,
                picture: user.picture 
            },
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
        console.error("Google auth error:", error);
        res.status(401).json({ success: false, message: "Google authentication failed" });
    }
});

// Email/Password Login
app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    const db = loadDatabase();

    const user = db.users.find(u => u.email === email);
    if (!user) {
        return res.json({ success: false, message: "Invalid credentials" });
    }

    if (!user.password) {
        return res.json({ success: false, message: "Please use Google login" });
    }

    try {
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.json({ success: false, message: "Invalid credentials" });
        }

        user.lastLogin = new Date().toISOString();
        saveDatabase(db);

        const token = jwt.sign(
            { 
                userId: user.id, 
                email: user.email, 
                name: user.name,
                role: user.role 
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            token: token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            }
        });
    } catch (error) {
        res.json({ success: false, message: "Login failed" });
    }
});

// Key Authentication (for loaders)
app.post("/api/auth/key", (req, res) => {
    const { key, hwid, appId } = req.body;
    const db = loadDatabase();

    const app = db.apps.find(a => a.id === appId);
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

// Applications Management
app.post("/api/apps", authenticateToken, requireRole('admin'), (req, res) => {
    const { name, version, downloadUrl } = req.body;
    const db = loadDatabase();

    const app = {
        id: generateAppId(),
        name,
        version: version || "1.0.0",
        downloadUrl,
        ownerId: req.user.userId,
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

app.put("/api/apps/:id", authenticateToken, (req, res) => {
    const { id } = req.params;
    const { enabled } = req.body;
    const db = loadDatabase();

    const app = db.apps.find(a => a.id === id);
    if (!app) {
        return res.json({ success: false, message: "App not found" });
    }

    if (req.user.role !== 'admin' && app.ownerId !== req.user.userId) {
        return res.status(403).json({ success: false, message: "Access denied" });
    }

    app.enabled = enabled;
    app.updatedAt = new Date().toISOString();
    saveDatabase(db);

    res.json({ success: true, app });
});

// Key Generation
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

app.post("/api/keys/:id/ban", authenticateToken, (req, res) => {
    const { id } = req.params;
    const db = loadDatabase();

    const key = db.keys.find(k => k.value === id);
    if (!key) {
        return res.json({ success: false, message: "Key not found" });
    }

    if (req.user.role !== 'admin' && key.createdBy !== req.user.userId) {
        return res.status(403).json({ success: false, message: "Access denied" });
    }

    key.banned = true;
    key.updatedAt = new Date().toISOString();
    saveDatabase(db);

    res.json({ success: true, message: "Key banned" });
});

// Users Management
app.get("/api/users", authenticateToken, requireRole('admin'), (req, res) => {
    const db = loadDatabase();
    const users = db.users.map(user => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        picture: user.picture
    }));

    res.json({ success: true, users });
});

app.post("/api/users/promote", authenticateToken, requireRole('admin'), (req, res) => {
    const { userId, role } = req.body;
    const db = loadDatabase();

    const user = db.users.find(u => u.id === userId);
    if (!user) {
        return res.json({ success: false, message: "User not found" });
    }

    user.role = role;
    user.updatedAt = new Date().toISOString();
    saveDatabase(db);

    res.json({ success: true, message: "User role updated" });
});

// Statistics
app.get("/api/stats", authenticateToken, (req, res) => {
    const db = loadDatabase();

    let keys = db.keys;
    let apps = db.apps;

    if (req.user.role !== 'admin') {
        keys = keys.filter(k => k.createdBy === req.user.userId);
        apps = apps.filter(a => a.ownerId === req.user.userId);
    }

    const stats = {
        totalApps: apps.length,
        totalKeys: keys.length,
        totalUsers: db.users.length,
        activeKeys: keys.filter(k => !k.banned && (!k.expiresAt || new Date(k.expiresAt) > new Date())).length,
        bannedKeys: keys.filter(k => k.banned).length,
        expiredKeys: keys.filter(k => !k.banned && k.expiresAt && new Date(k.expiresAt) < new Date()).length,
        resellerKeys: keys.filter(k => k.creatorRole === 'reseller').length,
        todayActivations: keys.filter(k => k.lastUsed && new Date(k.lastUsed).toDateString() === new Date().toDateString()).length
    };

    res.json({ success: true, stats });
});

// Settings
app.get("/api/settings", authenticateToken, requireRole('admin'), (req, res) => {
    const db = loadDatabase();
    res.json({ success: true, settings: db.settings });
});

app.put("/api/settings", authenticateToken, requireRole('admin'), (req, res) => {
    const { settings } = req.body;
    const db = loadDatabase();

    db.settings = { ...db.settings, ...settings };
    saveDatabase(db);

    res.json({ success: true, message: "Settings updated" });
});

// Serve admin panel
app.get("/admin", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.get("/", (req, res) => {
    res.redirect("/admin");
});

app.listen(PORT, () => {
    console.log(`🚀 Eclipse Panel v3.0 running on port ${PORT}`);
    console.log(`🔐 Google Auth: ${GOOGLE_CLIENT_ID ? "Enabled" : "Disabled"}`);
    console.log(`📊 Admin panel: http://localhost:${PORT}`);
});

export default app;
