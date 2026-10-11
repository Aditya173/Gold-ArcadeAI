# Storefront API

The backend the app's UI is built against. Everything is one HTTP function, `api`, plus Firestore reads
that the security rules allow.

| | Base URL |
|---|---|
| Emulator | `http://127.0.0.1:5001/demo-storefront/us-central1/api` |
| Deployed | `https://us-central1-<project>.cloudfunctions.net/api` |

All bodies are JSON (`Content-Type: application/json`). CORS is open.

## Auth

Sign in with the Firebase client SDK (anonymous sign-in is enough), then send the user's **ID token**:

```
Authorization: Bearer <await auth.currentUser.getIdToken()>
```

An ID token is a short-lived signed proof of who the user is; the API checks it and uses its `uid`. The open
routes are `GET /packs`, `GET /public/{storeId}`, `GET /creators/{id}`, `GET /creators/{id}/marketplace` and
`GET /marketplace/{itemId}`. In the emulator, connect the client to the
auth emulator (`connectAuthEmulator(auth, 'http://127.0.0.1:9099')`) so its tokens are accepted.

## Errors

Every error is `{"error": {"code": "<code>", "message": "<human text>"}}`:

| HTTP | `code` | When |
|---|---|---|
| 400 | `invalid-argument` | unknown pack, bad `storeId`, invalid brand kit, unknown `templateId`, bad `quantity` |
| 401 | `unauthenticated` | missing or invalid ID token |
| 403 | `permission-denied` | not your user or not your store |
| 404 | `not-found` | no such route, store, public store, piece, or no insights attached yet |
| 405 | `method-not-allowed` | right path, wrong method |
| 409 | `failed-precondition` | publishing with no designed piece; buying a ring (no size on the order line yet); making an item with no insights attached, or an item that fails the brand rules |
| 503 | `unavailable` | Arcade (the mock) is down or answered an error |
| 500 | `internal` | anything else |

## The flow

```
GET /packs ─► POST /users/{uid}/insights ─► POST /stores ─► POST /stores/{id}/plan ─► POST /stores/{id}/design
            ─► GET /stores/{id} (owner review) ─► POST /stores/{id}/publish ─► GET /public/{id} ─► POST …/checkout
```

Plan and design are separate calls so the UI can show progress. Each is quick in the emulator
(well under 5 s); with a live Claude plan, `plan` can take a minute.

---

### `GET /packs` (no auth)

The Gold insight packs a user can attach. For the demo these are the only source of readings: 8
portrait archetypes (`kind: "archetype"`) and invented example people (`kind: "fixture"`).

```json
{"packs": [
  {"id": "archetype-grid-keeper", "kind": "archetype", "name": "Grid Keeper",
   "oneLine": "…", "photos": {"count": 300, "events": 80},
   "ideas": ["filled weekly planner", "paperwork spread on table", "…"],
   "palette": ["#…", "#…"], "signatureReliability": "unmeasured"},
  {"id": "creator_maya", "kind": "fixture", "name": null, "oneLine": null, "…": "…"}
]}
```

### `POST /users/{uid}/insights` (auth; `{uid}` must be the caller)

Attach a pack to the user. Replaces any earlier one. Request: `{"pack": "archetype-grid-keeper"}`.
Response: the attached reading (a `gold.reading.v0`, see `gold_sdk/README.md`), always `stub: true`:

```json
{"pack": "archetype-grid-keeper", "kind": "archetype", "attachedAt": 1791745505568,
 "reading": {"schema": "gold.reading.v0", "subject": "archetype-grid-keeper", "stub": true,
             "photos": {"count": 300, "events": 80},
             "signature": [{"idea": "filled weekly planner", "share_of_events": 0.35, "strength": 0.85,
                            "evidence": ["ev-001"], "synonyms": ["…"]}],
             "palette": [{"name": "…", "hex": "#…", "share": 0.3, "source": "lives_with"}],
             "places": [], "reliability": {"signature": {"status": "unmeasured"}},
             "archetype": {"name": "Grid Keeper", "one_line": "…", "title_phrasings": ["…"]}}}
```

### `GET /users/{uid}/insights` (auth; own uid)

The same object, or 404 if none is attached.

### `POST /stores` (auth)

Create a store from the caller's attached reading. Request: `{}` or `{"storeId": "my-id"}` (1–64 of
`A-Z a-z 0-9 _ -`). Calling it again with the same `storeId` starts that store over: its pieces are
cleared and its public page comes down. Response: `{"storeId": "W50ma4…", "status": "created", "pack": "archetype-grid-keeper"}`.

