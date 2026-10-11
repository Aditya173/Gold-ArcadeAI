"""marketplace.py -- idea 7: a creator's brand template + a fan's Gold insights -> a custom piece,
and every piece made goes onto the creator's marketplace for anyone to see and buy.

  brand kit    the creator's palette, motifs, logo/pattern assets and per-category templates, plus
               rules (fixtures/brand_*.json, schema brand.kit.v0)
  fan reading  the fan's Gold insight pack (gold_sdk.read(fixture=...)) -- what makes it THEIRS
  make_item    ONE Claude call fills a template: the brand element stays, the fan's strongest idea
               becomes the motif; checked in code (brand colours, required brand element, forbidden
               words, the why quotes a real share, jewelry takes no colours/references)
  arcade       print pieces send the brand's logo/pattern as Arcade references; jewelry is prompt-only.
               Mock transport until the hackathon (arcade.py refuses live without ARCADE_LIVE=1)
  marketplace  an append-only item list per creator (JSON file store here; the backend maps it to
               Firestore creators/{creatorId} + marketplace/{itemId}); feed() and buy()

  python marketplace/marketplace.py --demo        # 3 archetype fans x the Tide & Clay kit, offline
  python marketplace/marketplace.py --selftest
"""
from __future__ import annotations
import hashlib, json, os, re, sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
for d in ("gold_sdk", "planner", "arcade"):
    sys.path.insert(0, str(REPO / d))
from gold_sdk import read  # noqa: E402
from planner import ask  # noqa: E402

HERE = Path(__file__).resolve().parent
OUT = Path(os.environ.get("ARCADE_OUT") or REPO / "out") / "marketplace"
HEX = re.compile(r"^#[0-9a-f]{6}$")

SYSTEM = """You design ONE made-to-order piece for a fan, inside a creator's brand. The creator's
template is fixed: keep its brand element and its rules. The fan's Gold reading says what is
distinctive about them; the piece's personal motif must come from it.

Return ONLY JSON: {"title": str (2-4 words), "brief": str (<= 600 chars: the template filled in,
with {fan_motif} replaced by a concrete, makeable motif drawn from ONE of the fan's ideas, and every
other {slot} filled from its allowed values), "fan_idea": the idea name copied exactly from the
reading, "colors": [hex] (print only: at least the rule's minimum of BRAND colours copied from the
brand palette, plus at most the allowed number of fan accent colours copied from the fan palette;
[] for jewelry), "why_owner": str (1 sentence to the fan quoting the idea's share exactly as given,
e.g. "coastal walks show up in 29% of your moments"), "public_tag": str (<= 6 words, non-personal,
no numbers, e.g. "for early-morning walkers")}.
Never put the creator's name, any text, letters or a logo description in the brief: the logo and
patterns travel as reference images. Never name cities, brands or people."""


def load_kit(name: str) -> dict:
    k = json.loads((HERE / "fixtures" / f"{name}.json").read_text(encoding="utf-8"))
    validate_kit(k)
    return k


def validate_kit(k: dict) -> None:
    assert k.get("schema") == "brand.kit.v0" and k["creatorId"] and k["palette"]
    assert all(HEX.match(c["hex"]) for c in k["palette"])
    ids = {a["assetId"] for a in k["assets"]}
    for t in k["templates"]:
        assert t["world"] in ("print", "jewelry") and "{fan_motif}" in t["brief"]
        assert set(t["uses_assets"]) <= ids, f"{t['templateId']}: unknown asset"
        assert not (t["world"] == "jewelry" and t["uses_assets"]), "jewelry takes no references"


def template(k: dict, tid: str) -> dict:
    return next(t for t in k["templates"] if t["templateId"] == tid)


def fan_text(r: dict) -> str:
    L = [f"- {s['idea']}: {s['share_of_events']:.0%} of moments" for s in r["signature"]]
    return ("Fan's reading (share of their moments):\n" + "\n".join(L) +
            "\nFan palette: " + ", ".join(f"{c['name']} {c['hex']}" for c in r["palette"]))


def user_msg(k: dict, t: dict, r: dict) -> str:
    return (f"Creator: {k['name']} (voice: {k['voice']})\nBrand palette: "
            + ", ".join(f"{c['name']} {c['hex']} ({c['role']})" for c in k["palette"])
            + f"\nRules: at least {k['rules']['min_brand_colors']} brand colours; at most "
            f"{k['rules']['fan_accent_colors']} fan accent colour(s); forbidden words {k['rules']['forbidden_words']}"
            + f"\nTemplate ({t['category']}, {t['world']}): {t['brief']}\nRequired brand element (one of): "
            + f"{t['required_brand_element']}\nSlot values: {json.dumps(t['slots'])}\n\n" + fan_text(r))


