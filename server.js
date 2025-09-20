const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static("public"));

const dbFile = path.join(__dirname, "keys.json");
const screenshotsDir = path.join(__dirname, "screenshots");

if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

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
    createdAt: new Date().toISOString(),
    hwid: null,
    activations: 0,
    maxActivations: 1,
    lastActivation: null,
    screenshots: []
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
  const { durationMs, maxActivations = 1 } = req.body;
  const keys = loadKeys();
  const key = generateKey(durationMs);
  key.maxActivations = maxActivations;
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

app.post("/api/check", (req, res) => {
  const { value, hwid } = req.body;
  const keys = loadKeys();
  const key = keys.find((k) => k.value === value);
  
  if (!key) return res.json({ valid: false, reason: "not_found" });
  if (key.banned) return res.json({ valid: false, reason: "banned" });
  if (key.expiresAt && new Date(key.expiresAt) < new Date())
    return res.json({ valid: false, reason: "expired" });
  
  if (key.hwid && key.hwid !== hwid)
    return res.json({ valid: false, reason: "hwid_mismatch" });
  
  if (!key.hwid && key.activations >= key.maxActivations)
    return res.json({ valid: false, reason: "max_activations" });
  
  if (!key.hwid) {
    key.hwid = hwid;
    key.activations += 1;
    key.lastActivation = new Date().toISOString();
    saveKeys(keys);
  }
  
  res.json({ 
    valid: true, 
    expiresAt: key.expiresAt,
    createdAt: key.createdAt
  });
});

app.post("/api/screenshot", (req, res) => {
  const { key, screenshot } = req.body;
  const keys = loadKeys();
  const keyData = keys.find((k) => k.value === key);
  
  if (!keyData) {
    return res.status(404).json({ success: false, message: "Key not found" });
  }
  
  const screenshotId = Date.now() + '-' + Math.random().toString(36).substring(2, 10);
  const screenshotPath = path.join(screenshotsDir, `${screenshotId}.png`);
  
  const base64Data = screenshot.replace(/^data:image\/png;base64,/, "");
  
  fs.writeFile(screenshotPath, base64Data, 'base64', (err) => {
    if (err) {
      console.error("Error saving screenshot:", err);
      return res.status(500).json({ success: false, message: "Failed to save screenshot" });
    }
    
    keyData.screenshots.push({
      id: screenshotId,
      timestamp: new Date().toISOString(),
      path: screenshotPath
    });
    
    saveKeys(keys);
    res.json({ success: true, id: screenshotId });
  });
});

app.get("/api/screenshot/:key/:id", (req, res) => {
  const { key, id } = req.params;
  const keys = loadKeys();
  const keyData = keys.find((k) => k.value === key);
  
  if (!keyData) {
    return res.status(404).send("Key not found");
  }
  
  const screenshot = keyData.screenshots.find(s => s.id === id);
  if (!screenshot) {
    return res.status(404).send("Screenshot not found");
  }
  
  if (!fs.existsSync(screenshot.path)) {
    return res.status(404).send("Screenshot file not found");
  }
  
  res.sendFile(screenshot.path);
});

app.get("/api/keys/:value", (req, res) => {
  const { value } = req.params;
  const keys = loadKeys();
  const key = keys.find((k) => k.value === value);
  
  if (!key) return res.status(404).json({ error: "Key not found" });
  
  res.json(key);
});

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

app.listen(PORT, () => {
  console.log(`🚀 Eclipse Panel running on port ${PORT}`);
  console.log(`📊 Admin password: ${ADMIN_PASSWORD}`);
  console.log(`🔑 API endpoints available at http://localhost:${PORT}/api`);
});
