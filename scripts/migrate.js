'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', 'data.sqlite');
const db = new Database(DB_PATH);

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

const normalize = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

// Seed data mirrors the original in-memory dataset
const seed = [
    {
        address: '10 Anson Road, International Plaza, Singapore 079903',
        date: '2024-07-12',
        severity: 'Minor',
        description: 'Fender-bender at carpark entrance, no injuries reported.',
        source: 'Traffic police summary'
    },
    {
        address: '10 Anson Road, International Plaza, Singapore 079903',
        date: '2023-11-03',
        severity: 'Moderate',
        description: 'Two-vehicle collision along Anson Rd near loading bay.',
        source: 'Public report'
    },
    {
        address: '1 North Bridge Road, High Street Centre, Singapore 179094',
        date: '2022-05-19',
        severity: 'Minor',
        description: 'Cyclist skidded due to wet surface, treated on scene.',
        source: 'Ambulance dispatch log'
    },
    {
        address: '1 North Bridge Road, High Street Centre, Singapore 179094',
        date: '2024-02-28',
        severity: 'Major',
        description: 'Multi-vehicle pile-up during peak hour; 3 hospitalized.',
        source: 'Media report'
    },
    {
        address: '50 Jurong Gateway Road, JEM, Singapore 608549',
        date: '2021-09-08',
        severity: 'Moderate',
        description: 'Rear-end collision near taxi stand.',
        source: 'Traffic police summary'
    },
    {
        address: '18 Marina Gardens Drive, Gardens by the Bay, Singapore 018953',
        date: '2024-12-01',
        severity: 'Minor',
        description: 'Pedestrian tripped near crosswalk; assisted by staff.',
        source: 'Venue incident log'
    },
    {
        address: '3155 Commonwealth Ave W, The Clementi Mall, Singapore 129588',
        date: '2023-03-22',
        severity: 'Minor',
        description: 'Light collision at mall drop-off point.',
        source: 'Security report'
    },
    {
        address: '1 Raffles Place, One Raffles Place, Singapore 048616',
        date: '2022-10-14',
        severity: 'Major',
        description: 'Collision involving motorcycle; road closed briefly.',
        source: 'Media report'
    }
];

const insert = db.prepare(`
INSERT INTO accidents (address, address_normalized, date, severity, description, source)
VALUES (@address, @address_normalized, @date, @severity, @description, @source)
`);

const trx = db.transaction((rows) => {
    db.exec('DELETE FROM accidents;');
    for (const r of rows) {
        insert.run({
            address: r.address,
            address_normalized: normalize(r.address),
            date: r.date,
            severity: r.severity,
            description: r.description,
            source: r.source
        });
    }
});

trx(seed);

console.log('Migration + seed complete. Rows:', db.prepare('SELECT COUNT(*) AS c FROM accidents').get().c);


