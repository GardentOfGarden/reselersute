const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const dbFile = path.join(__dirname, "keys.json");

// Загрузка ключей
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
  };
}

// Login для админа
app.post("/api/login", (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    return res.json({ success: true });
  }
  res.json({ success: false, message: "Wrong password" });
});

// Получить все ключи
app.get("/api/keys", (req, res) => {
  res.json(loadKeys());
});

// Создать новый ключ
app.post("/api/keys", (req, res) => {
  const { durationMs } = req.body;
  const keys = loadKeys();
  const key = generateKey(durationMs);
  keys.push(key);
  saveKeys(keys);
  res.json(key);
});

// Забанить ключ
app.post("/api/ban", (req, res) => {
  const { value } = req.body;
  let keys = loadKeys();
  keys = keys.map((k) => (k.value === value ? { ...k, banned: true } : k));
  saveKeys(keys);
  res.json({ success: true });
});

// Проверка ключа
app.post("/api/check", (req, res) => {
  const { value } = req.body;
  const keys = loadKeys();
  const key = keys.find((k) => k.value === value);
  if (!key) return res.json({ valid: false, reason: "not_found" });
  if (key.banned) return res.json({ valid: false, reason: "banned" });
  if (key.expiresAt && new Date(key.expiresAt) < new Date())
    return res.json({ valid: false, reason: "expired" });
  res.json({ valid: true });
});

app.listen(PORT, () => console.log(`✅ Eclipse server running at http://localhost:${PORT}`));
