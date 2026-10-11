# Idea 6 framework: a club's season drop, on the Gold SDK

**X = run clubs, climbing gyms, teams and student orgs, Y = a season keepsake drop**: group pieces
for the clubhouse (a printed rug and a wall print, paid by the organizer) and, for a member who opts
in, a personal pendant from the events they were at. Built on `gold_sdk.read(photos)`
(`gold.reading.v0`, see `gold_sdk/README.md`). How photos are read is not in this repo. Code:
`club_drop.py`.

**No same-for-everyone pendant.** A pendant costs about $100 or more; one with no member reading
behind it is just club merch at the wrong price.

## 1. Group and buyer

| | Group piece | Member piece |
|---|---|---|
| Who uses it | The organizer | Each member who opts in |
| Who pays | The organizer, from dues, a fundraiser or a gym's retail budget | The member |
| Price | About $100 and up (Arcade's anchor); the rug's real price is unknown | Sterling pendant, about $100 (mock estimate) |
| How often | Once per season, race or anniversary | Same moment, once |
| Precedent | End-of-season coach gift, team plaque | Championship rings $189–350; finisher posters $37–217 |
| What they use today | Custom Ink group orders, SquadLocker/TeamSnap stores, Bonfire pre-orders, Fourthwall, Shopify plus Printful (all apparel) | Same |

**Timing rule:** sell only at a moment (season end, race, anniversary).

## 2. Photos in

- **Group:** the organizer's shared season album (Google Photos or iCloud link). The organizer
  confirms they may share it and that the photographers agreed; photos anyone opted out of are
  dropped before reading.
- **Member:** a member opts in, gets an **anonymous ref** (`person-N`), and ticks the album events
  they were at from the event list (events are grouped by time and place, not by who is in them).
  Only those events' photos are read for their piece. A member who doesn't opt in is never read.
- **Never:** face matching across the album, a scan of everyone in it, or anyone's whole camera roll.
- **Opt-in "find me" by selfie** is a possible later option, only with explicit consent and only for
  that member. Not built.

## 3. Reading: which fields, and why

| Field | Used for | Why |
|---|---|---|
| `signature[]` of the album | The group pieces' motifs and whys ("Dawn harbour runs show up in 42% of the club's moments") | What sets this club's season apart |
| `palette[]` of the album | Rug and print `colors` | Arcade print products take exact hex colours |
| `places[]` | Context in the planner input (waterfront, cafe, trail) | Kinds of place, never named places |
| `signature[]` of a **member's own slice** | The pendant's motif and why | Their piece differs because their season did, not because they typed a name |
| `people[]` | **Never requested for the album.** If present, the code drops it before planning | The group path uses nobody's identity; members are identified only by their own opt-in ref |
| `named_places[]`, `trips[]` | Not used | Club locations stay off every page |

**Reliability.** The SDK reports reliability per field. A member gets a pendant only when:
1. they tagged at least 5 events (fewer, and no slice is read at all);
2. the SDK reports the slice's `signature` as `measured`;
3. their top idea stands out from the club's (at least 1.5x its club share), so the pendant is
   theirs and not the club's.
Otherwise: no pendant, and the run says which rule stopped it.

## 4. Signature → collection (the planner)

- **Club plan** (rug + wall art print) on the album reading; **member plan** (pendant necklace) on
  that member's slice. Claude when `--plan` is passed and `ANTHROPIC_API_KEY` is set; otherwise the
  hand-written `recorded_plans.json`.
- **Rules enforced in code (`planner.check`)**, each against the reading the plan came from: exact
  categories, colours only from that palette, no colours on jewelry, ideas only from that reading,
  every why quotes a stated share. A member's share checked against the club reading is refused, so
  a member why can't borrow the club's numbers or the other way round.
- **Prompt rules:** the rug is "printed" (makers decline "hand-tufted" or "woven" here); no club
  logo, institution or named place; pendants name metal, finish, size and thickness, with no stones
  by default.

## 5. Arcade (offline, mock only)

- Categories by name (`run_designs.pick`): Rug, Wall Art Print (inferred), Pendant Necklace (from
  Arcade's docs).
- Every body goes through `Arcade.design` on `mock_arcade.mock_transport` (schema-checked);
  deterministic `requestId` (`run_designs.rid`). The pendant body carries no `colors`.
- **Retry rule:** one simplified retry on a failed job or admission 400, then "not makeable".
- **Makeability check (before live):** a fresh reader reads each brief as a maker would (raised line
  at 22 mm castable? rug construction named?). The real read is a human maker.

## 6. Surface

- **Public drop page** (`out/6-club-merch-drop/drop_public.html`, photo-free): the group pieces only.
  No members, no evidence refs, no person refs.
- **Member page** (`member_<ref>.html`, local, that member only): their pendant, the number of events
  they tagged, their evidence refs (resolved to thumbnails on their own device), reliability.
- A pre-order window for the drop (copying Bonfire), not a standing store.

## 7. Money

- The organizer pays for group pieces; each member pays for theirs; always a human paying through
  `checkoutUrl` (this code never creates a checkout).
- Our share: a design fee or an affiliate share, unknown until Arcade says.
- Mock estimates only: printed rug $600, wall print $45, sterling pendant $103.50. Not quotes.

## 8. Measure

- **Does a real club album have a signature?** On one real album with a moment: does the club's
  reading differ from random crowds' photos more than chance? That is the gate.
- **Photos vs the organizer's answer:** before they see the drop, ask "What does your club do
  together?" If they name every theme, the photos add only a palette.
- **Do members' slices differ?** For real members' ticks: does a member's slice differ from a random
  same-size set of the club's events more than chance?
- **The business metric:** how many opted-in members say "yes" at about $100, and whether the
  organizer orders a group piece.

## 9. Risks

| Risk | Mitigation |
|---|---|
| Faces of people who didn't agree | No face matching; members self-tag; non-members never read |
| Photographers' rights | Organizer confirms consent; pieces are inspired by, not copies of, photos |
| A member page leaking | Local only; public page refuses person and evidence refs (asserted in code) |
| Logos and institutions | Never in a prompt |
| "The model invented a reason" | `planner.check` against the right reading |
| Price far above club merch | Sell only at a moment; no everyday drop |

## 10. Demo

```
python ideas/6-club-merch-drop/club_drop.py
```

Reads the invented club (`gold_sdk/fixtures/club_tidewater_*.json`) and three invented opt-ins
(`member_optins.json`): person-1 tagged 9 events and gets a pendant; person-2 tagged 3 (no slice
read); person-3 didn't opt in (never read). 3 bodies through the mock; pages under
`out/6-club-merch-drop/`. $0 Arcade, $0 Claude. `--selftest` runs offline.

**At the hackathon:** `ARCADE_LIVE=1 python arcade/run_designs.py --briefs 6-club-merch-drop/briefs.json --cap <cap>`.
