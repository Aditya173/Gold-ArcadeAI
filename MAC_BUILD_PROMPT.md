# Mac build prompt: the whole app, built and compiled

Paste everything below the line into Claude Code on the Mac, started in an empty folder. It builds the backend
(Part 2 of `BRIEF_MARKETPLACE.md`) and an iOS app that implements every screen in Part 1, then compiles and runs
it in the iOS Simulator. **Start the prompt with the word `ultracode`** so Claude orchestrates the parallel work
with workflows.

---

ultracode

You are building, compiling and running the full Gold × Arcade marketplace app on this Mac today. Work in phases,
in order. Do not move to the next phase until its **done-check** passes, and report each done-check result
(command + summary line) as you go. If a phase can't pass, stop and tell me exactly what failed and why.

## Ground rules (binding for every agent)

1. **The spec is `BRIEF_MARKETPLACE.md`** in the repo. Part 1 = what every screen must contain (S0–S9). Part 2 =
   the backend, data model, endpoints and the U1–U7 build plan. When this prompt and the brief disagree, the brief
   wins, except for the rules in this list.
2. **The repo is public** (`github.com/Aditya173/Gold-ArcadeAI`). Never commit secrets, real photos, personal
   data, or anything about how Gold reads photos. Gold enters only through `gold_sdk/` insight packs.
3. **No live Arcade calls** unless I set `ARCADE_LIVE=1` myself in this session. Everything runs against the
   offline mock (`arcade/mock_arcade.py`). Never create a checkout against live Arcade and never pay.
4. **Pushes go through the leak scanner.** `python3 tools/leak_scan.py --install-hook` installs it. It needs the
   private deny list at `~/.config/gold/public_deny.txt`. I'll copy that file to this Mac privately; it must never
   be committed. If it's missing, the push is blocked: tell me, don't work around it.
