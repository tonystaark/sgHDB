'use strict';

const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'data.sqlite');
const db = new Database(DB_PATH);

// Ensure table exists
db.exec(`
CREATE TABLE IF NOT EXISTS accidents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  address TEXT NOT NULL,
  address_normalized TEXT NOT NULL,
  date TEXT NOT NULL,
  severity TEXT NOT NULL,
  description TEXT NOT NULL,
  source TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_accidents_address_norm ON accidents(address_normalized);
CREATE INDEX IF NOT EXISTS idx_accidents_date ON accidents(date);
`);

const app = express();

// Serve static files (frontend)
app.use(express.static(__dirname));

// Simple JSON endpoint: latest accident by address
app.get('/api/accidents', (req, res) => {
    const q = String(req.query.address || '').trim();
    if (!q) return res.status(400).json({ error: 'address is required' });

    const normalize = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
    const normalized = normalize(q);

    // Prefer exact normalized match; else fallback to contains
    const exact = db.prepare(`
    SELECT * FROM accidents
    WHERE address_normalized = ?
    ORDER BY date DESC
    LIMIT 1
  `).get(normalized);

    if (exact) return res.json({ result: exact, matches: 1 });

    const likeParam = `%${normalized}%`;
    const partial = db.prepare(`
    SELECT * FROM accidents
    WHERE address_normalized LIKE ?
    ORDER BY date DESC
    LIMIT 1
  `).get(likeParam);

    if (partial) return res.json({ result: partial, matches: 'partial' });

    res.json({ result: null, matches: 0 });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});


