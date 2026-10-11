# Idea 1, fork 1: a private object from your own camera roll

**The crossroads.** Is the reading for a public audience (a creator selling to fans, the main folder) or
for the person themself? This fork builds the second: pieces made from the owner's own roll, which they
buy for themself or share as a gift list. Nothing is published, and no seller commission applies.

```
python ideas/1-creator-storefront/fork-1/owner_object.py --demo
```

Offline, against the invented `creator_maya` roll reading and the mock Arcade: $0 Arcade, $0 Claude
(recorded plan). Reuses `../creator_store.py` by import.

Writes to `out/1-creator-storefront/fork-1/`: `owner.html` (private: whys, evidence refs, reliability),
`gift.html` (no why, no count, no photo), `plan.json`, `arcade_requests.json`.

`--selftest`: 7 offline checks (measured signature used, owner language, gift page clean).

What changes from the main line: the roll's signature is reported as measured, so whys quote it; whys say
what the photos show, never what the owner likes, and never mention an audience or selling; no money gate.

Plan: `FRAMEWORK.md`. Notes: `RESEARCH.md`. Blockers: `../OPEN_QUESTIONS.md` (fork 1).
