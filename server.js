const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const crypto = require("crypto");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

app.use(cors());
app.use(express.json());
app.use(express.static("public"));
app.use("/screenshots", express.static("screenshots"));

const dbFile = path.join(__dirname, "keys.json");
const screenshotsDir = path.join(__dirname, "screenshots");

if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir);
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, screenshotsDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'screenshot-' + uniqueSuffix + '.jpg');
    }
});

const upload = multer({ storage: storage });

function loadKeys() {
    if (!fs.existsSync(dbFile)) fs.writeFileSync(dbFile, JSON.stringify([]));
    return JSON.parse(fs.readFileSync(dbFile, "utf-8"));
}

function saveKeys(keys) {
    fs.writeFileSync(dbFile, JSON.stringify(keys, null, 2));
}

function generateStableHWID() {
    const components = [];
    
    try {
        const cpuInfo = getCPUInfo();
        if (cpuInfo) components.push(cpuInfo);
    } catch (e) {}
    
    try {
        const diskSerial = getDiskSerial();
        if (diskSerial) components.push(diskSerial);
    } catch (e) {}
    
    try {
        const macAddress = getMACAddress();
        if (macAddress) components.push(macAddress);
    } catch (e) {}
    
    try {
        const motherboardInfo = getMotherboardInfo();
        if (motherboardInfo) components.push(motherboardInfo);
    } catch (e) {}
    
    if (components.length === 0) {
        components.push(Math.random().toString(36).substring(2, 15));
    }
    
    const hwidString = components.join("-");
    return crypto.createHash('sha256').update(hwidString).digest('hex').substring(0, 32);
}

function generateKey(durationMs) {
    return {
        value: "ECL-" + Math.random().toString(36).substring(2, 8).toUpperCase() + 
               Math.random().toString(36).substring(2, 8).toUpperCase(),
        banned: false,
        expiresAt: durationMs ? new Date(Date.now() + durationMs).toISOString() : null,
        createdAt: new Date().toISOString(),
        hwidLocked: true,
        maxHwid: 1,
        hwids: [],
        usedCount: 0,
        lastUsed: null
    };
}

app.post("/api/login", (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        return res.json({ success: true });
    }
    res.json({ success: false, message: "Wrong password" });
});

app.get("/api/keys", (req, res) => {
    res.json(loadKeys());
});

app.post("/api/keys", (req, res) => {
    const { durationMs } = req.body;
    const keys = loadKeys();
    const key = generateKey(durationMs);
    keys.push(key);
    saveKeys(keys);
    res.json(key);
});

app.post("/api/ban", (req, res) => {
    const { value } = req.body;
    let keys = loadKeys();
    keys = keys.map((k) => (k.value === value ? { ...k, banned: true } : k));
    saveKeys(keys);
    res.json({ success: true });
});

app.post("/api/unban", (req, res) => {
    const { value } = req.body;
    let keys = loadKeys();
    keys = keys.map((k) => (k.value === value ? { ...k, banned: false } : k));
    saveKeys(keys);
    res.json({ success: true });
});

app.post("/api/keys/delete", (req, res) => {
    const { value } = req.body;
    let keys = loadKeys();
    const initialLength = keys.length;
    keys = keys.filter(k => k.value !== value);
    
    if (keys.length < initialLength) {
        saveKeys(keys);
        res.json({ success: true, message: "Key deleted successfully" });
    } else {
        res.status(404).json({ success: false, message: "Key not found" });
    }
});

