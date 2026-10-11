# Screens: layout and copy (from `marketplace/Merch Studio v4.dc.html`)

Design source: Claude Design canvas, iPhone frame 390x844. Tokens: `app/src/theme.ts`. Primitives:
`app/src/components/ui.tsx`. Data and states per screen: `BRIEF_MARKETPLACE.md` Part 1 (this file is look and copy
only). Every screen keeps the brief's four states with `LoadingState` / `EmptyState` / `ErrorState` (error shows
`error.message` + "Try again").

## Global

- **Two looks.** `Screen variant="studio"` (creator + onboarding, S1-S4, S6): warm gradient `#f6f4f0 -> #eeeae1 ->
  #e9e5d8`, a white glow blob top-left and a lemon `#fdff7b` glow bottom-right. `Screen variant="store"` (fan
  storefront and shopping, S5, S7-S9): flat `#fbfaf7`, no glow.
- **Controls are frosted glass:** `rgba(255,255,255,.55)` fill, `rgba(255,255,255,.9)` 1px border, soft warm shadow.
  Selected = whiter fill + 1.5px `#111` border.
- **Main CTA** sits in `Screen footer` (20px sides, 36px bottom): `Button` primary = lemon gradient, 54 tall, radius
  14, 17/600 ink. Disabled = 8% ink fill, 38% ink text. `dark` = ink gradient, white text. `accent` = the creator's
  palette accent (fan screens).
