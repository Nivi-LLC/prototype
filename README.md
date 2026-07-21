# NIVI Passports

Shareable **Product Intelligence Passport** prototype for India coffee.

**Scenario:** Continental Coffee shares one secure link with a European coffee roaster (Hamburg) for Arabica green beans sourced from **Farm 147**, Somwarpet, Kodagu, Karnataka.

Instead of 50 PDFs, the importer sees farm GPS, growing-season NDVI/weather, harvest evidence, Continental processing, lab AI decisions, container IoT, ocean guidance, customs match, and a long-term supplier recommendation.

## Open locally

```bash
cd /Users/sampath1/Documents/NIVI-LLC/prototype
python3 -m http.server 8080
```

Visit [http://localhost:8080](http://localhost:8080).

**Live site:** [https://nivi-llc.github.io/prototype/](https://nivi-llc.github.io/prototype/)

**Password:** `9999` (client-side gate for the stakeholder demo — not real security).

### Ask NIVI Intelligence

1. Open the **Ask NIVI** tab.
2. Paste a session key and click **Start 3 min** (session auto-clears after 3 minutes).
3. Ask about Farm 147 only — crop health, NDVI/heatmap, moisture, lab/EU risk, voyage, EUDR, accept/reject.

Answers are scoped to the dummy passport in `js/data.js` (including `riskFactors`) via a strict farm-only system prompt.

Chat requests go through a same-team Netlify proxy (`/api/ask` on [nivi-passports.netlify.app](https://nivi-passports.netlify.app)) so the browser can reach the model API without CORS errors.

Farm-only access control is enforced on the **server** (not just the prompt):
- Client sends `question` + short history only — it cannot set the system prompt or passport context
- Input allow/block gate (jailbreaks, other farms/origins, off-topic)
- Output filter before the reply is returned
- Matching client gate in `js/farm-guard.js` for instant refusals

Redeploy the proxy after function changes:

```bash
npx netlify-cli deploy --prod --dir=. --functions=netlify/functions
```

If you change `js/data.js`, refresh the server copy:

```bash
node -e "const fs=require('fs');const w={};new Function('window',fs.readFileSync('js/data.js','utf8'))(w);fs.writeFileSync('netlify/functions/_shared/passport.json',JSON.stringify(w.PASSPORT,null,2));"
```

## Demo identity

| Field | Value |
| --- | --- |
| Brand | NIVI Passports |
| Processor | Continental Coffee |
| Farm | Farm 147 · Ramesh Gowda |
| Batch | CC-AR-2026-00481 |
| PO / Shipment | PO-2026-00981 / SHIP-2026-00081 |
| Product | Arabica Plantation AA · 200 MT |
| Destination | Hamburg, Germany |

All values in `js/data.js` are **dummy data** for demonstration.

## Stack

Static HTML + CSS + vanilla JS. No build step.

- `index.html` — Tanee-style farm monitoring shell
- `css/passport.css` — light dashboard system
- `js/data.js` — dummy passport model
- `js/gate.js` — password gate (`9999`)
- `js/passport.js` — sidebar view switching + data bind
- `assets/` — farm NDVI map, NDVI chart, weather panel, beans imagery

## Design notes

Tanee-inspired light dashboard with **NIVI Passports** brand on the left header, named top-center navigation (Overview · Farm Map · Growing · Harvest · Chain · Trust · Future), monitoring cards, sector map, and a Future Intelligence view covering AI agents, EUDR digital twins, rural IoT, open APIs, carbon reporting, and first-mile integrity.
