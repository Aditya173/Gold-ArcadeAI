"""run_designs.py -- briefs.json -> Arcade designs, products, prices.

Reads out/briefs.json (planner/), maps each brief's category onto
a live Arcade category, runs `Arcade.design`, downloads the product images (URLs are
short-lived), and appends one record per brief to out/designs.jsonl.

  CAP = 24 designs (brief §6). Resumable: a brief whose requestId is already in designs.jsonl is
  skipped, and the requestId is deterministic per brief, so an interrupted run re-sends the SAME
  idempotency key and Arcade replays instead of re-spending.
  Stops at the first 401/402/403 or any error mentioning credits/billing (brief §5).
  Never creates a checkout.

  python tools/arcade/run_designs.py --list     # show the category mapping, spend nothing
  python tools/arcade/run_designs.py            # run (needs ARCADE_API_KEY)
  python tools/arcade/run_designs.py --briefs storefront_briefs.json   # the storefront's 6 pieces
  python tools/arcade/run_designs.py --mock --briefs <file>   # mock Arcade (mock_arcade.py + the
        category fixture): no network, no key; writes designs_mock.jsonl / calls_mock.jsonl only,
        so a mock run can never make the live run skip a brief. Without --mock the live
        transport is still refused unless ARCADE_LIVE=1.
  --cap N   design cap for this run (default 24; Adi sets it on hackathon day)
"""
from __future__ import annotations
import hashlib, json, sys, urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from arcade import Arcade, ArcadeError, UA, _strip_queries  # noqa: E402

REPO = HERE.parents[1]
from arcade import ARCADE_OUT as OUT  # noqa: E402
CAP = 24
# brief category -> (world, words the live category name must contain). ponytail: name match;
# switch to an explicit id map once Adi has looked at categories/list.
WANT = {"ring": ("jewelry", ["ring"]), "ring (alternate metal)": ("jewelry", ["ring"]),
        "pendant necklace": ("jewelry", ["pendant"]), "earrings": ("jewelry", ["earring"]),
        "rug": ("print", ["rug"]), "throw pillow": ("print", ["pillow"]), "wall art print": ("print", ["print"]),
        "textile": ("print", ["textile"]), "ceramic": ("print", ["ceramic"])}


def pick(cats: list[dict], category: str) -> dict | None:
    if category not in WANT:
        return None
    world, words = WANT[category]
    cand = [c for c in cats if c["world"] == world and all(w in (c["name"] + " " + c.get("category", {}).get("name", "")).lower() for w in words)]
    # prefer the plainest: the shortest name ("Rings" over "Dainty Diamond Ring")
    return min(cand, key=lambda c: len(c["name"])) if cand else None


def rid(b: dict) -> str:
    return "gx-" + hashlib.sha256(json.dumps([b["who"], b["arm"], b["category"], b["prompt"]]).encode()).hexdigest()[:24]


def fatal(err: Exception) -> bool:
    s = str(err).lower()
    return (isinstance(err, ArcadeError) and err.status in (401, 402, 403)) or "credit" in s or "billing" in s


def main() -> int:
    mock = "--mock" in sys.argv
    cap = int(sys.argv[sys.argv.index("--cap") + 1]) if "--cap" in sys.argv else CAP
    if mock:
        from mock_arcade import mock_transport
        a = Arcade(key="arcade_sk_live_MOCK", transport=mock_transport, log=OUT / "calls_mock.jsonl", sleep=lambda s: None)
    else:
        a = Arcade()
    cats = a.categories()
    name = sys.argv[sys.argv.index("--briefs") + 1] if "--briefs" in sys.argv else "briefs.json"
    briefs = json.loads((OUT / name).read_text(encoding="utf-8"))
    mapping = {c: pick(cats, c) for c in {b["category"] for b in briefs}}
    for c, m in mapping.items():
        print(f"  {c:24} -> {m and (m['world'], m['name'], m['categoryId'])}")
    if "--list" in sys.argv:
        return 0
    log = OUT / ("designs_mock.jsonl" if mock else "designs.jsonl")
    done = {json.loads(l)["requestId"] for l in log.read_text(encoding="utf-8").splitlines() if l.strip()} if log.exists() else set()
    (OUT / "designs").mkdir(parents=True, exist_ok=True)
    n = len(done)
    for b in briefs:
        r = rid(b)
        if r in done:
            continue
        if n >= cap:
            print(f"cap {cap} reached; remaining briefs not run")
            break
        cat = mapping[b["category"]]
        if not cat:
            rec = {"requestId": r, "ok": False, "stage": "category", "reason": f"no live category for {b['category']}"}
        else:
            colors = b.get("colors") if cat["world"] == "print" else None
            try:
                rec = a.design(b["prompt"], cat["categoryId"], colors=colors, request_id=r)
            except Exception as e:  # noqa: BLE001 -- logged, and fatal ones stop the night
                rec = {"ok": False, "stage": "error", "reason": str(e)}
                if fatal(e):
                    print(f"STOP: {e}")
                    with log.open("a", encoding="utf-8") as f:
                        f.write(json.dumps({"requestId": r, **rec, "brief": b}) + "\n")
                    return 2
            rec["requestId"] = r
            for i, img in enumerate([] if mock else (rec.get("product") or {}).get("images") or []):
                p = OUT / "designs" / f"{r}_{i}.jpg"
                req = urllib.request.Request(img["url"], headers={"User-Agent": UA})
                with urllib.request.urlopen(req, timeout=60) as resp:
                    p.write_bytes(resp.read())
                img["local"] = p.name
        n += 1
        with log.open("a", encoding="utf-8") as f:
            f.write(json.dumps(_strip_queries({**rec, "brief": b})) + "\n")   # signed links carry credentials
        pr = (rec.get("product") or {}).get("unitPrice") or {}
        print(f"  [{n}/{cap}]{' MOCK' if mock else ''} {b['who']}/{b['arm']}/{b['category']}: "
              f"{'ok ' + pr.get('amount', '?') + ' ' + pr.get('currency', '') if rec['ok'] else 'FAIL ' + str(rec.get('reason'))[:120]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
