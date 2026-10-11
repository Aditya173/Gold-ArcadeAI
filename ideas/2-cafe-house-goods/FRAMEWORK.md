# Idea 2 framework: independent cafés → a room set (owner fit-out)

The ten parts on the Gold SDK contract (`gold_sdk/README.md`). The owner buys a printed room set once, at
opening or a refit; the print and plate can also go on a guest shelf. Market figures are from
`RESEARCH.md`. The diner alternative is `fork-1/`.

## 1. Group and buyer

| | |
|---|---|
| Uses it | The owner or manager of one independent café, restaurant, bakery or food truck |
| Pays | The owner, for the room. Guests buy second, from a short shelf |
| Price | Pillow $69 and ceramic art $174 listed on Arcade; print $45 mock; printed rug unquoted. **No set total is quoted** until a printed rug is priced |
| How often | Once at opening or refit, then maybe a seasonal shelf piece |
| Today | A designer ($2k–$8k) or agency ($5k–$25k); a commissioned potter; logo mats ($41–$230); Shopify + Printful; owner-drawn pins; or nothing |

## 2. Photos in

- **A deliberate owner shoot:** 15–30 photos of one room, its crockery and its counter, over a few visits.
  The owner's everyday roll is not the input: it mixes the room with the rest of their life.
- Consent: the owner's own photos. Staff and regulars never appear in a piece, a reference image or any
  shared evidence.
- What leaves the device: the reading (text, hex); never photos.

## 3. Reading (Gold SDK fields used)

The SDK reports reliability per field; any field reported `"unmeasured"` is dropped before the planner.

| Field | Used for | Why |
|---|---|---|
| `places[]` | **Venue check** (`venue()`): the top place type must be a food place in ≥ 60% of the moments | A roll of many restaurants reads a diner, not a room; it is sent to the diner line. If `places` is unmeasured, no venue can be confirmed and the run stops |
| `signature[]` | Motif and "why" per piece | What sets the room apart: floor tile, shelves, chairs, windows |
| `palette[]` | `colors` on every print piece | Arcade print takes exact hex |
| `photos.events` | Shares per visit, not per photo | |
| `people[]`, `named_places[]` | **Not used** | Faces of staff and guests; no venue or street names in prompts |

## 4. Reading → room set (the planner)

`planner.evidence_text()` → one planner call, or `plan_recorded.json` without `ANTHROPIC_API_KEY` →
`planner.check()` plus room rules:
- Four pieces: printed entrance rug (room), wall print (room+shelf), banquette pillow (room), decorative
  plate (room+shelf). Each tagged `for`.
- Motifs from materials, geometry and colour; never a logo, the venue's name, text, people or the menu.
- Rug, pillow and textile prompts say "printed"; no prompt says tufted, hand-knotted, woven, loom or wool.
- The plate is decorative, for display only, until a maker confirms a food-safe glaze.
- No staff jewelry.

## 5. Arcade (offline)

Real client on `mock_arcade.mock_transport`; categories mapped by `run_designs.pick`; bodies saved to
`out/2-cafe-house-goods/arcade_requests.json`. Maker declines are shown, not hidden. Prices are mock; the
rug's mock price is built on a hand-tufted figure, and no set total is shown.

## 6. Surface

| Page | Who | Contents |
|---|---|---|
| `owner.html` | The owner | All four pieces, `for` tags, whys with shares, evidence refs, reliability, venue check, mock prices |
| `public.html` | Guests (link or QR at the counter) | Shelf pieces only, no photos, no counts, no refs |

## 7. Money

Room pieces: the owner pays at `checkoutUrl`. Shelf: each guest pays. A human always pays. The seller keeps
any markup plus Arcade's 5%. Gold's share (a setup fee per venue, or a cut of the shelf markup) is unset.

## 8. Measure

- **Blind owner test:** three lines per owner: V (from the shoot), G (from a form: "what do you serve?",
  "what colours is your room?"), and D (a null: a generic café). The owner fills the form **before**
  seeing any line and grades blind. Photos earn their place only if V beats G. Not run.
- **Business metric:** 3–5 owners asked what they would pay, piece by piece. Not asked.

## 9. Risks

| Risk | Mitigation |
|---|---|
| A diner's roll passes as a venue | `venue()` on measured `places` |
| Faces of staff and regulars | Never in a piece, reference or shared evidence |
| Logos and IP | No logo, name or text in any prompt |
| The model invents a reason | `planner.check` |
| A tufted rug brief | "printed" required, tufted/woven refused |
| Plates used as service ware | Display only, stated in the prompt |
| Categories don't exist | The line stands on rug + print + pillow |

## 10. Demo

```
python ideas/2-cafe-house-goods/cafe_line.py --demo
```

$0 Arcade, $0 Claude, offline, invented owner. Live Arcade is a human step at the hackathon.
