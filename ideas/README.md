# Ideas: group → product, from the photos they choose

Six ideas. Each one takes a group's photos, gets a Gold reading
([contract](../gold_sdk/README.md)), and turns it into made-to-order pieces on Arcade. Every idea
is built against the offline mock Arcade and has been through blank-slate review rounds (a fresh
reviewer with no context reads the idea cold). **None has reached a pass, and none has been shown
to a buyer.** "Fix" below means "keep, but change what the review names". Background evidence for
each group is in [research/C5](../research/C5_group_evidence.md).

| # | Group | Product | Reading fields it uses | Status |
|---|---|---|---|---|
| 1 | Creators and personal brands (1k–200k followers) | A storefront of 6–10 pieces, each with a "why", for their audience to buy | `signature`, `palette`, `places` | Fix. Fork open: curated feed or camera roll ([DECISIONS](DECISIONS.md)). The money depends on Arcade's answers |
| 2 | Independent cafés, restaurants, bakeries, food trucks | A house goods line: table linens, ceramics, a print, a pillow | `palette`, `places`, `signature` | Fix. Fork open: café owner line or diner line ([DECISIONS](DECISIONS.md)). No café read yet |
| 3 | Couples | A keepsake pair (pendants), with a registry-style page as a later step | `trips`, `palette`; `named_places` and `people` only with consent | Fix. The pendant pair ships; reading two partners' photos waits on two consenting partners |
| 4 | Travellers | A trip capsule: a print painted from a photo the owner picks, plus a small textile | `trips`, `named_places` (opt-in), `palette` | Fix. Narrowed to the reference print: on their own, the readings only find the trip, which photo apps already do |
| 5 | Short-term-rental hosts, boutique hotels | A room-matched line (pillow, print, rug) that guests can buy afterwards | `palette`, `places` | Fix. "One room photo in, one pillow out"; the line across a host's properties is a hypothesis |
| 6 | Clubs, teams, student orgs | A season drop: shared pieces, plus a member's own pendant only when their photos support one | `signature`, `palette`; `people` only with consent | Fix. Arcade makes no apparel, so it is narrowed to a season keepsake. Needs a real club album |

Each idea's folder (`ideas/<n>-<slug>/`) holds its own README, framework and demo command.

## Three blockers that cut across all six

1. **The photos must beat a form.** Each idea has to show that pieces made from someone's photos
   are better, to that person, than pieces made from a 20-second form (a few typed answers). No
   idea has shown this yet. The test is blind: the person picks between the photo version and
   the form version without knowing which is which.
2. **The money.** At Arcade's public commission, a creator earns about **5% of a sale** (markup
   on top is allowed by the terms, but untested in practice; approved Entrepreneurs get 7.5%). On
   most pieces that is less than a print-on-demand tee or hoodie earns. Whether it can be more
   depends on two answers from Arcade: can a seller mark up, and what is the creator/Entrepreneur
   rate ([HACKATHON_DAY.md](../HACKATHON_DAY.md)). This matters most for ideas 1 and 2, which sell
   on to others.
3. **No buyer has been asked.** Every "would they pay" is still a question. The research gives
   asking prices and adjacent spending, not demand for these pieces.
