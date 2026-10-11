# Gold × Arcade

A hackathon project: turn the photos someone chooses into a small collection of made-to-order
pieces on [Arcade](https://arcade.ai) — jewelry, rugs, pillows, prints — with a reason behind
every piece.

## Start here

| Doc | For |
|---|---|
| [Run it yourself](#run-it-yourself) | **A reviewer starts here.** The app in the iOS Simulator against a local backend; no accounts or API keys |
| [`BRIEF_MARKETPLACE.md`](BRIEF_MARKETPLACE.md) | **Today's build.** Part 1: every screen and the demo video (for the UI teammate). Part 2: the backend, endpoints, Arcade style and product creation, Instagram via Meta, and the build plan |
| [`MAC_BUILD_PROMPT.md`](MAC_BUILD_PROMPT.md) | One paste-in prompt that builds, compiles and runs the whole app on a Mac |
| [`WIRING.md`](WIRING.md) | **Where everything plugs in** for the local simulation: run commands, the synthetic archetype, fake products |
| [`backend/API.md`](backend/API.md) | The API the app calls |
| [`HACKATHON_DAY.md`](HACKATHON_DAY.md) | Switching from the mock to live Arcade |

## Run it yourself

Everything runs on your Mac: a mock Arcade, the Firebase emulators, and the app in Expo Go on the iOS Simulator.
No accounts or API keys; internet is only needed to install and for the first start (emulator and Expo Go downloads).
**Nothing is live:** the Arcade is a mock, Instagram is faked, and no payment is ever taken.

**You need** (macOS with [Homebrew](https://brew.sh)):

- Xcode with an iOS Simulator (Mac App Store; open Xcode once so it installs a Simulator)
- Node 22+ (`brew install node`; Expo's bundler needs at least 20.19)
- Java 21+, which firebase-tools requires (`brew install openjdk@21`, then
  `export PATH="$(brew --prefix openjdk@21)/bin:$PATH"`; add that line to `~/.zshrc` so every terminal has it)
- Python 3.11+ (`brew install python@3.12`; macOS's own `python3` is 3.9 and too old)
- firebase-tools (`npm i -g firebase-tools`)

**1. Install** (once):

```bash
git clone https://github.com/Aditya173/Gold-ArcadeAI && cd Gold-ArcadeAI
```

```bash
python3.12 -m venv venv && venv/bin/pip install -r requirements.txt
```

```bash
(cd backend && npm install) && (cd backend/functions && npm install) && (cd app && npm install)
```

**2. Configure the backend** (once). The example already points at the mock Arcade and sets `INSTAGRAM_FAKE=1`;
no keys needed:

```bash
cp backend/functions/env.local.example backend/functions/.env.local
```

**3. Start it**: open four terminal tabs, each in the `Gold-ArcadeAI` folder, and leave 1, 2 and 4 running:

Terminal 1, the mock Arcade:

```bash
venv/bin/python arcade/mock_arcade.py --serve 8787
```

Terminal 2, the Firebase emulators. Wait for "All emulators ready" (the first start downloads the emulators; the
warning *Your requested "node" version "20" doesn't match your global version* is fine):

```bash
cd backend && npm run emulators
```

Terminal 3, the demo data, once 1 and 2 are up (it prints `[seed] ... listed` and exits; rerun it after every
emulator restart, the emulators keep nothing):

```bash
cd backend && npm run seed
```

Terminal 4, the app. It boots the Simulator and opens the app in Expo Go (the first time, answer `y` to install
Expo Go):

```bash
cd app && npx expo start --ios
```

**4. Try it** (2 minutes):

- **Creator:** *I'm a creator* → *Let's go* → pick any demo profile → *Analyze my Brand* →
  *Use demo brand (Wishbone Kitchen)* → "You're live!".
- **Fan:** *Sign out / switch role* (bottom bar) → *I'm a fan* → *Let's go* → pick *Long-Table Host* →
  *Start Shopping* → *Design with Wishbone Kitchen* → four pieces → open one to see *Why we chose this* →
  *Buy now* → *Continue to payment* → "Demo checkout created, no payment taken".

**Simulator only.** A real iPhone with Expo Go can't reach the backend: the emulators and the mock listen on
`127.0.0.1` on purpose (the Auth emulator accepts unsigned sign-ins, so it shouldn't be open to your network).

**If something goes wrong:**

- *"Unable to locate a Java Runtime"* or *"no longer supports Java version before 21"* in terminal 2: run the
  `export PATH=...` line from the prerequisites in that terminal, check `java -version` says 21+, and start again.
- *Port already in use* (8787, 5001, 8080, 9099, 9199, 4400, 8081): something else holds it; `lsof -i :5001` shows what.
  Stop it, or Ctrl-C an old run of this project.
- *"Timeout after 10000"* while the Functions emulator loads: `cd backend && FUNCTIONS_DISCOVERY_TIMEOUT=60 npm run emulators`.
- *Expo Go says the project needs a different SDK*: let `npx expo start --ios` install the Expo Go it offers (this
  app uses Expo SDK 57), or delete Expo Go from the Simulator and run it again.
- *The seed or the app shows network errors*: terminals 1 and 2 must both be up before you seed; then rerun the seed.

More detail: [`WIRING.md`](WIRING.md) (every route and where it plugs in) and [`backend/README.md`](backend/README.md)
(tests).

## How it works

```
photos ──► Gold SDK ──► reading ──► planner ──► Arcade briefs ──► Arcade (mock until the hackathon)
           (protected)  what sets     a store +    schema-checked     designs, prices, checkout
                        them apart    "why" lines  request bodies
```

| Folder | What |
|---|---|
| `gold_sdk/` | The only boundary to Gold: the reading contract, **Gold insight packs** (8 archetypes) and invented example people. The demo plugs one pack into each user |
| `planner/` | Reading → store + pieces. Its rules are enforced in code: colours only from the palette, every "why" quotes a real share |
| `arcade/` | Arcade client, a mock built from Arcade's published OpenAPI spec, and the design runner. **Live calls are off** unless `ARCADE_LIVE=1` |
| `marketplace/` | **Idea 7**: a creator's brand template + a fan's Gold insights → a custom piece listed on the creator's marketplace |
| `backend/` | The API the app's UI is built against (Firebase Functions + Firestore) |
| `ideas/` | Six group → product ideas, researched and framed end to end (idea 7 is `marketplace/`) |
| `research/` | Background research on taste, brand reading and creator merch |

Selftests (after step 1 of [Run it yourself](#run-it-yourself)):

```bash
venv/bin/python gold_sdk/gold_sdk.py --selftest && venv/bin/python planner/planner.py --selftest && venv/bin/python arcade/mock_arcade.py --selftest
```

Every push goes through `tools/leak_scan.py` (a pre-push hook).
