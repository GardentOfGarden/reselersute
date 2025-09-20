const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const crypto = require("crypto");
const multer = require("multer");
const { exec } = require("child_process");

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
    fs.mkdirSync(screenshotsDir, { recursive: true });
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

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

function loadKeys() {
    if (!fs.existsSync(dbFile)) {
        fs.writeFileSync(dbFile, JSON.stringify([]));
        return [];
    }
    try {
        return JSON.parse(fs.readFileSync(dbFile, "utf-8"));
    } catch (error) {
        console.error("Error loading keys:", error);
        return [];
    }
}

function saveKeys(keys) {
    try {
        fs.writeFileSync(dbFile, JSON.stringify(keys, null, 2));
        return true;
    } catch (error) {
        console.error("Error saving keys:", error);
        return false;
    }
}

function generateKey(durationMs) {
    const timestamp = Date.now();
    const randomPart = Math.random().toString(36).substring(2, 10).toUpperCase();
    return {
        value: `ECL-${timestamp.toString(36).toUpperCase()}-${randomPart}`,
        banned: false,
        expiresAt: durationMs ? new Date(Date.now() + durationMs).toISOString() : null,
        createdAt: new Date().toISOString(),
        hwidLocked: true,
        maxHwid: 1,
        hwids: [],
        usedCount: 0,
        lastUsed: null,
        screenshots: []
    };
}

app.post("/api/login", (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        return res.json({ success: true, message: "Login successful" });
    }
    res.status(401).json({ success: false, message: "Wrong password" });
});

app.get("/api/keys", (req, res) => {
    try {
        const keys = loadKeys();
        res.json(keys);
    } catch (error) {
        res.status(500).json({ error: "Failed to load keys" });
    }
});

app.get("/api/keys/:value", (req, res) => {
    try {
        const { value } = req.params;
        const keys = loadKeys();
        const key = keys.find(k => k.value === value);
        
        if (!key) {
            return res.status(404).json({ error: "Key not found" });
        }
        
        res.json(key);
    } catch (error) {
        res.status(500).json({ error: "Failed to load key" });
    }
});

app.post("/api/keys", (req, res) => {
    try {
        const { durationMs, maxHwid = 1 } = req.body;
        const keys = loadKeys();
        const key = generateKey(durationMs);
        key.maxHwid = parseInt(maxHwid) || 1;
        
        keys.push(key);
        if (saveKeys(keys)) {
            res.json(key);
        } else {
            res.status(500).json({ error: "Failed to save key" });
        }
    } catch (error) {
        res.status(500).json({ error: "Failed to generate key" });
    }
});

app.post("/api/ban", (req, res) => {
    try {
        const { value } = req.body;
        const keys = loadKeys();
        const updatedKeys = keys.map(k => 
            k.value === value ? { ...k, banned: true } : k
        );
        
        if (saveKeys(updatedKeys)) {
            res.json({ success: true, message: "Key banned successfully" });
        } else {
            res.status(500).json({ error: "Failed to ban key" });
        }
    } catch (error) {
        res.status(500).json({ error: "Failed to ban key" });
    }
});

app.post("/api/unban", (req, res) => {
    try {
        const { value } = req.body;
        const keys = loadKeys();
        const updatedKeys = keys.map(k => 
            k.value === value ? { ...k, banned: false } : k
        );
        
        if (saveKeys(updatedKeys)) {
            res.json({ success: true, message: "Key unbanned successfully" });
        } else {
            res.status(500).json({ error: "Failed to unban key" });
        }
    } catch (error) {
        res.status(500).json({ error: "Failed to unban key" });
    }
});

app.post("/api/keys/delete", (req, res) => {
    try {
        const { value } = req.body;
        const keys = loadKeys();
        const filteredKeys = keys.filter(k => k.value !== value);
        
        if (saveKeys(filteredKeys)) {
            res.json({ success: true, message: "Key deleted successfully" });
        } else {
            res.status(500).json({ error: "Failed to delete key" });
        }
    } catch (error) {
        res.status(500).json({ error: "Failed to delete key" });
    }
});

app.post("/api/hwid/check", (req, res) => {
    try {
        const { value, hwid } = req.body;
        const keys = loadKeys();
        const keyIndex = keys.findIndex(k => k.value === value);
        
        if (keyIndex === -1) {
            return res.json({ valid: false, reason: "not_found" });
        }
        
        const key = keys[keyIndex];
        
        if (key.banned) {
            return res.json({ valid: false, reason: "banned" });
        }
        
        if (key.expiresAt && new Date(key.expiresAt) < new Date()) {
            return res.json({ valid: false, reason: "expired" });
        }
        
        if (key.hwidLocked) {
            if (key.hwids.length === 0) {
                keys[keyIndex].hwids.push(hwid);
                keys[keyIndex].usedCount += 1;
                keys[keyIndex].lastUsed = new Date().toISOString();
                saveKeys(keys);
                return res.json({ 
                    valid: true, 
                    firstTime: true,
                    message: "HWID registered successfully" 
                });
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
            firstTime: false,
            message: "HWID verification successful" 
        });
    } catch (error) {
        res.status(500).json({ error: "HWID check failed" });
    }
});

