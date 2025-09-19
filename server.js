// server.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASS = process.env.ADMIN_PASS || null; // на Render укажи свой секрет в Environment

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

const dbFile = path.join(__dirname, "keys.json");

function loadKeys() {
  if (!fs.existsSync(dbFile)) fs.writeFileSync(dbFile, JSON.stringify([]));
  return JSON.parse(fs.readFileSync(dbFile, "utf8"));
}
function saveKeys(keys) {
  fs.writeFileSync(dbFile, JSON.stringify(keys, null, 2));
}
function genKey() {
  return (
    Math.random().toString(36).substring(2, 10).toUpperCase() +
    "-" +
    Math.random().toString(36).substring(2, 10).toUpperCase()
  );
}

// Middleware для защиты админ API по заголовку x-admin-pass
function adminAuth(req, res, next) {
  if (!ADMIN_PASS) return res.status(403).json({ error: "admin disabled" });
  const pass = req.headers["x-admin-pass"];
  if (!pass || pass !== ADMIN_PASS) return res.status(401).json({ error: "unauthorized" });
  next();
}

/* ===== Public API (использует лоадер) ===== */
app.post("/api/check", (req, res) => {
  const { value } = req.body || {};
  if (!value) return res.status(400).json({ valid: false, reason: "no_value" });

  const keys = loadKeys();
  const key = keys.find(k => k.value === value);
  if (!key) return res.json({ valid: false, reason: "not_found" });
  if (key.banned) return res.json({ valid: false, reason: "banned" });
  if (key.expiresAt && new Date(key.expiresAt) < new Date()) return res.json({ valid: false, reason: "expired" });
  return res.json({ valid: true });
});

/* ===== Admin API (for admin UI) ===== */
app.post("/admin/create", adminAuth, (req, res) => {
  const { days = null, note = null } = req.body || {};
  const keys = loadKeys();
  const key = {
    value: genKey(),
    banned: false,
    note: note || null,
    createdAt: new Date().toISOString(),
    expiresAt: days ? new Date(Date.now() + days * 24*60*60*1000).toISOString() : null
  };
  keys.push(key);
  saveKeys(keys);
  res.json(key);
});

app.get("/admin/keys", adminAuth, (req, res) => {
  res.json(loadKeys().sort((a,b)=> (new Date(b.createdAt)) - (new Date(a.createdAt))));
});

app.post("/admin/ban", adminAuth, (req, res) => {
  const { value, ban } = req.body || {};
  if (!value) return res.status(400).json({ error: "no_value" });
  const keys = loadKeys();
  const idx = keys.findIndex(k => k.value === value);
  if (idx === -1) return res.status(404).json({ error: "not_found" });
  keys[idx].banned = !!ban;
  if (ban) keys[idx].bannedAt = new Date().toISOString();
  saveKeys(keys);
  res.json({ ok: true, key: keys[idx] });
});

app.get("/admin/export.csv", adminAuth, (req, res) => {
  const keys = loadKeys();
  const lines = ["value,banned,createdAt,expiresAt,note"];
  keys.forEach(k => {
    lines.push([k.value, k.banned ? "1":"0", k.createdAt || "", k.expiresAt || "", (k.note||"").replace(/,/g," ")].join(","));
  });
  res.setHeader("Content-Type","text/csv");
  res.setHeader("Content-Disposition","attachment; filename=\"keys.csv\"");
  res.send(lines.join("\n"));
});

/* ===== Optional helper: create initial keys via GET (dev) ===== */
// app.get("/admin/create-test", adminAuth, (req,res)=>{ /* ... */ });

app.listen(PORT, () => {
  console.log(`Eclipse keyserver running on http://localhost:${PORT}`);
  if (!ADMIN_PASS) console.log("ADMIN_PASS not set: admin endpoints disabled");
});
