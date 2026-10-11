# Idea 3 research: couples → keepsakes + a registry-style page

Public market research only. Market numbers name their web source. Arithmetic over cited inputs is
labelled "arithmetic", not a finding. Nothing here has been tested with a couple or a guest.

## 0. Verdict

**Keep**, reshaped: the registry is the *channel*, not the whole product. Couples overwhelmingly ask for
cash (Zola: 87% of its 2025 couples), so a registry made only of photo-built objects competes with cash and
loses. What can work: **one partner buying for the other** (anniversary, engagement: one payer, no cash
alternative), and on a registry **one group-funded hero piece** plus a few ~$100 pieces single guests can
buy.

| Question | Answer |
|---|---|
| Who pays | The partner at anniversaries (main path); wedding guests for a group gift (second path) |
| Why photos, not a form | A form gets the one place a couple remembers to type. Two rolls could show the moments they share, the trips they took together and the palette of those days. Unproven (§5) |
| Which photos | Each partner's own camera roll, read on their own phone, both opted in |
| Categories | Pendant Necklace; Rug, Wall Art Print, Throw Pillow, Ceramic Plate (inferred). No rings |

The weakest assumption: **that guests want a photo-made object for the couple rather than give cash.**

## 1. Market size

| Fact | Number | Source |
|---|---|---|
| Average US wedding cost, 2025 | $34,000; $292/guest; 117 guests | The Knot 2026 Real Weddings Study [1][2] |
| Average US wedding cost, Zola 2026 couples | $36,000 | Zola First Look via AOL [5] |
| US weddings per year | ~2.0–2.1M (weakly sourced) | [7][8]; 2022 forecast 2.5M [9] |
| Couples announcing on social media | 60% within 24 h, 86% within a week (2016) | The Knot [26] |
| Engagement ring average, 2025 | $4,600; 61% lab-grown | The Knot / Blue Nile [10][11] |
| Married-couple households | 74% of family households (2024) | US Census [27] |
| Personalized gifts, global | ~$31.4B (2025), ~5.5%/yr (estimates vary 2×) | [12][13] |
| Personalized gifts, US | +$5.27B 2024–2029, 9.9% CAGR | Technavio [14] |
| Photo books, global | $1.9B–$3.8B (2025) | [15][16] |

**Arithmetic:** 2.0M weddings × 117 guests × 34% who buy off the registry × $88–$160 per gift ≈ $7B–$13B
a year through US registries as bought gifts. An older figure puts all wedding gifts at ~$19B, $9B of it
cash [6]. The reachable slice is far smaller.

Anniversaries are the repeat market: tens of millions of married couples [27]; a jewelry council study
found over half of respondents would spend up to $1,000 on an anniversary gift [17] (undated, weak). NRF:
Valentine's Day 2025, $188.81 per shopper [17].

## 2. Who pays, how much, how often

**Wedding guests.** $88 per guest and $107 per wedding-party member (The Knot 2018) [18]; $160 per gift
(The Knot, undated) [4]; Zola's estimate $50–$100 [4]. 34% bought off the registry, 29% gave cash
(2018) [18]. 87% of 6,000 Zola couples asked for cash in 2025 [4]. On Zola any item can be a group gift;
underfunded gifts convert to store credit [20]; cash contributions carry a 2.5% fee [19].

**Price ladder that fits:** a $100–$200 single-guest tier and one group-funded hero at $800–$2,000, about
8–20 guests per hero at $88–$160 (arithmetic).

**Partners (anniversary / engagement).** One buyer, one piece, ~$200–$1,000, at most once a year. It
recurs and needs no guests: the main path.

## 3. What they use today

