const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static("public"));

const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const db = {
  users: path.join(dataDir, "users.json"),
  apps: path.join(dataDir, "apps.json"),
  keys: path.join(dataDir, "keys.json"),
  settings: path.join(dataDir, "settings.json")
};

function initDB() {
  if (!fs.existsSync(db.users)) {
    const hashedPassword = bcrypt.hashSync("fezy123456", 10);
    fs.writeFileSync(db.users, JSON.stringify([{
      id: "1",
      username: "jadx",
      password: hashedPassword,
      role: "superadmin",
      permissions: ["*"],
      createdAt: new Date().toISOString()
    }]));
  }
  
  if (!fs.existsSync(db.apps)) fs.writeFileSync(db.apps, "[]");
  if (!fs.existsSync(db.keys)) fs.writeFileSync(db.keys, "[]");
  if (!fs.existsSync(db.settings)) fs.writeFileSync(db.settings, JSON.stringify({
    siteName: "Eclipse Auth",
    theme: "dark",
    allowRegistrations: false
  }));
}

initDB();

function loadData(file) {
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

function saveData(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function authenticateToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: "Access denied" });

  const users = loadData(db.users);
  const user = users.find(u => u.token === token);
  if (!user) return res.status(401).json({ error: "Invalid token" });

  req.user = user;
  next();
}

function requireRole(roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role) && !req.user.permissions?.includes('*')) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  const users = loadData(db.users);
  const user = users.find(u => u.username === username);

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  user.token = generateToken();
  user.lastLogin = new Date().toISOString();
  saveData(db.users, users);

  res.json({
    success: true,
    token: user.token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      permissions: user.permissions
    }
  });
});

app.post("/api/auth/register", async (req, res) => {
  const settings = loadData(db.settings);
  if (!settings.allowRegistrations) {
    return res.status(403).json({ error: "Registrations are disabled" });
  }

  const { username, password, inviteCode } = req.body;
  const users = loadData(db.users);
  
  if (users.find(u => u.username === username)) {
    return res.status(400).json({ error: "Username already exists" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = {
    id: crypto.randomBytes(8).toString('hex'),
    username,
    password: hashedPassword,
    role: "user",
    permissions: [],
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  saveData(db.users, users);
  res.json({ success: true });
});

app.get("/api/apps", authenticateToken, (req, res) => {
  const apps = loadData(db.apps);
  const userApps = req.user.role === 'superadmin' ? apps : 
                  apps.filter(app => req.user.permissions?.includes(app.id));
  res.json(userApps);
});

app.post("/api/apps", authenticateToken, requireRole(['superadmin', 'admin']), (req, res) => {
  const { name, description, settings } = req.body;
  const apps = loadData(db.apps);
  
  const newApp = {
    id: crypto.randomBytes(8).toString('hex'),
    name,
    description,
    settings: {
      requireHWID: settings?.requireHWID ?? true,
      captureScreenshots: settings?.captureScreenshots ?? true,
      maxActivations: settings?.maxActivations ?? 1,
      defaultExpiry: settings?.defaultExpiry ?? 2592000000,
      status: settings?.status ?? 'active',
      ...settings
    },
    ownerId: req.user.id,
    createdAt: new Date().toISOString(),
    stats: { totalKeys: 0, activeKeys: 0, bannedKeys: 0 }
  };

  apps.push(newApp);
  saveData(db.apps, apps);
  res.json(newApp);
});

app.post("/api/keys/generate", authenticateToken, (req, res) => {
  const { appId, duration, maxActivations, note } = req.body;
  const apps = loadData(db.apps);
  const app = apps.find(a => a.id === appId);
  
  if (!app) return res.status(404).json({ error: "App not found" });
  if (app.settings.status !== 'active') {
    return res.status(400).json({ error: "App is disabled" });
  }

  const keys = loadData(db.keys);
  const keyValue = `ECL-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  
  const newKey = {
    id: crypto.randomBytes(8).toString('hex'),
    value: keyValue,
    appId,
    createdBy: req.user.id,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + (duration || app.settings.defaultExpiry)).toISOString(),
    maxActivations: maxActivations || app.settings.maxActivations,
    activations: 0,
    hwid: null,
    banned: false,
    note: note || '',
    lastActivation: null
  };

  keys.push(newKey);
  saveData(db.keys, keys);
  res.json(newKey);
});

app.post("/api/keys/check", (req, res) => {
  const { appId, key, hwid } = req.body;
  const apps = loadData(db.apps);
  const keys = loadData(db.keys);
  
  const app = apps.find(a => a.id === appId);
  if (!app || app.settings.status !== 'active') {
    return res.json({ valid: false, error: "App not available" });
  }

  const keyData = keys.find(k => k.value === key && k.appId === appId);
  if (!keyData) return res.json({ valid: false, error: "Invalid key" });
  if (keyData.banned) return res.json({ valid: false, error: "Key banned" });
  if (new Date(keyData.expiresAt) < new Date()) {
    return res.json({ valid: false, error: "Key expired" });
  }

  if (keyData.hwid && keyData.hwid !== hwid) {
    return res.json({ valid: false, error: "HWID mismatch" });
  }

  if (!keyData.hwid && keyData.activations >= keyData.maxActivations) {
    return res.json({ valid: false, error: "Max activations reached" });
  }

  if (!keyData.hwid) {
    keyData.hwid = hwid;
    keyData.activations++;
    keyData.lastActivation = new Date().toISOString();
    saveData(db.keys, keys);
  }

  res.json({ 
    valid: true, 
    app: { name: app.name, settings: app.settings },
    key: { expiresAt: keyData.expiresAt, activations: keyData.activations }
  });
});

app.get("/api/admin/stats", authenticateToken, requireRole(['superadmin', 'admin']), (req, res) => {
  const apps = loadData(db.apps);
  const keys = loadData(db.keys);
  const users = loadData(db.users);

  const stats = {
    totalApps: apps.length,
    totalKeys: keys.length,
    totalUsers: users.length,
    activeKeys: keys.filter(k => !k.banned && new Date(k.expiresAt) > new Date()).length,
    bannedKeys: keys.filter(k => k.banned).length,
    recentActivity: keys.slice(-10).map(k => ({
      key: k.value.substring(0, 8) + '...',
      app: apps.find(a => a.id === k.appId)?.name,
      time: k.lastActivation
    }))
  };

  res.json(stats);
});

app.listen(PORT, () => {
  console.log(`🚀 Eclipse Auth System running on port ${PORT}`);
});
