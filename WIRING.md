# Wiring: where everything plugs in (local simulation)

Everything runs **locally**. The Firebase **emulators** (auth, Firestore, functions) stand in for a server, and the
**mock Arcade** stands in for Arcade. Nothing is deployed, and no cloud Firestore is used.

```
 app (partner's UI)  ──HTTP──►  Functions emulator: backend/functions/index.js   (one function, `api`)
                                   │
   S2 Gold onboarding      ──►  GET /packs, POST /users/{uid}/insights   ──► src/packs.js ──► gold_sdk/insights/*.json
   S3 brand inputs         ──►  POST /instagram/scrape                   ──► src/instagram.js ──► instagram/scrape.py
   S4 style                ──►  POST /creators/onboard                    ──► src/style.js ──► mock Arcade (references)
   S6 made for you + why   ──►  POST /suggest, GET /suggestions           ──► src/marketplace.js ──► mock Arcade (patterns, products)
   S8 marketplace          ──►  GET /marketplace, GET /creators           ──► Firestore emulator: marketplace/*
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
npm i -g firebase-tools && npm run emulators            # terminal 2: auth, firestore, functions (needs Java 21+)
npm run seed                                            # terminal 3: Wishbone Kitchen + its pieces + 2 fans
curl -X POST http://127.0.0.1:5001/demo-storefront/us-central1/api/dev/fake-products   # terminal 3: fill the marketplace
```

API base for the app: `http://127.0.0.1:5001/demo-storefront/us-central1/api`. The Simulator reaches `127.0.0.1`. A real
phone can't: the emulators and the mock listen on `127.0.0.1` only. Every endpoint is in [`backend/API.md`](backend/API.md).

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
1. Create the creator (as uid `seed-creator-wishbonekitchen`): `POST /creators/onboard {"fixture": "brand_wishbonekitchen"}`.
2. As a fan, attach the pack: `POST /users/{uid}/insights {"pack": "archetype-long-table-host"}`.
3. Make the pieces: `POST /suggest {"creatorId": "creator-wishbonekitchen", "count": 4}`.

`npm run seed` (from `backend/`) does all of this.

Each comes back listed with a mock price, and the fan sees its private `why`. To change who the fan is, edit the
JSON pack (ideas, shares, palette, places), then update the matching recorded items. The rule checks reject any
"why" that quotes a share the pack doesn't have.

## Demo-only images at the repo root (example creator)

the four `IMG_….jpg` files and `INSTAGRAM 1.png`, `INSTAGRAM 2.png` (Instagram screenshots) and `napkin.png`,
`pillow.png`, `placemat.png` (product images) are **for the demo video of the example creator, Wishbone Kitchen**:
the creator's brand inputs and product visuals on camera. **The app doesn't load them**, and the user (fan) flow
doesn't need them: a fan's pieces come from their Gold insight pack plus the creator's kit. Don't wire them into a
route or the seed.

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
