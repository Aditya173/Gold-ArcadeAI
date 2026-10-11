# Brief: the Gold x Arcade marketplace (build today)

We build **one thing today: a universal marketplace**. A simple Shopify-style storefront inside the app,
running on the creator dashboard. Every visitor can see and buy every product.

Two flows, both start at login:

| Flow | Steps |
|---|---|
| **Creator** | Login -> Gold onboarding -> brand inputs (logos / reference images, palette, Instagram) -> style creation -> suggested products (their Gold insights + their style) -> marketplace with their products listed |
| **Fan** | Login -> Gold onboarding -> creator search (one creator pre-populated) -> suggested products (their Gold insights + that creator's style) -> marketplace with their piece listed next to the creator's |

Three facts that shape everything below:

1. **"Model training" = style creation, and Arcade's public API has no endpoint for it.** The only
   "trained model" in Arcade Studio is a "Your Custom Trained Model — Schedule a call" button (a sales demo
   booking). So a **style** here means: the creator's images uploaded to Arcade as **references**
   (`references/createUpload` -> PUT bytes -> `references/create` -> `referenceId`), stored by us per
   creator, plus their palette and style words. Each generation sends **at most 3** of those IDs in
   `patterns/create.referenceIds` plus up to 10 palette hex values in `colors`. A reference is just an uploaded
   image that steers what Arcade generates. There is no `styleId` anywhere in Arcade.
2. **Product creation** goes through `patterns/create` with a `categoryId` (one job makes the artwork and the
   product). Long work is a **job** you poll with `jobs/get`; a design takes 1–2 minutes live.
3. **Gold in the demo = a synthetic archetype insight pack** (`gold_sdk/insights/archetype-*.json`: the 8 Gold
   archetypes plus the synthetic **Long-Table Host**). The real app swaps in the restricted Gold SDK behind the same
   backend function. Not built today.
4. **The demo pair.** Example creator: **Wishbone Kitchen** (`@wishbonekitchen`; cooking, dinner parties,
   lifestyle; kit `marketplace/fixtures/brand_wishbonekitchen.json`, `creatorId` `creator-wishbonekitchen`). Demo fan:
   **Long-Table Host** (`archetype-long-table-host`), a synthetic archetype fitted to that aesthetic from traits of
   four Gold archetypes: cooks for a crowd, big groups over one-to-one, long-table dinner parties (38% of moments),
   pasta from scratch (31%), candlelit tablescapes (27%), farmers-market mornings (22%). The creator onboards with
   Gold as **Small-Table Host**. The kit describes the aesthetic only: no logo or photo of theirs is in the repo.
   **Before the video is shared publicly, get the creator's OK or label it "concept, not affiliated".**

---

# PART 1 — Demo video and UI requirements

For the UI teammate and the video. This part says **what must be on each screen and where its data comes
from**, never how it looks. Field names are the exact JSON fields the backend returns (Part 2, section 2.4).

## 1.0 Rules that apply to every screen

- Every screen has four states: **empty**, **loading / generating**, **error**, **success**. Each is listed per
  screen below. An error state always shows the backend's `error.message` and a retry action.
- Every price is `price.amount` + `price.currency` (amount is a string like `"48.00"`; show it as is). If
  `price` is `null`, show "Price on request" (the backend re-reads it later, so it may fill in on the next load).
  If `price.mock` is `true`, show the word **"estimate"** next to it.
- Every product image is `imageUrl`. If it fails to load, show a placeholder and keep the card.
- Images expire live (Arcade URLs are short-lived). Never cache image URLs in the client across sessions;
  re-fetch the list.
- Auth: Firebase anonymous sign-in, then `Authorization: Bearer <idToken>` on every call that needs it (see
  `backend/API.md`). Calls marked "optional" auth in 2.4 take the token when signed in and work without it.
- Nothing personal from Gold is ever shown to anyone but the owner. On public screens, only `public_tag`.
- Arcade generation is slow (1–2 min per product live). Every generating state shows each item's own `status`
  (`generating` / `listed` / `not_makeable`) independently; no single page-level spinner.

## 1.1 Screen list (in order)

| # | Screen | Creator flow | Fan flow |
|---|---|---|---|
| S0 | App shell / dashboard nav | yes | yes |
| S1 | Login | yes | yes |
| S2 | Gold onboarding | yes | yes |
| S3 | Brand inputs (logos / references, palette, Instagram) | yes | no |
| S4 | Style creation progress | yes | no |
| S5 | Creator search | no | yes |
| S6 | Suggested products (generating -> results) | yes | yes |
| S7 | Product detail | yes | yes |
| S8 | Universal marketplace | yes | yes |
| S9 | Buy / checkout | yes | yes |

---

### S0. App shell / dashboard nav (shown after S2 on every screen)

**Purpose:** the creator dashboard the marketplace lives in; the way back to every main screen.

| Element | Data / source |
|---|---|
| Nav item **Marketplace** | -> S8 |
| Nav item **Made for you** | -> S6 for the current `creatorId` (creator: their own; fan: the one picked in S5) |
| Nav item **My products** | -> S8 showing only items where `mine == true` |
| **Sign out / switch role** | Firebase `signOut`, then back to S1 (next sign-in is a new anonymous uid) |
| Signed-in role | `GET /users/{uid}/insights` -> `role` |
| For creators: their name and handle | `GET /creators/{creatorId}` -> `name`, `handle` (`creatorId` from `GET /users/{uid}/insights`) |

**States:** signed out (only **Marketplace** and **Sign in**); loading (role not yet read); error (show
`error.message`, nav still works); success.

---

### S1. Login

**Purpose:** sign in and pick a role.

| Element | Data / source |
|---|---|
| App name and one-line value statement | static |
| Two entry actions: **"I'm a creator"** and **"I'm a fan"** | sets `role` = `creator` or `fan` (sent in S2) |
| "Browse the marketplace" link (no onboarding) | goes to S8; `GET /marketplace` needs no login |
| **Sign out / switch role** (when already signed in) | Firebase `signOut`, then a new anonymous sign-in (new uid) |

**User actions:** pick a role -> anonymous sign-in -> S2. Or browse -> S8.
**States:** loading (signing in); error (sign-in failed, retry); success (go to S2).
**Video:** show both entry actions; click "I'm a creator" first (creator flow is recorded first). **Before the fan
section, sign out; the fan is a different uid from the creator.**

---

### S2. Gold onboarding

**Purpose:** connect the user's Gold insights so we can suggest products relevant to them. Same screen for
creators and fans.

| Element | Data / source |
|---|---|
| Explanation of what Gold shares and that it stays private to the user | static |
| Consent / "Connect Gold" action | static; in the real app this launches the restricted Gold SDK |
| **Demo profile picker**: list of the 9 archetypes (8 Gold + Long-Table Host), labelled "Demo profile" | `GET /packs` -> `packs[]` where `kind == "archetype"`: `id`, `name`, `oneLine`, `palette[]`, `ideas[]` (first 3), `photos.count` |
| After connecting: a summary card "What Gold found" (private to the user) | `POST /users/{uid}/insights` response -> `reading.archetype.name`, `reading.archetype.one_line`, `reading.signature[].idea` (top 3) with `share_of_events` as %, palette colours (hex) from `reading.palette[].hex` |
| "This is synthetic demo data" note | `reading.stub == true` |
| Continue action | creator -> S3; fan -> S5 |

**User actions:** connect -> pick a demo profile -> see summary -> continue.
**States:** empty (no pack chosen, continue disabled); loading (attaching); error (unknown pack 400, retry);
success (summary card shown).
**Video:** show the connect step. Creator picks **Small-Table Host**, fan picks **Long-Table Host**; the two
"What Gold found" cards show different top ideas, and the two S6 card sets show different products and `why` lines.

---

### S3. Brand inputs (creator only)

**Purpose:** collect what Arcade needs to build the creator's style.

| Element | Data / source |
|---|---|
| Creator name, handle | text inputs -> `name`, `handle` |
| **Logos** upload (1–2 images) | file input -> `images[]` with `kind: "logo"` |
| **Reference images** upload (1–4 images) | file input -> `images[]` with `kind: "reference"` |
| **Connect Instagram** action (business or creator account, via Meta's Instagram Login) | `GET /instagram/connect` -> open `authUrl`; Meta redirects to `GET /instagram/callback`; afterwards `GET /instagram/status` -> `{connected, username}` |
| After connecting: grid of the account's recent image posts (carousel images flattened), pick 1–4 | `GET /instagram/media` -> `media[]`: `id`, `mediaUrl` (show as thumbnail), `permalink`, `timestamp`, `mediaType` (`IMAGE` only; videos are skipped) -> chosen IDs sent as `instagramMediaIds[]` |
| Instagram handle (filled from the connected account; editable only when not connected) | `instagram` (text, shown on the creator page) |
| **Import from a public handle** (no Instagram login): handle field + "Import" action -> grid of the latest posts, pick 1–4 | `POST /instagram/scrape {handle}` -> `images[]`: `mediaId`, `takenAt`, `caption`, `mediaType`, `dataBase64` (show as thumbnails). Picked ones -> `images[]` with `kind: "instagram"` (their `mediaType` + `dataBase64`). States: importing (10–20 s), imported (grid), failed (503: private account, only videos, or Instagram blocked it -> show `error.message`, offer the other two options) |
| Fallback: "add images from your Instagram" upload (pick 1–4 saved posts) | images -> `images[]` with `kind: "instagram"` |
| **Colour palette**: 2–6 colours, each a hex value, with add/remove | `palette[]` of `#rrggbb` (backend lowercases) |
| Optional "style words" (up to 3, e.g. "hand-drawn, coastal") | `styleWords[]` -> added to every prompt |
| List of every chosen image (local thumbnail) with its kind and a remove action | local |
| Image limits shown and enforced before upload: PNG/JPEG/WEBP/GIF, max 1 MB each, max 6 total | local check; backend also enforces |
| "Which 3 images define your style?" pick. Default: first logo + first reference + first Instagram image (if there is no Instagram image, the next reference) | `styleRefs[]` (indexes into `images[]`); Arcade accepts at most 3 per generation |
| "Use demo brand" shortcut | sends `{fixture: "brand_wishbonekitchen"}` instead of uploads |
| Create style action | `POST /creators/onboard` -> S4 |

**User actions:** upload logos and references, set palette, connect Instagram and pick posts (or upload them),
pick style images, submit.
**States:** empty (submit disabled until name + handle + valid Instagram handle + at least 1 image + 2 colours);
validation errors inline (too big, wrong type, bad hex, bad Instagram handle); Instagram states: not connected,
connecting, connected (grid), connect failed or not a business/creator account (show `error.message`, offer the
upload fallback); loading (uploading); error (400/403
with `error.message`; 403 = that handle is taken by another account); success -> S4.
**Video:** the recorded creator **is Wishbone Kitchen** (see 1.2). Upload `logo.png` as a logo,
`pattern-gingham.png` as a reference and `pattern-citrus.png` as an Instagram image (all from
`marketplace/fixtures/images/`: generated placeholders, not the creator's real assets), enter the palette and name
from `brand_wishbonekitchen.json`, handle `wishbonekitchen` (so `creatorId` = `creator-wishbonekitchen`, the
fixture's ID) and Instagram handle `@wishbonekitchen`, submit.

---

### S4. Style creation progress (creator only)

**Purpose:** show the style being built (images registered with Arcade) and confirm what the style is.

| Element | Data / source |
|---|---|
| One row per S3 image: local thumbnail, kind, status | during the call: status `uploading` for every row; on response replace each with `style.images[i].status` (`registered` / `failed`). Fixture path: rows show kind only (no local file). `referenceId` is shown only as "registered" |
| The 3 style images that will steer every product | `style.styleRefs[]` (indexes into the rows) |
| Palette colours (hex) | `style.palette[]` |
| Style words | `style.styleWords[]` |
| Honest label: "Style = your reference images + palette. Arcade uses up to 3 images per product." | static |
| Continue action -> S6 | |

**States:** loading (the onboard call is synchronous, a few seconds per image; text "Registering your images
with Arcade"); partial (some `failed`: show which, allow continue if at least 1 registered); error (all failed
or 503 `unavailable`, retry); success.
**Video:** show the rows as uploading, then all registered, then "Your style is ready".

---

### S5. Creator search (fan only)

**Purpose:** fan picks whose style their product will be made in.

| Element | Data / source |
|---|---|
| Search box (filters by name or handle) | `GET /creators?q=<text>` |
| Results: name, handle, palette colours (hex), number of listed products | `creators[]`: `creatorId`, `name`, `handle`, `instagram`, `palette[]`, `listedCount` |
| **One creator pre-populated** at the top before typing: **Wishbone Kitchen** (`creator-wishbonekitchen`) | first item of `GET /creators` |
| Creator preview: their listed products (up to 4) | `GET /marketplace?creatorId=<id>&maker=creator` -> `items[]` |
| Select action -> S6 | stores chosen `creatorId` |

**States:** empty (no match: "No creators found"); loading; error; success.
**Video:** the fan sees Wishbone Kitchen already there (the creator just recorded), types "wish" to show search
works, selects it.

---

### S6. What we made for you, and why (product creation)

**Purpose:** the product creation page. Show the products we made for this person **and why we chose each
thing**, with the reasons pulled from their camera roll (their Gold insights). Creator: their insights + their own
style. Fan: their insights + the chosen creator's style. Generated products are **listed in the universal
marketplace automatically** (no separate publish step).

| Element | Data / source |
|---|---|
| Header: "Made for you from your camera roll + {creator name}'s style" | `GET /creators/{creatorId}` -> `name` |
| "What we used from your camera roll" strip (owner only): the top 3 insights with their % and the user's palette swatches | the caller's reading: `reading.signature[0..2].idea` + `share_of_events`, `reading.palette[].hex` (from `GET /users/{uid}/insights`) |
| Start action (auto-start on arrival is fine) | `POST /suggest {creatorId}` |
| One card per suggestion (3 by default): category, status | `GET /suggestions?creatorId=` -> `items[]`: `itemId`, `category`, `status` (`generating` / `listed` / `not_makeable`) |
| When `listed`: image, title, price, category, short description, made-by | `imageUrl`, `title`, `price`, `category`, `description`, `maker` |
| **Why we chose this** (owner only, never public): a list of reasons, one per choice | `reasons[]`, each `{kind, text}`: `insight` = the camera-roll idea + % behind the motif ("long-table dinner parties show up in 38% of your moments"); `colour` = which colours came from your roll vs the creator's palette; `style` = the creator's brand element used ("gingham check"); `product` = why this product type (the place it matches, e.g. "dining table in 42% of your moments"). `why` stays as the one-line summary |
| Which style was used | palette (`palette[]`) and style words (`styleWords[]`) from `GET /creators/{creatorId}`; image thumbnails only if that response has `styleThumbs[]` (URLs), otherwise the text "3 reference images" |
| When `not_makeable`: reason | `reason` (Arcade's or the checker's message) |
| Per-card actions: open detail (S7) | |
| "Go to marketplace" action -> S8 | |

**States:** generating (while `POST /suggest` is in flight, show `count` (default 3) per-item generating
placeholders even if `GET /suggestions` returns `[]`; poll `GET /suggestions` every 3 s; live takes 1–2 min, mock
under 5 s); empty (only when `POST /suggest` returns **409** "attach an insight pack first" -> back to S2, or
**404** "no such creator" -> back to S5 / S3); partial (some `not_makeable`); error (503: Arcade unavailable,
retry); success (all cards resolved).
**Video:** cards change from generating to listed; open one card's "Why we chose this" and read its insight
reason aloud (fan: the gingham runner, "long-table dinner parties show up in 38% of your moments").

---

### S7. Product detail

**Purpose:** a Shopify-style product page.

| Element | Data / source |
|---|---|
| Image gallery (primary + extra) | `imageUrl`, `images[]` |
| Title | `title` |
| Price (+ "estimate" if mock) | `price.amount`, `price.currency`, `price.mock` |
| Variant / options label (size, material) | `selectionLabel` |
| Creator name + handle, **creator link** | `creatorName`, `creatorHandle`; link -> S8 with `?creatorId={creatorId}` applied, showing the creator name as the filter label |
| "Made by" line: **"by {creatorName}"** or **"fan edition, made in {creatorName}'s style"** | `maker` (`creator` / `fan`) |
| Public tag (optional, short, no numbers) | `public_tag` (may be `null`: hide) |
| Description | `description` |
| Category | `category` |
| Manufacturer | `makerName` |
| Times bought | `stats.buys` |
| Quantity selector (1–10) | sent as `quantity` |
| **Buy now** action | if not signed in: silent anonymous sign-in first (no onboarding), then -> S9 |
| Owner-only block (only for the person who made it): "Why we chose this" with the same `reasons[]` | `GET /marketplace/{itemId}` returns `owner.why` only to the maker. Send `Authorization: Bearer` when signed in (optional); without it `owner` is absent |

**States:** loading; not found (404: "This product is no longer available"); error; success.
**Video:** open the fan's piece, point at "fan edition, made in Wishbone Kitchen's style" and the price.

---

### S8. Universal marketplace

**Purpose:** one storefront with every listed product from every creator and fan. Anyone can see and buy.

| Element | Data / source |
|---|---|
| Product list, per item: image, title, price, creator name, **fan edition** label when `maker == "fan"`, times bought | `GET /marketplace` -> `items[]`: `itemId`, `imageUrl`, `title`, `price`, `creatorName`, `maker`, `category`, `stats.buys` |
| Product count | `items.length` |
| Sort: Newest / Most bought | `?sort=new` / `?sort=popular` |
| Filters: by creator, by category, by maker (creator / fan) | `?creatorId=`, `?category=`, `?maker=` |
| "Your products" marker on items the viewer made | `mine`. Send `Authorization: Bearer` when signed in (optional); without it `mine` is always false |
| Card action -> S7 | |
| Entry points: from S6, from S1 "Browse", and from the S0 nav | |

**States:** empty ("No products yet"); loading; error; success.
**Video:** the creator item and the fan item appear in the same results list; after the purchase in S9, the bought
item shows times bought 1 and moves up under "Most bought".

---

### S9. Buy / checkout

**Purpose:** start a purchase. Arcade hosts the payment page; we hand off to it.

| Element | Data / source |
|---|---|
| Order summary: image, title, quantity, unit price | from S7 |
| Continue to payment action | `POST /marketplace/{itemId}/buy {quantity}` -> `orderId`, `checkoutId`, `checkoutUrl`, `mock`. If not signed in: silent anonymous sign-in first |
| Hand-off: **only when `mock == false`**, open `checkoutUrl` in a new tab | `checkoutUrl` |
| If `mock == true`: do **not** open `checkoutUrl`; show "Demo checkout created, no payment taken" | `mock`, `orderId` |
| Confirmation: "Checkout created" + order reference | `orderId` |

**States:** loading (creating checkout); error (409 e.g. ring needs a size; 503 Arcade down); success.
**Rule:** in the demo **nobody pays**. Paying at a live `checkoutUrl` places a real order.
**Video:** on the mock, click Buy and show the in-app confirmation; the Arcade checkout page appears only in the
live re-record (do not pay). Back to S8.

## 1.2 Demo video: shot list and timed script (about 3:00)

**Who's who:** the recorded creator **is Wishbone Kitchen** (S3 as described there); the recorded fan is the
**Long-Table Host**. For the recording run the seed does **not** pre-create the creator: start a fresh emulator,
record the creator section, then run `node scripts/seed.mjs --fans-only` (adds 2 seeded fan items so the
marketplace isn't empty), then record the fan section.

| Time | Screen | What is on screen | Voice-over (short) |
|---|---|---|---|
| 0:00–0:10 | S1 | App, two role entry actions | "Creators and fans both start here." |
| 0:10–0:30 | S2 (creator) | Connect Gold, pick **Small-Table Host**, "What Gold found" card | "Gold tells us what this person actually lives with. Demo uses a synthetic profile." |
| 0:30–0:55 | S3 | Upload logo and reference; palette; **Connect Instagram** -> grid of recent posts -> pick 2 | "The creator gives us their brand, straight from their Instagram." |
| 0:55–1:10 | S4 | Rows uploading, then all registered; "style ready" | "Arcade turns those into a style." |
| 1:10–1:35 | S6 (creator) | 3 cards generating, then listed with images and prices. Open one listed card's `why` line, which quotes the same idea and % shown on the S2 "What Gold found" card (e.g. S2 shows "dinner table for four 40%", the reason says "dinner table for four shows up in 40% of your moments") | "We make products from their insights in their style." (cut the wait) |
| 1:35–1:45 | S8 | Creator's products in the marketplace | "They're live for everyone." |
| 1:45–1:55 | S0 -> S1 -> S2 (fan) | Sign out / switch role; new uid; fan picks **Long-Table Host**; "What Gold found": long-table dinner parties 38%, pasta from scratch 31%, candlelit tablescapes 27% | "Now a fan of Wishbone Kitchen." |
| 1:55–2:05 | S5 | Wishbone Kitchen pre-populated, search "wish", select | "They pick a creator." |
| 2:05–2:25 | S6 (fan) | Runner, plate, print, pendant generating -> listed; open "Why we chose this" on the runner (insight 38%, colours, gingham, dining table) | "Made from this fan's camera roll, in that creator's style." |
| 2:25–2:35 | S8 -> S7 | Filter by Wishbone Kitchen (`creatorId`); point at the fan item with the "Your products" marker (`mine == true`, the piece just made) in the same list as the creator's items; open it | "One marketplace, creator and fan pieces together." |
| 2:35–2:45 | S9 -> S8 | Buy -> "Demo checkout created" -> back; "Most bought" shows times bought 1 | "Anyone can buy." |
| 2:45–3:00 | S0 -> S1 -> S8 -> S7 -> S9 | Sign out -> "Browse the marketplace" -> signed out, the same creator and fan items -> open one -> Buy (silent anonymous sign-in) -> checkout created | "Even without an account." |

Recording rules: record against the mock for timing safety, then re-record S4/S6/S9 against live Arcade if a
working key exists (Part 2, 2.10). Speed up generating waits; do not fake results.

## 1.3 References to imitate (function only)

| Reference | What to copy functionally |
|---|---|
| Shopify collection page | product list with image, title, price; product count; sort; filter by vendor/category |
| Shopify product page | image gallery, title, price, variant label, quantity, Buy now, description, vendor link |
| Shopify vendor / brand collection | a creator's own product list reached from a product |
| Arcade Studio create flow (`studio.arcade.ai/create`) | reference-image upload list, palette, per-item generating states, results list |
| A bank-account connect consent step (e.g. Plaid Link) | explain what is shared, explicit connect, success summary |
| Instagram profile grid / Meta "Continue with Instagram" consent | connect the account, then pick a few posts as images |

## 1.4 UI acceptance checklist

- [ ] Both flows run start to finish from S1 without a page reload or manual URL.
- [ ] S8 is reachable from the S0 dashboard nav on every post-onboarding screen.
- [ ] Switching role creates a new uid; the fan's items show `maker == "fan"`.
- [ ] S2 lists exactly the 9 archetypes from `GET /packs`, labelled demo; the summary uses `reading.*` fields.
- [ ] S3 enforces: name, handle, Instagram handle matching `^@?[A-Za-z0-9._]{1,30}$`, at least 1 image, 2–6 valid hex colours, 1 MB per image, 6 images max, at most 3 style images.
- [ ] S3 captures the Instagram handle and Instagram images separately from logos and references.
- [ ] S3 "Connect Instagram" shows the account's recent image posts and sends the chosen `instagramMediaIds[]`;
      the upload fallback works when not connected.
- [ ] With an Instagram image present, it is in the default `styleRefs`.
- [ ] S4 shows per-image status and continues with partial success.
- [ ] S5 shows Wishbone Kitchen before any typing; search filters by name and handle.
- [ ] S6 shows per-card `generating` / `listed` / `not_makeable`, polls, and never treats an early `[]` as empty.
- [ ] Every listed S6 card's `why` names an idea from that user's `reading.signature[]` with the same %.
- [ ] Every listed S6 card shows "Why we chose this" with its `reasons[]` (insight, colour, style, product).
- [ ] S6 shows the "What we used from your camera roll" strip (top 3 insights + palette).
- [ ] `why` appears only on S6 and the owner block of S7, never on S8 or for other viewers.
- [ ] S7 shows price with "estimate" when `price.mock`, "Price on request" when `price` is null.
- [ ] S7 distinguishes creator products from fan editions using `maker`; the creator link opens S8 filtered.
- [ ] S8 shows items from more than one maker in one list; sort, three filters and times bought work.
- [ ] S8 works signed out.
- [ ] A signed-out visitor can buy from S8 -> S7 -> S9.
- [ ] S9 opens `checkoutUrl` only when `mock == false`; shows the in-app confirmation on mock; shows backend errors (e.g. ring 409).
- [ ] Every screen has its empty, loading, error and success states.

---

# PART 2 — Backend and flow (build today with ultracode)

Rule for today: **reuse what exists, cut everything else.** The repo already has a working Firebase backend
(one HTTP function `api`, Firestore, unit tests, e2e passing) with packs, an Arcade client with a live guard,
a brand-kit marketplace and buy. We add a creator onboarding route, a suggest route, a universal feed and creator
search, and unhook the old personal-store routes.

## 2.1 Architecture

```
  UI (teammate)                     Firebase (emulator locally, deployed later)
  ─────────────                     ─────────────────────────────────────────────
  S1 login ── anon auth ──────────► Auth
  S0..S9  ── HTTPS + ID token ────► functions/index.js  `api`  (ROUTES table)
                                       │
                                       ├─ packs.js        Gold step: list/load archetype packs
                                       │                  (real app: restricted Gold SDK, same function)
                                       ├─ flow.js         attachInsights / getInsights (+ role)
                                       ├─ style.js  NEW   creator onboard: kit + Arcade references
                                       ├─ marketplace.js  makeItem / feed / getItem / buy  (+ suggest, suggestions, creators)
                                       ├─ planner.js      brief writing + rule checks (template or 1 Claude call)
                                       └─ arcade.js       Arcade client: call / wait / design / reference
                                              │   ARCADE_LIVE unset ─► mock_arcade.py :8787 (offline)
                                              │   ARCADE_LIVE=1     ─► https://platform.arcade.ai/v1
                                              ▼
                                         Arcade: references/*, categories/list, patterns/create, jobs/get,
                                                 products/get, checkouts/create
                                       Firestore: users, creators, marketplace, orders
```

One process, one function, no queues, no webhooks (Arcade has none; we poll `jobs/get`).

## 2.2 Components

| Component | File | Status today |
|---|---|---|
| Router + auth + error mapping | `backend/functions/index.js` | keep; U2 rewrites the ROUTES table once (2.15) |
| Gold step | `src/packs.js`, `flow.attachInsights/getInsights` | keep; add `role` |
| Arcade client | `src/arcade.js` | keep; **fix**: PUT image bytes in `reference()`, explicit `User-Agent`, `ARCADE_MAX_POLLS` |
| Offline Arcade | `arcade/mock_arcade.py` | keep; **add** a `do_PUT` for `uploadUrl` |
| Style (creator onboarding) | `src/style.js` (new, ~80 lines) | new |
| Suggestions + universal feed + buy | `src/marketplace.js` | extend |
| Brief writing + checks | `src/planner.js` (`templatePlan`, `check`, `askClaude`), `marketplace.checkItem` | keep |
| Rules | `backend/firestore.rules` | keep creators/marketplace/orders; delete stores/public; lock `users/{uid}` writes |

## 2.3 Data model (Firestore, minimal)

Clients only read; all writes go through `api`. U2 changes the `users/{uid}` rule to `allow read: if owner;
allow write: if false;` (today it allows owner writes).

| Path | Fields | Who reads |
|---|---|---|
| `users/{uid}` | `role` (`creator`/`fan`), `creatorId` (creators only) | owner |
| `users/{uid}/insights/current` | existing: `pack`, `kind`, `attachedAt`, `reading` | owner |
| `creators/{creatorId}` | existing public kit fields (`name`, `handle`, `palette`, `motifs`, `templates` public parts) + **new** `instagram`, `styleWords[]`, `createdAt` | public |
| `creators/{creatorId}/private/assets` | existing `owner`, `assets`, `referenceIds`, `templates` + **new** `styleRefs[]` (≤3 `referenceId`s), `images[]{kind, referenceId, status}` | owner |
| `marketplace/{itemId}` | existing `itemId`, `creatorId`, `templateId`, `category`, `world`, `title`, `brief`, `colors`, `public_tag`, `status`, `productId`, `imageUrl`, `price`, `stats.buys`, `createdAt` + **new** `maker` (`creator`/`fan`), `creatorName`, `creatorHandle`, `description`, `selectionLabel`, `makerName`, `images[]`, `imageFetchedAt`, `attempts`, `reason`; `status` gains `generating` | public when `listed` |
| `marketplace/{itemId}/private/owner` | existing `makerUid`, `owner_only{fan_idea, why}` | maker |
| `orders/{orderId}` | existing | buyer + creator owner |

`listedCount` is **not stored**: `GET /creators` computes it from the one `status == "listed"` query.

The **style** is not a separate document: it is `styleRefs` + `palette` + `styleWords` on the creator. Arcade has
no style object, so there is nothing else to store.

**The kit contract (pinned so U4 and U5 build to the same shape).** Every creator, fixture or form, has a full
`brand.kit.v0` that passes the existing `validateKit`. A form creator's kit is built by `style.js` as:

| Field | Value for a form creator |
|---|---|
| `creatorId` | `'creator-' + slug(handle)` (A-Z a-z 0-9 -, at most 56 characters) |
| `palette` | the hex values, lowercased: `[{name:'c1', hex, role: i < 2 ? 'primary' : 'accent'}, ...]` |
| `rules` | a copy of Wishbone Kitchen's `rules` (incl. `forbidden_words`) |
| `voice` | `styleWords.join(', ')` |
| `assets` | `[{assetId:'img-0', kind, mediaType, byteLength}, ...]` one per uploaded image |
| `templates` | copies of the 4 Wishbone Kitchen templates (same `templateId`s) with `uses_assets: []` and `required_brand_element = styleWords.slice(0,3)`, dropping any word that is a forbidden word; if none remain, `['the signature motif']`. The pendant brief becomes: `"A {metal} pendant shaped like {brand_element}, with a small engraved {fan_motif} on the back. No stones, purely graphic."` |
| private `styleRefs` | the ≤3 chosen `referenceId`s |

## 2.4 API endpoints

Base: `http://127.0.0.1:5001/demo-storefront/us-central1/api`. Errors stay `{"error":{"code","message"}}`.

| Method + path | Auth | Request | Response | Arcade calls |
|---|---|---|---|---|
| `GET /packs` | no | – | `{packs[]}` (existing) | none |
| `POST /users/{uid}/insights` | own uid | `{pack, role}` | existing reading object; also writes `users/{uid}.role` | none |
| `GET /users/{uid}/insights` | own uid | – | existing + `role`, `creatorId` (S0 restores the session from this after a reload) | none |
| `POST /creators/onboard` **new** | yes | `{name, handle, instagram, palette:["#rrggbb"..], styleWords?:[], images:[{kind:"logo"\|"reference"\|"instagram", mediaType, dataBase64}], instagramMediaIds?:[id..≤4], styleRefs?:[i,i,i]}` (each Instagram media ID is fetched server-side from the connected account and added as `kind:"instagram"`) or `{fixture:"brand_wishbonekitchen"}`. `creatorId = 'creator-' + slug(handle)`; hex lowercased before validating; same `creatorId` owned by a different uid -> **403** (existing `createCreator` check) | `{creatorId, style:{images[]{kind,status,referenceId}, styleRefs[], palette[], styleWords[]}}` | per image: `references/createUpload` -> PUT `uploadUrl` -> `references/create` |
| `POST /instagram/scrape` **built** | yes | `{handle, max?=6}` | `{handle, source, images:[{mediaId, shortcode, takenAt, caption, mediaType, byteLength, width, height, dataBase64}]}`; 400 bad handle, 503 blocked/private/timeout. Logged out via gallery-dl (`instagram/scrape.py`); newest first, one image per post, videos and pinned posts skipped, each ≤1600 px and ≤1 MB | none (Instagram public web, logged out) |
| `GET /instagram/connect` **new** | yes | – | `{authUrl}`: Instagram Login URL with `scope=instagram_business_basic`, our `redirect_uri`, and `state` = a signed uid | none |
| `GET /instagram/callback` **new** | via `state` | `?code=&state=` (from Meta) | exchanges `code` for a token, then a long-lived token; stores it at `users/{uid}/private/instagram` (server-only); redirects back to the app | Meta: token exchange |
| `GET /instagram/status` **new** | yes | – | `{connected, username}` | Meta: `GET /me?fields=user_id,username` |
| `GET /instagram/media` **new** | yes | `?limit=24` | `{media:[{id, mediaType, mediaUrl, permalink, timestamp}]}` images only; carousel `children` flattened | Meta: `GET /me/media?fields=id,media_type,media_url,permalink,timestamp,children{id,media_type,media_url}` |
| `GET /creators` **new** | no | `?q=` | `{creators:[{creatorId,name,handle,instagram,palette,listedCount}]}` (Wishbone Kitchen first) | none |
| `GET /creators/{id}` | no | – | existing + `name`, `handle`, `palette`, `styleWords`, `instagram` (and `styleThumbs[]` only if added later) | none |
| `POST /suggest` **new** | yes | `{creatorId, count?=4}` (`count` takes the first N kit templates) | always **200** once every item is final: `{items:[{itemId,category,status,title,description,maker,imageUrl,price,why,reasons,reason}]}` (`reasons` owner-only, see 2.6) (up to ~2 min live). 404 no such creator; 409 no Gold reading attached | per item: `patterns/create` (+`categoryId`) -> `jobs/get` poll -> `products/get` |
| `GET /suggestions` **new** | yes | `?creatorId=&count=3` | same `items[]`: `db.getAll` of the caller's deterministic itemIds; missing docs are skipped (UI polls this while `/suggest` runs) | none |
| `GET /marketplace` **new** | optional | `?sort=new\|popular&creatorId=&category=&maker=` | `{items[]}` all `listed` items, each with `itemId, imageUrl, title, price, creatorName, maker, category, stats.buys, mine` | `products/get` refresh (2.9) |
| `GET /marketplace/{itemId}` | optional | – | existing + new fields; `owner.why` only for the maker | same refresh |
| `POST /marketplace/{itemId}/buy` | yes | `{quantity}` | `{orderId, checkoutId, checkoutUrl, mock}` (U3 adds `checkoutId`; today it returns the other three). Ring -> **409** | `checkouts/create` (`dropShip: true` when quantity 1, already done) |

Removed routes: `GET /creators/{id}/marketplace` (replaced by `GET /marketplace?creatorId=`), `POST /creators`
(replaced by `/creators/onboard`), `POST /creators/{id}/items` (replaced by `/suggest`), all `/stores*` and `/public/*`.

## 2.5 The Gold step

- **Demo:** `GET /packs` -> user picks an archetype -> `POST /users/{uid}/insights {pack, role}` stores a
  `gold.reading.v0` (always `stub: true`). Same for creators and fans.
- **Real app:** `attachInsights` calls the restricted Gold SDK instead of `packs.load(id)` and stores the same
  `gold.reading.v0` shape. Nothing downstream changes. Not built today.
- Only the reading's ideas, palette shares and archetype phrasings are used; `evidence` refs never leave the owner.
- `role` is never read by the backend (the maker is decided by kit ownership). It is kept only so the UI can
  restore the session and S0 after a reload.

## 2.6 How suggestions are made

```
caller's reading (Gold)  +  chosen creator's kit (templates, palette, styleRefs, styleWords)
          │
          ▼  for the first `count` kit templates (4 for Wishbone Kitchen: table runner, plate, kitchen print, pendant)
planner / makeItem: fill template brief with the reading's top signature idea   (recorded -> 1 Claude call -> template fill)
          │  checkItem: brand colours, ≤1 fan accent, forbidden words, exact share quote, number-free public tag
          ▼
write marketplace/{itemId} status "generating"
          ▼
Arcade (print):   patterns/create {requestId, prompt: brief + styleWords, referenceIds (≤3),
                                   colors: kit + accent (≤10), categoryId}  -> poll jobs/get -> products/get
Arcade (jewelry): patterns/create {requestId, prompt: brief + metal + styleWords, categoryId}   (no refs, no colors)
          ▼
status "listed" (productId, imageUrl, images, price=unitPrice, selectionLabel, makerName, description)
or "not_makeable" (reason)
```

- `maker = "creator"` when the caller owns the kit (`private/assets.owner == uid`), else `"fan"`. One code path.
- **Reference IDs (U5 changes `makeItem`):** print items send `referenceIds = priv.styleRefs || t.uses_assets.map((a) =>
  priv.referenceIds[a])`, capped at 3. Jewelry sends no `referenceIds`, `colors` or `modelId` (the docs require this).
- **Items never block each other:** run them with `Promise.allSettled`; each item is wrapped in try/catch, and any
  error (Arcade 400/5xx, poll timeout, planner or checkItem rejection) writes `status: "not_makeable"` with `reason`.
  `/suggest` always returns 200 with every item final. The function timeout is 300 s today; raise to 540 s.
- **Idempotency:** `itemId = arcade.rid(uid, creatorId, templateId)` (stable; today it hashes the brief, which
  changes per Claude run). The doc is written as `generating` first. An item already `listed` is skipped. Arcade
  `requestId = `${itemId}-${attempts}``; `attempts` goes up only when the previous status was `not_makeable`
  (Arcade replays the original result for a `requestId` it has seen, so a failed item needs a new one to retry).
  This also makes `GET /suggestions` a `db.getAll` of known IDs: no query, no index.
- **Why line:** `why` must quote one `reading.signature[].idea` and its `share_of_events` as the same % shown in
  S2 (the existing "exact share quote" check enforces it).
- **Reasons (the "why we chose this" list), built in code, not by the model,** from data we already have, so every
  reason is true: `insight` (the `fan_idea` + its share), `colour` (each item colour labelled "from your roll" if in
  `reading.palette`, else "from {creator}'s palette"), `style` (the `required_brand_element` found in the brief),
  `product` (the reading's `places[]` entry that matches the template's category, via a small map: textile/plate ->
  dining table or kitchen, print -> kitchen, pendant -> none). Stored with `owner_only` in `private/owner`.

## 2.7 Style creation sequence (creator onboarding)

1. Validate: name, handle, `instagram` matches `^@?[A-Za-z0-9._]{1,30}$`, 1–6 images, each
   `image/png|jpeg|webp|gif`, decoded size ≤ 1 MB (Arcade allows 10 MiB; our JSON body limit is the real cap),
   2–6 hex colours (lowercased first), `styleRefs` ≤ 3.
1b. **Instagram images:** for each `instagramMediaIds[]` entry, re-read it from the connected account
   (`GET /{media-id}?fields=media_type,media_url` with the stored token; IDs not owned by that account fail), skip
   non-`IMAGE`, download `media_url` (it can expire, so fetch it now, never store it), check type and size, and add
   it as `kind: "instagram"`. Downloaded bytes go straight to Arcade and are not kept.
2. For each image: `references/createUpload {requestId: rid('ref', creatorId, sha256(bytes)) + '-u', mediaType,
   byteLength: decoded length}` -> PUT `uploadUrl` with `up.method` and exactly `up.requiredHeaders` (no
   `Authorization`) -> `references/create {requestId: rid('ref', creatorId, sha256(bytes)) + '-c', uploadId}` ->
   `referenceId`. Same bytes -> same `requestId`, so a retried onboard does not duplicate references. A failed
   image is marked `failed`; continue if at least one succeeds.
3. `styleRefs` = the chosen 3; default: first logo + first reference + first Instagram image (no Instagram image:
   the next reference).
4. Build the kit (2.3 contract), run `validateKit`, write `creators/{creatorId}` (public) and `private/assets`
   (refs, templates, `styleRefs`); write `users/{uid}.creatorId`.
5. **Fixture path** (`{fixture}`): reads `marketplace/fixtures/images/<assetId>.png` for each kit asset and uploads
   them the same way.

Not doing: real style training (Studio custom model is sales-led), `modelId` / `models/list` (optional in Arcade,
the mock answers 501), per-image intent (Studio-only). **Instagram is read only from the creator's own connected
account** (Instagram API with Instagram Login, `instagram_business_basic`). We do not read other people's accounts:
Meta's Business Discovery reads other public business accounts but doesn't document `media_url`, and their images
aren't ours to turn into products.

### 2.7b Instagram import, where it plugs in (built and tested 2026-10-11)

Three ways to get Instagram images into S3, in order of preference for the demo:

| Path | How | Status |
|---|---|---|
| **Import from a public handle** | `POST /instagram/scrape {handle}` -> `backend/functions/src/instagram.js` runs `instagram/scrape.py` (gallery-dl, logged out) -> base64 images -> UI grid -> picked ones go into onboarding as `kind:"instagram"` | **Built.** Unit tests (fake mode) and one live fetch pass; live: 5 images from the latest 12 posts of a public creator account in ~14 s |
| Connect Instagram (Meta API) | the creator's own business/creator account, routes above | Brief only (U4b) |
| Upload saved posts | file picker | Always works; keep it |

- **Locally (the demo):** the app's S3 screen calls `POST /instagram/scrape` on the **Functions emulator** on the dev
  machine, which starts Python itself. Set `PYTHON` in `backend/functions/.env.local` to a Python with `gallery-dl`
  and `pillow` (`pip install -r requirements.txt`). Code: route in `backend/functions/index.js`, runner
  `backend/functions/src/instagram.js`, scraper `instagram/scrape.py`, tests `backend/functions/test/instagram.test.js`
  (`INSTAGRAM_SCRAPE_LIVE=1` adds a real fetch).
- **Deployed:** Cloud Functions (Node) has no Python. Put `instagram/scrape.py` behind a tiny Python service (Cloud
  Run, one endpoint) and have `instagram.js` call it by URL instead of starting a process. Not needed for the demo.
- **Measured behaviour:** gallery-dl worked logged out in every run today (6, 40 and 7 images; no 429).
  Instaloader got HTTP 429 on its first request both times, so it isn't used. Instagram can start blocking logged-out
  access at any time: before recording, run the import once and keep the fake mode (`INSTAGRAM_SCRAPE_FAKE=1`) as the
  fallback.
- Until `POST /creators/onboard` (U4) exists, the scraped images can be checked by eye from the response; U4 takes
  them as `images[]` with `kind: "instagram"` unchanged.

## 2.8 Product creation sequences

| | Print (wall art print, throw pillow, rug) | Jewelry (pendant, earrings, ring) |
|---|---|---|
| Category | `categories/list` -> `pick()` matches by name, `world: "print"` (never hardcode IDs) | same, `world: "jewelry"` |
| Generate | `patterns/create {requestId, prompt ≤1000, referenceIds ≤3, colors ≤10, categoryId}` — one job makes pattern + product, Arcade picks options | `patterns/create {requestId, prompt, categoryId}` only. Name the metal in the prompt (e.g. "sterling silver"). An incompatible prompt gets a synchronous **HTTP 400** before any job exists |
| Wait | `jobs/get {jobId}` every `ARCADE_POLL_MS` (3000 live) up to `ARCADE_MAX_POLLS` (default 80, about 4 min) until `succeeded` / `failed`. Statuses are only `running`, `succeeded`, `failed` (no queued state) | same |
| Outcome -> status | `succeeded` with `result.productId` -> read the product. Any synchronous 400 from `patterns/create` (existing stage `admit`), any `failed` job, or `succeeded` with `result` null / no `productId` -> `not_makeable`, `reason = error.message`. **Never match on message text** | same |
| Read | `products/get {productId}` -> `imageUrl`, `images[]`, `unitPrice` (nullable, string amount), `selectionLabel`, `maker.name`, `description` | same |
| Not today | `categories/get` + `products/create` with chosen `selections` / `fit` (the shortcut is enough) | rings at checkout (no size on the order line): 409 guard in marketplace `buy` |

## 2.9 Universal marketplace and buy

- `GET /marketplace`: one query `where status == "listed"`, filter/sort in memory (demo scale). ponytail: in-memory
  filter, add composite indexes past ~1,000 items.
- `mine`: if a uid is present, one `db.getAll(...items.map((i) => private/owner ref))` and `mine = makerUid === uid`;
  no uid -> `mine = false`. ponytail: one batched read per feed; store a `makerUid` hash on the public doc past
  ~1,000 items.
- Refresh: an item is refreshed with `products/get` when `imageFetchedAt` is older than 10 minutes **or** `price`
  is null (Arcade says a null `unitPrice` means "read again later"). Update `imageUrl`, `images` and `price`.
  Refreshes run with `Promise.allSettled`; on error keep the old values. At most 12 refreshes per request.
  ponytail: N Arcade calls per feed load; copy images to Storage if the list grows past a few dozen.
- `buy`: `checkouts/create {requestId, lines:[{productId, quantity}], dropShip: quantity === 1}` -> `orders/{orderId}`
  -> `stats.buys += 1`. U3 adds `checkoutId` to the response and moves the ring guard from `flow.js` into
  `marketplace.buy` before `checkouts/create`: `if (category === 'ring') fail('failed-precondition', ...)` (409).
  All checkouts go through the platform's Arcade key (products belong to the key's account). **Nobody pays** at a
  live `checkoutUrl`.

## 2.10 How it runs

**Local (offline mock, default):**

```bash
# from the repo root
python arcade/mock_arcade.py --serve 8787            # terminal 1
cd backend && npm run emulators                       # terminal 2 (auth, firestore, storage, functions)
cd backend && node scripts/seed.mjs                   # terminal 3: Wishbone Kitchen + its 4 products + 2 fan items
                                                      #   (video run: --fans-only, after the creator section; see 1.2)
```

`backend/functions/.env.local`: `ARCADE_BASE_URL=http://127.0.0.1:8787/v1`, no `ARCADE_LIVE`.

**Live Arcade (exact switch):**

1. Replace the key: the one in `backend/functions/.env.local` returns **401 "Invalid API key."** Make a new one at
   `https://studio.arcade.ai/settings/api-keys`. It goes in `.env.local` (local) or
   `firebase functions:secrets:set ARCADE_API_KEY` (deployed). Never in argv, a commit or a log.
2. Set in `.env.local`: `ARCADE_LIVE=1`, `ARCADE_BASE_URL=https://platform.arcade.ai/v1`, `ARCADE_POLL_MS=3000`.
   (`arcade.js` reads `maxPolls` from `ARCADE_MAX_POLLS`, default 80 ≈ 4 min, inside the 540 s timeout. Today
   `maxPolls` is a fixed 60, so with the example's 200 ms poll a live job would "time out" after 12 s.)
3. `arcade.js` sends Node fetch's default User-Agent (`node`); U1 sets an explicit one
   (`gold-arcade-marketplace/1.0`) to avoid edge bot filtering.
4. Check categories once (no credits): `python arcade/arcade.py categories --save` -> `arcade/categories_live.json`.
   Confirm `pick()` finds a textile/table runner, a ceramic plate, a wall art print and a pendant (textile and
   plate are **inferred** names in the fixture); fix names in the templates if not.
5. Smoke test: `POST /creators/onboard {fixture}` then one `POST /suggest {count:1}`. Expect 1–2 min.
6. Set a design cap for the day before the full demo (credit cost per design is not documented; read it in Studio).

## 2.11 Seeded demo data

`backend/scripts/seed.mjs`, idempotent (deterministic itemIds and `requestId`s), runs against the emulator. Each of
the 3 seed users gets an anonymous ID token from the Auth emulator (copy the helper from `test/e2e.mjs`), then:

| User | Calls |
|---|---|
| Creator (skipped with `--fans-only`) | `POST /users/{uid}/insights {pack: "archetype-small-table-host", role: "creator"}` -> `POST /creators/onboard {fixture: "brand_wishbonekitchen"}` -> `POST /suggest {creatorId: "creator-wishbonekitchen", count: 4}` |
| Fan 1 | `POST /users/{uid}/insights {pack: "archetype-two-gear-day", role: "fan"}` -> `POST /suggest {creatorId: "creator-wishbonekitchen", count: 1}` (template fill) |
| Fan 2 | same with `archetype-same-order-regular`, `count: 1` (template fill) |

The video's fan (**Long-Table Host**) is NOT seeded: they're made live in the fan section. Their 4 suggestions have
recorded plans (`marketplace/fixtures/recorded_items.json`, keys `wk-*|archetype-long-table-host`), so the mock run
is offline and deterministic.

- Fixture images: 3 small **generated** PNGs (under 100 KB each, made by a script from the kit palette, NOT the
  creator's real assets) at `marketplace/fixtures/images/logo.png` (a plain wishbone shape), `pattern-gingham.png`,
  `pattern-citrus.png` (named by `assetId`). Added in U4. Add `marketplace/fixtures/images/` to `ASSET_OK` in
  `tools/leak_scan.py`, or the push is blocked (images are refused everywhere else).
- Done-check: `GET /marketplace` returns at least 5 listed items.
- All 9 archetype packs stay available in S2.

## 2.12 Retire (minimal today)

- U2 only: `index.js` ROUTES rewrite (2.15), delete `stores/**` and `public/**` from `firestore.rules`, the
  `users/{uid}` write lock, and the matching cases in `test/rules.test.js` and the first half of `test/e2e.mjs`.
- Leave alone today, dead but harmless: the store functions in `flow.js`, `planner.js` `RECORDED`,
  `functions/data/plan_creator_maya.json`. ponytail: delete after demo.
- Leave alone (not needed, not in the way): `ideas/`, `research/`, Python `planner/`, `marketplace/marketplace.py`.
- U6 updates `backend/API.md` to the new route table (2.4).

## 2.13 Test plan (must pass before the demo)

| Check | Command | Pass |
|---|---|---|
| Unit | `cd backend && npm test` | all green, including new: onboard validation, suggest maker logic, feed filters, form-creator kit |
| Rules | `npm run test:rules` | green without stores/public cases; `marketplace/*/private/owner` readable only by maker; owner **cannot** write `users/{uid}` |
| Mock | `python arcade/mock_arcade.py --selftest` | green incl. new PUT test |
| E2E (mock) | `npm run e2e` (mock on 8787) | creator onboard -> suggest 3 -> fan (new uid) pack -> suggest 3 -> `GET /marketplace` has creator + fan items -> signed-out buy -> `stats.buys == 1` |
| Live smoke | 2.10 step 5 | 1 real listed product with image and price |

## 2.14 Risks and fallbacks

| Risk | Fallback |
|---|---|
| No style/training endpoint | Already planned: references (≤3) + palette + style words. Say "style" in UI, not "trained model". |
| Live generation slow (1–2 min) or rate-limited (429) | `/suggest` count 3, `allSettled`; UI polls; client already retries 429 with `Retry-After`. Record video on mock, cut waits. |
| Polling gives up early live | `ARCADE_POLL_MS=3000`, `ARCADE_MAX_POLLS=80` (2.10 step 2). |
| Key invalid / no credits | Run the whole demo on the mock (`price.mock` shows "estimate"). |
| Edge bot filtering | Explicit User-Agent (2.10 step 3). |
| Category names differ live | `categories --save`, adjust template categories. |
| Jewelry prompt rejected (400) or job fails | item goes `not_makeable`; UI shows `reason`; print items carry the demo. |
| One item throws | `allSettled` + per-item try/catch: it ends `not_makeable`, the others list. |
| Image URLs expire | refresh on read (2.9). |
| `unitPrice` null | "Price on request"; the feed re-reads it on the next load (2.9). |
| Function timeout on `/suggest` | timeout 540 s; items are written as `generating` first so polling still shows progress. |
| Ring purchase | 409 guard in `marketplace.buy`. |
| Meta app setup takes time (app, Instagram product, redirect URL, tester role) | Do it first (human, ~45 min). Until it works, S3 uses the upload fallback; the demo still shows "Connect Instagram" only if it works live. |
| Meta app not reviewed | Development mode works for accounts added as **testers** on the Meta app. Only those accounts can connect today. |
| The demo creator's real account | Only connects if they log in themselves. Otherwise connect a team-owned business/creator test account. Never download a creator's posts without their consent. |
| `media_url` expires | Download at onboard time only; never store it. |
| Public-handle import blocked (logged-out Instagram changes) | Retry once; then the upload fallback; record the demo with fake mode if needed. |

## 2.15 Build plan for today (ultracode work units)

Order: **Wave 1** (U1, U2, U3 in parallel) -> **Wave 2** (U4, U4b, U5 in parallel) -> **Wave 3** (U6) -> **U7** (live).
**Human step first thing today:** create the Meta app (Instagram API with Instagram Login), add the redirect URL,
and add the demo Instagram business/creator account as a tester; put the app ID and secret in Functions secrets.

**File ownership (no merge conflicts):** U2 owns `index.js` entirely. It removes the old routes and adds **every**
new route from 2.4 in one change, each pointing at a named export (`style.onboard`, `marketplace.listCreators`,
`marketplace.feed`, `marketplace.suggest`, `marketplace.suggestions`, ...) through a small wrapper that returns
**501** while the export does not exist yet. U2 also raises the timeout to 540 s. No other unit touches `index.js`.
U3 and U5 both edit `marketplace.js` but run in different waves. U4 and U5 build to the kit contract pinned in 2.3.

| Unit | Scope | Files | Done-check |
|---|---|---|---|
| **U1 Arcade bytes + live readiness** | `reference(mediaType, bytes, requestId)` does createUpload -> PUT (`up.method`, exactly `up.requiredHeaders`, no auth) -> create; explicit `User-Agent`; `maxPolls` from `ARCADE_MAX_POLLS` (default 80); mock `do_PUT` storing bytes for the upload | `src/arcade.js`, `arcade/mock_arcade.py` | `npm test` + mock selftest green; new test uploads 1 PNG to the mock and gets a `referenceId` |
| **U2 Routes + rules** | ROUTES rewrite with 501 stubs, timeout 540, rules (delete stores/public, lock `users/{uid}` writes), matching test cases removed, rules test that the owner cannot write `users/{uid}` | `index.js`, `firestore.rules`, `test/rules.test.js`, `test/e2e.mjs` | `npm test` and `npm run test:rules` green; unbuilt new routes answer 501 |
| **U3 Universal feed + search + buy** | `feed` (filters, sort, `mine` via one `getAll`, `stats.buys`), `listCreators` (`?q`, Wishbone Kitchen first, computed `listedCount`), `GET /creators/{id}` extra fields, new item fields, refresh rule (2.9), `buy` returns `checkoutId` + ring 409 | `src/marketplace.js` | unit tests: feed across 2 creators, filters, `mine`, search returns Wishbone Kitchen first, buying a ring -> 409 |
| **U4 Creator onboarding (style)** | `style.onboard` (uploads + fixture path), form-creator kit (2.3 contract), `users/{uid}.role/creatorId`, `role`/`creatorId` in insights responses, 3 fixture PNGs | `src/style.js` (new), `flow.js` (attach/get insights only), `marketplace/fixtures/images/` | unit test with mock: 3 images -> 3 `referenceId`s, `styleRefs.length ≤ 3`, Instagram image in default `styleRefs`, bad hex / oversize / bad Instagram handle -> 400, handle owned by another uid -> 403; a form creator + the template planner gives 3 items that pass `checkItem` |
| **U4b Instagram (Meta API)** | `src/instagram.js`: connect URL, callback (code -> token -> long-lived token, stored server-only), status, media list (images, carousels flattened), `fetchForOnboard(ids)` returning bytes; an **offline fake** (`INSTAGRAM_FAKE=1`) that serves 4 generated images so tests and the mock demo need no Meta account. Env: `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `INSTAGRAM_REDIRECT_URI` (Functions secrets, never committed) | `src/instagram.js` (new), routes via U2 stubs | unit tests with the fake: media list is images only, a carousel is flattened, onboard with 2 media IDs -> 2 `instagram` `referenceId`s, a foreign media ID -> 400, no token stored in any public doc; rules test: client cannot read `users/{uid}/private/instagram` |
| **U5 Suggest** | `suggest`, `suggestions` (`getAll`), `maker` logic, stable `itemId` + `attempts` requestId, `generating` first, `allSettled` + per-item `not_makeable`, `makeItem` reads `priv.styleRefs` (≤3) for print; **`reasons[]` built in code (2.6)** stored owner-only and returned to the owner | `src/marketplace.js` | unit test: every listed item for `archetype-long-table-host` has 4 `reasons` whose `insight` text quotes the reading's exact %, and `reasons` never appear in `GET /marketplace`; creator caller -> `maker:"creator"`; fan caller -> `maker:"fan"`; jewelry sends no `referenceIds`/`colors`; a form creator's print item sends its `styleRefs`; rerun makes no duplicates; an item forced to fail with the mock fault header ends `not_makeable` and the other two are `listed` |
| **U6 Seed + e2e + docs** | `scripts/seed.mjs` (2.11, incl. `--fans-only`), rewrite `test/e2e.mjs` to the 2.13 flow, update `API.md` | `backend/scripts`, `backend/test`, `backend/API.md` | `npm run e2e` PASS; `GET /marketplace` returns ≥ 5 items after seed |
| **U7 Live switch** (human + 1 agent) | 2.10 live steps 1–6 | `.env.local` only | one live product listed with real image + price; no payment made |

UI teammate can start immediately against the existing `GET /packs`, `POST /users/{uid}/insights`, `GET /marketplace/{itemId}`
and `buy`, and against the request/response shapes in 2.4 for the rest (unbuilt routes answer 501 after Wave 1).

## Review notes

- All 36 review findings applied. For the creator-identity finding, option 1 was chosen (the recorded creator is
  Wishbone Kitchen; the recording run seeds fans only, after the creator section), because S5 must pre-populate Wishbone Kitchen.
- `GET /suggestions` kept (as a `getAll` of deterministic IDs) because S6 needs per-item progress while `/suggest` runs.
- `users.role` kept only for UI session restore and S0 (2.5).
