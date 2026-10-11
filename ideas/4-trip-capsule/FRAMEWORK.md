# Idea 4 framework: the trip capsule, on the Gold SDK

**X = travellers, Y = a small capsule per trip** (a wall print and a tea towel in that trip's
colours, a pendant for milestone trips). Built on one call, `gold_sdk.read(photos)`, which returns a
reading (`gold.reading.v0`, see `gold_sdk/README.md`). How photos are read is not in this repo.
Code: `trip_capsule.py`. Market: `RESEARCH.md`. Blockers: `OPEN_QUESTIONS.md`.

## 1. Group and buyer

| | Decision |
|---|---|
| Who uses it | A traveller with a phone camera roll, after a trip |
| Who pays | The traveller, for themselves or as a gift for a travel companion |
| Price | Arcade's own anchor: simple pieces about $100. The mock's lower print and textile figures are the team's estimate, shown on the owner page only, labelled "mock estimate" |
| How often | Once per trip; frequent travellers take several a year (RESEARCH §1) |
| What they use today | Polarsteps books, Mapiful-style map posters (typed in), Etsy coordinate pendants (typed in), Pandora-style charms (same for everyone), Etsy paintings of one holiday photo |

The creator variant (a travel creator selling a trip drop) is idea 1's storefront with a trip
filter and is not built here.

## 2. Photos in

- **Source:** the traveller's own camera roll, read on the device. Saved images, screenshots and
  photos received from other phones are left out by default (they carry wrong dates and other
  people's locations).
- **Picker:** the app's photo-library access (`expo-media-library`). Under iOS limited access the
  trip page says "built from the photos you shared", because missing days look like a short trip.
- **Per trip:** the app passes only the photos dated inside a trip to a second `read()` call. The
  traveller confirms each trip and can drop photos from it.
- **Consent, in plain words, before the scan:** "We look at the dates and places of your own photos
  to find your trips. Home is used only to tell trips from home, and stays on this phone." A second
  line names what goes to Claude (the trip's city and month, the reading's ideas, shares and colours;
  no images).
- **Reference photo (opt-in, per photo, print only):** "Use this photo as the print's reference? It
  will be sent to Arcade and a maker." Default off, with a note when a photo may show a person.

## 3. Reading: which fields, and why

| Field | Used for | Why this idea needs it |
|---|---|---|
| `trips[]` (place, start, end, events) | Finding each trip; the capsule's name ("Oaxaca, March") | The whole idea is per trip |
| `named_places[]` (opt-in) | The trip's city at metro level | The name on the gift page; never coordinates |
| `signature[]` of the **trip's own** reading | The print and tea-towel motifs, and the "why" | So each piece comes from that trip, not from the person's usual photos |
| `palette[]` of the trip's reading | The print and tea-towel `colors` | Arcade print products take exact hex colours |
| `photos.events` of the trip | The threshold (3 moments) | A trip with fewer moments is too thin for a palette |
| `people[]` | **Not used** | Companions are other people; a trip capsule needs nobody's identity |

**Reliability.** The SDK reports reliability per field (`measured` with a value, or
`unmeasured`). The pipeline reads it and acts on it:
- `trips` unmeasured (as in the demo fixture) → every trip is a *proposal*: the owner page says
  "confirm this trip first" and the gift page is marked "Draft, do not share yet".
- The planner may not lean on unmeasured fields. The owner page lists every field's reliability
  next to the pieces built on it.

## 4. Signature → collection (the planner)

- **One plan per trip**, through `planner/planner.py`: Claude when `--plan` is passed and
  `ANTHROPIC_API_KEY` is set; otherwise the hand-written `recorded_plans.json`.
- **Input:** `planner.evidence_text(trip_reading)`: the trip's ideas with their shares, its palette
  and kinds of place.
- **Output:** exactly two pieces per trip, a wall art print and a textile, each drawing on a
  different idea. The planner writes the pattern; the code appends the product line (a 30 x 40 cm
  matte archival print, unframed; a 50 x 70 cm cotton-linen tea towel).
- **Rules enforced in code (`planner.check`):** exactly the requested categories; colours only from
  *that trip's* palette (another trip's colour is refused); every idea cited exists in the reading;
  every "why" quotes a share the reading states, exactly ("Terracotta courtyards show up in 36% of
  this trip's moments"). No landmark, brand or transit mark in a prompt.
- **Trips under 3 moments** get no capsule; the run says why.

## 5. Arcade (offline, mock only)

- Categories are mapped by name with `arcade/run_designs.pick` against the fixture (Wall Art Print,
  Textile; both "inferred" until the live list).
- Each brief goes through `Arcade.design` with `mock_arcade.mock_transport`, so every body is checked
  against Arcade's published request schema. `requestId` is deterministic per brief
  (`run_designs.rid`), so a rerun replays instead of re-spending.
- `colors`: print only, at most 10, copied from the trip palette. Jewelry takes none.
- `referenceIds`: print only, at most 3, opt-in per photo. The mock does not implement the
  reference-upload calls, so the demo sends none.
- **Retry rule:** a failed job ("no maker can price this design") or an admission 400 gets one retry
  with a simplified prompt, then the piece is shown as "not makeable" rather than hidden. The
  selftest injects a failure to exercise it.
- **Makeability check (before live):** a reader who has seen nothing else reads each brief as a
  maker would (print holds at tea-towel scale? any landmark named?) and says make, revise or
  decline. A human maker's read at the hackathon is the real one.

## 6. Surface

- **Owner page** (`out/4-trip-capsule/owner_<trip>.html`, local only): the pieces with their whys,
  the trip's exact dates, the evidence refs (opaque ids the owner's device resolves to thumbnails),
  per-field reliability, mock results and the planner's input.
