# Brief §1.4 UI acceptance checklist: simulator run, 2026-10-11

Verified by driving the app in Expo Go on the iPhone 17 Pro simulator (emulators + mock Arcade, `INSTAGRAM_FAKE=1`).
Screenshot numbers refer to files in this folder.

- [x] Both flows run start to finish from S1 without a page reload or manual URL. Creator 01-07, fan 08-13.
      (One reload happened mid-run, caused by another agent's live edit to S1, not by the flow.)
- [x] S8 is reachable from the S0 dashboard nav on every post-onboarding screen. Nav bar visible on S3-S9 shots.
- [x] Switching role creates a new uid; the fan's items show `maker == "fan"`. "Fan edition" badges in 11, 13; API feed lists them as `maker: fan`.
- [x] S2 lists exactly the 9 archetypes from `GET /packs`, labelled demo. "9 profiles", "Synthetic demo data" (02, 08).
- [ ] S3 enforces every rule (name, handle, Instagram regex, image count/size, 2-6 hex, 3 style images). Not verified:
      only the "Still needed" summary was seen updating; no limits were exercised.
- [x] S3 captures the Instagram handle and Instagram images separately. 04: handle filled from the connected account, Instagram section "2 of 4".
- [~] S3 "Connect Instagram" shows recent posts and sends `instagramMediaIds[]`. Posts shown and picked (04);
      the send was not exercised because the run used "Use demo brand". Upload fallback not verified.
- [ ] With an Instagram image present, it is in the default `styleRefs`. Not verified.
- [x] S4 shows per-image status. 05 ("registered" per image). Partial success not exercised.
- [x] S5 shows Wishbone Kitchen before any typing (09). Search filtering not verified.
- [x] S6 shows per-card status (`listed` badges, 06, 10). `generating` / `not_makeable` and polling not observed (mock is fast).
- [ ] Every listed S6 card's `why` names an idea from the user's signature with the same %. Not verified.
- [~] Every listed S6 card shows "Why we chose this" (10). Its expanded `reasons[]` were not opened.
- [x] S6 shows the "What we used from your camera roll" strip (06, 10).
- [ ] `why` appears only on S6 and the owner block of S7. Not verified.
- [x] S7 shows price with "estimate" when `price.mock` (11). "Price on request" not exercised.
- [x] S7 distinguishes creator products from fan editions ("Fan edition", 11). Creator link to filtered S8 not tapped.
- [x] S8 shows items from more than one maker in one list, with sort, three filters and times bought (07, 14). Filters were not tapped.
- [x] S8 works signed out (14).
- [x] A signed-out visitor can buy from S8 -> S7 -> S9 (15). `Market Morning` `stats.buys` went 1 -> 2.
- [x] S9 shows the in-app confirmation on mock (12, 15). Live `checkoutUrl` and ring 409 not exercised.
- [ ] Every screen has its empty, loading, error and success states. Partly seen: loading (S2), error (S4 403 before the fix below), success. Not checked per screen.

## Bugs fixed during the run (app/ only)

1. "Use demo brand" failed with 403 "that creatorId belongs to someone else". Cause: `backend/scripts/seed.mjs` owns
   `creator-wishbonekitchen` under the fixed uid `seed-creator-wishbonekitchen`. Fix: the button now signs in as that
   uid with an unsigned custom token, which only the Auth emulator accepts (`signInAsDemoCreator` in
   `app/src/services/firebase.ts`, used in `S3BrandInputs.tsx`).
2. After a signed-out buy, the nav showed the red error "no insights attached". Fix: a 404 from insights now shows
   "Shopper" (`S0Nav.tsx`).

## Seen, not fixed

- S2: the camera-roll emoji icon renders as a "?" box.
- S2: the "Synthetic demo data" badge overflows the card edge.
- S3: the header title "Style Your Shop" overlaps the step dots.
- Mock product images are SVG, so they render as labelled placeholder tiles (real Arcade images are raster).
