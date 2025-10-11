'use strict';

const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'data.sqlite');
const db = new Database(DB_PATH);

const app = express();

// Serve static files (frontend)
app.use(express.static(__dirname));

// Simple JSON endpoint: all incidents by postal code
app.get('/api/incidents', (req, res) => {
  const postalCode = String(req.query.postal_code || '').trim();
  if (!postalCode) return res.status(400).json({ error: 'postal_code is required' });

  // Search by exact postal code match - return ALL incidents
  const results = db.prepare(`
    SELECT * FROM incidents
    WHERE postal_code = ?
    ORDER BY date_reported DESC
  `).all(postalCode);

  return res.json({
    results: results,
    count: results.length,
    postal_code: postalCode
  });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});