### `POST /stores/{storeId}/plan` (auth; owner)

Plans the store: a name, tagline, about text, palette and **one piece per category**: `ring`,
`pendant necklace`, `earrings`, `rug`, `throw pillow`, `wall art print`. The planner's rules are
enforced in code: print colours come only from the reading's palette, jewelry takes no colours, and every
`why` quotes a share the reading actually states. Request: `{}`. Response: `{"products": 6, "model": "template"}`.
`model` says how the plan was written: `"recorded"` (a stored plan, `creator_maya` only), `"template"`
(offline, built from the reading) or `"claude-opus-5-5"` (when an Anthropic key is set).

### `POST /stores/{storeId}/design` (auth; owner)

Sends each planned piece to Arcade (`patterns/create`, then the product). Rerunning skips pieces already
designed or declined. Request: `{}`. Emulator only: `{"faults": {"0": "job_fail"}}` makes the mock's
maker refuse line 0 (also `admission`, `rate_limit`, `unauthorized`); ignored for any non-local Arcade.
Response:

```json
{"designs": [{"line": 0, "ok": false, "reason": "no maker can price this design"},
             {"line": 1, "ok": true, "reason": null}]}
```

### `GET /stores/{storeId}` (auth; owner)

Everything the owner's review screen needs.

```json
{"storeId": "W50ma4…", "owner": "<uid>", "creatorId": null, "templateId": null, "pack": "archetype-grid-keeper",
 "status": "designed", "createdAt": 1791745505568, "model": "template",
 "reading": {"…": "the reading, without evidence refs"},
 "store": {"name": "Grid Keeper", "tagline": "…", "about": "…", "palette": ["#…"]},
 "products": [
   {"id": "p00", "line": 0, "category": "ring", "title": "…", "prompt": "<brief sent to the maker>",
    "colors": [], "why": "Filled weekly planner shows up in 35% of your moments.",
    "signature": ["filled weekly planner"], "status": "declined", "declineReason": "job: no maker can price this design"},
   {"id": "p03", "line": 3, "category": "rug", "…": "…", "status": "designed",
    "arcade": {"productId": "…", "patternId": "…", "imageUrl": "http://127.0.0.1:8787/mock/placeholder/…",
               "unitPrice": {"amount": "600.00", "currency": "USD", "mock": true, "basis": "…"},
               "maker": "…", "categoryId": "…"}}],
 "evidence": {"signature": {"filled weekly planner": ["ev-001"]}, "products": {"p00": ["ev-001"]}}}
```

`status` moves `created` → `planned` → `designed` → `published`. A product is `planned`, `designed` or
`declined`. `evidence` refs are opaque and **owner-only**; they never reach the public copy. Prices and
images are the mock's: label them as estimates (`unitPrice.mock` is `true`).

### `POST /stores/{storeId}/publish` (auth; owner)

Copies the store to its public page. Nothing goes public unless the owner ticked it. Request:

```json
{"optin": {"about": true, "whys": ["p01", "p03"]}}
```

Public: name, tagline, palette, the designed pieces (title, category, brief, image, price, maker), plus the
about text and each `why` only if opted in. Never public: the owner's uid, the reading, evidence, declined
pieces. Publishing again replaces the public copy. Response: `{"storeId": "W50ma4…", "url": "/store/W50ma4…"}`
(`url` is a suggested app route).

### `GET /public/{storeId}` (no auth)

```json
{"storeId": "W50ma4…", "name": "Grid Keeper", "tagline": "…", "about": "… or null", "palette": ["#…"],
 "stub": true, "mock": true, "publishedAt": 1791745505568,
 "products": [{"id": "p01", "line": 1, "category": "pendant necklace", "title": "…", "why": "… or null",
               "prompt": "…", "productId": "…", "imageUrl": "…", "unitPrice": {"amount": "82.80", "currency": "USD", "mock": true},
               "maker": "…"}]}
```

`stub: true` means the store was planned from a sample reading, not the owner's own photos. Say so on the page.

### `POST /public/{storeId}/products/{pid}/checkout` (auth: any signed-in user)

Buy one piece. Creates an Arcade checkout and an order. Request: `{}`. Response:

```json
{"orderId": "…", "checkoutUrl": "http://127.0.0.1:8787/mock/checkout/9000001", "mock": true}
```

