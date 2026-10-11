"""diner_line.py -- idea 2, fork 1 (option B): the diner, not the cafe. A person's own food photos ->
a printed tea towel, print, pillow and display plate, for themself or as a gift.

What changes from ../cafe_line.py:
  read      gold_sdk.read(food_photos, fixture="diner_theo")
  diner     food places cover >= 50% of the moments, spread over many places (no single venue)
  rules     tea towel printed (a loom-woven towel is not a printed product); plate why says "display
            plate"; each piece tagged self / gift / self+gift
  pages     owner.html (private) and gift.html: no counts, no places, no photos

  python ideas/2-cafe-house-goods/fork-1/diner_line.py --demo
  python ideas/2-cafe-house-goods/fork-1/diner_line.py --selftest
"""
from __future__ import annotations
import json, sys, tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import cafe_line  # noqa: E402
cs = cafe_line.cs

FIXTURE = "diner_theo"
CATS = ["textile", "wall art print", "throw pillow", "ceramic"]
FOOD_SHARE = 0.5
ADDENDUM = ("These pieces are for a person whose photos are full of meals, for themself or as a gift. "
            "Never name a restaurant, a city or a person. The textile is a printed cotton tea towel, never "
            "woven or loom-made. The plate is decorative; its why says 'display plate'. Tag each piece "
            "\"for\": \"self\", \"gift\" or \"self+gift\".")
GIFT_WHY = "From the tables they keep coming back to."


def diner(r: dict) -> float:
    if not cs.trusted(r, "places"):
        raise SystemExit("diner check: places unmeasured")
    food = sum(p["share_of_events"] for p in r["places"] if p["type"] in cafe_line.FOOD | {"market"})
    if food < FOOD_SHARE:
        raise SystemExit(f"food places cover {food:.0%} of moments: not a diner's roll")
    return food


def rules(plan: dict) -> list[str]:
    errs = cs.print_rules(plan)
    errs += [f"{p['category']}: tag it self, gift or self+gift" for p in plan["products"] if p.get("for") not in ("self", "gift", "self+gift")]
    errs += ["ceramic: why must say 'display plate'" for p in plan["products"] if p["category"] == "ceramic" and "display plate" not in p["why"]]
    errs += ["textile: must be a printed tea towel" for p in plan["products"] if p["category"] == "textile" and "tea towel" not in p["prompt"].lower()]
    return errs


def run(out: Path, fixture: str = FIXTURE, transport=cs.mock_transport) -> dict:
    r = cs.gold_sdk.read([], fixture=fixture)       # photos: the person's own food photos
    food = diner(r)
    plan, src = cs.get_plan(cs.planner_view(r), CATS, HERE / "plan_recorded.json", ADDENDUM, rules, "diner_line")
    recs = cs.make(plan, transport)
    gift = cs.neutral(plan, GIFT_WHY)
    gift["store"] = dict(gift["store"], about="Made-to-order pieces for someone who eats well. Pick one as a gift.")
    notes = [f"Food places cover {food:.0%} of the moments, across many places: a diner's line, not a venue's.",
             f"Palette: {r['reliability']['palette'].get('note', 'see reliability')}.",
             "Price check: custom tea towels sell for about $15-23; this line has to be worth more than that."]
    cs.write(out, r, plan, recs, src, notes, gift)
    (out / "public.html").replace(out / "gift.html")
    print(f"{plan['store']['name']}: {sum(x['ok'] for x in recs)}/{len(recs)} pieces on the mock, {src} -> {out}")
    return {"reading": r, "plan": plan, "recs": recs}


def selftest() -> None:
    n = 0

    def ok(c, what):
        nonlocal n
        assert c, what
        n += 1

    tmp = Path(tempfile.mkdtemp())
    res = run(tmp)
    ok(all(x["ok"] for x in res["recs"]) and len(res["recs"]) == 4, "4 of 4 bodies valid on the mock")
    ok(not cs.public_clean((tmp / "gift.html").read_text(encoding="utf-8"), res["reading"]), "gift page: no counts, refs or photos")
    try:
        diner(cs.gold_sdk.read([], fixture="creator_maya"))
        ok(False, "a roll that is not mostly food must be refused")
    except SystemExit:
        ok(True, "non-food roll refused")
    bad = json.loads(json.dumps(res["plan"]))
    bad["products"][0]["prompt"] = "Loom-woven cotton tea towel with pasta shapes."
    ok(any("loom" in e.lower() for e in rules(bad)), "a loom-woven towel is refused")
    bad["products"][3]["why"] = "Street tacos are in 22% of your moments."
    ok(any("display plate" in e for e in rules(bad)), "plate why must say display plate")
    print(f"diner_line selftest: {n} checks PASS")


if __name__ == "__main__":
    selftest() if "--selftest" in sys.argv else run(cs.planner.OUT / "2-cafe-house-goods" / "fork-1")
