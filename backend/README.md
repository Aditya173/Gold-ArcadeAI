# Storefront backend

Firebase Functions + Firestore for the Gold × Arcade storefront: a Gold insight pack in, a published store of
made-to-order Arcade pieces out, with a mock checkout. The UI is built separately against **[API.md](API.md)**.

```
GET /packs → attach a pack → create store → plan → design (mock Arcade) → owner review → publish → Buy → mock checkoutUrl
creator brand kit + fan's pack → item (brand rules checked) → creator's marketplace feed → Buy → mock checkoutUrl
```

| Path | What |
|---|---|
| `functions/index.js` | the one HTTP function `api`: routes, ID-token auth, error codes |
| `functions/src/packs.js` | Gold insight packs from `../gold_sdk/fixtures` and `../gold_sdk/insights`, checked against the reading contract |
| `functions/src/planner.js` | a JS port of `planner/planner.py` (SYSTEM prompt and `check()`), plus the offline plans |
| `functions/src/arcade.js` | Arcade client; refuses any non-local host unless `ARCADE_LIVE=1` |
| `functions/src/flow.js` | the store pipeline steps, each taking `db` |
| `functions/src/marketplace.js` | idea 7, a JS port of `marketplace/marketplace.py`: brand kits, fan items, `check_item`, feed, buy |
| `functions/data/plan_creator_maya.json` | the recorded plan for the `creator_maya` fixture |
| `firestore.rules`, `storage.rules` | clients only read; owner-only stores, evidence and insights; public copies readable by anyone |
| `functions/test/marketplace.test.js` | the marketplace rules (the Python selftest cases, ported) |
| `test/rules.test.js` | rules tests (emulator), including: the public store cannot read evidence; a non-maker cannot read a marketplace item's private owner doc; nobody writes `marketplace` directly |
| `test/e2e.mjs` | the whole API over HTTP in the emulators against the mock Arcade, marketplace included |

## Run it

Needs Node 20+, Java 11+ (Firestore emulator), the Firebase CLI (`npm i -g firebase-tools`) and Python with
`pip install -r ../requirements.txt` (the mock Arcade).

```bash
npm install && (cd functions && npm install)
cp functions/env.local.example functions/.env.local

npm test                                   # functions unit tests: offline, no emulator (starts the mock itself)
npm run test:rules                         # Firestore + Storage rules in the emulator

python ../arcade/mock_arcade.py --serve 8787    # in a second terminal: the mock Arcade
npm run e2e                                # full API flow in the emulators
npm run emulators                          # or keep the emulators up for the UI
```

`npm test` runs the mock with `python`; set `PYTHON` to use another interpreter. If the Functions emulator
reports "Timeout after 10000" while loading, set `FUNCTIONS_DISCOVERY_TIMEOUT=60` and run again.

## What is stubbed

| Piece | Today | Later |
|---|---|---|
| Gold reading | An insight pack attached to the user (`POST /users/{uid}/insights`). Every reading is marked `stub: true`, and public stores say so. No photos are uploaded or read | The protected Gold SDK produces the same `gold.reading.v0` from the user's own photos. `storage.rules` already keeps uploads owner-only |
| Plan | No `ANTHROPIC_API_KEY`: the recorded plan for `creator_maya`, otherwise a plain template plan built from the reading. Both go through the same `check()` | Set `ANTHROPIC_API_KEY` (hackathon key): one Claude call, retried once with the rule errors. No spend cap or cache in the JS port yet |
| Arcade | The mock at `ARCADE_BASE_URL` (`http://127.0.0.1:8787/v1`): placeholder images, mock prices, a mock `checkoutUrl` that is never paid | The real Arcade base URL and key at the hackathon, with `ARCADE_LIVE=1` |
| Rings | Checkout refuses them: the order line carries no ring size | Add a size to the order line |
| Marketplace items | Recorded items for the three demo fans (`marketplace/fixtures/recorded_items.json`), otherwise a plain template fill from the fan's strongest idea with a generic public tag | With `ANTHROPIC_API_KEY`: one Claude call per item (no retry), checked by the same rules |
| Brand assets | Registered with Arcade's references API from the kit's metadata; no image bytes are uploaded (the kit carries none) | Upload the bytes to `uploadUrl` once kits carry files |
| Royalty | `royalty_pct` is stored on each item; nothing pays it | Depends on how Arcade handles seller markup (open question in `marketplace/README.md`) |

Archetype packs mark their signature `unmeasured`; the review screen should say the reading is an example.

## Deploying

`firebase deploy` uploads only `functions/`, so a predeploy step (`node functions/src/packs.js --copy`)
copies the packs and the marketplace fixtures into `functions/data/` (gitignored) first.
