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

const dbFile = path.join(__dirname, "db.json");
const screenshotsDir = path.join(__dirname, "screenshots");

if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

function loadDB() {
  if (!fs.existsSync(dbFile)) fs.writeFileSync(dbFile, JSON.stringify({ apps: [], keys: [] }));
  return JSON.parse(fs.readFileSync(dbFile, "utf-8"));
}

function saveDB(db) {
  fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
}

function generateKey(app_id, durationMs, owner_id, maxActivations) {
  return {
    value: "ECLIPSE-" + crypto.randomBytes(8).toString("hex").toUpperCase(),
    app_id,
    owner_id,
    banned: false,
    expires_at: durationMs ? new Date(Date.now() + durationMs).toISOString() : null,
    created_at: new Date().toISOString(),
    hwid: null,
    activations: 0,
    max_activations: maxActivations || 1,
    last_activation: null,
    screenshots: [],
    usage_logs: []
  };
}

app.post("/api/login", (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    return res.json({ success: true });
  }
  res.json({ success: false, message: "Wrong password" });
});

app.get("/api/apps", (req, res) => {
  const db = loadDB();
  res.json(db.apps);
});

app.post("/api/apps", (req, res) => {
  const { name, owner_id } = req.body;
  const db = loadDB();
  const app_id = crypto.randomBytes(4).toString("hex");
  const app = { id: app_id, name, owner_id, created_at: new Date().toISOString() };
  db.apps.push(app);
  saveDB(db);
  res.json(app);
});

app.get("/api/keys", (req, res) => {
  const db = loadDB();
  res.json(db.keys);
});

app.post("/api/keys", (req, res) => {
  const { app_id, duration_ms, owner_id, max_activations } = req.body;
  const db = loadDB();
  if (!db.apps.find(a => a.id === app_id)) {
    return res.status(400).json({ success: false, message: "Invalid app_id" });
  }
  const key = generateKey(app_id, duration_ms, owner_id, max_activations);
  db.keys.push(key);
  saveDB(db);
  res.json(key);
});

app.post("/api/ban", (req, res) => {
  const { value } = req.body;
  const db = loadDB();
  const key = db.keys.find(k => k.value === value);
  if (key) {
    key.banned = true;
    saveDB(db);
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, message: "Key not found" });
  }
});

app.post("/api/unban", (req, res) => {
  const { value } = req.body;
  const db = loadDB();
  const key = db.keys.find(k => k.value === value);
  if (key) {
    key.banned = false;
    saveDB(db);
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, message: "Key not found" });
  }
});

app.post("/api/keys/delete", (req, res) => {
  const { value } = req.body;
  const db = loadDB();
  const initialLength = db.keys.length;
  db.keys = db.keys.filter(k => k.value !== value);
  if (db.keys.length < initialLength) {
    saveDB(db);
    res.json({ success: true, message: "Key deleted successfully" });
  } else {
    res.status(404).json({ success: false, message: "Key not found" });
  }
});

app.post("/api/auth", (req, res) => {
  const { key, hwid, app_id } = req.body;
  const db = loadDB();
  const keyData = db.keys.find(k => k.value === key && k.app_id === app_id);

  if (!keyData) return res.json({ valid: false, reason: "not_found" });
  if (keyData.banned) return res.json({ valid: false, reason: "banned" });
  if (keyData.expires_at && new Date(keyData.expires_at) < new Date())
    return res.json({ valid: false, reason: "expired" });

  if (keyData.hwid && keyData.hwid !== hwid)
    return res.json({ valid: false, reason: "hwid_mismatch" });

  if (!keyData.hwid && keyData.activations >= keyData.max_activations)
    return res.json({ valid: false, reason: "max_activations" });

  if (!keyData.hwid) {
    keyData.hwid = hwid;
    keyData.activations += 1;
    keyData.last_activation = new Date().toISOString();
    keyData.usage_logs.push({ timestamp: new Date().toISOString(), action: "activation", hwid });
    saveDB(db);
  }

  res.json({ valid: true, expires_at: keyData.expires_at });
});

app.post("/api/screenshot", (req, res) => {
  const { key, hwid, app_id, screenshot } = req.body;
  const db = loadDB();
  const keyData = db.keys.find(k => k.value === key && k.app_id === app_id);

  if (!keyData) return res.status(404).json({ success: false, message: "Key not found" });
  if (keyData.hwid && keyData.hwid !== hwid) return res.status(403).json({ success: false, message: "HWID mismatch" });

  const screenshotId = Date.now() + '-' + crypto.randomBytes(4).toString("hex");
  const screenshotPath = path.join(screenshotsDir, `${screenshotId}.png`);
  const base64Data = screenshot.replace(/^data:image\/png;base64,/, "");

  fs.writeFile(screenshotPath, base64Data, 'base64', (err) => {
    if (err) return res.status(500).json({ success: false, message: "Failed to save screenshot" });

    keyData.screenshots.push({ id: screenshotId, timestamp: new Date().toISOString(), path: screenshotPath });
    keyData.usage_logs.push({ timestamp: new Date().toISOString(), action: "screenshot", hwid });
    saveDB(db);
    res.json({ success: true, id: screenshotId });
  });
});

app.get("/api/screenshot/:key/:id", (req, res) => {
  const { key, id } = req.params;
  const db = loadDB();
  const keyData = db.keys.find(k => k.value === key);

  if (!keyData || !keyData.screenshots.find(s => s.id === id)) return res.status(404).send("Screenshot not found");
  const screenshot = keyData.screenshots.find(s => s.id === id);

  res.sendFile(screenshot.path);
});

app.get("/api/stats", (req, res) => {
  const db = loadDB();
  const totalKeys = db.keys.length;
  const activeKeys = db.keys.filter(k => !k.banned && (!k.expires_at || new Date(k.expires_at) > new Date())).length;
  const bannedKeys = db.keys.filter(k => k.banned).length;
  const expiredKeys = db.keys.filter(k => !k.banned && k.expires_at && new Date(k.expires_at) < new Date()).length;

  res.json({ totalKeys, activeKeys, bannedKeys, expiredKeys });
});

app.get("/api/stats/:app_id", (req, res) => {
  const { app_id } = req.params;
  const db = loadDB();
  const keys = db.keys.filter(k => k.app_id === app_id);
  const totalKeys = keys.length;
  const activeKeys = keys.filter(k => !k.banned && (!k.expires_at || new Date(k.expires_at) > new Date())).length;
  const bannedKeys = keys.filter(k => k.banned).length;
  const expiredKeys = keys.filter(k => !k.banned && k.expires_at && new Date(k.expires_at) < new Date()).length;

  res.json({ totalKeys, activeKeys, bannedKeys, expiredKeys });
});

app.get("/api/logs/:key", (req, res) => {
  const { key } = req.params;
  const db = loadDB();
  const keyData = db.keys.find(k => k.value === key);
  if (!keyData) return res.status(404).json({ error: "Key not found" });
  res.json(keyData.usage_logs || []);
});

app.listen(PORT, () => {
  console.log(`🚀 Eclipse Panel running on port ${PORT}`);
});
