const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "eclipse_super_secret_key_2024";

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static("public"));

const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = {
  users: loadJSON("users.json", [
    { 
      id: 1, 
      username: "jadx", 
      password: "$2a$10$8K1p/a0dRTlR0dZQbKQwE.F9QJQY8XqZJZQY8XqZJZQY8XqZJZQY8", 
      role: "admin", 
      email: "admin@eclipse.com",
      createdAt: new Date().toISOString()
    }
  ]),
  apps: loadJSON("apps.json", []),
  keys: loadJSON("keys.json", []),
  settings: loadJSON("settings.json", {
    maxResellerKeys: 50,
    defaultKeyDuration: 30,
    screenshotEnabled: true
  })
};

function loadJSON(filename, defaultValue) {
  const filepath = path.join(dataDir, filename);
  try {
    if (fs.existsSync(filepath)) {
      return JSON.parse(fs.readFileSync(filepath, "utf8"));
    }
  } catch (error) {
    console.error(`Error loading ${filename}:`, error);
  }
  return defaultValue;
}

function saveJSON(filename, data) {
  const filepath = path.join(dataDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
}

function generateAppId() {
  return "APP_" + Math.random().toString(36).substring(2, 10).toUpperCase();
}

function generateKey() {
  return "ECLIPSE-" + 
    Math.random().toString(36).substring(2, 8).toUpperCase() + "-" +
    Math.random().toString(36).substring(2, 8).toUpperCase() + "-" +
    Math.random().toString(36).substring(2, 8).toUpperCase();
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: "Access token required" });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: "Invalid token" });
    }
    req.user = user;
    next();
  });
}

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: "Username and password required" });
  }

  const user = db.users.find(u => u.username === username);
  if (!user) {
    return res.status(401).json({ success: false, message: "Invalid credentials" });
  }

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    return res.status(401).json({ success: false, message: "Invalid credentials" });
  }

  const token = jwt.sign(
    { 
      id: user.id, 
      username: user.username, 
      role: user.role 
    }, 
    JWT_SECRET, 
    { expiresIn: '24h' }
  );

  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      email: user.email
    }
  });
});

