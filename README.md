# NIVI PIOS — Product Intelligence Operating System

> The AI Operating System for Trusted Global Trade.

Prototype of **NIVI PIOS** for Continental Coffee · Farm 147 · batch `CC-AR-2026-00481` (Kodagu Arabica → Hamburg).

This is not a digital passport archive. It answers:

1. What is happening?
2. Why?
3. What should I do next?
4. What is the financial impact?
5. How confident is the AI?
6. What evidence supports it?
7. What if I choose differently?
8. Compared with what?

## Domains

| Tab | Intelligence |
| --- | --- |
| **Exec** | Business health, revenue opportunity / at risk, primary AI decision |
| **Grow** | Growing decision with yield / ₹ impact |
| **Harvest** | Grade, premium, buyer match |
| **Chain** | Voyage / intervene-or-hold |
| **Docs** | Decision evidence pack |
| **Buy** | Procurement recommendation |
| **Decide** | Scenario simulation engine |
| **Memory** | Product Memory™ lifecycle |
| **Ask** | AI Copilot (Farm 147 only) |

## Open locally

```bash
cd /Users/sampath1/Documents/NIVI-LLC/prototype
python3 -m http.server 8080
```

Visit [http://localhost:8080](http://localhost:8080).

**Live site:** [https://nivi-llc.github.io/prototype/](https://nivi-llc.github.io/prototype/)

**Password:** `9999` (client-side gate — not real security).

### AI Copilot

1. Open **Ask**
2. Paste session key → **Start 3 min**
3. Ask decision questions for this batch only

Proxy: [nivi-passports.netlify.app/api/ask](https://nivi-passports.netlify.app/api/ask)

```bash
npx netlify-cli deploy --prod --dir=. --functions=netlify/functions
```

Refresh server passport context after `js/data.js` changes:

```bash
node -e "const fs=require('fs');const w={};new Function('window',fs.readFileSync('js/data.js','utf8'))(w);fs.writeFileSync('netlify/functions/_shared/passport.json',JSON.stringify(w.PASSPORT,null,2));"
```

## Demo identity

| Field | Value |
| --- | --- |
| Platform | NIVI PIOS |
| Processor | Continental Coffee |
| Farm | Farm 147 · Ramesh Gowda |
| Batch | CC-AR-2026-00481 |
| Primary decision | Accept shipment (94% confidence) |

All values in `js/data.js` are **dummy data**.

## Stack

Static HTML + CSS + vanilla JS.

- `js/pios.js` — decision / memory / simulation rendering
- `js/data.js` — PIOS model (decisions, predictions, Product Memory)
- `js/ask-nivi.js` + Netlify `/api/ask` — farm-scoped copilot
