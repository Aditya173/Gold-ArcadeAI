# Idea 1, fork 1 framework: a private object from your own roll

1. **Group and buyer.** The same people as idea 1, as owners, not sellers. The owner buys one piece at
   Arcade's price (sterling ~$100, 14k ~$800, mock), or a friend buys from the gift list. Today: a
   jeweller commission, Etsy custom, or nothing.
2. **Photos in.** The whole camera roll, read on the device (full-library permission). Nothing is published.
3. **Reading (Gold SDK).** `signature[]` (measured on a roll, so whys may quote it), `palette[]` (print
   `colors`), `places[]`. The SDK reports reliability per field; unmeasured fields are dropped before the
   planner. `people[]` and `named_places[]` are not used.
4. **Reading → set.** Five pieces (ring, pendant, printed rug, print, printed pillow), each on a different
   signature idea. Rules in code: `planner.check`; no audience, selling or liking words in a why (the photos
   *show* an idea; that is not the same as the owner liking it); at least one piece rests on the measured
   signature; printed, never tufted or woven.
5. **Arcade (offline).** Same as the main line: real client on `mock_arcade.mock_transport`, bodies saved,
   maker declines reported, mock prices.
6. **Surface.** `owner.html`, private, with whys and evidence refs. `gift.html`, shareable, with titles,
   briefs and colours only: no why, no count, no photo.
7. **Money.** The owner pays the maker's price at `checkoutUrl`. No seller commission. Gold's take (a
   referral cut or a small fee) is unset until Arcade's terms are known.
8. **Measure.** The owner's blind three-way: the set from the reading vs a bio-plus-colours form vs a
   swapped-reading set (the null). Second question: "would you buy one at this price?" Not run.
9. **Risks.** Friends in evidence photos (private page only); "shows" is not "likes" (checked); maker
   refusals; a gift-list brief echoing private imagery.
10. **Demo.** `python ideas/1-creator-storefront/fork-1/owner_object.py --demo`, $0.