def check_item(item: dict, k: dict, t: dict, r: dict) -> list[str]:
    errs = []
    brand = {c["hex"] for c in k["palette"]}
    fan = {c["hex"] for c in r["palette"]}
    brief = item.get("brief", "")
    if not 0 < len(brief) <= 1000:
        errs.append("brief length")
    if "{" in brief:
        errs.append("unfilled slot")
    low = brief.lower()
    if not any(e.lower() in low for e in t["required_brand_element"]):
        errs.append("brand element missing")
    for w in k["rules"]["forbidden_words"]:
        if re.search(rf"\b{re.escape(w)}\b", low):
            errs.append(f"forbidden word {w!r}")
    if k["name"].lower() in low:
        errs.append("creator name in the brief (the brand travels as references)")
    idea = next((s for s in r["signature"] if s["idea"] == item.get("fan_idea")), None)
    if idea is None:
        errs.append("fan_idea is not one of the fan's ideas")
    elif f"{round(idea['share_of_events'] * 100)}%" not in item.get("why_owner", ""):
        errs.append("why_owner must quote the idea's share exactly")
    cols = [c.lower() for c in item.get("colors", [])]
    if t["world"] == "jewelry":
        if cols:
            errs.append("jewelry takes no colours")
    else:
        if sum(c in brand for c in cols) < k["rules"]["min_brand_colors"]:
            errs.append("too few brand colours")
        extra = [c for c in cols if c not in brand]
        if any(c not in fan for c in extra):
            errs.append("a colour is neither brand nor fan palette")
        if len(extra) > k["rules"]["fan_accent_colors"]:
            errs.append("too many fan accent colours")
    tag = item.get("public_tag", "")
    if re.search(r"\d", tag) or len(tag.split()) > 6:
        errs.append("public_tag must be short and number-free")
    return errs


def recorded(k: dict, t: dict, r: dict) -> dict | None:
    """Offline plans for the demo (written by hand, checked like live ones)."""
    p = HERE / "fixtures" / "recorded_items.json"
    rec = json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}
    return rec.get(f"{t['templateId']}|{r['subject']}")


def make_item(k: dict, tid: str, r: dict, fan_uid: str, live_plan: bool = False) -> dict:
    t = template(k, tid)
    item = ask(SYSTEM, user_msg(k, t, r), "fan-item") if live_plan else recorded(k, t, r)
    if item is None:
        raise SystemExit(f"no recorded plan for {tid}|{r['subject']}; run with --plan and ANTHROPIC_API_KEY")
    errs = check_item(item, k, t, r)
    if errs:
        raise ValueError(f"item rejected: {errs}")
    iid = "itm-" + hashlib.sha256(f"{k['creatorId']}|{fan_uid}|{tid}|{item['brief']}".encode()).hexdigest()[:12]
    return {"itemId": iid, "creatorId": k["creatorId"], "makerUid": fan_uid, "templateId": tid,
            "category": t["category"], "world": t["world"], "title": item["title"], "brief": item["brief"],
            "colors": item.get("colors", []), "assets": t["uses_assets"], "public_tag": item["public_tag"],
            "owner_only": {"why": item["why_owner"], "fan_idea": item["fan_idea"]},
            "royalty_pct": k["rules"]["royalty_pct"], "status": "planned", "stats": {"views": 0, "buys": 0}}


def to_arcade(item: dict, a, refs: dict[str, str], cats: dict[str, str]) -> dict:
    """Send the item to Arcade (the mock until the hackathon). refs: assetId -> referenceId."""
    rec = a.design(item["brief"], cats[item["category"]],
                   colors=item["colors"] or None, request_id=item["itemId"],
                   reference_ids=[refs[x] for x in item["assets"]] or None)
    if rec["ok"]:
        pr = rec["product"]
        item.update(status="listed", productId=pr["productId"], price=pr.get("unitPrice"))
    else:
        item.update(status="not_makeable", reason=rec.get("reason"))
    return item


# ---- the marketplace store (file-backed for the demo; Firestore in the backend) --------------------
class Market:
    def __init__(self, path: Path):
        self.path = path
        self.items = json.loads(path.read_text(encoding="utf-8")) if path.exists() else []

    def add(self, item: dict) -> None:
        if not any(i["itemId"] == item["itemId"] for i in self.items):
            self.items.append(item)
            self.save()

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(self.items, indent=1), encoding="utf-8")

    def feed(self, creator_id: str, sort: str = "new", viewer: str | None = None) -> list[dict]:
        """What anyone sees: listed items only, and never the owner-only why/idea (unless it's yours)."""
        xs = [i for i in self.items if i["creatorId"] == creator_id and i["status"] == "listed"]
        if sort == "popular":
            xs = sorted(xs, key=lambda i: -i["stats"]["buys"])
        else:
            xs = list(reversed(xs))
        return [{k: v for k, v in i.items() if k != "owner_only" or i["makerUid"] == viewer} for i in xs]

    def buy_lines(self, item_id: str, quantity: int = 1) -> dict:
        """The checkouts/create body the BACKEND sends for a buyer (dropShip for single units, per the
        docs). The buyer pays at checkoutUrl; nothing here pays or calls Arcade."""
        it = next(i for i in self.items if i["itemId"] == item_id and i["status"] == "listed")
        return {"requestId": f"buy-{item_id}-{quantity}", "lines": [{"productId": it["productId"], "quantity": quantity}],
                "dropShip": quantity == 1}


