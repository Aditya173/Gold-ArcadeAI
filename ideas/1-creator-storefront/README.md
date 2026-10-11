# Idea 1: creators → a signature capsule storefront

A creator's curated feed goes in; a six-piece capsule their audience can buy comes out, each piece with
a reason that quotes the reading exactly.

```
python ideas/1-creator-storefront/creator_store.py --demo
```

Runs offline against an **invented** creator (`gold_sdk/fixtures/creator_maya_feed.json`) and the mock
Arcade: $0 Arcade, $0 Claude (it uses `plan_recorded.json` unless `ANTHROPIC_API_KEY` is set and
`--plan` is passed). Needs `pip install -r requirements.txt` (the mock uses `jsonschema`).

Writes to `out/1-creator-storefront/` (gitignored): `owner.html` (creator only), `public.html`
(photo-free, no counts), `plan.json`, `arcade_requests.json` (every body validated by the mock).

`--selftest`: 13 offline checks (reliability gate, printed-not-tufted, entry pieces, maker decline,
money gate, public-page leaks).

| File | What |
|---|---|
| `RESEARCH.md` | Market, prices, what creators use today |
| `FRAMEWORK.md` | The ten parts on the Gold SDK contract |
| `OPEN_QUESTIONS.md` | The honest blockers |
| `fork-1/` | The alternative: the owner's own camera roll → pieces for themself or a gift list |

**Status:** the money gate prints NO-GO at Arcade's public 5% commission. That, and whether a reading
beats a form, are open (`OPEN_QUESTIONS.md`).
