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

Redesigned to match the **Tanee Smart Farming** UI kit: floating dark icon sidebar, light gray canvas, white cards, green health accents, greenhouse-style monitoring grid, sector map view, device list, camera card, and journey task rail—applied to the Continental Coffee / Farm 147 passport story.
