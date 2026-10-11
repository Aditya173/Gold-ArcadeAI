# Idea 2, fork 1 framework: the diner line

1. **Group and buyer.** A person whose roll is full of meals; they buy for themself, or a friend buys a
   gift. Four pieces at mock prices of $45–$70. Today: $15–23 custom towels, or nothing.
2. **Photos in.** Their own food photos (the whole roll, filtered on the device to food places). No venue
   step: every table counts, because the subject is the person, not a room. Dining companions never
   appear in a piece or any shared evidence.
3. **Reading (Gold SDK).** `places[]` for the **diner check** (`diner()`): food places cover ≥ 50% of the
   moments. `signature[]` for motifs and whys. `palette[]` for print `colors`; the SDK's palette note says
   a palette across many restaurants is a mood, not one room, and the owner page says so. The SDK reports
   reliability per field; unmeasured fields are dropped. `named_places[]` is never used.
4. **Reading → line.** Tea towel (textile), print, pillow, plate. Rules in code: `planner.check`; each
   piece tagged self / gift / self+gift; the towel is a printed tea towel (a loom-woven towel is not a
   printed product); the plate's why says "display plate"; no restaurant, city or person in a prompt.
5. **Arcade (offline).** Same as the main line: mock transport, saved bodies, declines shown, mock prices.
6. **Surface.** `owner.html` private; `gift.html` with no counts, no places, no photos.
7. **Money.** The person or the gifter pays at `checkoutUrl`. No margin claimed.
8. **Measure.** Blind: this line vs a generic food line vs a form line ("your three favourite dishes").
   Business: a "would buy or gift at this price" rate against a $15 towel. Not run.
9. **Risks.** Where someone eats is sensitive (no places anywhere); companions in photos; invented reasons
   (`planner.check`); maker refusals.
10. **Demo.** `python ideas/2-cafe-house-goods/fork-1/diner_line.py --demo`, $0.