app.post("/api/hwid/check", (req, res) => {
    const { value, hwid } = req.body;
    const keys = loadKeys();
    const key = keys.find((k) => k.value === value);
    
    if (!key) return res.json({ valid: false, reason: "not_found" });
    if (key.banned) return res.json({ valid: false, reason: "banned" });
    if (key.expiresAt && new Date(key.expiresAt) < new Date())
        return res.json({ valid: false, reason: "expired" });
    
    const keyIndex = keys.findIndex(k => k.value === value);
    
    if (key.hwidLocked) {
        if (key.hwids.length === 0) {
            keys[keyIndex].hwids.push(hwid);
            keys[keyIndex].usedCount += 1;
            keys[keyIndex].lastUsed = new Date().toISOString();
            saveKeys(keys);
            return res.json({ valid: true, firstTime: true });
        }
        
        if (!key.hwids.includes(hwid)) {
            return res.json({ valid: false, reason: "hwid_mismatch" });
        }
    }
    
    keys[keyIndex].usedCount += 1;
    keys[keyIndex].lastUsed = new Date().toISOString();
    saveKeys(keys);
    
    res.json({ 
        valid: true, 
        expiresAt: key.expiresAt,
        createdAt: key.createdAt,
        firstTime: false
    });
});

app.post("/api/hwid/manage", (req, res) => {
    const { value, action, hwid } = req.body;
    const keys = loadKeys();
    const keyIndex = keys.findIndex((k) => k.value === value);
    
    if (keyIndex === -1) {
        return res.status(404).json({ success: false, message: "Key not found" });
    }
    
    if (action === "add") {
        if (keys[keyIndex].hwids.length >= keys[keyIndex].maxHwid) {
            return res.json({ success: false, message: "HWID limit reached" });
        }
        
        if (!keys[keyIndex].hwids.includes(hwid)) {
            keys[keyIndex].hwids.push(hwid);
        }
    } else if (action === "remove") {
        keys[keyIndex].hwids = keys[keyIndex].hwids.filter(h => h !== hwid);
    } else if (action === "clear") {
        keys[keyIndex].hwids = [];
    } else if (action === "toggle-lock") {
        keys[keyIndex].hwidLocked = !keys[keyIndex].hwidLocked;
    } else if (action === "set-limit") {
        keys[keyIndex].maxHwid = parseInt(hwid) || 1;
    }
    
    saveKeys(keys);
    res.json({ success: true, key: keys[keyIndex] });
});

app.post("/api/screenshot", upload.single('screenshot'), (req, res) => {
    const { key, hwid } = req.body;
    
    if (!req.file) {
        return res.status(400).json({ success: false, message: "No screenshot uploaded" });
    }
    
    const keys = loadKeys();
    const keyIndex = keys.findIndex(k => k.value === key);
    
    if (keyIndex !== -1) {
        if (!keys[keyIndex].screenshots) {
            keys[keyIndex].screenshots = [];
        }
        
        keys[keyIndex].screenshots.push({
            filename: req.file.filename,
            hwid: hwid,
            timestamp: new Date().toISOString()
        });
        
        saveKeys(keys);
    }
    
    res.json({ success: true, filename: req.file.filename });
});

app.get("/api/screenshots/:key", (req, res) => {
    const { key } = req.params;
    const keys = loadKeys();
    const keyData = keys.find(k => k.value === key);
    
    if (!keyData || !keyData.screenshots) {
        return res.json([]);
    }
    
    res.json(keyData.screenshots);
});

app.get("/api/stats", (req, res) => {
    const keys = loadKeys();
    const totalKeys = keys.length;
    const activeKeys = keys.filter(k => !k.banned && (!k.expiresAt || new Date(k.expiresAt) > new Date())).length;
    const bannedKeys = keys.filter(k => k.banned).length;
    const expiredKeys = keys.filter(k => !k.banned && k.expiresAt && new Date(k.expiresAt) < new Date()).length;
    const usedKeys = keys.filter(k => k.usedCount > 0).length;

    res.json({
        totalKeys,
        activeKeys,
        bannedKeys,
        expiredKeys,
        usedKeys
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Eclipse Panel running on port ${PORT}`);
    console.log(`📊 Admin password: ${ADMIN_PASSWORD}`);
    console.log(`🔑 API endpoints available at http://localhost:${PORT}/api`);
    console.log(`🔒 HWID protection system activated`);
});