- **Type:** Plus Jakarta Sans everywhere. Display 44/48 800 (welcome, "You're live!"), headline 34/40 800, title
  28/34 700, lead 17/24 muted `#5f584c`, labels 13/600 muted. Shop fonts (creator's choice): Clean = Jakarta 700,
  Round = Outfit 700, Bold = Bricolage Grotesque 800, Serif = Instrument Serif.
- **Image placeholders:** beige tile `#efe9dd` with a 10px mono caption bottom-left (`ImageTile label`). Generating
  slots are dashed "Designing…" tiles (`ImageTile status="generating"`), one per item, never one page spinner.
- **Onboarding header:** 36px frosted back circle left, 3-bar `Stepper` centre (20x4 bars, ink = done). Store
  header: 32px beige back circle, shop name in the shop font, "Bag (n)" right (`Header variant="store"`).

## S0 App shell / nav

Store-style header bar (`Header variant="store"`) with the shop/creator name; nav as glass `Chip`s or a bottom row:
**Marketplace**, **Made for you**, **My products**, and **Sign out / switch role** (ghost `Button`). Creator: name +
@handle under the title in `type.caption`. Signed out: only Marketplace + Sign in.

## S1 Login (design: "welcome")

- Top two-thirds: floating tilted glass `Chip`s with dots: "Dinner parties" (lemon, -6deg), "Home decor" (ink, 5deg),
  "Custom jewelry" (rust `#a76549`, 4deg) around a centred 156px frosted product tile (radius 32, -3deg).
- `Segmented`: **I'm a creator** | **I'm a fan** (selected = ink pill, white text).
- Display title: creator "Let's open your storefront" / fan "Let's go shopping".
- Lead: creator "Turn your brand into a shop full of items your audience actually wants" / fan "Find and create
  products from your favorite people."
- Primary CTA **Let's go** (signs in, -> S2). Under it a ghost link **Browse the marketplace** (-> S8).

## S2 Gold onboarding (design: "info", step 1 of 3)

- Title "First, the basics"; sub creator "A few details to make your shop yours." / fan "A couple of details to
  tailor what you see."
- Glass list card, rows: icon, 17/600 title, 13 muted sub, right side small dark **Connect** button that turns into a
  28px ink circle with a lemon check when done. Row "Camera roll" (sub "For your lifestyle" -> after connect the
  profile's photo count). Creators also get "Instagram" here only as a teaser; the real connect is S3.
- Expandable **Why connect?** row (chevron). Creator: "Connecting your photos and Instagram helps us understand your
  style and create a storefront that feels like you. You'll review everything before your shop goes live." Fan:
  "Connecting your photos helps us suggest products that fit your life, made in your favorite creators' styles."
  Always: "Your photos stay private and nothing gets posted."
- **Demo profile** picker below (label "Demo profile"): selectable glass `Card`s, archetype name 17/600, one-line 13
  muted, `PaletteStrip` of its palette.
- After connect: the "What Gold found" summary as the design's **vibes** moment: headline 34/40 "Seeing your
  viewpoint…" then "Finding what you love…", and the top ideas pop in one by one (600ms apart) as tilted glass `Chip`s
  with coloured dots and the % as `note`. Palette swatches under. "Synthetic demo data" as a neutral `Badge`.
- CTA: creator **Analyze my Brand** / fan **Start Shopping**; disabled until a profile is chosen.

## S3 Brand inputs (design: "customize", step 2 of 3, title "Style Your Shop")

- Live shop preview first: white raised `Card variant="solid"` (radius 20): logo circle + shop name in the chosen
  shop font, then a 150px cover tile (mono label "cover · …"), tagline 22/26 in the shop font, small accent "Shop
  now" pill.
- Sections (`Section` title 15/600, right-side counter 13 muted):
  - **Shop name** / **Handle** / **Instagram handle** `Input`s (label above, inline red error).
  - **Logo**: glass row, 44px circle thumb, "From your Instagram" / "Profile photo", small secondary **Upload**.
  - **Color Palette**: palette options as glass rows with a `PaletteStrip` (height 32, radius 10) + radio; dashed
    **+ Custom** row (52 tall). Hex chips editable, 2-6 colours.
  - **Reference Images** "n of 3": 3-column grid of `ImageTile`s (radius 12); selected = 2px ink border + numbered ink
    badge with lemon digit (1-3 = style refs). Same grid for imported Instagram posts.
  - **Connect Instagram** / **Import from a public handle** rows like S2's connect rows.
  - **Use demo brand** ghost button.
- CTA **Next** (creates the style).

## S4 Style creation progress (design: "make", step 3 of 3)

- Kicker 13/600 muted "Designing in your style…" -> "All done"; title 28/34 "Registering your images" -> "Your style
  is ready".
- 2-column grid of framed `ImageTile`s (6px frosted frame, radius 18); each with kind label and a `Badge`
  (uploading = outline, registered = lemon, failed = danger). Pending slots are dashed "Designing…" tiles.
- Under the grid: `PaletteStrip`, style words as `Chip variant="tag"`, the honest label in `type.caption`.
- CTA **Continue** (disabled until at least 1 registered). On success the "You're live!" moment can be reused: display
  "You're live!", lead "{shop} is open. Share the link and watch the orders roll in.", link row with "Copy".

## S5 Creator search (fan, store look)

- Title 28/34 "Whose style?"; `Input` search with placeholder "Search creators".
- Results: glass `Card`s, name 17/600, @handle 13 muted, `PaletteStrip`, "{n} products" note. Wishbone Kitchen first.
- Selected creator preview: 2x2 grid of `ImageTile` (4:5, radius 16), title 15/600 + price 15 muted.
- Empty: "No creators found". CTA **Design with {name}** (accent button in their palette accent).

## S6 Made for you (design: "pick" + "make")

- Title 28/34 "Made for you from your camera roll + {creator}'s style".
- "What we used from your camera roll" strip: three glass `Chip`s (idea + % as `note`) and `PaletteStrip`.
- 2-column product grid like "make": framed `ImageTile` per item; `generating` = dashed "Designing…" slot;
  `listed` = image + title 15/600 + price 13 muted (+ "estimate" lemon `Badge`); `not_makeable` = danger `Badge` +
  `reason`.
- Per card a **Why we chose this** expander (same chevron as "Why connect?"), one row per reason: kind as tag chip,
  text 13/18 `#3d382f`.
- Style used: `PaletteStrip` + style-word tags, or "3 reference images".
- CTA **Go to marketplace** (dark) or, while generating, disabled "Designing…".

## S7 Product detail (store look)

- Store header (back, creator name in shop font, "Bag (n)").
- Hero `ImageTile` 4:5 radius 24, thumbnails row under it.
- Title 20/700 + price 17/600 on one row; "estimate" lemon badge / "Price on request".
- "by {creator}" or "fan edition, made in {creator}'s style" (`Badge tone="ink"` for fan edition); creator name is a
  link to S8 filtered.
- `public_tag` as tag chip; description 15/20; category, manufacturer, "Bought n times" as caption rows.
- Quantity stepper (small secondary buttons - and +). CTA **Buy now** in the creator accent colour.
- Owner block: glass card "Why we chose this" with reasons.

## S8 Marketplace (design: "store")

- Store header (title "Marketplace", right count "{n} products").
- Optional hero tile when filtered by creator (300 tall, radius 24, tagline 32/36 in shop font).
- "Design your own" accent card (18/20 padding, radius 18, title 17/700, sub 13, arrow) -> S6 for fans.
- Section "Shop the collection": sort `Segmented` (Newest | Most bought), filter `Chip`s (creator, category, Creator
  / Fan), active filter shown as a selected chip with its name.
- 2-column grid (gap 16/12): `ImageTile` 4:5 radius 16, title 15/600, price 15 muted, creator name 13 muted;
  "Fan edition" ink badge and "Yours" lemon badge on the tile; "Bought n" caption.
- Empty: "No products yet".

## S9 Checkout (design: "create" done state)

- Store header with back.
- Order summary: square `ImageTile` radius 24, title 20/700 and price 17/600 on one row, quantity + unit price caption.
- Footer: secondary **Back** + accent **Continue to payment** (flex 1 / 1.6).
- Mock result: confirmation card "Demo checkout created, no payment taken" + order reference; button label becomes
  "Checkout created ✓". Live (`mock == false`): open `checkoutUrl` in the browser.
