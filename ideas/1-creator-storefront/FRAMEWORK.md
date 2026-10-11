# Idea 1 framework: creators → a signature capsule storefront

The ten parts, end to end, on the Gold SDK contract (`gold_sdk/README.md`). Group X = content creators
and personal brands (lifestyle, food, travel, fashion). Product Y = a 6–10 piece capsule their audience
can buy, with a reason behind each piece. Market figures are from `RESEARCH.md`. The private-object
alternative (the owner's own camera roll) is `fork-1/`.

## 1. Group and buyer

| | |
|---|---|
| Uses it | The creator: uploads a feed, approves the capsule, shares the link |
| Pays for goods | The audience, one piece each, at Arcade's checkout |
| Pays for Gold | The creator (a one-off capsule fee, $49–199 hypothesis) or nobody (a share of the commission) |
| Target tier | 25k–200k followers: qualifies for Arcade's entrepreneur program; audience already buys recommended goods |
| Not a fit | Under ~10k followers: too few buyers at Arcade prices |
| Price | Sterling pieces near $100, 14k pieces from ~$800, rugs from ~$400; 2–8× the ~$48 merch order |
| How often | One capsule per season or launch (unmeasured) |
| Today | Fourthwall, Printful + Shopify, Printify, Etsy, Stan Store, a freelance designer, Pietra, or Arcade directly. Prompt-to-merch is a commodity: Gold has to beat "the creator types a prompt into Arcade" |

## 2. Photos in

- **Curated upload** (this folder): the posted feed or shoot outtakes as a folder, 30–120 photos. No
  Instagram API, so no app review.
- The creator confirms they hold the rights to every photo.
- **What leaves the device:** the reading (text and hex), never photos. Arcade gets prompt text and hex
  colours. A photo goes to Arcade as a reference image only by per-photo opt-in, print pieces only.
- Other people in evidence photos: never a prompt input, never on a public page.

## 3. Reading (Gold SDK fields used)

`gold_sdk.read(photos)` returns a `gold.reading.v0`. The SDK reports reliability per field, and the
pipeline drops any field it reports as `"unmeasured"` before the planner sees it (`planner_view()`).

| Field | Used for | Why this idea needs it |
|---|---|---|
| `palette[]` | `colors` on print pieces; the store theme | Arcade print products take exact hex. On a feed these are labelled **"the feed's colours"** (partly the editing preset), never "the colours of your days" |
| `places[]` | The "why" on each piece in curated mode | A feed's settings (café, studio, home) are what the audience recognises |
| `signature[]` | The "why" and motif, **only if** `reliability.signature` is measured | A curated set this small may not be measurable; the invented feed fixture reports it as unmeasured, so this run's capsule rests on palette and places |
| `photos.events` | Shares are per moment | 40 shots of one shoot count once |
| `people[]`, `named_places[]` | **Not used** | Privacy, and Arcade prompts forbid people and landmarks |

## 4. Reading → capsule (the planner)

`planner/planner.py`: `evidence_text()` builds the input, one planner call (or the recorded plan
`plan_recorded.json` when there is no `ANTHROPIC_API_KEY`), then `check()` and this idea's rules.

- **Mix:** 2 jewelry (pendant, earrings) + 4 print (rug, pillow, print, plate). At least 2 entry-priced
  print pieces (print, pillow, plate, textile) so the capsule has something near the merch ticket.
- **Rules in code:** every "why" quotes a share the reading states (`planner.check`); colours only from
  the palette, none on jewelry; ideas only from the reading; rug, pillow and textile prompts say
  "printed", and no prompt says tufted, hand-knotted, woven, loom or wool (a maker reads those as a
  different product); the plate is decorative.
- Never a city, landmark, brand, logo, person or text in a prompt.

## 5. Arcade (offline)

- Category mapping: `arcade/run_designs.pick` against `arcade/categories_fixture.json` (Rings and Pendant
  Necklace from Arcade's docs; the rest inferred, ids invented until `categories/list` replaces them).
- Every body goes through the real `Arcade` client on `mock_arcade.mock_transport`: schema-checked,
  jewelry refuses `colors`, idempotent `requestId` (`run_designs.rid`). Bodies are saved to
  `out/1-creator-storefront/arcade_requests.json`.
- **Maker decline:** a job that fails "no maker can price this design" is shown as "maker declined",
  never hidden (selftest injects it). A spare brief and one simpler retry are the next step.
- Prices shown are **mock** (`mock_arcade.price`). The rug's mock price is built on a hand-tufted figure;
  a printed rug has no Arcade quote yet.

## 6. Surface

| Page | Who sees it | Contents |
|---|---|---|
| `out/1-creator-storefront/owner.html` | The creator, on their device | Store, cards, whys with their shares, evidence refs, reliability per field, mock prices, the money gate |
| `out/1-creator-storefront/public.html` | Anyone with the link | Names, briefs, colours. No photos, no evidence refs, no counts or shares (the run refuses to write it otherwise) |

## 7. Money

A fan pays at Arcade's `checkoutUrl`; a human always pays (the client refuses checkouts). The creator
earns Arcade's seller commission. **The money gate** (`money()`): the creator's take on the median
piece must reach $12.56, what one $45 print-on-demand hoodie leaves. At the public 5% on this run's
mock prices it is **NO-GO**; the selftest shows a 20% rate or equivalent markup would flip it. This is
the first question for Arcade (`OPEN_QUESTIONS.md`).

## 8. Measure

- **Blind test:** the capsule from the reading vs one from a two-line bio plus the colours a form
  collects; the creator picks "more me" without knowing which is which. A swapped-reading capsule (another
  person's reading) is the null. Not run.
- **Evidence check:** `planner.check` on every plan (pass/fail rule, runs every time).
- **Business metric:** a "would buy at this price" rate from a creator's real audience (a link-only page
  with a notify button per piece), against the 0.4–1.2% merch conversion. Not run.

## 9. Risks

| Risk | Mitigation |
|---|---|
| Creator earns ~5% of a sale | The money gate on every run; ask Arcade about rate and markup |
| Gold adds nothing over the creator's own prompt | The blind test; fallback is pet owners |
| The model invents a reason | `planner.check`: every share quoted must be in the reading |
| The feed measures the preset | Palette labelled "the feed's colours"; signature only if measured |
| Photos on a public page | Public page is photo-, ref- and count-free by check |
| Maker refusals | Declines shown; printed-only wording; spare briefs next |
| Category ids invented | `categories/list` replaces the fixture on the day |

## 10. Demo

```
python ideas/1-creator-storefront/creator_store.py --demo
```

$0 Arcade (mock), $0 Claude (recorded plan). With `ANTHROPIC_API_KEY` set and `--plan`, one cached,
spend-capped planner call replaces the recorded plan. At the hackathon, `ARCADE_LIVE=1` with
`arcade/run_designs.py` replays the saved bodies against the live API; that is a human step.