| Tool | What it does | Gap | Source |
|---|---|---|---|
| Zola | Universal registry, group gifts, cash funds | Hosts products, makes none | [19][20][21] |
| Etsy (registry since 2023) | "Where we met" maps ($6–$40), venue drawings ($25–$100), 14k coordinate necklaces (~$71–$77) | Each item is a **form**: the buyer types one coordinate, one date, one name | [22][23][24][25] |
| Minted | Weddings marketplace; **April 2026: prompt-based AI customisation, e.g. an illustration of the venue** | From a prompt, not the couple's life | [28][29] |
| Arcade | Prompt → artisan jewelry; rugs with Magic Match (room photo → rug); founded by Minted's founder | One prompt → one product | [30][31][32] |
| Shutterfly / Mixbook | Photo books $15–$70+ | Prints photos; doesn't read them | [15][33] |
| Shopify + Printful | DIY storefront | Couples don't run shops | [34] |
| Jewellers | Custom bands, engraved intersections (A. Jaffe "Maps") | Expensive, slow | [24] |

Precedent: **strong** for "personalised couple object from where-we-met data" (a whole Etsy category);
**strong** for group-funded registry gifts; **new** for reading both partners' photos. Minted's AI venue
art and Arcade's Magic Match are one step away: validation and competition at once.

## 4. How couples' photos exist

- **Two separate camera rolls** by default.
- **Google Photos Partner Sharing:** one partner, all or chosen photos, cross-platform [35].
- **iCloud Shared Photo Library:** up to 6 people, Apple-only [35].
- **Shared albums** by link for trips [35].
- **Wedding guest albums:** QR code → a shared album or uploader [36][37][38].
- **Curated feed:** a handful of announcement posts, too little for a couple reading [26].

Take **each partner's own roll, read on their own phone**. A curated upload only gives what the Etsy
form already captures.

## 5. What the reading has to add (on the Gold SDK contract)

In this repo the merge of two rolls happens inside the protected SDK; the product sees a single
`gold.reading.v0` with the opt-in fields `people[]` (anonymous refs), `named_places[]` and `trips[]`.
What the couple product needs from it, and the honest limits:

- **Shared moments:** the moments both partners appear in, which a form can't produce. Needs both opt-ins.
- **Trips taken together** (`trips[]`): candidates for a print, shown to the couple, never on a guest page.
- **A shared palette:** colours to design with. It must be distinct to the couple to be quoted as theirs.
- **"Where we met" is never asserted**; at most offered as a question for the couple to confirm.
- **Two-phone consent:** partner B must opt in on their own phone. Guessing a partner from one roll is the
  riskiest privacy case for the least gain.
- **The test that would prove it:** the couple picks blind between pieces from the reading and pieces from
  a form (where we met, our city, two colours), with another couple's reading as the null. Untested.

## 6. Arcade fit

| Piece | Category | Buyer tier | Notes |
|---|---|---|---|
| Matching pendant pair | Pendant Necklace (docs) | Partner, or group gift | One design ordered as quantity 2; jewelry takes no `colors` |
| "Our moments" rug | Rug (inferred) | Group gift | Printed; palette and motif, not a legible map |
| Place-free print | Wall Art Print (inferred) | Single guest | Reference images only by opt-in |
| Pillow / plate | Throw Pillow, Ceramic Plate (inferred) | Single guest | Plate is decorative |
| Wedding bands | Rings | **Not recommended** | Sizing, comfort fit and the stakes of a band make a guest-funded, maker-declinable band a poor first product |

Makeability risks: engraved coordinates and tiny text are classic refusals at pendant scale; "a map of our
city" on a rug must be a motif, not legible streets.

## 7. Surface

A **link-only page**, not public: pieces, mock prices, a group-gift bar for the hero. It can sit on an
existing Zola registry as an external item [19][21]. Guests see no photos, no places, no dates. The
couple approves every piece and line first. Checkout is a human paying at Arcade's `checkoutUrl`.

## 8. Risks

1. **Weakest: guests choose a photo-made object over cash** [4][18]. Mitigation: the anniversary path.
2. **Two-phone consent.**
3. **Exes and old relationships in a roll.** Shared moments (both rolls) avoid this; a one-roll guess does not.
4. **Short rolls:** "our places" needs years of photos.
5. **Invented reasons:** the why quotes the reading exactly; "where we met" is never asserted.
6. **Competition:** Minted's AI venue art [29] and Arcade's Magic Match [30].
7. **Location:** no home location on any shared page.

