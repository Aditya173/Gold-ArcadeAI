# FAN-MADE design pass (Elizabeth, 2026-10-11)

Source: `Fan-Made Prototype.html` (Claude Design bundle, 390x844 iPhone frame, 9 screens: welcome, info, vibes,
customize, pick, make, live, store, create + the iOS photo alert). Decoded template lives only in the scratchpad; no
images from it go into the repo (the 9 embedded photos are Wishbone Kitchen demo shots: use `ImageTile` + API
images / plain `tile` placeholders).

**UI only.** Copy, layout, tokens, component look. No change to data flow, API calls, auth, polling, validation or
navigation. Where the design implies new data (fan prompt, font persisted, shop name on S2), it is listed under
"Not applied" at the end.

It is the same visual system as `Merch Studio v4` (SCREENS.md): every existing token value in `theme.ts` matches.
The changes are the **FAN-MADE** brand, new copy, a few new component sizes, and the store-look placeholders.

## 1. Tokens

### Unchanged (Fan-Made value == `theme.ts`)

| Token | Value |
|---|---|
| `colors.bg` / `screenTop/Mid/Bottom` / `storeBg` | `#e6e1d5` / `#f6f4f0 #eeeae1 #e9e5d8` (0, .55, 1) / `#fbfaf7` |
| glows | white 300px blur 50 op .8 top-left (-90, 80); lemon 260px blur 60 op .7 bottom-right (-90, 120); store: no glow |
| `phone` | `#0d0a10`, frame radius 56, screen radius 46 |
| ink / muted / muted2 / placeholder / inkSoft / heroInk | `#111` / `#5f584c` / `#6e675a` / `#9a9384` / `#3d382f` / `#2a211b` |
| lemon / lemonLight / lemonInk / rust | `#fdff7b` / `#feffb0` / `#4d3d00` / `#a76549` |
| glass / glassCard / glassStrong / glassSelected / glassWeak / glassFaint / glassBorder | .55 / .5 / .75 / .8 / .35 (.45 palette off) / .3 / .9 white |
| inputBg / linkBg | `rgba(255,255,255,.7)` / `.6` |
| hairline / outline / stepOff / radioOff / dashed / dashedStrong | ink at .08 / .12 / .15 / .25 / .15 / .2 |
| border / chipBg / tile / tileAlt | `#e5dfd2` / `#f1ede4` / `#efe9dd` (logo bg `#eee9df`, same token) / `#f7f3ec` |
| disabledBg / disabledInk / scrim | ink .08 / ink .38 / `rgba(0,0,0,.28)` |
| gradients | primary `#feffb0 -> #fdff7b`; dark `#3a3a3a -> #111` |
| fonts | Plus Jakarta Sans 400-800 (UI), Outfit 700, Bricolage Grotesque 800, Instrument Serif 400 (shop fonts Clean / Round / Bold / Serif). All already loaded. |
| type | display 44/48 800 -.035em; headline 34/40 800 -.03em; title 28/34 700 -.025em; heading 20/700; lead 17/24; bodyStrong 17/22 600; body 15/20; label 13/18 600; button 17/600; buttonSm 15/600; badge 12/700; mono 10 |
| radii | 8, 10, 12, 14 (button, input, link row), 16, 18 (card), 20 (preview card), 24 (hero), 999 |
| shadows | soft `0 2px 10px rgba(90,70,30,.05)`; glass `0 4px 14px …07`; raised `0 8px 22px …09`; phone; primary; dark |
| layout | footer `12 20 36`; scroll body `16 20 16`, gap 10 (lists) / 14-20 (sections); CTA 54 tall |

### New tokens to add (`theme.ts`)

| New name | Value | Used by |
|---|---|---|
| `colors.glassPill` | `rgba(255,255,255,.7)` | S1 floating pills (same value as `inputBg`; alias is fine) |
| `colors.glassBorderStrong` | `rgba(255,255,255,.95)` | S1 floating pills border |
| `colors.storeDashedBg` | `#f6f3ec` | store-look "Designing your piece…" tile |
| `colors.storeDashed` | `#e0d8c8` | its 1.5px dashed border |
| `colors.stripeA` / `colors.stripeB` | `#ecdfcd` / `#f6efe3` | generated-image placeholder stripes (135deg, 8px) |
| `colors.monoWarm` | `#8a7258` | mono caption on the stripe placeholder |
| `colors.iosBlue` / `colors.iosSheet` / `colors.iosSeparator` | `#007aff` / `rgba(242,242,242,.92)` / `rgba(60,60,67,.36)` | only if the photo alert is ever drawn in-app (see S2) |
| `shadows.pill` | `0 3px 10px rgba(90,70,30,.08)` | S1 floating pills |
| `type.wordmark` | Jakarta 800, 15/20, letterSpacing 3.6 (.24em), centred, ink | "FAN-MADE" |
| `type.pill` | Jakarta 600, 15 | S1 pills (vibe chips stay 18/600, live pills 16/600 = `type.chip`) |
| `type.vibe` | Jakarta 600, 18 | S2 vibes chips |
| `type.storeName` | shop font, 20, letterSpacing -.02em | store header name |
| `brand` (const) | `'FAN-MADE'` | wordmark, app name copy |

