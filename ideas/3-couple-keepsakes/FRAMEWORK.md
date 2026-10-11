# Idea 3 framework: couples → keepsakes

The ten parts on the Gold SDK contract (`gold_sdk/README.md`). Main path: one partner buys a matching
pendant pair for the two of them. Second path: a link-only registry page with a rug, a print and a pillow.
Market figures are from `RESEARCH.md`. The registry stays a preview until its buyer test runs.

## 1. Group and buyer

| | |
|---|---|
| Uses it | A couple, both with their own phone |
| Pays | Main: one partner (anniversary, engagement). Second: wedding guests, singly or as a group gift |
| Price | Pendant pair ~$250 sterling (mock: one design × 2); rug, print, pillow from the mock price model |
| How often | Once a year at most (anniversary); once (wedding) |
| Today | Etsy "where we met" maps and coordinate necklaces (a form), Zola, Minted, photo books, a jeweller |

## 2. Photos in

- Each partner's own camera roll, read on their own phone. **Both opt in.** The SDK merges the two
  readings; no photo leaves either phone.
- One roll alone is not a couple: the run stops at the consent gate.
- The couple approves every piece and line before any guest sees a page (approval step: designed, not built).

## 3. Reading (Gold SDK fields used)

The SDK reports reliability per field; unmeasured fields are dropped before the planner.

| Field | Used for | Why |
|---|---|---|
| `people[]` (opt-in) | **Consent gate** (`couple()`): two recurring anonymous refs, reported measured | Both partners opted in. No field, no couple, no guessing a partner from one roll |
| `signature[]` | Motif and why per piece | What the two rolls share |
| `palette[]` | Print `colors` | Arcade print takes exact hex |
| `trips[]`, `named_places[]` (opt-in) | **Owner page only**, as context for the couple | Never in a prompt (Arcade bans landmarks; privacy), never on the guest page |
| `photos.events` | The share of moments the second partner appears in (owner page) | |

## 4. Reading → keepsakes (the planner)

`planner.evidence_text()` → one planner call, or `plan_recorded.json` without `ANTHROPIC_API_KEY` →
`planner.check()` plus couple rules:
- Four pieces: pendant (one design, ordered as a pair), printed rug, print, printed pillow. **No rings.**
- No city, trip or venue name in any prompt or why (checked against the reading's own `named_places` and
  `trips`); never "where you met" or an engagement claim: only the couple can say that.
- Printed, never tufted or woven; colours only from the palette, none on jewelry.

## 5. Arcade (offline)

Real client on `mock_arcade.mock_transport`; bodies saved. **The pair:** the prompt describes one pendant;
`products/get` at quantity 2 and the buyer's `checkouts/create` line (quantity 2, no drop-ship needed)
are validated on the mock and saved to `order_requests.json`. Gold never sends a checkout; the client
refuses it and a human pays. Whether the price includes the chain is unverified until a real product.

## 6. Surface

| Page | Who | Contents |
|---|---|---|
| `owner.html` | The couple | Pieces, whys with shares, evidence refs, partner refs, trips, the pair price, reliability |
| `public.html` | Guests with the link | Pieces, briefs, colours. No photos, places, dates, counts or refs (checked) |

## 7. Money

Main: the buyer pays the pair at `checkoutUrl`. Registry: guests pay; a group gift would sit on an existing
registry as an external item. Gold's take is unset (a referral or a small fee).

## 8. Measure

- **Two-volunteer join:** two consenting people who travelled together; check the shared moments the
  reading finds against what they say happened. Not run.
- **Willingness to pay (anniversary):** 5–10 people in couples: "would you pay ~$250 for this pair?",
  once with a typed date and once with the reading's motif. Not run.
- **Guest chip-in:** 5–10 wedding guests: "would you chip in $100 toward this?" next to a cash fund. Not run.
- **Photos vs a form:** blind pick between pieces from the reading and from a form, another couple's reading
  as the null. Not run.

## 9. Risks

| Risk | Mitigation |
|---|---|
| Guests prefer cash | The anniversary path needs no guests |
| One-sided reading of a partner | Consent gate on `people[]`; no one-roll mode |
| Exes and old places | Shared moments only; couple approval |
| Location on a shared page | No places or dates on the guest page (checked) |
| Invented "where we met" | Refused in code |
| Engraving refused at pendant scale | A line and a dot, no tiny text; makeability unmeasured |

## 10. Demo

```
python ideas/3-couple-keepsakes/couple.py --demo
```

$0 Arcade, $0 Claude, offline, invented couple (`couple_june_and_ola`).
