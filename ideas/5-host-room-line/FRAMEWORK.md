# Idea 5 framework: a host's room line, on the Gold SDK

**X = multi-unit short-term-rental hosts and boutique hotels, Y = a proposed line**: a house rug and
a house print shared by every room (only when the rooms really share colours), plus one pillow per
room in that room's own accent. Built on `gold_sdk.read(photos)` (`gold.reading.v0`, see
`gold_sdk/README.md`). How photos are read is not in this repo. Code: `host_line.py`.

**Pitch until tested: "one room photo in, one pillow out."** The house line is a hypothesis (see
`OPEN_QUESTIONS.md`).

## 1. Group and buyer

| | Decision |
|---|---|
| Who uses it | A host with several units, or a boutique hotel |
| Who pays | The host, for its own rooms (main). Guests may buy the same pieces later on the host's own page, the host earning a commission (side line) |
| Price | Arcade's anchor: simple pieces about $100, complex ones $1,000+. Mock figures are labelled estimates, never quotes |
| How often | At fit-out and at each refresh; again when a piece is damaged |
| What they use today | Minoan, turnkey furnishers, West Elm or Wayfair, a designer; Arcade Magic Match for one room to one rug |

## 2. Photos in

- **Curated upload, one folder per room**, of listing or setup photos the host owns (about 20 to 30
  per room). Never a scraped listing URL.
- **Consent at upload:** the host confirms it holds the rights to the photos.
- **How many rooms:** the demo caps nothing; a real app should cap per order.
- **People in photos** (a cleaner, a guest) are rare; no page ever shows a photo.

## 3. Reading: which fields, and why

The pipeline calls `read()` **once per room** (that room's photos) and **once for the whole
property** (all rooms together).

| Field | Used for | Why |
|---|---|---|
| `palette[]` per room | Each room's **accent**: its most saturated colour that is not a house colour | The pillow must belong to *that* room |
| `palette[]` of the property | **House colours**: property colours that recur in 2 or more room palettes | The rug and print must suit every room |
| `signature[]` (property and room) | The "why" each piece quotes ("Brass fittings appear in 42% of the property's moments") | Every claim quotes the reading exactly |
| `places[]` | Room type labels, generic only ("bedroom") | Never a property name or address |
| `people[]`, `named_places[]`, `trips[]` | **Not used** | A room line needs nobody's identity and no location |

**Reliability.** The SDK reports reliability per field. A house look is claimed only when **every**
reading's `palette` is `measured`; if any is `unmeasured`, or fewer than 2 colours recur, there are
no house pieces and the line is pillows only (the selftest covers both). The host board lists
reliability per field, per reading.

## 4. Signature → collection (the planner)

- **House plan** (rug + wall art print) planned on the property reading; **one pillow plan per room**
  planned on that room's reading. Claude when `--plan` is passed and `ANTHROPIC_API_KEY` is set;
  otherwise the hand-written `recorded_plans.json`.
- **Rules enforced in code:** `planner.check` (categories, prompt length, colours only from the
  palette, ideas only from the reading, every why quotes a stated share), plus this idea's own:
  - house pieces use **house colours only**;
  - each pillow carries its room's accent, and its why must say it **echoes** a colour the room
    already has (not "picked for you");
  - the rug is briefed as **printed** (makers decline "hand-tufted" or "woven" in a printed category);
  - pillow patterns stay clear of the seams.
- **Guest wording** is conditional: "proposed; if the host orders this line". The code refuses guest
  text with "chosen by your host", "the room you stayed in", evidence refs or person refs.

## 5. Arcade (offline, mock only)

- Categories mapped by name (`run_designs.pick`): Rug, Wall Art Print, Throw Pillow, all "inferred"
  in the fixture until the live list.
- Every body goes through `Arcade.design` on `mock_arcade.mock_transport` and is checked against
  Arcade's published request schema; `requestId` is deterministic (`run_designs.rid`).
- `colors` (print only, at most 10) come from the readings. No `referenceIds`: room photos are never
  sent to a maker.
- **Retry rule:** one simplified retry on a failed job or admission 400, then "not makeable". The
  selftest injects a failure.
- **Makeability check (before live):** a reader who has seen nothing else reads each brief as a
  maker would (pattern into a pillow seam? rug construction named?). The real read is a human maker
  at the hackathon.

## 6. Surface

- **Host board** (`out/5-host-room-line/host_board.html`, local only): house colours with "in k of n
  rooms", each room's accent, reliability, mock results, and the questions to ask before ordering.
- **Guest preview** (`guest_preview.html`, photo-free): the proposed pieces, labelled "Preview, not a
  store", with conditional wording. Published only if the host orders and says so.

## 7. Money

- The host pays Arcade's price per piece through `checkoutUrl` (a human step; this code never
  creates a checkout).
- Mock estimates: rug (5x8) $600, pillow cover $65, print $45. Stock comparison from a web search:
  a wool 5x8 rug about $339 and a linen 20x20 cover about $34 at a large furniture retailer. So a
  made-to-order room costs roughly twice stock; the case must be the look, not the price.
- Guest side line: the host's markup or commission on a guest sale. Arcade's seller terms and any
  trade price are to be confirmed on the day.

## 8. Measure

- **Does a real portfolio share a palette?** On consenting hosts' photos: do rooms from the same host
  share more colours than rooms drawn from different hosts? A shuffle test (shuffle host labels many
  times; the real overlap must beat almost all shuffles). If not, the house line goes.
- **Photos vs a 4-swatch form:** the host types wall, floor, sofa and one accent per room in 30
  seconds. Do the photos find a recurring colour the host left out, and does it change a piece?
- **Viewer check:** do the pieces stand out from the surfaces they sit on (a rug the colour of the
  floor disappears)?
- **The business metric:** 2 or 3 multi-unit hosts shown the board with a real 5x8 quote: would you
  order, for which units, at what price?

## 9. Risks

| Risk | Mitigation |
|---|---|
| Photo rights (Airbnb or a photographer may own them) | Host confirms rights at upload; no scraping |
| People in listing photos | No page shows a photo; nothing about people is read |
| Overclaiming to guests | Conditional wording, banned phrases checked in code |
| Leaking the property | Generic room labels only; no addresses or property names on any page |
| "Magic Match, batched" | The house-colour test must beat a shuffle on real hosts, or the idea reduces to per-room pillows |
| Wear and replacement | Ask about washability and spares; made-to-order lead time is weeks |

## 10. Demo

```
python ideas/5-host-room-line/host_line.py
```

Reads the invented host (`gold_sdk/fixtures/host_wren_*.json`: one property reading, three rooms),
finds 4 house colours and 3 accents, sends 5 bodies (rug, print, 3 pillows) through the mock, and
writes `out/5-host-room-line/`. $0 Arcade, $0 Claude. `--selftest` runs offline.

**At the hackathon:** `ARCADE_LIVE=1 python arcade/run_designs.py --briefs 5-host-room-line/briefs.json --cap <cap>`.
