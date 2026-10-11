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
routes are `GET /packs`, `GET /creators`, `GET /creators/{id}`, `GET /marketplace`, `GET /marketplace/{itemId}` and
the Instagram callback (they still read the uid when a token is sent). In the emulator, connect the client to the
auth emulator (`connectAuthEmulator(auth, 'http://127.0.0.1:9099')`) so its tokens are accepted.

## Errors

Every error is `{"error": {"code": "<code>", "message": "<human text>"}}`:

| HTTP | `code` | When |
|---|---|---|
| 400 | `invalid-argument` | unknown pack or fixture, bad onboard form (handle, Instagram handle, hex, image type/size), bad `quantity` |
| 401 | `unauthenticated` | missing or invalid ID token |
| 403 | `permission-denied` | not your user; that `creatorId` belongs to another uid |
| 404 | `not-found` | no such route, creator or item, or no insights attached yet |
| 405 | `method-not-allowed` | right path, wrong method |
| 409 | `failed-precondition` | `/suggest` with no Gold reading attached; buying a ring (no size on the order line yet) |
| 501 | `unimplemented` | a route whose module is not built yet |
| 503 | `unavailable` | Arcade (the mock) is down or answered an error |
| 500 | `internal` | anything else |

## The flow

```
GET /packs ─► POST /users/{uid}/insights {pack, role}
  creator: ─► POST /creators/onboard ─► POST /suggest {creatorId}            (maker "creator")
  fan:     ─► GET /creators?q= ─► POST /suggest {creatorId} (poll GET /suggestions)   (maker "fan")
anyone:    GET /marketplace ─► GET /marketplace/{itemId} ─► POST /marketplace/{itemId}/buy
```

`/suggest` answers once every item is final (`listed` or `not_makeable`): about 1 s per item on the mock, 1–2 min
live. Items are written as `generating` first, so `GET /suggestions` shows progress meanwhile.

---

### `GET /packs` (no auth)

The Gold insight packs a user can attach. For the demo these are the only source of readings: 9
portrait archetypes (8 Gold + the synthetic Long-Table Host) (`kind: "archetype"`) and invented example people (`kind: "fixture"`).

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

Attach a pack to the user. Replaces any earlier one. Request: `{"pack": "archetype-grid-keeper", "role": "creator"|"fan"}`
(`role` is stored on `users/{uid}` only so the UI can restore the session).
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

The same object plus `role` and `creatorId` (creators only), or 404 if none is attached.


## Creators and the marketplace

A creator onboards a **style** (≤3 reference images + palette + style words) on top of a `brand.kit.v0` with 4
templates (table runner, plate, kitchen print, pendant). Anyone with a Gold reading asks `/suggest` for pieces in
that creator's templates, personal to their reading; every listed piece is in the one marketplace feed.

### `POST /creators/onboard` (auth; the caller becomes the owner)

Form: `{"name", "handle", "instagram": "@name", "palette": ["#rrggbb", …2-6], "styleWords"?: […≤8],
"images": [{"kind": "logo"|"reference"|"instagram", "mediaType": "image/png|jpeg|webp|gif", "dataBase64"}] (1-6, ≤1 MB each),
"instagramMediaIds"?: [id, …≤4], "styleRefs"?: [imageIndex, …≤3]}`, or the demo fixture `{"fixture": "brand_wishbonekitchen"}`.
`creatorId = "creator-" + slug(handle)`. Each image goes to Arcade (createUpload -> PUT -> create); one failed image is
marked `failed` and the rest continue. Re-onboarding is allowed for the owner; another uid gets **403**.

Response: `{"creatorId": "creator-wishbonekitchen", "style": {"images": [{"kind", "status": "ready"|"failed", "referenceId"}],
"styleRefs": ["ref_…"], "palette": ["#…"], "styleWords": ["…"]}}`

### Instagram (Meta API with Instagram Login; `INSTAGRAM_FAKE=1` serves 4 generated images offline)

| Route | Auth | Response |
|---|---|---|
| `GET /instagram/connect` | yes | `{authUrl}` (Instagram Login, `scope=instagram_business_basic`, signed `state`) |
| `GET /instagram/callback?code=&state=` | via `state` | stores the token server-only at `users/{uid}/private/instagram`; 302 back to the app |
| `GET /instagram/status` | yes | `{connected, username}` |
| `GET /instagram/media?limit=24` | yes (max 50) | `{media: [{id, mediaType: "IMAGE", mediaUrl, permalink, timestamp}]}` images only, carousels flattened |