## 2. Screen map (Fan-Made -> brief S0-S9)

| Fan-Made | Brief | Look |
|---|---|---|
| welcome | S1 Login | studio |
| info | S2 Gold onboarding (step 1/3) | studio |
| iOS photo alert | S2 (Camera roll Connect) / S3 (Upload) | system |
| vibes | S2 "What Gold found" moment (creator) | studio, no stepper |
| customize "Style Your Shop" | S3 Brand inputs (step 2/3) | studio |
| pick "Add Your Products" | S6 creator header / product kinds (step 3/3) | studio |
| make "Designing…" | S4 progress grid + S6 generating grid | studio |
| live "You're live!" | S4 success state (creator end) | studio |
| store "Shop the collection" | S8 Marketplace (+ S0 store header) | store |
| create "Design your own" | S5 -> S6 fan flow; done state = S7 / S9 look | store |
| product page | no separate screen in the design: use create-done (square tile r24, title 20/700 + price 17/600, "Again" + accent CTA) for S7, S9 | store |

### welcome (S1)
Top to bottom: status bar; **FAN-MADE** wordmark (`type.wordmark`, top padding 8); 320px float area with 4
tilted pills (glassPill, 1px glassBorderStrong, `shadows.pill`, padding 9/15, 15/600, 8px dot, centred on x%):
- creator: "Connect with your audience" (lemon, 34%/70, -7deg), "Formalize your style" (ink, 66%/142, 6deg),
  "Earn revenue" (rust, 30%/214, 4deg), "Create with your fans" (lemon, 64%/284, -5deg)
- fan: "Decorate your home" (ink, 64%/60, 5deg), "Elevate your wardrobe" (lemon, 32%/134, -6deg), "Style your
  jewelry" (rust, 68%/206, -4deg), "Host with the most" (ink, 36%/276, 7deg)

Then role switch: full-width glass pill track (radius 999, padding 4, glassBorder, soft shadow) with two flex-1
segments 40 tall radius 999: **I'm a creator** | **I'm a fan** (on = ink bg, white 15/600; off = muted). 36 below:
display title "Let's open your storefront" / "Let's go shopping"; lead (12 top, 28 bottom) "Turn your brand into a
shop full of items your audience actually wants" / "Find and create products from your favorite people."; primary
CTA **Let's go**. Side padding 24, bottom 40. No product tile, no "Gold" in the art.

### info "First, the basics" (S2)
Header: 36 frosted back circle `‹` + 3-bar stepper (bar 1 on). Title 28/34 "First, the basics"; sub "A few details
to make your shop yours." / "A couple of details to tailor what you see." Label **Shop name** / **Your name** + 52px
input (placeholder "e.g. Wishbone Kitchen" / "e.g. Ava"). Label **Connect**, then one glass list card (radius 18):
- Camera roll (photo icon) — sub "For your lifestyle" -> "{n} photos"
- Instagram (creator only, IG glyph) — sub "For your brand" -> "@handle · {n} posts"
- right side (92 wide): dark small **Connect** (32 tall, radius 10, 15/600) -> done = 28px ink circle, lemon check
- footer row **Why connect?** 13/600 muted + chevron (rotates 180 open). Open: creator "Connecting your photos and
  Instagram helps us understand your style and create a storefront that feels like you. You'll review everything
  before your shop goes live." / fan "Connecting your photos helps us suggest products that fit your life, made in
  your favorite creators' styles." + always "Your photos stay private and nothing gets posted."

CTA **Analyze my Brand** / **Start Shopping** (disabled look until ready).

### iOS photo alert
Native alert (270 wide, radius 14, frosted): title "“FAN-MADE” Would Like to Access Your Photos" (the design says
"Merch Studio"; brand is FAN-MADE), body "We look at your photos to understand your style and suggest products.
Nothing is posted.", buttons **Allow Full Access**, **Limit Access…**, **Don't Allow** (bold). This is the OS sheet:
do not draw it in RN. Its text = `app.json` `name` + `NSPhotoLibraryUsageDescription` / `photosPermission` (only
visible in a dev build; Expo Go shows "Expo Go").

