"""cafe_line.py -- idea 2 (option A): a cafe owner's shoot of their own room -> a printed room set
(entrance rug, wall print, banquette pillow, decorative plate) bought once by the owner, with the print
and plate also offered on a guest shelf.

  read      gold_sdk.read(shoot, fixture="cafe_owner_lark")   (an invented owner until the SDK lands)
  venue     the reading must be ONE food place: its top place type is a food place in >= 60% of the
            moments. A roll of many restaurants is a diner, not a venue (that is fork-1/diner_line.py)
  plan      recorded plan or one planner call; planner.check plus room rules: printed rug (never
            tufted / woven / wool), plate for display only, no staff jewelry
  arcade    every body through mock_arcade.mock_transport (never live); mock prices
  pages     out/2-cafe-house-goods/owner.html (owner only) and public.html (the shelf: photo-free, no counts)

The plumbing (reliability gate, plan check, mock run, page writer) is shared with idea 1:
../1-creator-storefront/creator_store.py.

  python ideas/2-cafe-house-goods/cafe_line.py --demo
  python ideas/2-cafe-house-goods/cafe_line.py --selftest
"""
from __future__ import annotations
import json, sys, tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "1-creator-storefront"))
import creator_store as cs  # noqa: E402

FIXTURE = "cafe_owner_lark"
CATS = ["rug", "wall art print", "throw pillow", "ceramic"]
FOOD = {"cafe", "restaurant", "bar", "bakery", "food truck"}
VENUE_SHARE = 0.6
ADDENDUM = ("This is a room set for one independent cafe, bought by its owner. Motifs come from the room's "
            "materials, geometry and colour, never from a logo, the venue's name, text, people or the menu. "
            "The rug is printed, low pile, for commercial foot traffic; never tufted, hand-knotted, woven or "
            "wool. The plate is decorative, for display, not for food service. Tag each piece "
            "\"for\": \"room\" or \"room+shelf\".")
SHELF_WHY = "Made for the room first; offered on the shelf."


def venue(r: dict) -> dict:
    """The owner's photos must show one food place, not many. Uses `places` only if measured."""
    if not cs.trusted(r, "places") or not r["places"]:
        raise SystemExit("venue check: the SDK reports places as unmeasured, so no venue can be confirmed")
    top = max(r["places"], key=lambda p: p["share_of_events"])
    if top["type"] not in FOOD or top["share_of_events"] < VENUE_SHARE:
        raise SystemExit(f"not one venue (top place {top['type']} in {top['share_of_events']:.0%} of moments): "
                         "this reads a diner; use fork-1/diner_line.py")
    return top


def rules(plan: dict) -> list[str]:
    errs = cs.print_rules(plan)
    if any(p["category"] in cs.planner.JEWELRY for p in plan["products"]):
        errs.append("no staff jewelry: dropped (dangling pieces are discouraged in food service)")
    errs += [f"{p['category']}: tag it for room or room+shelf" for p in plan["products"] if p.get("for") not in ("room", "room+shelf")]
    return errs


def run(out: Path, fixture: str = FIXTURE, transport=cs.mock_transport) -> dict:
    r = cs.gold_sdk.read([], fixture=fixture)       # photos: the owner's 15-30 shots of the room
    top = venue(r)
    plan, src = cs.get_plan(cs.planner_view(r), CATS, HERE / "plan_recorded.json", ADDENDUM, rules, "cafe_line")
    recs = cs.make(plan, transport)
    shelf = cs.neutral(plan, SHELF_WHY, keep=lambda p: p["for"] == "room+shelf")
    notes = [f"Venue check: {top['type']} in {top['share_of_events']:.0%} of the shoot's moments.",
             "Room pieces: " + ", ".join(p["title"] for p in plan["products"]) + ". Shelf: "
             + ", ".join(p["title"] for p in shelf["products"]) + ".",
             cs.RUG_NOTE, "No set total is quoted: the rug has no Arcade price for a printed rug yet.",
             "The plate is decorative until a maker confirms a food-safe glaze."]
    cs.write(out, r, plan, recs, src, notes, shelf)
    print(f"{plan['store']['name']}: {sum(x['ok'] for x in recs)}/{len(recs)} pieces on the mock, {src}, "
          f"{len(shelf['products'])} on the shelf -> {out}")
    return {"reading": r, "plan": plan, "recs": recs, "shelf": shelf}


def selftest() -> None:
    n = 0

    def ok(c, what):
        nonlocal n
        assert c, what
        n += 1

    tmp = Path(tempfile.mkdtemp())
    res = run(tmp)
    ok(all(x["ok"] for x in res["recs"]) and len(res["recs"]) == 4, "4 of 4 bodies valid on the mock")
    ok(all("printed" in p["prompt"].lower() for p in res["plan"]["products"] if p["category"] == "rug"), "the rug is printed")
    ok({p["for"] for p in res["shelf"]["products"]} == {"room+shelf"}, "shelf page carries shelf pieces only")
    ok(not cs.public_clean((tmp / "public.html").read_text(encoding="utf-8"), res["reading"]), "shelf page is photo- and count-free")
    diner = cs.gold_sdk.read([], fixture="diner_theo")
    try:
        venue(diner)
        ok(False, "a diner's roll must not pass as a venue")
    except SystemExit as e:
        ok("diner" in str(e), "a diner's roll is sent to the diner line")
    bad = json.loads(json.dumps(res["plan"]))
    bad["products"][0]["prompt"] = "Hand-tufted wool entrance rug, 3x5 ft, terracotta hexagons."
    ok(any("tufted" in e or "printed" in e for e in rules(bad)), "a tufted rug is refused")
    bad["products"][3]["prompt"] = "Ceramic dinner plate, 10 in, terracotta rim."
    ok(any("display" in e for e in rules(bad)), "a service plate is refused")
    bad["products"].append({"category": "pendant necklace", "for": "room", "prompt": "staff pendant"})
    ok(any("staff jewelry" in e for e in rules(bad)), "staff jewelry is refused")
    print(f"cafe_line selftest: {n} checks PASS")


if __name__ == "__main__":
    selftest() if "--selftest" in sys.argv else run(cs.planner.OUT / HERE.name)
