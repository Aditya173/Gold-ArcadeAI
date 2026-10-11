# Idea 3: couples → keepsakes

Both partners' camera rolls (both opted in) go in; a matching pendant pair one partner buys for the two of
them comes out, plus a printed rug, print and pillow for a link-only registry page.

```
python ideas/3-couple-keepsakes/couple.py --demo
```

Offline, against an **invented** couple (`gold_sdk/fixtures/couple_june_and_ola.json`) and the mock
Arcade: $0 Arcade, $0 Claude (recorded plan unless `ANTHROPIC_API_KEY` and `--plan`). Needs
`pip install -r requirements.txt`. Reuses idea 1's plumbing (`../1-creator-storefront/creator_store.py`).

Writes to `out/3-couple-keepsakes/`: `owner.html` (the couple), `public.html` (guests: no photos, places,
dates or counts), `plan.json`, `arcade_requests.json`, `order_requests.json` (the pair at quantity 2).

`--selftest`: 8 offline checks (consent gate, pair pricing, no rings, no places or "where you met", guest
page clean).

| File | What |
|---|---|
| `RESEARCH.md` | Weddings, registries, anniversary spend, precedents |
| `FRAMEWORK.md` | The ten parts on the Gold SDK contract |
| `OPEN_QUESTIONS.md` | The honest blockers |

**Status:** the registry path waits on a guest test; the pendant pair waits on a willingness-to-pay check.
