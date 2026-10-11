# Wiring: where everything plugs in (local simulation)

Everything runs **locally**. The Firebase **emulators** (auth, Firestore, functions) stand in for a server, and the
**mock Arcade** stands in for Arcade. Nothing is deployed, and no cloud Firestore is used.

```
 app (partner's UI)  ──HTTP──►  Functions emulator: backend/functions/index.js   (one function, `api`)
                                   │
   S2 Gold onboarding      ──►  GET /packs, POST /users/{uid}/insights   ──► src/packs.js ──► gold_sdk/insights/*.json
   S3 brand inputs         ──►  POST /instagram/scrape                   ──► src/instagram.js ──► instagram/scrape.py
                            ──►  POST /creators                           ──► src/marketplace.js ──► mock Arcade (references)
   S6 made for you + why   ──►  POST /creators/{id}/items                 ──► src/marketplace.js ──► mock Arcade (patterns, products)
   S8 marketplace          ──►  GET /creators/{id}/marketplace            ──► Firestore emulator: marketplace/*
   S7 product page         ──►  GET /marketplace/{itemId}, GET /assets/fake/{file}
   S9 buy                  ──►  POST /marketplace/{itemId}/buy            ──► mock Arcade checkout (or demo checkout for fakes)
   fill the marketplace    ──►  POST /dev/fake-products                   ──► src/fakes.js ──► marketplace/fixtures/fake_products/
```

## Run it

```bash
pip install -r requirements.txt                         # in a venv: jsonschema, pillow, gallery-dl
python arcade/mock_arcade.py --serve 8787               # terminal 1: mock Arcade
cd backend && npm install && cd functions && npm install && cd ..
cp functions/env.local.example functions/.env.local    # then set PYTHON to the venv's python
npm run emulators                                       # terminal 2: auth, firestore, functions (needs Java 17+)
curl -X POST http://127.0.0.1:5001/demo-storefront/us-central1/api/dev/fake-products   # terminal 3: fill the marketplace
```

API base for the app: `http://127.0.0.1:5001/demo-storefront/us-central1/api`. The Simulator reaches `127.0.0.1`; a
real phone needs the Mac's LAN IP. Every endpoint is in [`backend/API.md`](backend/API.md).

Checks: `npm test` (from `backend/functions`), `npm run test:rules`, `npm run e2e` (with the mock running), and
`npm run fakes` (fake products end to end; needs no mock).

## Where the synthetic archetype is

| What | Where |
|---|---|
| **The demo fan, Long-Table Host** (synthetic, fitted to Wishbone Kitchen) | [`gold_sdk/insights/archetype-long-table-host.json`](gold_sdk/insights/archetype-long-table-host.json) |
| The 8 Gold archetypes | `gold_sdk/insights/archetype-*.json` |
| How a pack becomes a user's "Gold onboarding" | `GET /packs` lists all 9; `POST /users/{uid}/insights {"pack": "archetype-long-table-host"}` attaches it (`backend/functions/src/packs.js`) |
| The example creator, Wishbone Kitchen | [`marketplace/fixtures/brand_wishbonekitchen.json`](marketplace/fixtures/brand_wishbonekitchen.json) (palette, motifs, 4 templates) |
| The fan's 4 suggestions with "why we chose this" (offline, deterministic) | [`marketplace/fixtures/recorded_items.json`](marketplace/fixtures/recorded_items.json), keys `wk-*\|archetype-long-table-host` |
| The format of a Gold reading | [`gold_sdk/README.md`](gold_sdk/README.md), [`gold_sdk/contract.schema.json`](gold_sdk/contract.schema.json) |

**To make the fan's pieces in the simulation:**
1. Create the creator: `POST /creators {"fixture": "brand_wishbonekitchen"}`.
2. As a fan, attach the pack: `POST /users/{uid}/insights {"pack": "archetype-long-table-host"}`.
3. Make each piece: `POST /creators/creator-wishbonekitchen/items {"templateId": "wk-runner"}` (also `wk-plate`,
   `wk-print`, `wk-pendant`).

Each comes back listed with a mock price, and the fan sees its private `why`. To change who the fan is, edit the
JSON pack (ideas, shares, palette, places), then update the matching recorded items. The rule checks reject any
"why" that quotes a share the pack doesn't have.

## Fake products (your partner fills the marketplace)

Add listings to [`marketplace/fixtures/fake_products/products.json`](marketplace/fixtures/fake_products/products.json)
and images to `marketplace/fixtures/fake_products/images/`. The format and rules are in that folder's
[README](marketplace/fixtures/fake_products/README.md). Load them with `POST /dev/fake-products` (emulator only;
safe to repeat). They appear in the feed next to the generated pieces with `fake: true`. Buying one gives a
demo checkout without Arcade.

## Shopify (Arcade AI plugin): placeholders only

The real marketplace would run on the creator's Shopify store through Arcade's plugin for Shopify. For the
hackathon it is **described, not built**: static placeholder elements in the UI (brief 1.2b) and a suggested design
(brief 2.13b). No route calls Shopify, and the local marketplace above is what the demo uses.

## Still to build (from `BRIEF_MARKETPLACE.md`, Part 2)

| Brief item | What it adds | Plugs into |
|---|---|---|
| U2 routes | `GET /marketplace` (one feed across creators), `GET /creators` (search), `/suggest` | `index.js` ROUTES |
| U3 feed | filters, `mine`, `maker`, `creatorName` on generated items (fakes already carry them) | `src/marketplace.js` |
| U4 onboarding | `POST /creators/onboard` (logos, palette, Instagram images -> Arcade references) | new `src/style.js` |
| U4b Meta API | Connect Instagram (owner's account) | new routes, `src/instagram.js` |
| U5 suggest | several pieces at once + `reasons[]` | `src/marketplace.js` |

Until then the simulation uses the routes above: `POST /creators` with the fixture, one `POST .../items` per template,
and `GET /creators/{id}/marketplace` for the storefront.
