const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const crypto = require("crypto");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

// Middleware безопасности
app.use(helmet());
app.use(compression());
app.use(morgan("combined"));
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Лимит запросов
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP"
});
app.use(limiter);

app.use(express.static("public"));

const dbFile = path.join(__dirname, "keys.json");
const logsFile = path.join(__dirname, "logs.json");

// Загрузка ключей
function loadKeys() {
  try {
    if (!fs.existsSync(dbFile)) {
      fs.writeFileSync(dbFile, JSON.stringify([]));
      return [];
    }
    const data = fs.readFileSync(dbFile, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error loading keys:", error);
    return [];
  }
}

function saveKeys(keys) {
  try {
    fs.writeFileSync(dbFile, JSON.stringify(keys, null, 2));
  } catch (error) {
    console.error("Error saving keys:", error);
  }
}

function logAction(action, data = {}) {
  try {
    let logs = [];
    if (fs.existsSync(logsFile)) {
      const logsData = fs.readFileSync(logsFile, "utf-8");
      logs = JSON.parse(logsData);
    }
    
    logs.unshift({
      timestamp: new Date().toISOString(),
      action,
      ...data
    });
    
    // Сохраняем только последние 1000 записей
    if (logs.length > 1000) {
      logs = logs.slice(0, 1000);
    }
    
    fs.writeFileSync(logsFile, JSON.stringify(logs, null, 2));
  } catch (error) {
    console.error("Error logging action:", error);
  }
}

function generateKey(durationMs) {
  return {
    value: "ECLIPSE-" + crypto.randomBytes(12).toString('hex').toUpperCase().match(/.{1,4}/g).join('-'),
    banned: false,
    expiresAt: durationMs ? new Date(Date.now() + durationMs).toISOString() : null,
    createdAt: new Date().toISOString(),
    hwid: null,
    hwidLocked: false,
    usageCount: 0
  };
}

// Login для админа
app.post("/api/login", (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    logAction("admin_login", { success: true });
    return res.json({ success: true });
  }
  logAction("admin_login", { success: false, reason: "wrong_password" });
  res.json({ success: false, message: "Wrong password" });
});

// Получить все ключи
app.get("/api/keys", (req, res) => {
  try {
    const keys = loadKeys();
    res.json(keys);
  } catch (error) {
    res.status(500).json({ error: "Failed to load keys" });
  }
});

// Создать новый ключ
app.post("/api/keys", (req, res) => {
  try {
    const { durationMs } = req.body;
    const keys = loadKeys();
    const key = generateKey(durationMs);
    keys.push(key);
    saveKeys(keys);
    logAction("key_generated", { key: key.value, durationMs });
    res.json(key);
  } catch (error) {
    res.status(500).json({ error: "Failed to generate key" });
  }
});

// Забанить ключ
app.post("/api/ban", (req, res) => {
  try {
    const { value } = req.body;
    let keys = loadKeys();
    let updated = false;
    
    keys = keys.map((k) => {
      if (k.value === value) {
        updated = true;
        return { ...k, banned: true };
      }
      return k;
    });
    
    if (updated) {
      saveKeys(keys);
      logAction("key_banned", { key: value });
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, message: "Key not found" });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to ban key" });
  }
});

// Разбанить ключ
app.post("/api/unban", (req, res) => {
  try {
    const { value } = req.body;
    let keys = loadKeys();
    let updated = false;
    
    keys = keys.map((k) => {
      if (k.value === value) {
        updated = true;
        return { ...k, banned: false };
      }
      return k;
    });
    
    if (updated) {
      saveKeys(keys);
      logAction("key_unbanned", { key: value });
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, message: "Key not found" });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to unban key" });
  }
});

