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

- `index.html` — passport page
- `css/passport.css` — visual system
- `js/data.js` — dummy passport model
- `js/passport.js` — journey rail, scroll-spy, reveals
- `assets/` — farm NDVI map, NDVI chart, weather panel, hero & beans imagery

## Design notes

UI patterns adapted from Tanee Smart Farming (metric tiles, green health accents, map composition) and Farm Management Dashboard (sticky journey progress, dark trust panels). Visual direction is forest green + harvest amber—not the real-estate AURA prototype.
