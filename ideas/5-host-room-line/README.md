# Idea 5: host room line

A host uploads photos of its rooms, one folder per room. The Gold SDK reads each room, and the
property as a whole. Out comes a **proposed** line: a house rug and print in the colours the rooms
share (only if they really do), and one pillow per room that echoes that room's own accent.
Guests could later buy the same pieces on the host's own page.

```
python ideas/5-host-room-line/host_line.py
```

Runs offline on an **invented** host (`gold_sdk/fixtures/host_wren_*.json`): 3 rooms, 4 house
colours, 5 request bodies validated by the mock Arcade. Writes `out/5-host-room-line/` (gitignored):
`host_board.html` (local only), `guest_preview.html` (photo-free, "Preview, not a store"),
`arcade_requests.json`, `briefs.json`. Cost: $0. Needs `pip install -r requirements.txt`.

- `--selftest`: offline checks (house-colour rule, accents, reliability gate, guest wording, retry rule).
- `--plan`: plan with Claude instead of `recorded_plans.json` (needs `ANTHROPIC_API_KEY`).
- Never calls Arcade live. At the hackathon: `ARCADE_LIVE=1 python arcade/run_designs.py --briefs 5-host-room-line/briefs.json`.

Plan: `FRAMEWORK.md`. Market: `RESEARCH.md`. What's unproven: `OPEN_QUESTIONS.md`.