### vibes (S2 found-state)
No stepper. Headline 34/40 800 "Seeing your viewpoint…" (first 3 chips) -> "Finding what you love…". Centered
wrapping chips (gap 14/10) pop in every 600ms: glass, padding 12/18, 18/600, 12px dot, tilt ±2-4deg. Demo copy:
"Grilling in the afternoon", "Tomato toast", "60s kitchen style", "Gingham & florals", "Dinner parties with
friends" (app shows the real Gold ideas).

### customize "Style Your Shop" (S3)
Stepper bar 2. Title 28/34. Then, gap 20:
1. Preview card (white, radius 20, raised): row 28px logo circle + shop name 17 in shop font; cover 150 tall
   (margin 0 10 10, radius 14, first reference image with dark bottom fade) holding tagline 22/26 white in shop font
   ("Set the table like you mean it") + accent pill **Shop now** (13/700, radius 10, padding 7/12).
2. **Logo**: glass row, 44 circle, "From your Instagram" / "Profile photo", white **Upload** (32, radius 10, 1px
   outline).
3. **Color Palette**: palette rows (glass .45 / selected .8 + 1.5px ink; 32px strip radius 10; 20px radio, on =
   6px ink ring) + dashed **+ Custom** (52 tall).
4. **Font**: 4-col grid of 76px tiles (radius 14, glass, selected 1.5px ink): "Aa" 24 in the font + 13 muted label
   Clean / Round / Bold / Serif.
5. **Reference Images** right "n of 3": 3-col grid gap 6, radius 12, selected 2px ink border + 22px ink badge with
   lemon digit; unselected badge = white .8 ring; others dim to .5 when 3 picked.

CTA **Next**.

