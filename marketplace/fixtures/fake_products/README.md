# Fake products (for filling the marketplace in the local simulation)

Hand-made listings that fill the marketplace without calling Arcade. Add them to `products.json` and put their
images in `images/`. One command loads them into the local emulator, and they appear in the feed next to the
products the app generates.

## Add a product

Add an object to `products` in `products.json`:

| Field | Required | Rules | Example |
|---|---|---|---|
| `creatorId` | yes | an existing creator, or one with a kit file `marketplace/fixtures/brand_<name>.json` (the loader creates the creator if needed) | `"creator-wishbonekitchen"` |
| `maker` | yes | `"creator"` (the creator's own product) or `"fan"` (a fan's piece) | `"fan"` |
| `title` | yes | 1–60 characters | `"Candlelit Wishbone"` |
| `category` | yes | one of `ring`, `pendant necklace`, `earrings`, `rug`, `throw pillow`, `wall art print`, `textile`, `ceramic plate` | `"pendant necklace"` |
| `price` | yes | `amount` is a string with 2 decimals; `currency` is 3 letters | `{"amount": "184.00", "currency": "USD"}` |
| `image` | yes | a file name in `images/` (`.jpg`, `.png` or `.webp`, letters/numbers/`.`/`-`/`_` only), or an `https://` URL | `"fan-wishbone-pendant.jpg"` |
| `description` | no | shown on the product page | |
| `colors` | no | `#rrggbb` values | `["#c8472d", "#f3ead7"]` |
| `public_tag` | no | at most 6 words, no numbers | `"for candlelit dinners"` |
| `buys` | no | the starting "times bought" count (sorts "Most bought") | `3` |
| `fan_idea`, `why` | fan items only | the private "why we chose this" line. Only the fan who made it would see it | `"Candlelit tablescapes show up in 27% of your moments, …"` |
| `itemId` | no | a fixed ID (`a-z 0-9 -`); default `fake-<creator>-<position>` | |

Image tips: about 900–1600 px on the long side and under 1 MB. Square or 3:4 works best for product cards.

## Load them

With the emulators running (see `backend/README.md`):

```bash
curl -X POST http://127.0.0.1:5001/demo-storefront/us-central1/api/dev/fake-products
# -> {"loaded": 3, "creators": ["creator-wishbonekitchen"]}
curl "http://127.0.0.1:5001/demo-storefront/us-central1/api/creators/creator-wishbonekitchen/marketplace?sort=popular"
```

- **Loading again is safe.** It overwrites by `itemId` and keeps "times bought".
- **Errors name the product and the field**, e.g. `products[2] "Candlelit Wishbone": images/x.jpg not found`.
- **The route only works in the emulator**, never deployed.

## How they behave

- **In the feed:** they appear like any listed product, with `fake: true` and `price.mock: true` (so the UI can show
  "estimate").
- **Images:** a local `image` becomes `imageUrl: "/assets/fake/<file>"`. The UI prefixes the API base,
  `http://127.0.0.1:5001/demo-storefront/us-central1/api`.
- **Buy:** returns a demo checkout (`fake: true`, `checkoutUrl: null`) without calling Arcade, and increases
  "times bought".
- **Fan items:** owned by a placeholder fan (`fake-fan-N`), so nobody in the app sees their private `why`.
