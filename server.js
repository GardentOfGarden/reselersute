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
    try {
        if (fs.existsSync(dbFile)) {
            const data = fs.readFileSync(dbFile, "utf-8");
            return JSON.parse(data);
        }
    } catch (error) {
        console.error("Error loading keys:", error);
    }
    return [];
}

// Сохранение ключей
function saveKeys(keys) {
    try {
        fs.writeFileSync(dbFile, JSON.stringify(keys, null, 2));
    } catch (error) {
        console.error("Error saving keys:", error);
    }
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

// Конвертация в миллисекунды
function convertToMs(duration, unit) {
    const multipliers = {
        seconds: 1000,
        minutes: 60000,
        hours: 3600000,
        days: 86400000,
        weeks: 604800000,
        months: 2592000000,
        years: 31536000000
    };
    return duration * multipliers[unit];
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
    const keys = loadKeys();
    res.json(keys);
});

app.post("/api/keys", (req, res) => {
    try {
        const { duration, unit } = req.body;
        
        if (!duration || !unit) {
            return res.status(400).json({ success: false, message: "Duration and unit are required" });
        }

        const durationMs = convertToMs(parseInt(duration), unit);
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
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error" });
    }
});

app.post("/api/keys/:id/ban", (req, res) => {
    try {
        const { id } = req.params;
        const keys = loadKeys();
        const keyId = parseInt(id);
        
        const updatedKeys = keys.map(key => 
            key.id === keyId ? { ...key, banned: true, status: "banned" } : key
        );
        
        saveKeys(updatedKeys);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// Новый endpoint для проверки ключей
app.post("/api/keys/check", (req, res) => {
    const { key } = req.body;
    const keys = loadKeys();
    const foundKey = keys.find(k => k.key === key);
    
    if (!foundKey) {
        return res.json({ valid: false, reason: "not_found" });
    }
    
    if (foundKey.banned) {
        return res.json({ valid: false, reason: "banned" });
    }
    
    if (new Date(foundKey.expiresAt) < new Date()) {
        return res.json({ valid: false, reason: "expired" });
    }
    
    res.json({ valid: true, key: foundKey });
});

app.listen(PORT, () => {
    console.log(`🚀 Eclipse Panel running on port ${PORT}`);
    // Создаем файл если его нет
    if (!fs.existsSync(dbFile)) {
        saveKeys([]);
    }
});
