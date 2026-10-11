# Idea 2: independent cafés → a room set

A café owner's shoot of their own room goes in; a printed room set comes out (entrance rug, wall print,
banquette pillow, decorative plate), with the print and plate also on a guest shelf.

```
python ideas/2-cafe-house-goods/cafe_line.py --demo
```

Offline, against an **invented** owner (`gold_sdk/fixtures/cafe_owner_lark.json`) and the mock Arcade:
$0 Arcade, $0 Claude (recorded plan unless `ANTHROPIC_API_KEY` and `--plan`). Needs
`pip install -r requirements.txt`. Reuses idea 1's plumbing (`../1-creator-storefront/creator_store.py`).

Writes to `out/2-cafe-house-goods/`: `owner.html`, `public.html` (the shelf), `plan.json`,
`arcade_requests.json`.

`--selftest`: 8 offline checks (venue check refuses a diner, printed rug, display plate, no staff jewelry,
shelf page clean).

| File | What |
|---|---|
| `RESEARCH.md` | Market, prices, precedents |
| `FRAMEWORK.md` | The ten parts on the Gold SDK contract |
| `OPEN_QUESTIONS.md` | The honest blockers |
| `fork-1/` | The alternative buyer: the diner, from their own food photos |

**Status:** no café has been read and no owner asked. See `OPEN_QUESTIONS.md`.
