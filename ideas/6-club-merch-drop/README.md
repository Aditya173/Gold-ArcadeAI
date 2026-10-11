# Idea 6: club season drop

A club's organizer shares the season album. The Gold SDK reads it (with people off) for the
season's signature and palette, which become group pieces for the clubhouse: a printed rug and a
wall print. A member who opts in tags the events they were at; only those events are read, and if
their season stands out from the club's they are offered a sterling pendant. Nobody is found by
face, and a member who doesn't opt in is never read.

```
python ideas/6-club-merch-drop/club_drop.py
```

Runs offline on an **invented** club (`gold_sdk/fixtures/club_tidewater_*.json`) and three invented
opt-ins (`member_optins.json`). Writes `out/6-club-merch-drop/` (gitignored): `drop_public.html`
(group pieces, photo-free, no members), `member_person-1.html` (local, that member only),
`arcade_requests.json`, `briefs.json`. Cost: $0. Needs `pip install -r requirements.txt`.

- `--selftest`: offline checks (consent and event gates, who gets read, planner rules, page privacy, retry rule).
- `--plan`: plan with Claude instead of `recorded_plans.json` (needs `ANTHROPIC_API_KEY`).
- Never calls Arcade live. At the hackathon: `ARCADE_LIVE=1 python arcade/run_designs.py --briefs 6-club-merch-drop/briefs.json`.

Plan: `FRAMEWORK.md`. Market: `RESEARCH.md`. What's unproven: `OPEN_QUESTIONS.md`.
