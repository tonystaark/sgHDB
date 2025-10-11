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

API:

```http
GET /api/accidents?address=<address>
```



