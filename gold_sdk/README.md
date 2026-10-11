# Gold SDK: the boundary

Everything in this repo builds on **one call**: give Gold a set of someone's photos, get back a
**reading**, which is what's distinctive about them. *How* Gold reads photos is not in this repo.
The protected Gold SDK will be dropped in here. Until then, `gold_sdk.read()` returns a sample
reading of an **invented** person, so everything downstream can be built and tested.

```python
from gold_sdk import read
reading = read(photos)          # photos: list of image paths the person chose (or their roll)
reading["signature"][0]         # {"idea": "hand-thrown ceramics", "share_of_events": 0.41, ...}
```

## For the demo: Gold insight packs

The demo needs no SDK service. Each user is given an uploaded **Gold insight pack**, a full
`gold.reading.v0`:
- `insights/archetype-*.json`: Gold's 8 portrait archetypes (e.g. Night-Shift Builder,
  Small-Table Host). Each carries the archetype's own words, plus example palette and shares.
- `fixtures/*.json`: invented example people for each idea.

```python
read([], fixture="archetype-small-table-host")
```

## The reading (`gold.reading.v0`)

The full schema is in `contract.schema.json`, and `fixtures/` has worked examples.

| Field | What it means | Why the product layer needs it |
|---|---|---|
| `photos.count`, `photos.events` | How many photos, and how many distinct moments (days or outings) they come from | Shares are reported per moment, so 40 shots of one dinner count once |
| `signature[]` | The ideas that set this person's photos apart from other people's, strongest first. Each has `idea` (plain words), `share_of_events` (the share of their moments it shows up in), `strength` (0–1), `evidence` (photo refs) and `synonyms` | The "why we chose this" behind every piece. It must be quoted exactly |
| `palette[]` | Colours with `name`, `hex`, `share`, and a `source` (where they live / where they go / what they save) | Arcade print products take exact hex colours |
| `places[]` | Kinds of place (café, park, studio …) with their share of moments | Motifs and settings |
| `named_places[]` | **Opt-in only.** Cities or areas, with moment counts | Trip and couple ideas |
| `trips[]` | Runs of moments away from home: `place`, `start`, `end`, `events` | The trip-capsule idea |
| `people[]` | **Opt-in only.** Recurring people as anonymous refs (`person-1` …) with the moments they appear in. Never names or faces | The couple and club ideas |
| `reliability` | Per field, how much to trust it: `"measured"` with a number, or `"unmeasured"` | The planner may not lean on unmeasured fields, and the UI says so |

**Privacy contract.**
- `evidence` items are opaque refs the *owner's* device can resolve to thumbnails. They never
  appear on a public page.
- `people` and `named_places` are absent unless the owner opts in.
- A reading carries no raw pixels, no embeddings and no method details.

## What's protected and what's here

| Here (public) | In the protected Gold SDK |
|---|---|
| This contract, the stub, invented fixtures | How photos are read and what "distinctive" is measured against |
| The planner, Arcade client and mock, the app, the idea frameworks | Models, calibration data, and accuracy measurements behind `reliability` |