Send the buyer to `checkoutUrl`. With the mock nothing is charged and the order is never paid. Rings
answer 409 for now (the order line has no ring size yet).

### `DELETE /stores/{storeId}` (auth; owner)

Deletes the store, its products, evidence and public page. Orders stay. Response: `{"deleted": "W50ma4…"}`.

---

## Brand-template marketplace (idea 7)

A creator publishes a **brand kit** (`brand.kit.v0`: palette, motifs, logo/pattern assets, one template per
category, rules; see `marketplace/README.md` and `marketplace/fixtures/brand_tide_and_clay.json`). A fan makes
a piece inside one template, personal to them through **their attached insight pack**. Every piece made is
listed on the creator's marketplace, where anyone can see it and any signed-in user can buy it.

```
POST /creators ─► (fans) POST /users/{uid}/insights ─► POST /creators/{id}/items ─► GET /creators/{id}/marketplace
                                                                                  ─► GET /marketplace/{itemId} ─► POST …/buy
```

### `POST /instagram/scrape` (auth)

Pulls a **public** Instagram account's latest post images for creator onboarding (the brand page). Logged out, no
Instagram account needed. Runs `instagram/scrape.py` (gallery-dl) on the server.

Request: `{"handle": "wishbonekitchen", "max": 6}` (`@` optional; `max` 1–6, default 6).

Response:
```json
{"handle": "wishbonekitchen", "source": "gallery-dl",
 "images": [{"mediaId": "4003433320117355812", "shortcode": "DePDWS_jsUk", "takenAt": "2026-10-08 13:34:23",
             "caption": "...", "mediaType": "image/jpeg", "byteLength": 234512, "width": 1200, "height": 1600,
             "dataBase64": "..."}]}
```

- Newest first; one image per post (the first of a carousel); videos and **pinned posts are skipped**; each image
  shrunk to at most 1600 px and 1 MB.
- The UI shows `images[]` as a grid, the creator picks 1–4, and the picked ones go to onboarding as brand images
  with `kind: "instagram"` (their `mediaType` + `dataBase64`). Nothing is stored by this route.
- Errors: **400** bad handle; **503** private account, only videos, Instagram blocked the request, or timeout
  (show `error.message` and offer the upload fallback). Takes about 10–20 s.
- `INSTAGRAM_SCRAPE_FAKE=1` in `functions/.env.local` returns generated images (offline demo and tests).

### `POST /creators` (auth; the caller becomes the owner)

Body: a full `brand.kit.v0`, or `{"fixture": "brand_tide_and_clay"}` for the demo kit. The kit is
validated (schema, `creatorId` 1–64 of `A-Z a-z 0-9 _ -`, lowercase `#rrggbb` palette, every template has
`{fan_motif}`, uses only known assets, jewelry templates use no assets, rules present). Each asset is
registered once with Arcade as a **reference** (an image Arcade uses to steer print designs) and its
`referenceId` is stored privately. Posting the same `creatorId` again updates the kit; someone else's
`creatorId` answers 403. Response: `{"creatorId": "creator-tide-and-clay", "assets": 3}`.

### `GET /creators/{creatorId}` (no auth)

The public kit: no owner uid, no asset internals (`referenceId`, sizes, descriptions) and no template briefs.

```json
{"schema": "brand.kit.v0", "creatorId": "creator-tide-and-clay", "name": "Tide & Clay", "handle": "tideandclay",
 "voice": "warm, unhurried, a little salty",
 "palette": [{"name": "clay", "hex": "#b8714a", "role": "primary"}],
 "motifs": ["the wave-and-wheel mark", "thrown-ring stripes", "a tide-line edge"],
 "assets": [{"assetId": "logo", "kind": "logo"}],
 "templates": [{"templateId": "tc-print", "category": "wall art print", "world": "print",
                "required_brand_element": ["thrown-ring stripes", "the wave-and-wheel mark", "a tide-line edge"]}],
 "rules": {"min_brand_colors": 2, "fan_accent_colors": 1, "forbidden_words": ["logo", "trademark", "text", "letters", "photo of"],
           "royalty_pct": 15, "public_tag_requires_opt_in": true},
 "createdAt": 1791745505568, "updatedAt": 1791745505568}
```

### `POST /creators/{creatorId}/items` (auth; the caller is the fan)

