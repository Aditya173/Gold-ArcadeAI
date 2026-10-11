# Gold × Arcade

A hackathon project: turn the photos someone chooses into a small collection of made-to-order
pieces on [Arcade](https://arcade.ai) — jewelry, rugs, pillows, prints — with a reason behind
every piece.

## Start here

| Doc | For |
|---|---|
| [`BRIEF_MARKETPLACE.md`](BRIEF_MARKETPLACE.md) | **Today's build.** Part 1: every screen and the demo video (for the UI teammate). Part 2: the backend, endpoints, Arcade style and product creation, Instagram via Meta, and the build plan |
| [`MAC_BUILD_PROMPT.md`](MAC_BUILD_PROMPT.md) | One paste-in prompt that builds, compiles and runs the whole app on a Mac |
| [`backend/API.md`](backend/API.md) | The API the app calls |
| [`HACKATHON_DAY.md`](HACKATHON_DAY.md) | Switching from the mock to live Arcade |

```
photos ──► Gold SDK ──► reading ──► planner ──► Arcade briefs ──► Arcade (mock until the hackathon)
           (protected)  what sets     a store +    schema-checked     designs, prices, checkout
                        them apart    "why" lines  request bodies
```

| Folder | What |
|---|---|
| `gold_sdk/` | The only boundary to Gold: the reading contract, **Gold insight packs** (8 archetypes) and invented example people. The demo plugs one pack into each user |
| `planner/` | Reading → store + pieces. Its rules are enforced in code: colours only from the palette, every "why" quotes a real share |
| `arcade/` | Arcade client, a mock built from Arcade's published OpenAPI spec, and the design runner. **Live calls are off** unless `ARCADE_LIVE=1` |
| `marketplace/` | **Idea 7**: a creator's brand template + a fan's Gold insights → a custom piece listed on the creator's marketplace |
| `backend/` | The API the app's UI is built against (Firebase Functions + Firestore) |
| `ideas/` | Six group → product ideas, researched and framed end to end (idea 7 is `marketplace/`) |
| `research/` | Background research on taste, brand reading and creator merch |

```bash
pip install -r requirements.txt
python gold_sdk/gold_sdk.py --selftest
python planner/planner.py --selftest
python arcade/mock_arcade.py --selftest
```

Every push goes through `tools/leak_scan.py` (a pre-push hook).