app.post("/api/hwid/manage", (req, res) => {
    try {
        const { value, action, hwid } = req.body;
        const keys = loadKeys();
        const keyIndex = keys.findIndex(k => k.value === value);
        
        if (keyIndex === -1) {
            return res.status(404).json({ error: "Key not found" });
        }
        
        switch (action) {
            case "add":
                if (keys[keyIndex].hwids.length >= keys[keyIndex].maxHwid) {
                    return res.json({ error: "HWID limit reached" });
                }
                if (!keys[keyIndex].hwids.includes(hwid)) {
                    keys[keyIndex].hwids.push(hwid);
                }
                break;
                
            case "remove":
                keys[keyIndex].hwids = keys[keyIndex].hwids.filter(h => h !== hwid);
                break;
                
            case "clear":
                keys[keyIndex].hwids = [];
                break;
                
            case "toggle-lock":
                keys[keyIndex].hwidLocked = !keys[keyIndex].hwidLocked;
                break;
                
            case "set-limit":
                keys[keyIndex].maxHwid = parseInt(hwid) || 1;
                break;
                
            default:
                return res.status(400).json({ error: "Invalid action" });
        }
        
        if (saveKeys(keys)) {
            res.json({ success: true, key: keys[keyIndex] });
        } else {
            res.status(500).json({ error: "Failed to update HWID settings" });
        }
    } catch (error) {
        res.status(500).json({ error: "HWID management failed" });
    }
});

app.post("/api/screenshot", upload.single('screenshot'), (req, res) => {
    try {
        const { key, hwid } = req.body;
        
        if (!req.file) {
            return res.status(400).json({ error: "No screenshot uploaded" });
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
                timestamp: new Date().toISOString(),
                url: `/screenshots/${req.file.filename}`
            });
            
            if (saveKeys(keys)) {
                res.json({ 
                    success: true, 
                    filename: req.file.filename,
                    url: `/screenshots/${req.file.filename}`
                });
            } else {
                res.status(500).json({ error: "Failed to save screenshot info" });
            }
        } else {
            res.status(404).json({ error: "Key not found" });
        }
    } catch (error) {
        res.status(500).json({ error: "Screenshot upload failed" });
    }
});

app.get("/api/screenshots/:key", (req, res) => {
    try {
        const { key } = req.params;
        const keys = loadKeys();
        const keyData = keys.find(k => k.value === key);
        
        if (!keyData || !keyData.screenshots) {
            return res.json([]);
        }
        
        res.json(keyData.screenshots);
    } catch (error) {
        res.status(500).json({ error: "Failed to load screenshots" });
    }
});

app.get("/api/stats", (req, res) => {
    try {
        const keys = loadKeys();
        const totalKeys = keys.length;
        const activeKeys = keys.filter(k => !k.banned && (!k.expiresAt || new Date(k.expiresAt) > new Date())).length;
        const bannedKeys = keys.filter(k => k.banned).length;
        const expiredKeys = keys.filter(k => !k.banned && k.expiresAt && new Date(k.expiresAt) < new Date()).length;
        const usedKeys = keys.filter(k => k.usedCount > 0).length;
        const hwidLockedKeys = keys.filter(k => k.hwidLocked).length;

        res.json({
            totalKeys,
            activeKeys,
            bannedKeys,
            expiredKeys,
            usedKeys,
            hwidLockedKeys
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to load statistics" });
    }
});

app.get("/api/health", (req, res) => {
    res.json({ 
        status: "OK", 
        timestamp: new Date().toISOString(),
        version: "2.0.0",
        hwidSystem: "active"
    });
});

app.delete("/api/screenshot/:filename", (req, res) => {
    try {
        const { filename } = req.params;
        const filePath = path.join(screenshotsDir, filename);
        
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            res.json({ success: true, message: "Screenshot deleted" });
        } else {
            res.status(404).json({ error: "File not found" });
        }
    } catch (error) {
        res.status(500).json({ error: "Failed to delete screenshot" });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Eclipse Panel running on port ${PORT}`);
    console.log(`📊 Admin password: ${ADMIN_PASSWORD}`);
    console.log(`🔑 API endpoints available at http://localhost:${PORT}/api`);
    console.log(`🔒 HWID protection system activated`);
    console.log(`📸 Screenshots directory: ${screenshotsDir}`);
});