// Удалить ключ
app.post("/api/keys/delete", (req, res) => {
  try {
    const { value } = req.body;
    let keys = loadKeys();
    const initialLength = keys.length;
    keys = keys.filter(k => k.value !== value);
    
    if (keys.length < initialLength) {
      saveKeys(keys);
      logAction("key_deleted", { key: value });
      res.json({ success: true, message: "Key deleted successfully" });
    } else {
      res.status(404).json({ success: false, message: "Key not found" });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to delete key" });
  }
});

// Переключить HWID блокировку
app.post("/api/toggle-hwid", (req, res) => {
  try {
    const { value } = req.body;
    let keys = loadKeys();
    let keyFound = false;
    
    keys = keys.map(k => {
      if (k.value === value) {
        keyFound = true;
        return { 
          ...k, 
          hwidLocked: !k.hwidLocked,
          hwid: k.hwidLocked ? null : k.hwid
        };
      }
      return k;
    });
    
    if (keyFound) {
      saveKeys(keys);
      const key = keys.find(k => k.value === value);
      logAction("hwid_toggled", { key: value, hwidLocked: key.hwidLocked });
      res.json({ 
        success: true, 
        hwidLocked: key.hwidLocked 
      });
    } else {
      res.status(404).json({ success: false, message: "Key not found" });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to toggle HWID lock" });
  }
});

// Получить статистику
app.get("/api/stats", (req, res) => {
  try {
    const keys = loadKeys();
    const totalKeys = keys.length;
    const activeKeys = keys.filter(k => !k.banned && (!k.expiresAt || new Date(k.expiresAt) > new Date())).length;
    const bannedKeys = keys.filter(k => k.banned).length;
    const expiredKeys = keys.filter(k => !k.banned && k.expiresAt && new Date(k.expiresAt) < new Date()).length;
    const hwidLockedKeys = keys.filter(k => k.hwidLocked).length;

    res.json({
      totalKeys,
      activeKeys,
      bannedKeys,
      expiredKeys,
      hwidLockedKeys
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to load stats" });
  }
});

// Проверка ключа с HWID
app.post("/api/check", (req, res) => {
  try {
    const { value, hwid } = req.body;
    const keys = loadKeys();
    const key = keys.find((k) => k.value === value);
    
    if (!key) {
      logAction("key_check", { key: value, valid: false, reason: "not_found" });
      return res.json({ valid: false, reason: "not_found" });
    }
    
    if (key.banned) {
      logAction("key_check", { key: value, valid: false, reason: "banned" });
      return res.json({ valid: false, reason: "banned" });
    }
    
    if (key.expiresAt && new Date(key.expiresAt) < new Date()) {
      logAction("key_check", { key: value, valid: false, reason: "expired" });
      return res.json({ valid: false, reason: "expired" });
    }
    
    if (key.hwidLocked) {
      if (!key.hwid) {
        // Первое использование - регистрируем HWID
        keys.forEach(k => {
          if (k.value === value) {
            k.hwid = hwid;
            k.usageCount = (k.usageCount || 0) + 1;
          }
        });
        saveKeys(keys);
        logAction("key_check", { key: value, valid: true, hwidRegistered: true, hwid });
        return res.json({ 
          valid: true, 
          expiresAt: key.expiresAt,
          createdAt: key.createdAt,
          hwidRegistered: true
        });
      } else if (key.hwid !== hwid) {
        logAction("key_check", { key: value, valid: false, reason: "hwid_mismatch", expected: key.hwid, received: hwid });
        return res.json({ valid: false, reason: "hwid_mismatch" });
      }
    }
    
    // Увеличиваем счетчик использования
    keys.forEach(k => {
      if (k.value === value) {
        k.usageCount = (k.usageCount || 0) + 1;
        k.lastUsed = new Date().toISOString();
      }
    });
    saveKeys(keys);
    
    logAction("key_check", { key: value, valid: true, usageCount: key.usageCount });
    res.json({ 
      valid: true, 
      expiresAt: key.expiresAt,
      createdAt: key.createdAt,
      usageCount: key.usageCount
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to check key" });
  }
});

// Получить логи
app.get("/api/logs", (req, res) => {
  try {
    if (!fs.existsSync(logsFile)) {
      return res.json([]);
    }
    const logsData = fs.readFileSync(logsFile, "utf-8");
    const logs = JSON.parse(logsData);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: "Failed to load logs" });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "OK", 
    timestamp: new Date().toISOString(),
    version: "1.3.0",
    uptime: process.uptime()
  });
});

// Обработка 404
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// Обработка ошибок
app.use((error, req, res, next) => {
  console.error("Server error:", error);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`🚀 Eclipse Panel running on port ${PORT}`);
  console.log(`📊 Admin password: ${ADMIN_PASSWORD}`);
  console.log(`🔑 API endpoints available at http://localhost:${PORT}/api`);
  
  // Создаем необходимые файлы при запуске
  if (!fs.existsSync(dbFile)) {
    fs.writeFileSync(dbFile, JSON.stringify([]));
  }
  if (!fs.existsSync(logsFile)) {
    fs.writeFileSync(logsFile, JSON.stringify([]));
  }
});
