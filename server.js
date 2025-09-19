// server.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// Разрешаем кросс-доменные запросы
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const dbFile = path.join(__dirname, "keys.json");
const ADMIN_PASSWORD = process.env.KEY_ADMIN_PASSWORD || "SuperSecret123";

// ---------- Ключи ----------
function loadKeys() {
  if (!fs.existsSync(dbFile)) fs.writeFileSync(dbFile, JSON.stringify([]));
  return JSON.parse(fs.readFileSync(dbFile, "utf-8"));
}

function saveKeys(keys) {
  fs.writeFileSync(dbFile, JSON.stringify(keys, null, 2));
}

function generateKey() {
  return (
    Math.random().toString(36).substring(2, 10) +
    "-" +
    Math.random().toString(36).substring(2, 10)
  ).toUpperCase();
}

// ---------- API ----------

// Проверка пароля
app.post("/api/admin-login", (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) res.json({ success: true });
  else res.json({ success: false });
});

// Получить все ключи
app.get("/api/keys", (req, res) => {
  res.json(loadKeys());
});

// Создать новый ключ
app.post("/api/keys", (req, res) => {
  const { days } = req.body;
  const keys = loadKeys();

  const key = {
    value: generateKey(),
    banned: false,
    expiresAt: days
      ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
      : null,
  };

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

app.listen(PORT, () =>
  console.log(`✅ Eclipse admin & keys site запущен: http://localhost:${PORT}`)
);