Pass chosen media `id`s to onboarding as `instagramMediaIds`; the server fetches the bytes. Nothing from Instagram is stored.

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

### `POST /dev/fake-products` (no auth; emulator only)

Loads `marketplace/fixtures/fake_products/products.json` into the emulator (format: that folder's README). Returns
`{"loaded": 3, "creators": ["creator-wishbonekitchen"]}`. Fake items have `fake: true`, `price.mock: true`, and a
relative `imageUrl` (`/assets/fake/<file>`, served by `GET /assets/fake/{file}`; prefix the API base). Buying one
returns a demo checkout (`fake: true`, `checkoutUrl: null`) without calling Arcade.


### `GET /creators?q=` (no auth)

`{"creators": [{"creatorId", "name", "handle", "instagram", "palette", "listedCount"}]}`, Wishbone Kitchen first.

### `GET /creators/{creatorId}` (no auth)

The public kit (no asset internals, no owner) plus `name`, `handle`, `palette`, `styleWords`, `instagram`.

### `POST /suggest` (auth)

Request: `{"creatorId": "creator-wishbonekitchen", "count": 4}` (the first `count` kit templates; default 4).
**404** no such creator, **409** no reading attached. Always **200** once every item is final:

```json
{"items": [{"itemId": "…", "category": "print", "status": "listed"|"not_makeable", "title": "…", "description": "…",
            "maker": "creator"|"fan", "imageUrl": "…", "price": {"amount": 34, "currency": "USD", "mock": true},
            "why": "…", "reasons": [{"kind": "insight"|"colour"|"style"|"product", "text": "…"}], "reason": null}]}
```

`maker` is `creator` when the caller owns the kit. `why` and `reasons` are owner-only (never in the feed). itemIds are
deterministic per (uid, creator, template): a rerun skips listed items and retries `not_makeable` ones.

### `GET /suggestions?creatorId=&count=3` (auth)

The caller's items so far, same shape (missing ones skipped). Poll it while `/suggest` runs.

### `GET /marketplace?sort=new|popular&creatorId=&category=&maker=creator|fan` (no auth; token optional)

`{"sort": "new", "items": [{"itemId", "imageUrl", "title", "price", "creatorName", "maker", "category", "stats": {"buys"}, "mine", …}]}`:
every `listed` item; `mine` is true for the caller's own items. Image URLs and prices are refreshed from Arcade when stale.

### `GET /marketplace/{itemId}` (no auth; send a token to get the maker's view)

The item's public fields. The maker also gets `owner: {why, fan_idea, reasons}` and can see their own
`generating`/`not_makeable` items; everyone else gets 404 for those.

### `POST /marketplace/{itemId}/buy` (auth: any signed-in user)

Body: `{"quantity": 1}` (an integer 1–20; default 1). Creates an Arcade checkout (`dropShip` when quantity
is 1), an order (`orders/{id}`: readable by the buyer and the creator), and adds 1 to `stats.buys`.
Response: `{"orderId": "…", "checkoutId": "…", "checkoutUrl": "http://127.0.0.1:8787/mock/checkout/9000003", "mock": true}`.
A ring answers **409**. With the mock nothing is charged.

## Reading Firestore directly (optional)

Clients can only **read**; every write goes through the API.

| Path | Who can read |
|---|---|
| `users/{uid}` | that user (`role`, `creatorId`; no client writes) |
| `users/{uid}/insights/current` | that user |
| `users/{uid}/private/instagram` | nobody (server only) |
| `orders/{id}` | the buyer and the creator |
| `creators/{id}` | anyone (the public kit + `instagram`, `styleWords`) |
| `creators/{id}/private/assets` | the creator (owner uid, assets, referenceIds, templates, `styleRefs`, `images`) |
| `marketplace/{id}` | anyone, while `status == "listed"` (a list query must filter on `status == "listed"`) |
| `marketplace/{id}/private/owner` | the maker only (`makerUid`, `owner_only`) |

## Local demo data

`node scripts/seed.mjs` (emulators + mock up): Wishbone Kitchen (fixture onboard + 4 suggestions) and 2 fans
(`archetype-two-gear-day`, `archetype-same-order-regular`, 1 item each). Fixed seed uids, so it is idempotent.
`--fans-only` skips the creator (the video run, after the creator section is recorded live).
