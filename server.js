const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static("."));

const dbFile = path.join(__dirname, "keys.json");
const hwidLogFile = path.join(__dirname, "hwid_logs.json");

function hashHWID(hwid) {
  return crypto.createHash('sha256').update(hwid).digest('hex');
}

function loadData(file) {
  if (!fs.existsSync(file)) {
    if (file === dbFile) {
      fs.writeFileSync(file, JSON.stringify([]));
    } else {
      fs.writeFileSync(file, JSON.stringify([]));
    }
  }
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (error) {
    return [];
  }
}

function saveData(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function generateKey(durationMs, maxHwids = 1) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let key = "ECLIPSE-";
  
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 8; j++) {
      key += chars[Math.floor(Math.random() * chars.length)];
    }
    if (i < 2) key += "-";
  }
  
  return {
    value: key,
    banned: false,
    expiresAt: durationMs ? new Date(Date.now() + durationMs).toISOString() : null,
    createdAt: new Date().toISOString(),
    maxHwids: maxHwids,
    usedHwids: [],
    totalActivations: 0
  };
}

app.post("/api/login", (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    return res.json({ success: true });
  }
  res.json({ success: false, message: "Wrong password" });
});

app.post("/api/validate", (req, res) => {
  const { key, hwid } = req.body;
  const keys = loadData(dbFile);
  const keyData = keys.find(k => k.value === key);
  
  if (!keyData) return res.json({ valid: false, reason: "not_found" });
  if (keyData.banned) return res.json({ valid: false, reason: "banned" });
  if (keyData.expiresAt && new Date(keyData.expiresAt) < new Date())
    return res.json({ valid: false, reason: "expired" });
  
  const hashedHwid = hashHWID(hwid);
  const isNewHwid = !keyData.usedHwids.includes(hashedHwid);
  
  if (isNewHwid) {
    if (keyData.usedHwids.length >= keyData.maxHwids) {
      return res.json({ valid: false, reason: "hwid_limit" });
    }
    
    keyData.usedHwids.push(hashedHwid);
    keyData.totalActivations++;
    saveData(dbFile, keys);
    
    const logs = loadData(hwidLogFile);
    logs.push({
      key: key,
      hwid: hashedHwid,
      timestamp: new Date().toISOString(),
      action: "activation",
      userAgent: req.get('User-Agent') || 'unknown'
    });
    saveData(hwidLogFile, logs);
  }
  
  res.json({ 
    valid: true, 
    expiresAt: keyData.expiresAt,
    createdAt: keyData.createdAt,
    isNewActivation: isNewHwid,
    activations: keyData.totalActivations,
    maxActivations: keyData.maxHwids
  });
});

app.get("/api/keys", (req, res) => {
  res.json(loadData(dbFile));
});

app.post("/api/keys", (req, res) => {
  const { durationMs, maxHwids = 1 } = req.body;
  const keys = loadData(dbFile);
  const key = generateKey(durationMs, maxHwids);
  keys.push(key);
  saveData(dbFile, keys);
  res.json(key);
});

app.post("/api/ban", (req, res) => {
  const { value } = req.body;
  let keys = loadData(dbFile);
  const keyIndex = keys.findIndex(k => k.value === value);
  
  if (keyIndex === -1) {
    return res.status(404).json({ success: false, message: "Key not found" });
  }
  
  keys[keyIndex].banned = true;
  saveData(dbFile, keys);
  res.json({ success: true });
});

app.post("/api/unban", (req, res) => {
  const { value } = req.body;
  let keys = loadData(dbFile);
  const keyIndex = keys.findIndex(k => k.value === value);
  
  if (keyIndex === -1) {
    return res.status(404).json({ success: false, message: "Key not found" });
  }
  
  keys[keyIndex].banned = false;
  saveData(dbFile, keys);
  res.json({ success: true });
});

app.post("/api/keys/delete", (req, res) => {
  const { value } = req.body;
  let keys = loadData(dbFile);
  const initialLength = keys.length;
  keys = keys.filter(k => k.value !== value);
  
  if (keys.length < initialLength) {
    saveData(dbFile, keys);
    res.json({ success: true, message: "Key deleted successfully" });
  } else {
    res.status(404).json({ success: false, message: "Key not found" });
  }
});

app.get("/api/hwid-logs", (req, res) => {
  res.json(loadData(hwidLogFile));
});

app.get("/api/stats", (req, res) => {
  const keys = loadData(dbFile);
  const totalKeys = keys.length;
  const activeKeys = keys.filter(k => !k.banned && (!k.expiresAt || new Date(k.expiresAt) > new Date())).length;
  const bannedKeys = keys.filter(k => k.banned).length;
  const expiredKeys = keys.filter(k => !k.banned && k.expiresAt && new Date(k.expiresAt) < new Date()).length;
  
  const totalActivations = keys.reduce((sum, k) => sum + (k.totalActivations || 0), 0);
  const maxActivations = keys.reduce((sum, k) => sum + (k.maxHwids || 0), 0);
  
  res.json({
    totalKeys,
    activeKeys,
    bannedKeys,
    expiredKeys,
    totalActivations,
    maxActivations,
    activationRate: maxActivations > 0 ? ((totalActivations / maxActivations) * 100).toFixed(2) + '%' : '0%'
  });
});

app.post("/api/check", (req, res) => {
  const { value } = req.body;
  const keys = loadData(dbFile);
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

app.get("/api/keys/:value", (req, res) => {
  const { value } = req.params;
  const keys = loadData(dbFile);
  const key = keys.find((k) => k.value === value);
  
  if (!key) return res.status(404).json({ error: "Key not found" });
  
  res.json(key);
});

app.post("/api/key/:value/reset-hwid", (req, res) => {
  const { value } = req.params;
  const { hwid } = req.body;
  let keys = loadData(dbFile);
  const keyIndex = keys.findIndex(k => k.value === value);
  
  if (keyIndex === -1) return res.status(404).json({ error: "Key not found" });
  
  const hashedHwid = hashHWID(hwid);
  keys[keyIndex].usedHwids = keys[keyIndex].usedHwids.filter(h => h !== hashedHwid);
  keys[keyIndex].totalActivations = keys[keyIndex].usedHwids.length;
  
  saveData(dbFile, keys);
  
  const logs = loadData(hwidLogFile);
  logs.push({
    key: value,
    hwid: hashedHwid,
    timestamp: new Date().toISOString(),
    action: "reset",
    userAgent: req.get('User-Agent') || 'unknown'
  });
  saveData(hwidLogFile, logs);
  
  res.json({ success: true, message: "HWID reset successfully" });
});

app.get("/api/health", (req, res) => {
  res.json({ 
    status: "OK", 
    timestamp: new Date().toISOString(),
    version: "2.0.0",
    hwid: true
  });
});

app.get("/api/settings", (req, res) => {
  res.json({
    maxKeyLength: 100,
    allowedDurations: ["hour", "day", "week", "month", "year"],
    maxKeysPerRequest: 10,
    hwidEnabled: true
  });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

app.listen(PORT, () => {
  console.log(`🚀 Eclipse Panel with HWID system running on port ${PORT}`);
  console.log(`📊 Admin password: ${ADMIN_PASSWORD}`);
  console.log(`🔑 HWID protection: ENABLED`);
  console.log(`🌐 Web interface: http://localhost:${PORT}`);
});