### pick "Add Your Products" (S6, creator)
Stepper bar 3. Title "Add Your Products"; sub "Create some products for your customers to purchase. They can also
create their own." Rows (radius 18, padding 14/16, on = glassStrong + 1.5px ink, off = glassWeak): 24px checkbox
(radius 8, on = lemon + ✓), name 17/600, reason 13 muted ("Gingham shows up all over your feed", "For your dinner
parties", "Your summer style", "For hosting with the most", "Long tables, long nights"). CTA **✦ Make {n}
products**.

### make "Designing…" (S4 / S6 grid)
Kicker 13/600 "Designing in your style…" -> "All done"; title "Making {n} pieces" -> "Your first collection". 2-col
grid gap 14: done = framed tile (radius 18, 6px glass frame, inner radius 13); pending = dashed "Designing…"
(glassFaint, 1.5px dashed). Under each: name 15/600, price 13 muted. CTA disabled **Designing…** -> **✦ Put it
live**.

### live "You're live!" (S4 success)
Three tilted glass pills (16/600, padding 10/16, 10px dot): "{n} products" (lemon, -7deg), "on Shopify" (ink,
6deg), "fans can design too" (rust, 3deg). Display "You're live!"; lead "{shop} is open. Share the link and watch the
orders roll in."; link row (linkBg, 1px white, radius 14, padding 14/16): "{handle}.shop" 17/600 + **Copy** 15/600
muted; buttons **Share to Stories** (primary) and **See it as a fan** (dark).

### store (S8 + S0 header)
Store look. Header 52 tall: 34px logo/avatar circle (tap = back to creator) + shop name `type.storeName`; right
**Bag ({n})** 15/600. Body padding 4 16 36, gap 16: accent card **Design your own** / "Create your own products in
{shop}'s style" (13, .85 opacity) + "→" 22 (radius 18, padding 18/20, palette accent bg, on-accent text). Section
"Shop the collection" 17/700. 2-col grid gap 16/12: tile 4:5 radius 16, name 15/600, price 15 muted.

### create "Design your own" (S5 -> S6 fan, S7/S9 look)
Header: 36 back circle (chipBg, no border) + **Bag ({n})**. Title 28/34 in shop font "What should {shop} make
you?"; guardrail tag chips (chipBg, 13/600, padding 6/12): "their colors", "tigers & citrus", "hand-painted". Idle:
54px white input (placeholder "I want a plate…") + suggestion chips ("a serving platter", "coasters", "napkins").
Running: square dashed tile radius 24 (storeDashedBg / storeDashed) "Designing your piece…" 15/600 muted2. Done:
square stripe tile radius 24 with mono "generated · “{prompt}”"; row title 20/700 + price 17/600. Footer: white
**Again** (flex 1) + accent CTA (flex 1.6) **Make it** -> **Designing…** -> **Add to bag · $46** -> **In your bag ✓**.

## 3. Per-file change list

**theme.ts** — add the new tokens above; no existing value changes.

**ui.tsx** — `Segmented`: add a `pill` look (track radius 999, padding 4, glass + glassBorder + soft; segment height
40, radius 999, flex 1). `Chip` glass: optional `size="sm"` (15/600, padding 9/15, 8px dot, glassPill/glassBorderStrong,
`shadows.pill`). `ImageTile status="generating"`: store variant colours (storeDashedBg/storeDashed) on store screens.
`Header variant="store"`: optional 34px avatar circle left of the name and name in `type.storeName`.

**S0Nav.tsx** — Header shows the creator avatar (34 circle, `tile` bg) + name in shop font, **Bag ({n})** right; keep
nav items. Signed-out header: **FAN-MADE** wordmark. Replace "Gold × Arcade" brand copy with FAN-MADE.

**S1Login.tsx** (+ `components/s1/WelcomeHero.tsx`) — Add FAN-MADE wordmark at top. WelcomeHero: drop the
Gold/× Arcade tile; render 4 role-dependent pills (pass `role`) at the positions above. Segmented -> pill look. Drop
the "Gold × Arcade: …" caption. Keep **Let's go**, **Browse the marketplace**, **Sign out / switch role** (nav).

**S2Onboarding.tsx** — Section label **Connect** above the card. Instagram sub "For your brand" (keep the S3 note
in the expander or drop). Done = ink circle + lemon check (check it matches). Why connect? copy as above. Vibes
moment: headline swap at 3 chips, chips 18/600 padding 12/18, 12px dot, tilts, centred wrap, no stepper look.

**S3BrandInputs.tsx** — Order: preview card, Logo, Color Palette, Font, Reference Images; move Shop name/Handle/IG
handle + Instagram import rows below them (or under a "Your shop" section, current). Preview cover = first selected
reference with dark fade, white tagline 22/26. Palette rows: off fill .45, radio 6px ring on. Ref badges: 22px,
unselected white ring, dim others at 3. CTA label **Next**.

**S4StyleProgress.tsx** — Kicker "Designing in your style…" -> "All done"; dashed "Designing…" pending tiles; under
each tile 15/600 label. On success: "You're live!" block (3 tilted pills, display, lead, link row + **Copy**,
**Share to Stories** primary, **See it as a fan** dark) wired to existing actions only (Copy = clipboard if already
imported, else plain text; See it as a fan = existing marketplace route).

**S5CreatorSearch.tsx** — No design screen. Align to store look: store header, title in 28/34, result cards as
glass rows (radius 18, padding 14/16, selected 1.5px ink), CTA accent like "Design your own".

**S6Suggestions.tsx** — Creator: "Add Your Products" row look (checkbox 24 r8 lemon on, name 17/600, reason 13) for
product kinds / why rows; CTA **✦ Make {n} products** label only if the action already exists. Generating grid: kicker
+ "Making {n} pieces" -> "Your first collection", CTA **Designing…** (disabled) -> existing CTA. Fan: title in shop
font "What should {shop} make you?", style words as guardrail chips (chipBg 13/600), generating = store dashed tile
"Designing your piece…".

**S7Product.tsx** — Store header with 36 chipBg back + **Bag ({n})**. Hero square radius 24, title 20/700 + price
17/600 row. Footer secondary white (1px border) + accent CTA flex 1/1.6; accent = creator palette accent.

**S8Marketplace.tsx** — Header avatar + shop name 20 in shop font + **Bag ({n})**. "Design your own" card sub
"Create your own products in {shop}'s style", arrow "→" 22. Section title "Shop the collection" 17/700. Grid gap
16/12, tile 4:5 r16, price 15 muted.

**S9Checkout.tsx** — Same summary row (square r24, 20/700 + 17/600). CTA labels in the create style: success state
"In your bag ✓"-style tick label ("Checkout created ✓", existing). Back button white with 1px `border`.

## Not applied (needs data/flow change, decide separately)
- Fan free-text prompt + suggestion chips on create (no prompt field in the API today).
- Font choice persisted with the shop (S3 Font picker can only drive the local preview).
- Name input on S2 (design) vs shop name on S3 (app); fan "Your name" has no field.
- Store link "{handle}.shop", "on Shopify", Share to Stories: copy only, no backend.
- `app.json` name -> "FAN-MADE" and photo usage text "We look at your photos to understand your style and suggest
  products. Nothing is posted." (config; shows only in a dev build; current text is more accurate: only picked
  images are uploaded).
