# Idea 2, fork 1: the diner line ("goods from the tables you love")

**The crossroads.** Whose photos carry the food signal, the café owner's or the diner's? The main folder
builds for the owner. This fork builds for the diner: a person's own food photos → a printed tea towel,
print, pillow and display plate, for themself (`self`), as a gift (`gift`), or both.

```
python ideas/2-cafe-house-goods/fork-1/diner_line.py --demo
```

Offline, against the invented `diner_theo` reading and the mock Arcade: $0 Arcade, $0 Claude (recorded
plan). Reuses `../cafe_line.py`.

Writes to `out/2-cafe-house-goods/fork-1/`: `owner.html` (private), `gift.html` (no counts, places or
photos), `plan.json`, `arcade_requests.json`.

`--selftest`: 5 offline checks (diner check, loom-woven towel refused, display plate, gift page clean).

Plan: `FRAMEWORK.md`. Prices: `RESEARCH.md`. Blockers: `../OPEN_QUESTIONS.md` (fork 1).
