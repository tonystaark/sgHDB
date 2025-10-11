## SG Address Accident Lookup

### Run locally

Option A (quick):

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Option B (Node serve):

```bash
npx --yes serve -s . --listen 5173
# open http://localhost:5173
```

### Obfuscate client script

Install deps and generate an obfuscated bundle (`script.obf.js`). The HTML tries to load `script.obf.js` and falls back to `script.js` if missing.

```bash
npm install
npm run obfuscate
```

Optional minified (non-obfuscated) build:

```bash
npm run minify
```

### Backend with SQLite

Install deps, migrate and seed, then start the server:

```bash
npm install
npm run migrate
npm start
# open http://localhost:8080
```

### CSV Data Import

Place your CSV file as `incidents.csv` in the project root with these columns:
- postal_code
- block
- location  
- date reported
- incident summary
- source url

Example CSV format:
```csv
postal_code,block,location,date reported,incident summary,source url
079903,10,"Anson Road, International Plaza, Singapore 079903",2024-07-12,"Fender-bender at carpark entrance",https://example.com/source
```

Then run:
```bash
npm run migrate  # This will parse incidents.csv and populate the database
```

API:

```http
GET /api/incidents?postal_code=<6-digit-postal-code>
```



