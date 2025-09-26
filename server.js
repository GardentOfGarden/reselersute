const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static("public"));

const dbFile = path.join(__dirname, "apps.json");
const screenshotsDir = path.join(__dirname, "screenshots");

if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

function loadApps() {
  if (!fs.existsSync(dbFile)) {
    const defaultApps = [
      {
        id: "eclipse",
        name: "Eclipse Cheat",
        ownerId: "admin",
        secret: crypto.randomBytes(32).toString('hex'),
        keys: [],
        settings: {
          maxActivations: 1,
          screenshotRequired: true,
          hwidLock: true
        }
      }
    ];
    fs.writeFileSync(dbFile, JSON.stringify(defaultApps, null, 2));
    return defaultApps;
  }
  return JSON.parse(fs.readFileSync(dbFile, "utf-8"));
}

function saveApps(apps) {
  fs.writeFileSync(dbFile, JSON.stringify(apps, null, 2));
}

function generateKey(appId, durationMs, maxActivations = 1) {
  return {
    id: crypto.randomBytes(16).toString('hex'),
    value: `${appId.toUpperCase()}-${crypto.randomBytes(8).toString('hex').toUpperCase()}-${crypto.randomBytes(8).toString('hex').toUpperCase()}-${crypto.randomBytes(8).toString('hex').toUpperCase()}`,
    appId: appId,
    banned: false,
    expiresAt: durationMs ? new Date(Date.now() + durationMs).toISOString() : null,
    createdAt: new Date().toISOString(),
    hwid: null,
    activations: 0,
    maxActivations: maxActivations,
    lastActivation: null,
    screenshots: [],
    metadata: {}
  };
}

app.post("/api/apps/create", (req, res) => {
  const { name, ownerId, settings } = req.body;
  const apps = loadApps();
  
  const newApp = {
    id: name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    name: name,
    ownerId: ownerId,
    secret: crypto.randomBytes(32).toString('hex'),
    keys: [],
    settings: {
      maxActivations: settings?.maxActivations || 1,
      screenshotRequired: settings?.screenshotRequired !== false,
      hwidLock: settings?.hwidLock !== false,
      ...settings
    },
    createdAt: new Date().toISOString(),
    stats: {
      totalKeys: 0,
      activeSessions: 0,
      totalScreenshots: 0
    }
  };
  
  apps.push(newApp);
  saveApps(apps);
  res.json({ success: true, app: newApp });
});

app.get("/api/apps", (req, res) => {
  res.json(loadApps());
});

app.get("/api/apps/:appId", (req, res) => {
  const apps = loadApps();
  const app = apps.find(a => a.id === req.params.appId);
  if (!app) return res.status(404).json({ error: "App not found" });
  res.json(app);
});

app.post("/api/apps/:appId/keys", (req, res) => {
  const { durationMs, maxActivations, metadata } = req.body;
  const apps = loadApps();
  const app = apps.find(a => a.id === req.params.appId);
  
  if (!app) return res.status(404).json({ error: "App not found" });
  
  const key = generateKey(app.id, durationMs, maxActivations);
  key.metadata = metadata || {};
  app.keys.push(key);
  app.stats.totalKeys++;
  
  saveApps(apps);
  res.json({ success: true, key: key });
});

app.post("/api/apps/:appId/check", (req, res) => {
  const { value, hwid, appSecret } = req.body;
  const apps = loadApps();
  const app = apps.find(a => a.id === req.params.appId);
  
  if (!app) return res.json({ valid: false, reason: "app_not_found" });
  if (appSecret !== app.secret) return res.json({ valid: false, reason: "invalid_secret" });
  
  const key = app.keys.find(k => k.value === value);
  if (!key) return res.json({ valid: false, reason: "key_not_found" });
  if (key.banned) return res.json({ valid: false, reason: "banned" });
  if (key.expiresAt && new Date(key.expiresAt) < new Date())
    return res.json({ valid: false, reason: "expired" });
  
  if (app.settings.hwidLock) {
    if (key.hwid && key.hwid !== hwid)
      return res.json({ valid: false, reason: "hwid_mismatch" });
    
    if (!key.hwid && key.activations >= key.maxActivations)
      return res.json({ valid: false, reason: "max_activations" });
  }
  
  if (!key.hwid && app.settings.hwidLock) {
    key.hwid = hwid;
    key.activations += 1;
    key.lastActivation = new Date().toISOString();
    app.stats.activeSessions++;
    saveApps(apps);
  }
  
  res.json({ 
    valid: true, 
    expiresAt: key.expiresAt,
    createdAt: key.createdAt,
    appName: app.name
  });
});

app.post("/api/apps/:appId/screenshot", (req, res) => {
  const { key, hwid, screenshot, appSecret } = req.body;
  const apps = loadApps();
  const app = apps.find(a => a.id === req.params.appId);
  
  if (!app || appSecret !== app.secret) {
    return res.status(404).json({ success: false, message: "Invalid app" });
  }
  
  const keyData = app.keys.find(k => k.value === key);
  if (!keyData) return res.status(404).json({ success: false, message: "Key not found" });
  
  if (app.settings.hwidLock && keyData.hwid && keyData.hwid !== hwid) {
    return res.status(403).json({ success: false, message: "HWID mismatch" });
  }
  
  const screenshotId = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
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
    
    app.stats.totalScreenshots++;
    saveApps(apps);
    res.json({ success: true, id: screenshotId });
  });
});

app.get("/api/apps/:appId/stats", (req, res) => {
  const apps = loadApps();
  const app = apps.find(a => a.id === req.params.appId);
  if (!app) return res.status(404).json({ error: "App not found" });
  
  res.json(app.stats);
});

app.post("/api/apps/:appId/keys/:keyId/ban", (req, res) => {
  const apps = loadApps();
  const app = apps.find(a => a.id === req.params.appId);
  if (!app) return res.status(404).json({ error: "App not found" });
  
  const key = app.keys.find(k => k.id === req.params.keyId);
  if (!key) return res.status(404).json({ error: "Key not found" });
  
  key.banned = true;
  if (key.hwid) app.stats.activeSessions = Math.max(0, app.stats.activeSessions - 1);
  
  saveApps(apps);
  res.json({ success: true });
});

app.delete("/api/apps/:appId/keys/:keyId", (req, res) => {
  const apps = loadApps();
  const app = apps.find(a => a.id === req.params.appId);
  if (!app) return res.status(404).json({ error: "App not found" });
  
  const keyIndex = app.keys.findIndex(k => k.id === req.params.keyId);
  if (keyIndex === -1) return res.status(404).json({ error: "Key not found" });
  
  const key = app.keys[keyIndex];
  if (key.hwid) app.stats.activeSessions = Math.max(0, app.stats.activeSessions - 1);
  app.stats.totalKeys--;
  app.stats.totalScreenshots -= key.screenshots.length;
  
  app.keys.splice(keyIndex, 1);
  saveApps(apps);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`🚀 Multi-App Auth System running on port ${PORT}`);
});
