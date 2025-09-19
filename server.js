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
  if (!fs.existsSync(dbFile)) fs.writeFileSync(dbFile, JSON.stringify([]));
  return JSON.parse(fs.readFileSync(dbFile, "utf-8"));
}

function saveKeys(keys) {
  fs.writeFileSync(dbFile, JSON.stringify(keys, null, 2));
}

function generateKey(durationMs) {
  return {
    value: "ECLIPSE-" + Math.random().toString(36).substring(2, 10).toUpperCase() + 
           "-" + Math.random().toString(36).substring(2, 10).toUpperCase() + 
           "-" + Math.random().toString(36).substring(2, 10).toUpperCase(),
    banned: false,
    expiresAt: durationMs ? new Date(Date.now() + durationMs).toISOString() : null,
    createdAt: new Date().toISOString()
  };
}

// Login для админа
app.post("/api/login", (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    return res.json({ success: true });
  }
  res.json({ success: false, message: "Wrong password" });
});

// Получить все ключи
app.get("/api/keys", (req, res) => {
  res.json(loadKeys());
});

// Создать новый ключ
app.post("/api/keys", (req, res) => {
  const { durationMs } = req.body;
  const keys = loadKeys();
  const key = generateKey(durationMs);
  keys.push(key);
  saveKeys(keys);
  res.json(key);
});

// Забанить ключ
app.post("/api/ban", (req, res) => {
  const { value } = req.body;
  let keys = loadKeys();
  keys = keys.map((k) => (k.value === value ? { ...k, banned: true } : k));
  saveKeys(keys);
  res.json({ success: true });
});

// Разбанить ключ
app.post("/api/unban", (req, res) => {
  const { value } = req.body;
  let keys = loadKeys();
  keys = keys.map((k) => (k.value === value ? { ...k, banned: false } : k));
  saveKeys(keys);
  res.json({ success: true });
});

// Удалить ключ
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

// Массовое удаление ключей
app.post("/api/keys/delete-bulk", (req, res) => {
  const { keysToDelete } = req.body;
  let keys = loadKeys();
  const initialLength = keys.length;
  keys = keys.filter(k => !keysToDelete.includes(k.value));
  
  saveKeys(keys);
  res.json({ 
    success: true, 
    message: `Deleted ${initialLength - keys.length} keys`,
    deletedCount: initialLength - keys.length
  });
});

// Получить статистику
app.get("/api/stats", (req, res) => {
  const keys = loadKeys();
  const totalKeys = keys.length;
  const activeKeys = keys.filter(k => !k.banned && (!k.expiresAt || new Date(k.expiresAt) > new Date())).length;
  const bannedKeys = keys.filter(k => k.banned).length;
  const expiredKeys = keys.filter(k => !k.banned && k.expiresAt && new Date(k.expiresAt) < new Date()).length;

  res.json({
    totalKeys,
    activeKeys,
    bannedKeys,
    expiredKeys
  });
});

// Проверка ключа
app.post("/api/check", (req, res) => {
  const { value } = req.body;
  const keys = loadKeys();
  const key = keys.find((k) => k.value === value);
  
  if (!key) return res.json({ valid: false, reason: "not_found" });
  if (key.banned) return res.json({ valid: false, reason: "banned" });
  if (key.expiresAt && new Date(key.expiresAt) < new Date())
    return res.json({ valid: false, reason: "expired" });
  
  res.json({ 
    valid: true, 
    expiresAt: key.expiresAt,
    createdAt: key.createdAt
  });
});

// Получить информацию о ключе
app.get("/api/keys/:value", (req, res) => {
  const { value } = req.params;
  const keys = loadKeys();
  const key = keys.find((k) => k.value === value);
  
  if (!key) return res.status(404).json({ error: "Key not found" });
  
  res.json(key);
});

// Обновить ключ
app.put("/api/keys/:value", (req, res) => {
  const { value } = req.params;
  const { banned, expiresAt } = req.body;
  let keys = loadKeys();
  let keyFound = false;
  
  keys = keys.map(k => {
    if (k.value === value) {
      keyFound = true;
      return { 
        ...k, 
        ...(banned !== undefined && { banned }),
        ...(expiresAt && { expiresAt: new Date(expiresAt).toISOString() })
      };
    }
    return k;
  });
  
  if (keyFound) {
    saveKeys(keys);
    res.json({ success: true, message: "Key updated successfully" });
  } else {
    res.status(404).json({ success: false, message: "Key not found" });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "OK", 
    timestamp: new Date().toISOString(),
    version: "1.0.0"
  });
});

// Получить настройки
app.get("/api/settings", (req, res) => {
  res.json({
    maxKeyLength: 100,
    allowedDurations: ["hour", "day", "week", "month", "year"],
    maxKeysPerRequest: 10
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Eclipse Panel running on port ${PORT}`);
  console.log(`📊 Admin password: ${ADMIN_PASSWORD}`);
  console.log(`🔑 API endpoints available at http://localhost:${PORT}/api`);
});
