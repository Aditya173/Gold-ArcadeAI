# Hackathon day: switching from the mock Arcade to the real one

Until the hackathon, everything here runs against the offline mock (`arcade/mock_arcade.py`).
This page turns on the real Arcade API, step by step. Run the steps in order, from the repo
root. The examples use bash; in PowerShell, write `$env:NAME = "value"` instead of
`export NAME=value`.

## Before spending anything: two questions for Arcade

The creator storefront (idea 1) only pays a creator if the money works. Arcade's public terms
(§10) give a seller **any markup above Arcade's generated price, plus 5% of that price**. Without
a markup, that is about $5 on a $100 piece ([research/C4](research/C4_creator_merch.md)). Ask
Arcade first:

1. **Can a seller add a markup** on top of the generated price at checkout, and is the markup paid
   out to the seller in full?
2. **What is the creator / Entrepreneur commission rate**, and who qualifies? The terms say 7.5%
   for approved Entrepreneurs (25k+ TikTok or Instagram followers). Confirm it still applies.

Write the answers into `ideas/1-creator-storefront/`. If both answers are no, idea 1 becomes "a
capsule for the brand", not "earn from a capsule", and it moves down the order in step 5.

## Ground rules

- **The key never goes in argv, a commit or a log.** It goes in `.env` or in Functions secrets.
  `arcade/arcade.py` strips it from its call log, and `tools/leak_scan.py` blocks any push that
  contains one.
- **Nobody pays.** The Python client refuses `checkouts/*` and `orders/*` outright. The app goes as
  far as a `checkoutUrl` and stops. Paying places a real order, so a human does that in Arcade
  Studio, if at all.
- **A design costs Arcade credits.** Read the credit price off Studio, then choose the day's design
  cap (`CAP` below) before step 5.

## 0. Check that the offline mock still passes (no network)

```bash
unset ARCADE_LIVE
python gold_sdk/gold_sdk.py --selftest
python planner/planner.py --selftest
python arcade/arcade.py --selftest        # includes "live refused without ARCADE_LIVE"
python arcade/mock_arcade.py --selftest
```

## 1. Key and live flag

```bash
# .env at the repo root (Studio -> Settings -> API keys):
#   ARCADE_API_KEY=arcade_sk_live_...
export ARCADE_LIVE=1
```

## 2. Replace the category fixture with Arcade's real list (one call, no credits)

`arcade/categories_fixture.json` holds guessed categories, and several are marked `inferred`.
Fetch the real list from `categories/list`:

```bash
python arcade/arcade.py categories --save   # -> arcade/categories_live.json
```

From now on the mock uses `categories_live.json` in place of the fixture, so mock runs match the
real catalogue. Next, check how the planner's categories map onto the real ones (this spends
nothing):

```bash
python arcade/run_designs.py --list --briefs <briefs file>
```

A category that maps to `None` is logged as `stage: category` and never sent. If the real names
differ from the guesses, edit `WANT` in `arcade/run_designs.py`.

## 3. Install the protected Gold SDK

*Placeholder: the step comes with the SDK.* Drop the protected SDK into `gold_sdk/`, following the
instructions it ships with. It replaces the stub behind the same `read(photos)` call and returns
the same `gold.reading.v0` contract ([gold_sdk/README.md](gold_sdk/README.md)). Then check it:

```bash
python gold_sdk/gold_sdk.py --selftest
```

Until it is installed, the planner runs on the invented fixtures (`--fixture creator_maya`).

## 4. Dry-run each idea against the mock

For each idea, make the reading and the plan, then send the briefs to the mock first. Each idea's
folder README names its photo set and subject.

```bash
python planner/planner.py --fixture <subject> --plan                  # -> out/briefs_<subject>.json
python arcade/run_designs.py --mock --briefs briefs_<subject>.json    # writes designs_mock.jsonl only
```

Mock runs write `designs_mock.jsonl` and `calls_mock.jsonl`, so they never mark a live brief as
done. A live run sends the same request bodies the mock accepted.

## 5. Live designs, one idea at a time, under the day's cap

`--cap N` counts **every** record in `out/designs.jsonl`, across all briefs files. So N is the
total for the day, not per idea: set it once and raise it only on purpose. Re-running is safe. Each
`requestId` is a hash of its brief, so a brief that already ran is skipped, and an interrupted call
resends the same idempotency key. The run stops at the first 401/402/403 or any credit or billing
error.

```bash
CAP=12   # chosen on the day, from the credit price
python arcade/run_designs.py --briefs briefs_<subject>.json --cap $CAP
```

Run the ideas in this default order, reordering on the day as the blockers clear:

| Order | Idea | Why here |
|---|---|---|
| 1 | 1 creator storefront | The seed. Run it first only if Arcade's answers keep the money working; otherwise move it down |
| 2 | 4 trip capsule | Its piece (a print from a photo the owner picks) needs nothing outside the repo |
| 3 | 3 couple keepsakes | One-payer pendant pair; the two-partner reading waits on two consenting partners |
| 4 | 5 host room line | "One room photo in, one pillow out" |
| 5 | 6 club merch drop | Needs a real club album to mean anything |
| 6 | 2 café house goods | The owner line needs a real café; the diner line can run on anyone's food photos |

## 6. Re-render the stores with real images and prices

`run_designs.py` downloads each product's images to `out/designs/`, because the image URLs
expire. It also writes the real prices into `out/designs.jsonl`. Re-run each idea's render step
(named in its folder README), plus `python planner/planner.py --fixture <subject>` for the
planner's own pages. A real price has no `"mock": true`, so any page still showing a mock price is
a bug.

## 7. The app

The app's Functions call `POST ${ARCADE_BASE_URL}/<procedure>`, reading the key from Functions
config only. The base URL is the one value that changes.

```bash
# emulator, against the mock:
python arcade/mock_arcade.py --serve 8787
#   functions/.env.local:  ARCADE_BASE_URL=http://127.0.0.1:8787/v1   ARCADE_API_KEY=arcade_sk_live_MOCK

# live:
firebase functions:secrets:set ARCADE_API_KEY      # paste the key at the prompt
#   functions/.env:  ARCADE_BASE_URL=https://platform.arcade.ai/v1
firebase deploy --only functions
```

Take **one** store end to end: onboarding → design (`patterns/create`, then `jobs/get` polled,
then `products/get`) → review → publish → Buy. Buy calls `checkouts/create`, which returns a
`checkoutUrl`. **Stop at the `checkoutUrl`.** Open it to check that it loads, and do not pay.

## What the mock does not prove

- Admission (Arcade's check that a prompt fits its category) only fails in the mock when a fault
  is injected. The real check may reject briefs the mock accepts.
- Mock prices come from a made-up model. They say nothing about real prices.
- The mock returns schema errors as 400 with `fieldErrors`. The live API may use 422.
- The mock's `categories/get` options are invented.
