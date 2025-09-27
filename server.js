import express from 'express';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import cors from 'cors';
import { randomBytes } from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

const dbFile = join(__dirname, 'db.json');

function loadDB() {
    if (!existsSync(dbFile)) writeFileSync(dbFile, JSON.stringify({ apps: [], keys: [] }, null, 2));
    return JSON.parse(readFileSync(dbFile, 'utf-8'));
}

function saveDB(db) {
    writeFileSync(dbFile, JSON.stringify(db, null, 2));
}

function generateKey(durationMs, owner_id, maxActivations) {
    return {
        value: 'KEYAUTH-' + randomBytes(8).toString('hex').toUpperCase(),
        owner_id,
        banned: false,
        expires_at: durationMs ? new Date(Date.now() + durationMs).toISOString() : null,
        created_at: new Date().toISOString(),
        hwid: null,
        activations: 0,
        max_activations: maxActivations || 1,
        last_activation: null,
        app_ids: []
    };
}

app.post('/api/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        return res.json({ success: true });
    }
    res.json({ success: false, message: 'Wrong password' });
});

app.get('/api/apps', (req, res) => {
    const db = loadDB();
    res.json(db.apps);
});

app.post('/api/apps', (req, res) => {
    const { name, owner_id, dll_url } = req.body;
    const db = loadDB();
    if (db.apps.length >= 2) {
        return res.status(400).json({ success: false, message: 'Maximum 2 apps allowed' });
    }
    const app_id = randomBytes(4).toString('hex');
    const app = { id: app_id, name, owner_id, dll_url, created_at: new Date().toISOString() };
    db.apps.push(app);
    saveDB(db);
    res.json(app);
});

app.post('/api/keys', (req, res) => {
    const { duration_ms, owner_id, max_activations, app_ids } = req.body;
    const db = loadDB();
    for (const app_id of app_ids) {
        if (!db.apps.find(a => a.id === app_id)) {
            return res.status(400).json({ success: false, message: `Invalid app_id: ${app_id}` });
        }
    }
    const key = generateKey(duration_ms, owner_id, max_activations);
    key.app_ids = app_ids;
    db.keys.push(key);
    saveDB(db);
    res.json(key);
});

app.post('/api/ban', (req, res) => {
    const { value } = req.body;
    const db = loadDB();
    const key = db.keys.find(k => k.value === value);
    if (key) {
        key.banned = true;
        saveDB(db);
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false, message: 'Key not found' });
    }
});

app.post('/api/unban', (req, res) => {
    const { value } = req.body;
    const db = loadDB();
    const key = db.keys.find(k => k.value === value);
    if (key) {
        key.banned = false;
        saveDB(db);
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false, message: 'Key not found' });
    }
});

app.post('/api/keys/delete', (req, res) => {
    const { value } = req.body;
    const db = loadDB();
    const initialLength = db.keys.length;
    db.keys = db.keys.filter(k => k.value !== value);
    if (db.keys.length < initialLength) {
        saveDB(db);
        res.json({ success: true, message: 'Key deleted successfully' });
    } else {
        res.status(404).json({ success: false, message: 'Key not found' });
    }
});

app.post('/api/auth', (req, res) => {
    const { key, hwid } = req.body;
    const db = loadDB();
    const keyData = db.keys.find(k => k.value === key);
    if (!keyData) return res.json({ valid: false, reason: 'not_found' });
    if (keyData.banned) return res.json({ valid: false, reason: 'banned' });
    if (keyData.expires_at && new Date(keyData.expires_at) < new Date())
        return res.json({ valid: false, reason: 'expired' });
    if (keyData.hwid && keyData.hwid !== hwid)
        return res.json({ valid: false, reason: 'hwid_mismatch' });
    if (!keyData.hwid && keyData.activations >= keyData.max_activations)
        return res.json({ valid: false, reason: 'max_activations' });

    if (!keyData.hwid) {
        keyData.hwid = hwid;
        keyData.activations += 1;
        keyData.last_activation = new Date().toISOString();
        saveDB(db);
    }

    const apps = db.apps.filter(a => keyData.app_ids.includes(a.id));
    res.json({ valid: true, expires_at: keyData.expires_at, apps });
});

app.get('/api/stats', (req, res) => {
    const db = loadDB();
    const totalKeys = db.keys.length;
    const activeKeys = db.keys.filter(k => !k.banned && (!k.expires_at || new Date(k.expires_at) > new Date())).length;
    const bannedKeys = db.keys.filter(k => k.banned).length;
    const expiredKeys = db.keys.filter(k => !k.banned && k.expires_at && new Date(k.expires_at) < new Date()).length;

    res.json({ totalKeys, activeKeys, bannedKeys, expiredKeys });
});

app.listen(PORT, () => {
    console.log(`🚀 KeyAuth-Inspired Server running on port ${PORT}`);
});
