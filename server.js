const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.static("public"));

const dbFile = path.join(__dirname, "database.json");
const screenshotsDir = path.join(__dirname, "screenshots");

if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

if (!fs.existsSync(dbFile)) {
  const initialData = {
    apps: [
      {
        id: "eclipse",
        name: "ECLIPSE",
        owner: "admin",
        secret: crypto.randomBytes(32).toString('hex'),
        createdAt: new Date().toISOString()
      }
    ],
    keys: [],
    settings: {
      adminPassword: "admin123",
      maxScreenshotSize: 5242880,
      sessionTimeout: 3600000
    }
  };
  fs.writeFileSync(dbFile, JSON.stringify(initialData, null, 2));
}

function loadDatabase() {
  return JSON.parse(fs.readFileSync(dbFile, "utf-8"));
}

function saveDatabase(data) {
  fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
}

function generateAppToken(appId, secret) {
  return crypto.createHash('sha256').update(appId + secret + Date.now()).digest('hex');
}

function authenticateApp(req, res, next) {
  const { appid, token } = req.headers;
  
  if (!appid || !token) {
    return res.status(401).json({ error: "App authentication required" });
  }

  const db = loadDatabase();
  const app = db.apps.find(a => a.id === appid);
  
  if (!app || app.token !== token) {
    return res.status(401).json({ error: "Invalid app credentials" });
  }
  
  req.appData = app;
  next();
}

app.post("/api/admin/login", (req, res) => {
  const { password } = req.body;
  const db = loadDatabase();
  
  if (password === db.settings.adminPassword) {
    const sessionToken = crypto.randomBytes(32).toString('hex');
    res.json({ success: true, token: sessionToken });
  } else {
    res.json({ success: false, message: "Invalid password" });
  }
});

app.post("/api/app/register", (req, res) => {
  const { name, owner, adminPassword } = req.body;
  const db = loadDatabase();
  
  if (adminPassword !== db.settings.adminPassword) {
    return res.status(401).json({ error: "Invalid admin password" });
  }
  
  const appId = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const existingApp = db.apps.find(a => a.id === appId);
  
  if (existingApp) {
    return res.status(400).json({ error: "App already exists" });
  }
  
  const newApp = {
    id: appId,
    name,
    owner,
    secret: crypto.randomBytes(32).toString('hex'),
    token: generateAppToken(appId, crypto.randomBytes(32).toString('hex')),
    createdAt: new Date().toISOString(),
    isActive: true
  };
  
  db.apps.push(newApp);
  saveDatabase(db);
  
  res.json({ 
    success: true, 
    app: {
      id: newApp.id,
      name: newApp.name,
      token: newApp.token
    }
  });
});

app.post("/api/:appid/auth/check", authenticateApp, (req, res) => {
  const { value, hwid } = req.body;
  const db = loadDatabase();
  
  const key = db.keys.find(k => k.value === value && k.appid === req.appData.id);
  if (!key) return res.json({ valid: false, reason: "not_found" });
  if (key.banned) return res.json({ valid: false, reason: "banned" });
  if (key.expiresAt && new Date(key.expiresAt) < new Date()) {
    return res.json({ valid: false, reason: "expired" });
  }
  
  if (key.hwid && key.hwid !== hwid) {
    return res.json({ valid: false, reason: "hwid_mismatch" });
  }
  
  if (!key.hwid) {
    key.hwid = hwid;
    key.activations += 1;
    key.lastActivation = new Date().toISOString();
    saveDatabase(db);
  }
  
  res.json({ 
    valid: true, 
    app: {
      name: req.appData.name,
      owner: req.appData.owner
    },
    key: {
      expiresAt: key.expiresAt,
      createdAt: key.createdAt,
      activations: key.activations,
      maxActivations: key.maxActivations
    }
  });
});

app.post("/api/:appid/auth/screenshot", authenticateApp, (req, res) => {
  const { key: keyValue, hwid, screenshot } = req.body;
  const db = loadDatabase();
  
  const key = db.keys.find(k => k.value === keyValue && k.appid === req.appData.id);
  if (!key) return res.status(404).json({ error: "Key not found" });
  if (key.hwid && key.hwid !== hwid) {
    return res.status(403).json({ error: "HWID mismatch" });
  }
  
  const screenshotId = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
  const screenshotPath = path.join(screenshotsDir, `${screenshotId}.png`);
  
  const base64Data = screenshot.replace(/^data:image\/png;base64,/, "");
  
  fs.writeFile(screenshotPath, base64Data, 'base64', (err) => {
    if (err) {
      console.error("Screenshot save error:", err);
      return res.status(500).json({ error: "Failed to save screenshot" });
    }
    
    if (!key.screenshots) key.screenshots = [];
    key.screenshots.push({
      id: screenshotId,
      timestamp: new Date().toISOString(),
      path: screenshotPath
    });
    
    saveDatabase(db);
    res.json({ success: true, id: screenshotId });
  });
});

app.post("/api/admin/keys/generate", (req, res) => {
  const { appid, durationMs, maxActivations = 1, note } = req.body;
  const db = loadDatabase();
  
  const app = db.apps.find(a => a.id === appid);
  if (!app) return res.status(404).json({ error: "App not found" });
  
  const keyValue = `ECL-${appid.toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  
  const newKey = {
    value: keyValue,
    appid,
    banned: false,
    expiresAt: durationMs ? new Date(Date.now() + durationMs).toISOString() : null,
    createdAt: new Date().toISOString(),
    hwid: null,
    activations: 0,
    maxActivations,
    lastActivation: null,
    screenshots: [],
    note: note || ""
  };
  
  db.keys.push(newKey);
  saveDatabase(db);
  
  res.json({ success: true, key: newKey });
});

app.get("/api/admin/keys", (req, res) => {
  const db = loadDatabase();
  res.json({ keys: db.keys, apps: db.apps });
});

app.post("/api/admin/keys/ban", (req, res) => {
  const { value } = req.body;
  const db = loadDatabase();
  
  const key = db.keys.find(k => k.value === value);
  if (key) {
    key.banned = true;
    saveDatabase(db);
  }
  
  res.json({ success: true });
});

app.post("/api/admin/keys/unban", (req, res) => {
  const { value } = req.body;
  const db = loadDatabase();
  
  const key = db.keys.find(k => k.value === value);
  if (key) {
    key.banned = false;
    saveDatabase(db);
  }
  
  res.json({ success: true });
});

app.delete("/api/admin/keys/:value", (req, res) => {
  const { value } = req.params;
  const db = loadDatabase();
  
  db.keys = db.keys.filter(k => k.value !== value);
  saveDatabase(db);
  
  res.json({ success: true });
});

app.get("/api/admin/stats", (req, res) => {
  const db = loadDatabase();
  const stats = {
    totalApps: db.apps.length,
    totalKeys: db.keys.length,
    activeKeys: db.keys.filter(k => !k.banned && (!k.expiresAt || new Date(k.expiresAt) > new Date())).length,
    bannedKeys: db.keys.filter(k => k.banned).length,
    expiredKeys: db.keys.filter(k => !k.banned && k.expiresAt && new Date(k.expiresAt) < new Date()).length,
    totalScreenshots: db.keys.reduce((sum, k) => sum + (k.screenshots ? k.screenshots.length : 0), 0)
  };
  
  res.json(stats);
});

app.listen(PORT, () => {
  console.log(`🚀 Eclipse Multi-App System running on port ${PORT}`);
});
