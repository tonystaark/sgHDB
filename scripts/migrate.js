'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', 'data.sqlite');
const db = new Database(DB_PATH);

// Updated schema to match CSV columns
db.exec(`
CREATE TABLE IF NOT EXISTS incidents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  postal_code TEXT NOT NULL,
  block TEXT NOT NULL,
  location TEXT NOT NULL,
  date_reported TEXT NOT NULL,
  incident_summary TEXT NOT NULL,
  source_url TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_incidents_postal_code ON incidents(postal_code);
CREATE INDEX IF NOT EXISTS idx_incidents_location ON incidents(location);
CREATE INDEX IF NOT EXISTS idx_incidents_date ON incidents(date_reported);
CREATE INDEX IF NOT EXISTS idx_incidents_block ON incidents(block);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  subscription_tier TEXT DEFAULT 'free',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id);

CREATE TABLE IF NOT EXISTS api_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  endpoint TEXT NOT NULL,
  postal_code TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_usage_user_id ON api_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_timestamp ON api_usage(timestamp);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at DATETIME NOT NULL,
  used BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_token ON password_reset_tokens(token);
`);

db.exec('DELETE FROM users;');

// CSV parsing function with proper comma handling
function parseCSV(csvContent) {
    const lines = csvContent.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));

    const records = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const values = parseCSVLine(line);
        if (values.length >= 5) {
            const postalCode = values[0] || '';
            // Skip records with empty postal_code
            if (!postalCode.trim()) {
                console.log(`Skipping record ${i + 1}: empty postal_code`);
                continue;
            }
            records.push({
                postal_code: postalCode,
                block: values[1] || '',
                location: values[2] || '',
                date_reported: values[3] || '',
                incident_summary: values[4] || '',
                source_url: values[5] || ''
            });
        }
    }
    return records;
}

// Helper function to parse CSV line respecting quoted fields
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }

    // Add the last field
    result.push(current.trim());

    // Remove quotes from each field
    return result.map(field => field.replace(/^"(.*)"$/, '$1'));
}

// Check for CSV file
const CSV_PATH = path.join(__dirname, '..', 'hdb_incidents.csv');

let records = [];

if (fs.existsSync(CSV_PATH)) {
    console.log('Found hdb_incidents.csv, parsing...');
    const csvContent = fs.readFileSync(CSV_PATH, 'utf8');
    records = parseCSV(csvContent);
    console.log(`Parsed ${records.length} records from CSV`);
} else {
    console.log('No hdb_incidents.csv found, using sample data...');
    // Sample data in new format

}

const insert = db.prepare(`
INSERT INTO incidents (postal_code, block, location, date_reported, incident_summary, source_url)
VALUES (@postal_code, @block, @location, @date_reported, @incident_summary, @source_url)
`);

const trx = db.transaction((rows) => {
    console.log('Clearing existing incidents from database...');
    const deleteCount = db.prepare('SELECT COUNT(*) AS count FROM incidents').get().count;
    console.log(`Found ${deleteCount} existing incidents to delete`);

    db.exec('DELETE FROM incidents;');
    console.log('Successfully cleared all incidents from database');

    console.log(`Inserting ${rows.length} new incidents...`);
    for (const r of rows) {
        insert.run({
            postal_code: r.postal_code,
            block: r.block,
            location: r.location,
            date_reported: r.date_reported,
            incident_summary: r.incident_summary,
            source_url: r.source_url
        });
    }
    console.log(`Successfully inserted ${rows.length} incidents`);
});

trx(records);

console.log('Migration + seed complete. Rows:', db.prepare('SELECT COUNT(*) AS c FROM incidents').get().c);