def demo() -> int:
    from arcade import Arcade
    from mock_arcade import MockArcade
    mock = MockArcade(polls=1)
    a = Arcade(key="arcade_sk_live_MOCK", transport=mock, log=None, sleep=lambda s: None)
    k = load_kit("brand_tide_and_clay")
    cats = {c["name"].lower(): c["categoryId"] for c in a.categories()}
    cmap = {"wall art print": next(v for n, v in cats.items() if "print" in n),
            "throw pillow": next(v for n, v in cats.items() if "pillow" in n),
            "pendant necklace": next(v for n, v in cats.items() if "pendant" in n)}
    refs = {x["assetId"]: a.reference(x["mediaType"], x["byteLength"], f"{k['creatorId']}-{x['assetId']}")
            for x in k["assets"]}
    m = Market(OUT / f"{k['creatorId']}.json")
    fans = [("fan-1", "archetype-first-light-solitary", "tc-print"),
            ("fan-2", "archetype-small-table-host", "tc-pillow"),
            ("fan-3", "archetype-night-shift-builder", "tc-pendant")]
    live = "--plan" in sys.argv and bool(os.environ.get("ANTHROPIC_API_KEY"))
    for uid, pack, tid in fans:
        it = to_arcade(make_item(k, tid, read([], fixture=pack), uid, live_plan=live), a, refs, cmap)
        m.add(it)
        print(f"  {uid} ({pack}) -> {it['category']}: {it['title']} [{it['status']}"
              f"{', mock ' + it['price']['amount'] + ' ' + it['price']['currency'] if it.get('price') else ''}]")
    feed = m.feed(k["creatorId"])
    print(f"marketplace {k['name']}: {len(feed)} listed; public view hides owner-only why: "
          f"{all('owner_only' not in i for i in feed)}")
    print("buy body:", json.dumps(m.buy_lines(feed[0]["itemId"])))
    return 0


def selftest() -> None:
    k = load_kit("brand_tide_and_clay")
    r = read([], fixture="archetype-first-light-solitary")
    t = template(k, "tc-print")
    idea = r["signature"][0]
    share = f"{round(idea['share_of_events'] * 100)}%"
    good = {"title": "Ridge Rings", "brief": f"A 12x16 in wall print: thrown-ring stripes framing {idea['idea']}. Flat colour, no faces.",
            "fan_idea": idea["idea"], "colors": ["#b8714a", "#9fb8ad"], "why_owner": f"It shows up in {share} of your moments.",
            "public_tag": "for early risers"}
    assert check_item(good, k, t, r) == [], check_item(good, k, t, r)
    for bad, why in ((dict(good, colors=["#b8714a"]), "too few brand colours"),
                     (dict(good, brief=good["brief"].replace("thrown-ring stripes", "stripes")), "brand element missing"),
                     (dict(good, brief=good["brief"] + " Add the Tide & Clay logo."), "forbidden word"),
                     (dict(good, why_owner="It shows up in 99% of your moments."), "quote the idea's share"),
                     (dict(good, colors=["#b8714a", "#9fb8ad", "#ff0000"]), "neither brand nor fan")):
        assert any(why in e for e in check_item(bad, k, t, r)), (why, check_item(bad, k, t, r))
    tj = template(k, "tc-pendant")
    gj = dict(good, brief=f"A sterling silver pendant in the shape of the wave-and-wheel mark, a small engraved {idea['idea']} on the back. No stones.", colors=[])
    assert check_item(gj, k, tj, r) == [] and check_item(dict(gj, colors=["#b8714a", "#9fb8ad"]), k, tj, r)
    import tempfile
    m = Market(Path(tempfile.mkdtemp()) / "m.json")
    it = {"itemId": "i1", "creatorId": "c", "makerUid": "u1", "status": "listed", "productId": "p1",
          "stats": {"buys": 0}, "owner_only": {"why": "secret"}}
    m.add(it); m.add(it)
    assert len(m.items) == 1, "add is idempotent"
    assert "owner_only" not in m.feed("c")[0] and "owner_only" in m.feed("c", viewer="u1")[0]
    assert m.buy_lines("i1") == {"requestId": "buy-i1-1", "lines": [{"productId": "p1", "quantity": 1}], "dropShip": True}
    print("marketplace selftest: 10 checks PASS")


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        selftest()
    else:
        sys.exit(demo())