app.post("/api/auth/register", authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: "Admin access required" });
  }

  const { username, password, role, email } = req.body;

  if (!username || !password || !role) {
    return res.status(400).json({ success: false, message: "All fields required" });
  }

  if (db.users.find(u => u.username === username)) {
    return res.status(400).json({ success: false, message: "Username already exists" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = {
    id: db.users.length + 1,
    username,
    password: hashedPassword,
    role,
    email: email || '',
    createdAt: new Date().toISOString()
  };

  db.users.push(newUser);
  saveJSON("users.json", db.users);

  res.json({
    success: true,
    message: "User created successfully",
    user: {
      id: newUser.id,
      username: newUser.username,
      role: newUser.role,
      email: newUser.email
    }
  });
});

app.get("/api/apps", authenticateToken, (req, res) => {
  const userApps = req.user.role === 'admin' 
    ? db.apps 
    : db.apps.filter(app => app.ownerId === req.user.id);
  
  res.json({ success: true, apps: userApps });
});

app.post("/api/apps", authenticateToken, (req, res) => {
  const { name, description, dllUrl, status = "active" } = req.body;

  if (!name || !dllUrl) {
    return res.status(400).json({ success: false, message: "Name and DLL URL required" });
  }

  const newApp = {
    id: generateAppId(),
    name,
    description: description || '',
    dllUrl,
    status,
    ownerId: req.user.id,
    ownerName: req.user.username,
    createdAt: new Date().toISOString(),
    totalKeys: 0,
    activeKeys: 0
  };

  db.apps.push(newApp);
  saveJSON("apps.json", db.apps);

  res.json({ success: true, app: newApp });
});

app.put("/api/apps/:id", authenticateToken, (req, res) => {
  const appId = req.params.id;
  const app = db.apps.find(a => a.id === appId);
  
  if (!app) {
    return res.status(404).json({ success: false, message: "App not found" });
  }

  if (req.user.role !== 'admin' && app.ownerId !== req.user.id) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  Object.assign(app, req.body);
  saveJSON("apps.json", db.apps);

  res.json({ success: true, app });
});

app.post("/api/keys/generate", authenticateToken, (req, res) => {
  const { appId, duration, maxActivations = 1, note = '' } = req.body;

  if (!appId || !duration) {
    return res.status(400).json({ success: false, message: "App ID and duration required" });
  }

  const app = db.apps.find(a => a.id === appId);
  if (!app) {
    return res.status(404).json({ success: false, message: "App not found" });
  }

  if (req.user.role === 'reseller') {
    const userKeys = db.keys.filter(k => k.ownerId === req.user.id && k.appId === appId);
    if (userKeys.length >= db.settings.maxResellerKeys) {
      return res.status(400).json({ 
        success: false, 
        message: `Maximum ${db.settings.maxResellerKeys} keys allowed for resellers` 
      });
    }
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + parseInt(duration));

  const newKey = {
    id: db.keys.length + 1,
    key: generateKey(),
    appId,
    appName: app.name,
    ownerId: req.user.id,
    ownerName: req.user.username,
    duration: parseInt(duration),
    maxActivations,
    activations: 0,
    expiresAt: expiresAt.toISOString(),
    createdAt: new Date().toISOString(),
    status: "active",
    hwid: null,
    note,
    lastActivation: null
  };

  db.keys.push(newKey);
  
  app.totalKeys = (app.totalKeys || 0) + 1;
  app.activeKeys = (app.activeKeys || 0) + 1;
  
  saveJSON("keys.json", db.keys);
  saveJSON("apps.json", db.apps);

  res.json({ success: true, key: newKey });
});

app.get("/api/keys", authenticateToken, (req, res) => {
  const userKeys = req.user.role === 'admin' 
    ? db.keys 
    : db.keys.filter(key => key.ownerId === req.user.id);
  
  res.json({ success: true, keys: userKeys });
});

app.post("/api/keys/validate", (req, res) => {
  const { key, hwid, appId } = req.body;

  if (!key || !appId) {
    return res.json({ valid: false, reason: "invalid_request" });
  }

  const keyData = db.keys.find(k => k.key === key && k.appId === appId);
  if (!keyData) {
    return res.json({ valid: false, reason: "key_not_found" });
  }

  if (keyData.status !== "active") {
    return res.json({ valid: false, reason: "key_banned" });
  }

  if (new Date(keyData.expiresAt) < new Date()) {
    return res.json({ valid: false, reason: "key_expired" });
  }

  if (keyData.hwid && keyData.hwid !== hwid) {
    return res.json({ valid: false, reason: "hwid_mismatch" });
  }

  if (keyData.activations >= keyData.maxActivations && !keyData.hwid) {
    return res.json({ valid: false, reason: "max_activations" });
  }

  if (!keyData.hwid) {
    keyData.hwid = hwid;
    keyData.activations += 1;
    keyData.lastActivation = new Date().toISOString();
    saveJSON("keys.json", db.keys);
  }

  const app = db.apps.find(a => a.id === appId);
  if (!app || app.status !== "active") {
    return res.json({ valid: false, reason: "app_inactive" });
  }

  res.json({ 
    valid: true, 
    app: {
      name: app.name,
      dllUrl: app.dllUrl
    },
    key: {
      expiresAt: keyData.expiresAt,
      activations: keyData.activations,
      maxActivations: keyData.maxActivations
    }
  });
});

app.post("/api/keys/:id/ban", authenticateToken, (req, res) => {
  const keyId = parseInt(req.params.id);
  const key = db.keys.find(k => k.id === keyId);
  
  if (!key) {
    return res.status(404).json({ success: false, message: "Key not found" });
  }

  if (req.user.role !== 'admin' && key.ownerId !== req.user.id) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  key.status = "banned";
  saveJSON("keys.json", db.keys);

  const app = db.apps.find(a => a.id === key.appId);
  if (app) {
    app.activeKeys = Math.max(0, (app.activeKeys || 0) - 1);
    saveJSON("apps.json", db.apps);
  }

  res.json({ success: true, message: "Key banned successfully" });
});

app.get("/api/stats", authenticateToken, (req, res) => {
  const userStats = {
    totalApps: req.user.role === 'admin' ? db.apps.length : db.apps.filter(a => a.ownerId === req.user.id).length,
    totalKeys: req.user.role === 'admin' ? db.keys.length : db.keys.filter(k => k.ownerId === req.user.id).length,
    activeKeys: req.user.role === 'admin' 
      ? db.keys.filter(k => k.status === "active" && new Date(k.expiresAt) > new Date()).length
      : db.keys.filter(k => k.ownerId === req.user.id && k.status === "active" && new Date(k.expiresAt) > new Date()).length,
    bannedKeys: req.user.role === 'admin' 
      ? db.keys.filter(k => k.status === "banned").length
      : db.keys.filter(k => k.ownerId === req.user.id && k.status === "banned").length
  };

  res.json({ success: true, stats: userStats });
});

app.get("/api/users", authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: "Admin access required" });
  }

  const users = db.users.map(user => ({
    id: user.id,
    username: user.username,
    role: user.role,
    email: user.email,
    createdAt: user.createdAt
  }));

  res.json({ success: true, users });
});

app.put("/api/settings", authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: "Admin access required" });
  }

  Object.assign(db.settings, req.body);
  saveJSON("settings.json", db.settings);

  res.json({ success: true, settings: db.settings });
});

app.get("/api/settings", authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: "Admin access required" });
  }

  res.json({ success: true, settings: db.settings });
});

app.listen(PORT, () => {
  console.log(`🚀 Eclipse Auth System running on port ${PORT}`);
  console.log(`🔐 Default admin: jadx / fezy123456`);
});
