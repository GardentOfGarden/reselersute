const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const dbFile = path.join(__dirname, "keys.json");

// Загрузка ключей
function loadKeys() {
    if (!fs.existsSync(dbFile)) {
        fs.writeFileSync(dbFile, JSON.stringify([]));
        return [];
    }
    try {
        return JSON.parse(fs.readFileSync(dbFile, "utf-8"));
    } catch {
        return [];
    }
}

// Сохранение ключей
function saveKeys(keys) {
    fs.writeFileSync(dbFile, JSON.stringify(keys, null, 2));
}

// Генерация ключа
function generateKey() {
    return 'ECLIPSE-' + 
           Math.random().toString(36).substring(2, 10).toUpperCase() + 
           '-' + 
           Math.random().toString(36).substring(2, 10).toUpperCase() + 
           '-' + 
           Math.random().toString(36).substring(2, 10).toUpperCase();
}

// API Routes
app.post("/api/login", (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        res.json({ success: true });
    } else {
        res.json({ success: false, message: "Invalid password" });
    }
});

app.get("/api/keys", (req, res) => {
    res.json(loadKeys());
});

app.post("/api/keys", (req, res) => {
    const { duration, unit } = req.body;
    
    const multipliers = {
        seconds: 1000,
        minutes: 60000,
        hours: 3600000,
        days: 86400000,
        weeks: 604800000,
        months: 2592000000,
        years: 31536000000
    };
    
    const durationMs = duration * multipliers[unit];
    const expiresAt = new Date(Date.now() + durationMs);
    
    const newKey = {
        id: Date.now(),
        key: generateKey(),
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
        status: "active",
        duration: `${duration} ${unit}`,
        banned: false
    };
    
    const keys = loadKeys();
    keys.push(newKey);
    saveKeys(keys);
    
    res.json({ success: true, key: newKey });
});

app.post("/api/keys/:id/ban", (req, res) => {
    const { id } = req.params;
    const keys = loadKeys();
    const updatedKeys = keys.map(key => 
        key.id === parseInt(id) ? { ...key, banned: true, status: "banned" } : key
    );
    
    saveKeys(updatedKeys);
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`🚀 Eclipse Panel running on port ${PORT}`);
});
