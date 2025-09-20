const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const dbFile = path.join(__dirname, "keys.json");
const hwidFile = path.join(__dirname, "hwid.json");

function loadKeys() {
  if (!fs.existsSync(dbFile)) fs.writeFileSync(dbFile, JSON.stringify([]));
  return JSON.parse(fs.readFileSync(dbFile, "utf-8"));
}

function saveKeys(keys) {
  fs.writeFileSync(dbFile, JSON.stringify(keys, null, 2));
}

function loadHWIDs() {
  if (!fs.existsSync(hwidFile)) fs.writeFileSync(hwidFile, JSON.stringify({}));
  return JSON.parse(fs.readFileSync(hwidFile, "utf-8"));
}

function saveHWIDs(hwidData) {
  fs.writeFileSync(hwidFile, JSON.stringify(hwidData, null, 2));
}

function generateKey(durationMs) {
  return {
    value: "ECLIPSE-" + Math.random().toString(36).substring(2, 10).toUpperCase() + 
           "-" + Math.random().toString(36).substring(2, 10).toUpperCase() + 
           "-" + Math.random().toString(36).substring(2, 10).toUpperCase(),
    banned: false,
    expiresAt: durationMs ? new Date(Date.now() + durationMs).toISOString() : null,
    createdAt: new Date().toISOString(),
    hwidLocked: false,
    maxHwid: 1,
    hwids: []
  };
}

function generateHWID() {
  return crypto.createHash('sha256').update(Date.now().toString() + Math.random().toString()).digest('hex');
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
  const { durationMs, maxHwid = 1 } = req.body;
  const keys = loadKeys();
  const key = generateKey(durationMs);
  key.maxHwid = maxHwid;
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

  res.json({
    totalKeys,
    activeKeys,
    bannedKeys,
    expiredKeys
  });
});

app.post("/api/hwid/check", (req, res) => {
  const { value, hwid } = req.body;
  const keys = loadKeys();
  const key = keys.find((k) => k.value === value);
  
  if (!key) return res.json({ valid: false, reason: "not_found" });
  if (key.banned) return res.json({ valid: false, reason: "banned" });
  if (key.expiresAt && new Date(key.expiresAt) < new Date())
    return res.json({ valid: false, reason: "expired" });
  
  if (key.hwidLocked) {
    if (!key.hwids.includes(hwid)) {
      if (key.hwids.length >= key.maxHwid) {
        return res.json({ valid: false, reason: "hwid_limit" });
      }
      
      key.hwids.push(hwid);
      saveKeys(keys);
    }
  }
  
  res.json({ 
    valid: true, 
    expiresAt: key.expiresAt,
    createdAt: key.createdAt
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

app.post("/api/check", (req, res) => {
  const { value, hwid } = req.body;
  const keys = loadKeys();
  const key = keys.find((k) => k.value === value);
  
  if (!key) return res.json({ valid: false, reason: "not_found" });
  if (key.banned) return res.json({ valid: false, reason: "banned" });
  if (key.expiresAt && new Date(key.expiresAt) < new Date())
    return res.json({ valid: false, reason: "expired" });
  
  if (key.hwidLocked && hwid) {
    if (!key.hwids.includes(hwid)) {
      return res.json({ valid: false, reason: "hwid_mismatch" });
    }
  }
  
  res.json({ 
    valid: true, 
    expiresAt: key.expiresAt,
    createdAt: key.createdAt
  });
});

app.get("/api/keys/:value", (req, res) => {
  const { value } = req.params;
  const keys = loadKeys();
  const key = keys.find((k) => k.value === value);
  
  if (!key) return res.status(404).json({ error: "Key not found" });
  
  res.json(key);
});

app.put("/api/keys/:value", (req, res) => {
  const { value } = req.params;
  const { banned, expiresAt, hwidLocked, maxHwid } = req.body;
  let keys = loadKeys();
  let keyFound = false;
  
  keys = keys.map(k => {
    if (k.value === value) {
      keyFound = true;
      return { 
        ...k, 
        ...(banned !== undefined && { banned }),
        ...(expiresAt && { expiresAt: new Date(expiresAt).toISOString() }),
        ...(hwidLocked !== undefined && { hwidLocked }),
        ...(maxHwid !== undefined && { maxHwid })
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

app.get("/api/health", (req, res) => {
  res.json({ 
    status: "OK", 
    timestamp: new Date().toISOString(),
    version: "1.0.0"
  });
});

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
  console.log(`🔒 HWID protection system activated`);
});