## 9. Alternates

**Pet owners → pet keepsakes:** proven demand (Crown & Paw claims over 1M portraits, self-reported;
modelled AOV $125–$150 [39]); custom pet products ~$8.5B (2025) [40]. Best alternate if couples fail on
consent.

## Sources

1. https://www.businesswire.com/news/home/20260218045442/en
2. https://www.theknot.com/content/wedding-data-insights/real-weddings-study
3. https://thebudgetsavvybride.com/average-wedding-cost-2025/
4. https://refinery29.com/en-us/how-much-cash-wedding-gift
5. https://www.aol.com/forget-registry-couples-want-wedding-090353021.html
6. https://venturebeat.com/technology/what-is-love-without-a-blender-zola-helps-newlyweds-get-the-gifts-they-want
7. https://www.doulike.com/blog/statistics/wedding-statistics-trends-costs-and-insights/
8. https://www.4over4.com/faqs/general/how-many-weddings-happen-in-the-united-states-each-year
9. https://nationaljeweler.com/articles/10622-here-comes-a-lot-of-couples-getting-married
10. https://www.theknot.com/content/engagement-ring-price-cost
11. https://www.bluenile.com/blog/love-brilliant/engagement-ring-statistics
12. https://www.sphericalinsights.com/reports/personalized-gifts-market
13. https://www.reanin.com/reports/non-photo-personalized-gifts-market
14. https://www.technavio.com/report/personalized-gifts-market-in-US-industry-analysis
15. https://www.giiresearch.com/report/tsci2048363-photobook-album-market-global-industry-size-share.html
16. https://verifiedmarketresearch.com/product/photobooks-market
17. https://www.jckonline.com/?p=34873 ; https://washingtonretail.org/?p=91088
18. https://www.theknotww.com/press-releases/2016-wedding-guest-study ; https://www.theknotww.com/press-releases/wedding-guest-study-2018-most-popular-wedding-day
19. https://www.zola.com/faq/115002835872-is-there-a-fee-for-gifts-added-from-other-stores-
20. https://www.zola.com/faq/115002838951-what-does-group-gifting-mean-on-my-registry-
21. https://www.zola.com/faq/115002835012-How-does-Zola-registry-work-
22. https://www.retailbrew.com/stories/2023/05/09/etsy-introduces-wedding-registry-business
23. https://www.etsy.com/listing/1757028418
24. https://www.etsy.com/listing/1887875418 ; https://www.jckonline.com/?p=11120
25. https://www.etsy.com/listing/719714089
26. https://www.theknotww.com/press-releases/theknot-social-media-study-2016
27. https://census.gov/newsroom/press-releases/2024/families-living-arrangements.html
28. https://www.businesswire.com/news/home/20230612224845/en
29. https://www.businesswire.com/news/home/20260430103207/en/Minted-Announces-Artist-Friendly-AI-Design-Customization-Approach-That-Will-Offer-Consumers-Instant-High-End-Customization
30. https://www.techdogs.com/tech-news/pr-newswire/arcade-first-ever-ai-physical-product-marketplace-raises-25m-series-a-and-expands-into-home-goods
31. https://pulse2.com/arcade-25-million-raised-for-ai-physical-product-marketplace/amp/
32. https://fortune.com/2024/11/27/minted-founder-mariam-naficy-arcade-ai-jewelry-production-creation-platform
33. https://www.photoworkout.com/shutterfly-vs-mixbook-comparing-photo-books
34. https://bsscommerce.com/shopify/shopify-print-on-demand-apps/
35. https://ente.com/articles/google-photos-partner-sharing-vs-icloud-shared-photo-library/
36. https://waldophotos.com/qr-code-for-wedding-pictures/
37. https://guestcam.co/blog/collect-wedding-photos-from-guests
38. https://app.wedibox.com/help/how-qr-code-photo-sharing-works
39. https://gripsintelligence.com/insights/retailers/crownandpaw.com
40. https://www.futuredatastats.com/custom-pet-products-market