- **Gift page** (`gift_<trip>.html`, link-only, photo-free): one trip's pieces and whys, the city and
  month, no evidence refs, no exact dates, nothing about home. Marked a draft until the trip is
  confirmed. Published only as a separate, explicit step.
- **No public storefront.**

## 7. Money

- The buyer pays Arcade's price through Arcade's `checkoutUrl`, always a human step; this code never
  creates a checkout.
- Our share: an affiliate or partner share, or a flat design fee per capsule. Unknown until Arcade
  says what it offers.
- Our cost per capsule: one cached Claude call when planning live; $0 Arcade before the hackathon.

## 8. Measure

- **Trip confirmation:** for each proposed trip, "Is this a trip you took? Right dates? Merge or
  split?" The rate of "yes" is the trip field's real reliability for this product.
- **Photos vs a form (the test that matters):** per trip, the photo-built print vs a print planned
  from the city plus 3 typed answers (what you did, the mood, colours you liked) vs a generic
  city-name print, shown blind and shuffled. "Which is more this trip?"
- **Swap test:** a reader sees a brief with place names removed and picks which trip it is for. A
  brief that would fit any trip is re-planned once, then dropped.
- **The business metric:** "would you buy this at about $100?" from at least 5 travellers other than
  the builder, then conversion through `checkoutUrl` once live.

## 9. Risks

| Risk | Mitigation |
|---|---|
| Location is sensitive | Home stays on the device; gift pages show city and month only |
| Other people's photos | Own photos only by default; shared albums need each contributor's consent |
| People in a reference photo | References are opt-in per photo, with a warning when a person may be in it |
| Brand and IP filters | No landmarks, logos or transit marks by name |
| "The model invented a reason" | `planner.check` refuses any share the reading does not state |
| Maker refusals | Retry once simplified, then show as not makeable |
| Price above impulse | Ask at Arcade's ~$100 anchor; no "people pay" claim before real answers |

## 10. Demo

```
python ideas/4-trip-capsule/trip_capsule.py
```

Reads the invented traveller (`gold_sdk/fixtures/traveller_noor*.json`), finds 3 trips, builds
capsules for the 2 with enough moments, sends 4 bodies through the mock, and writes the pages to
`out/4-trip-capsule/`. Cost: $0 Arcade, $0 Claude (recorded plans). `--selftest` runs offline.

**At the hackathon:** refresh categories, then
`ARCADE_LIVE=1 python arcade/run_designs.py --briefs 4-trip-capsule/briefs.json --cap <cap>`
(the briefs file the demo writes under `out/`).
