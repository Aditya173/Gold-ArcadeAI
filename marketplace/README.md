# Idea 7: brand-template marketplace

**A creator or public figure publishes a brand template.** That's their palette, logo,
patterns, motifs and a template per product. **Fans make custom pieces inside it**, each personal
to the fan through their own Gold insights. **Every piece made goes onto the creator's
marketplace**, where anyone can see it and buy it.

```
creator brand kit ─┐
                    ├─► make_item: one template filled in ─► Arcade (logo/patterns as references on print)
fan Gold insights ──┘      brand element kept, fan's idea      ─► marketplace item (listed, priced)
                           is the motif, checked in code         ─► feed (public) · buy (checkout body)
```

```bash
python marketplace/marketplace.py --selftest
python marketplace/marketplace.py --demo        # 3 archetype fans × the Tide & Clay kit, offline, mock Arcade
python marketplace/marketplace.py --demo --plan # live Claude plans (needs ANTHROPIC_API_KEY); Arcade is still the mock
```

## Why it fixes the blockers the other ideas hit

- **Photos earn their place.** The creator's brand supplies the look, and the fan's insights
  supply the reason the piece is *theirs*: the motif, a corner detail, the engraving. A form can
  pick a colour, but it can't tell you the fan is out at sunrise in 40% of their moments.
- **The creator earns without designing.** Every fan piece carries the creator's royalty
  (`rules.royalty_pct`). The buyer is usually the fan, who wants their own piece.
- **The marketplace grows itself.** Every piece made is a listing other fans can browse, buy or
  remix.

## The brand kit (`brand.kit.v0`, see `fixtures/brand_tide_and_clay.json`)

| Field | Meaning |
|---|---|
| `palette[]` | Brand colours with a `role` (primary / accent / neutral) |
| `motifs[]` | Named brand elements ("thrown-ring stripes") |
| `assets[]` | Logo and patterns, uploaded once to Arcade as **references**. Print pieces send them as `referenceIds`. Jewelry can't take references, so it gets the shape in words |
| `templates[]` | Per category: a brief with `{fan_motif}` and other `{slots}`, the required brand element, and which assets it uses |
| `rules` | Minimum brand colours, maximum fan accent colours, forbidden words, royalty %, and whether a public tag needs the fan's opt-in |

## What the code enforces (`check_item`)

- The brand element is present.
- At least N brand colours; at most M fan accent colours, each taken from the fan's own palette.
- No forbidden words, and no creator name in the prompt (the brand travels as references).
- The fan idea is one the reading really has, and the private "why" quotes its share exactly.
- Jewelry takes no colours or references.
- The public tag is short and contains no numbers.

## Privacy

- The fan's reading never appears on the marketplace.
- `feed()` strips `owner_only` (the fan's idea and why) for every viewer except the fan.
- Public listings show only the piece, the price, and an optional short tag such as "for
  early-morning walkers".

## Backend mapping (for the API)

| Here | Firestore |
|---|---|
| `load_kit` | `creators/{creatorId}`: the brand kit, with assets stored as Arcade referenceIds |
| `make_item` + `to_arcade` | `POST /creators/{creatorId}/items {templateId}` → `marketplace/{itemId}` |
| `Market.feed` | `GET /creators/{creatorId}/marketplace?sort=new or popular` (owner_only removed) |
| `Market.buy_lines` | `POST /marketplace/{itemId}/buy` → the backend calls Arcade `checkouts/create` → `checkoutUrl` for the buyer |

## Open questions for Arcade (hackathon day)

1. Can a creator's royalty be added on top of the maker's price, or how does a seller markup
   work?
2. Can a creator's logo be used as a reference image on print products, given Arcade's filter on
   brand names in prompts?
3. Can listings by one fan be bought by other people: is the product shareable, or tied to the
   account that made it?