5. Commit small units and push after each phase (`git pull --rebase` first). End commit messages with
   `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
6. **How the app looks is my teammate's job.** Build every screen functionally complete (all elements, data,
   actions and the four states in the brief), with all colours, fonts and spacing in ONE theme file
   (`app/src/theme.ts`) so the design can be swapped in without touching screens.

## Phase 0: machine setup

Check and install what's missing (Homebrew where needed). Report versions.

- Xcode (latest installed) + command line tools; an iOS Simulator runtime; `xcrun simctl list devices` shows an
  iPhone.
- Node 20 LTS or newer, npm; `watchman`.
- Java 17+ (needed by the Firebase emulators); `firebase-tools` (`npm i -g firebase-tools`).
- Python 3.11+ with a venv at `.venv` and `pip install -r requirements.txt` (needs `jsonschema`, `pillow`).
- CocoaPods (Expo prebuild uses it).

```bash
git clone https://github.com/Aditya173/Gold-ArcadeAI.git && cd Gold-ArcadeAI
python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt
python3 tools/leak_scan.py --install-hook
```

**Done-check:** these all pass offline:
`python gold_sdk/gold_sdk.py --selftest`, `python planner/planner.py --selftest`,
`python arcade/arcade.py --selftest`, `python arcade/mock_arcade.py --selftest`,
`python marketplace/marketplace.py --selftest`, `cd backend && npm install && npm test`.

**Known Mac traps:**
- The backend tests start the mock with the first `python` on `PATH`. Run them with the venv active, or set
  `PYTHON=$PWD/.venv/bin/python`.
- If the Functions emulator times out while loading, set `FUNCTIONS_DISCOVERY_TIMEOUT=60` (documented in
  `backend/README.md`).

## Phase 1: backend (brief Part 2, units U1–U6)

Run the brief's build plan (Part 2 §2.15) as a workflow:
- Wave 1: U1, U2 and U3 in parallel.
- Wave 2: U4 and U5 in parallel.
- Then U6.

Respect the file-ownership rule in §2.15:
- U2 owns `backend/functions/index.js`.
- U3 and U5 both edit `marketplace.js` but in different waves.

Each unit's done-check is in the brief's table. After each wave, have one fresh agent review the wave's diff against
the brief and fix what it finds. Must-haves:
- the demo pair from the brief: creator **Wishbone Kitchen** (`brand_wishbonekitchen`), fan **Long-Table Host**
  (`archetype-long-table-host`);
- the owner-only `reasons[]` ("why we chose this", built in code);
- the 3 generated placeholder images in `marketplace/fixtures/images/`, plus adding that folder to `ASSET_OK` in
  `tools/leak_scan.py`;
- `scripts/seed.mjs` with `--fans-only`.

**Done-check (all green, offline):**
- `cd backend && npm test`
- `npm run test:rules`
- with `python arcade/mock_arcade.py --serve 8787` running, `npm run e2e` prints `[e2e] PASS`
- after `node scripts/seed.mjs`, `GET /marketplace` returns at least 5 listed items
- `python3 tools/leak_scan.py` → `CLEAN`

Commit and push.

## Phase 2: the iOS app (brief Part 1, screens S0–S9)

Create the app in `app/` with **Expo (SDK current stable) + expo-router + TypeScript**. Structure:
- route groups `app/(auth)` and `(unauth)`;
- `src/{screens,services,store,hooks,theme.ts}`;
- `src/services/api.ts`: one typed client for every endpoint in brief §2.4, with types copied from the response
  shapes there;
- Firebase JS SDK for **anonymous auth only**, and `Authorization: Bearer <idToken>` on authed calls.

Point the app at the emulators. In the Simulator `127.0.0.1` reaches the Mac; on a real phone use the Mac's LAN IP
from `EXPO_PUBLIC_API_BASE`.

Build every screen in Part 1 with every element, data source, action and state listed there:
- **S0** nav
- **S1** login with "I'm a creator" / "I'm a fan" / "Browse"
- **S2** Gold onboarding:
  - the consent step;
  - the demo profile picker from `GET /packs` (9 archetypes);
  - the "What Gold found" card.
- **S3** brand inputs:
  - logo, reference and Instagram image pickers via `expo-image-picker`, sent as base64;
  - palette editor with hex validation;
  - Instagram handle regex;
  - style-image pick;
  - the "Use demo brand" shortcut.
- **S4** style progress
- **S5** creator search, with Wishbone Kitchen pre-populated
- **S6** "What we made for you, and why":
  - per-card status polling;
  - the "What we used from your camera roll" strip;
  - "Why we chose this" with `reasons[]`.
- **S7** product page
- **S8** universal marketplace: sort, three filters, the `mine` marker, works signed out.
- **S9** checkout: on mock, show the in-app confirmation and never open `checkoutUrl`.

Rules from the brief to enforce in the client:
- Show "estimate" when `price.mock`.
- Show "Price on request" when `price` is null.
- Never cache Arcade image URLs across sessions.
- `why` and `reasons` appear only to the owner.
- Poll `GET /suggestions` every 3 s and never treat an early `[]` as empty.

**Done-check:**
- `npx tsc --noEmit` clean.
- Unit tests for `api.ts` and the S3 validators pass (`jest` or `vitest`).
- An agent walks the whole **UI acceptance checklist (brief §1.4)** in the app running on the Simulator against
  the emulators and the mock. Each item is checked and ticked with how it was verified (the screen and what was
  seen). Untestable items are listed, not ticked.

Commit and push.

## Phase 3: compile and run on iOS

```bash
cd app
npx expo prebuild --platform ios --clean
npx expo run:ios                      # builds with Xcode and launches in the Simulator
```

1. Build with no errors.
2. The app launches in the Simulator.
3. Both flows run end to end against the local emulators and the mock:
   - creator: S1 → S2 (Small-Table Host) → S3 (Use demo brand or the 3 fixture images) → S4 → S6 → S8;
   - fan: sign out → S1 → S2 (Long-Table Host) → S5 (Wishbone Kitchen) → S6 (runner, plate, print, pendant,
     each with "Why we chose this") → S8 (the fan piece next to the creator's) → S7 → S9 (demo confirmation);
   - then signed out: Browse → S8 → S7 → Buy.
4. Take a Simulator screenshot of every screen in both flows (`xcrun simctl io booted screenshot`).
5. Save them in `docs/screens/` with a one-line caption list in `docs/screens/README.md`. These are generated UI
   screenshots with synthetic data only, so they're safe for the public repo. Add `docs/screens/` to `ASSET_OK`
   in the scanner.

Optional, on a physical iPhone:
- `npx expo run:ios --device`, with the API base set to the Mac's LAN IP.
- The phone in the earlier tests is on iOS 27, and Xcode 26.3 can't launch UI tests there. A plain `run:ios
  --device` install is fine; scripted UI tests are not. If signing fails, report it, don't change Apple account
  settings.

**Done-check:** the build log shows `Build Succeeded`, both flows ran, and the screenshots are committed.

## Phase 4: demo recording run

Follow brief §1.2 exactly:
1. Fresh emulators, nothing seeded.
2. Record the creator section on the Simulator: `xcrun simctl io booted recordVideo demo-creator.mp4`.
3. Run `node scripts/seed.mjs --fans-only`.
4. Record the fan section, then the signed-out buy.

Keep the video files **local** (don't commit them). Report the file paths and lengths.

## Phase 5: live Arcade (only when I say so)

Don't start this phase until I write "go live" and have put a fresh key in `backend/functions/.env.local`. Then run
the brief's §2.10 live steps 1–6 exactly:
- categories first;
- one smoke product;
- confirm the category names (textile and plate are inferred);
- then the demo design cap I set.

Never pay at a `checkoutUrl`.

## Final report

One message:
- each phase's done-check output;
- what's committed (hashes);
- what failed or was skipped and why;
- the acceptance checklist with ticks;
- where the screenshots and videos are;
- anything in the brief that turned out wrong (with the fix you made or propose).
