# Idea 4: trip capsule

After a trip, a traveller gets a small capsule made from that trip's photos: a wall print and a tea
towel in the trip's own colours, each with a "why" that quotes the reading. The Gold SDK proposes
the trips (`trips[]`), then reads each trip's photos on their own for its signature and palette.

```
python ideas/4-trip-capsule/trip_capsule.py
```

Runs offline on an **invented** traveller (`gold_sdk/fixtures/traveller_noor*.json`): 3 proposed
trips, 2 capsules (the third has too few moments), 4 request bodies validated by the mock Arcade.
Writes `out/4-trip-capsule/` (gitignored): `owner_<trip>.html` (local only: dates, evidence refs,
reliability), `gift_<trip>.html` (photo-free, city and month only), `arcade_requests.json`,
`briefs.json`. Cost: $0. Needs `pip install -r requirements.txt` (the mock uses `jsonschema`).

- `--selftest`: offline checks (planner rules, retry rule, page privacy).
- `--plan`: plan with Claude instead of `recorded_plans.json` (needs `ANTHROPIC_API_KEY`).
- Never calls Arcade live. At the hackathon: `ARCADE_LIVE=1 python arcade/run_designs.py --briefs 4-trip-capsule/briefs.json`.

Plan: `FRAMEWORK.md`. Market: `RESEARCH.md`. What's unproven: `OPEN_QUESTIONS.md`.
