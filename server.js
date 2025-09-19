const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const http = require("http");
const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const dbFile = path.join(__dirname, "keys.json");
const logsFile = path.join(__dirname, "logs.json");

// Хранилище активных подключений
const activeConnections = new Map();
const liveSessions = new Map();

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

// Сохранение ключей
function saveKeys(keys) {
  try {
    fs.writeFileSync(dbFile, JSON.stringify(keys, null, 2));
  } catch (error) {
    console.error("Error saving keys:", error);
  }
}

// Загрузка логов
function loadLogs() {
  try {
    if (!fs.existsSync(logsFile)) {
      fs.writeFileSync(logsFile, JSON.stringify([]));
      return [];
    }
    const data = fs.readFileSync(logsFile, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error loading logs:", error);
    return [];
  }
}

// Сохранение логов
function saveLogs(logs) {
  try {
    fs.writeFileSync(logsFile, JSON.stringify(logs, null, 2));
  } catch (error) {
    console.error("Error saving logs:", error);
  }
}

// Генерация ключа
function generateKey(durationMs) {
  return {
    value: "ECLIPSE-" + Math.random().toString(36).substring(2, 10).toUpperCase() + 
           "-" + Math.random().toString(36).substring(2, 10).toUpperCase() + 
           "-" + Math.random().toString(36).substring(2, 10).toUpperCase(),
    banned: false,
    expiresAt: durationMs ? new Date(Date.now() + durationMs).toISOString() : null,
    createdAt: new Date().toISOString(),
    lastUsed: null,
    usageCount: 0
  };
}

// WebSocket обработка
wss.on('connection', (ws) => {
  const connectionId = uuidv4();
  console.log(`New WebSocket connection: ${connectionId}`);
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'register':
          // Регистрация клиента мониторинга
          activeConnections.set(connectionId, {
            ws,
            type: data.clientType,
            userId: data.userId,
            key: data.key
          });
          break;
          
        case 'live_data':
          // Данные от лоадера
          broadcastToAdmins({
            type: 'live_update',
            data: {
              userId: data.userId,
              key: data.key,
              process: data.process,
              memory: data.memory,
              status: data.status,
              timestamp: new Date().toISOString()
            }
          });
          break;
          
        case 'screenshot':
          // Скриншот от лоадера
          broadcastToAdmins({
            type: 'screenshot',
            data: {
              userId: data.userId,
              key: data.key,
              image: data.image,
              timestamp: new Date().toISOString()
            }
          });
          break;
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  });
  
  ws.on('close', () => {
    activeConnections.delete(connectionId);
    console.log(`WebSocket connection closed: ${connectionId}`);
  });
});

// Broadcast to all admin clients
function broadcastToAdmins(data) {
  activeConnections.forEach((client, id) => {
    if (client.type === 'admin' && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(data));
    }
  });
}

// API Routes
app.post("/api/login", (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true });
  } else {
    res.json({ success: false, message: "Wrong password" });
  }
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

app.get("/api/stats", (req, res) => {
  const keys = loadKeys();
  const totalKeys = keys.length;
  const activeKeys = keys.filter(k => !k.banned && (!k.expiresAt || new Date(k.expiresAt) > new Date())).length;
  const bannedKeys = keys.filter(k => k.banned).length;
  const expiredKeys = keys.filter(k => !k.banned && k.expiresAt && new Date(k.expiresAt) < new Date()).length;
  const activeUsers = Array.from(activeConnections.values()).filter(c => c.type === 'client').length;

  res.json({
    totalKeys,
    activeKeys,
    bannedKeys,
    expiredKeys,
    activeUsers,
    liveConnections: activeConnections.size
  });
});

// Проверка ключа для лоадера
app.post("/api/check", (req, res) => {
  const { value } = req.body;
  const keys = loadKeys();
  const key = keys.find((k) => k.value === value);
  
  if (!key) return res.json({ valid: false, reason: "not_found" });
  if (key.banned) return res.json({ valid: false, reason: "banned" });
  if (key.expiresAt && new Date(key.expiresAt) < new Date()) {
    return res.json({ valid: false, reason: "expired" });
  }
  
  // Обновляем статистику использования
  key.lastUsed = new Date().toISOString();
  key.usageCount = (key.usageCount || 0) + 1;
  saveKeys(keys);
  
  // Логируем использование
  const logs = loadLogs();
  logs.push({
    key: value,
    action: 'check_success',
    timestamp: new Date().toISOString(),
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  saveLogs(logs);
  
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

// Получить логи ключа
app.get("/api/keys/:value/logs", (req, res) => {
  const { value } = req.params;
  const logs = loadLogs();
  const keyLogs = logs.filter(log => log.key === value);
  
  res.json(keyLogs);
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

// Получить активные сессии
app.get("/api/live/sessions", (req, res) => {
  const sessions = Array.from(activeConnections.values())
    .filter(client => client.type === 'client')
    .map(client => ({
      userId: client.userId,
      key: client.key,
      connectedAt: new Date().toISOString()
    }));
  
  res.json(sessions);
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "OK", 
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    connections: activeConnections.size
  });
});

// Получить настройки
app.get("/api/settings", (req, res) => {
  res.json({
    maxKeyLength: 100,
    allowedDurations: ["hour", "day", "week", "month", "year"],
    maxKeysPerRequest: 10,
    enableLiveMonitoring: true,
    enableScreenshots: false
  });
});

// Статический сервер для мониторинга
app.get("/monitor", (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'monitor.html'));
});

server.listen(PORT, () => {
  console.log(`🚀 Eclipse Panel running on port ${PORT}`);
  console.log(`📊 Admin password: ${ADMIN_PASSWORD}`);
  console.log(`🔑 API endpoints available at http://localhost:${PORT}/api`);
  console.log(`📺 Live monitor available at http://localhost:${PORT}/monitor`);
  
  // Создаем файлы если их нет
  if (!fs.existsSync(dbFile)) saveKeys([]);
  if (!fs.existsSync(logsFile)) saveLogs([]);
});