Body: `{"templateId": "tc-print", "showTag": true}`. The fan must have an insight pack attached (else 409).
`showTag` opts in to showing the short public tag when the kit's rules require an opt-in (Tide & Clay's do).

The piece is written by, in order: a **recorded** item for that template and pack (the demo fans), else
**one Claude call** when `ANTHROPIC_API_KEY` is set, else a **template fill** from the fan's strongest idea
(offline). Every route goes through the same checks, and a piece that fails answers 409
`failed-precondition` (`item rejected: …`):

- the template's brand element is in the brief, and no `{slot}` is left unfilled;
- print takes at least `min_brand_colors` brand colours plus at most `fan_accent_colors` colours from the
  **fan's own** palette; jewelry takes no colours and no references;
- no forbidden word and no creator name in the brief (the brand travels as references);
- `fan_idea` is one of the fan's ideas, and the private why quotes its share exactly;
- the public tag is at most 6 words with no numbers.

Then it goes to Arcade: print pieces carry the template's assets as `referenceIds`. The item is `listed` if a
maker can make it, otherwise `not_makeable` (visible only to the maker). Response (the maker's view):

```json
{"itemId": "itm-3f2a9c0d1b7e", "creatorId": "creator-tide-and-clay", "templateId": "tc-print",
 "category": "wall art print", "world": "print", "title": "First Light Rings",
 "brief": "A 12x16 in wall print: thrown-ring stripes framing a sunrise over a ridgeline, …",
 "colors": ["#b8714a", "#9fb8ad", "#e8dcc6", "#f2b98a"], "public_tag": "for early-morning walkers",
 "royalty_pct": 15, "model": "recorded", "stats": {"buys": 0}, "createdAt": 1791745505568,
 "status": "listed", "productId": "…", "imageUrl": "http://127.0.0.1:8787/mock/placeholder/…",
 "price": {"amount": "45.00", "currency": "USD", "mock": true, "basis": "…"},
 "owner_only": {"fan_idea": "sunrise over ridgeline", "why": "Sunrise over a ridgeline shows up in 40% of your moments, …"}}
```

A `not_makeable` item has `"reason": "…"` instead of `productId`, `imageUrl` and `price`. The same fan making
the same piece again gets the same `itemId`, and it keeps its `stats`.

### `GET /creators/{creatorId}/marketplace?sort=new|popular` (no auth)

Listed items only, without `owner_only` for anyone. `new` (default) is newest first; `popular` is most
bought first. Response: `{"creatorId": "…", "sort": "new", "items": [<item without owner_only>, …]}`.

### `GET /marketplace/{itemId}` (no auth; send a token to get the maker's view)

The item's public fields. The maker (by ID token) also gets `owner_only`, and can see their own
`not_makeable` items; everyone else gets 404 for those.

### `POST /marketplace/{itemId}/buy` (auth: any signed-in user)

Body: `{"quantity": 1}` (an integer 1–20; default 1). Creates an Arcade checkout (`dropShip` when quantity
is 1), an order (`orders/{id}`: readable by the buyer and the creator), and adds 1 to `stats.buys`.
Response: `{"orderId": "…", "checkoutUrl": "http://127.0.0.1:8787/mock/checkout/9000003", "mock": true}`.
With the mock nothing is charged.

## Reading Firestore directly (optional)

Live updates can come from Firestore listeners instead of polling `GET /stores/{id}`. Clients can only
**read**; every write goes through the API.

| Path | Who can read |
|---|---|
| `users/{uid}` | that user (they may also write it: free for UI preferences) |
| `users/{uid}/insights/current` | that user (written only by the API) |
| `stores/{id}`, `stores/{id}/products/*`, `stores/{id}/private/evidence` | the store's owner |
| `public/{id}`, `public/{id}/products/*` | anyone |
| `orders/{id}` | the buyer and the store's owner (for a marketplace order: the creator) |
| `creators/{id}` | anyone (the public kit) |
| `creators/{id}/private/assets` | the creator (owner uid, assets, referenceIds, full templates) |
| `marketplace/{id}` | anyone, while `status == "listed"` (a list query must filter on `status == "listed"`) |
| `marketplace/{id}/private/owner` | the maker only (`makerUid`, `owner_only`) |

Storage: `users/{uid}/photos/{storeId}/*` is owner-only (JPEG under 2 MB). The demo uploads no photos.

Stores carry `creatorId: null` and `templateId: null`, reserved for a store made from a creator's template.
