"""owner_object.py -- idea 1, fork 1: the same engine, but the reading is the owner's own camera roll
and the pieces are for the owner (or a gift list), never sold to an audience.

What changes from ../creator_store.py (imported, not modified):
  read      gold_sdk.read(roll, fixture="creator_maya")  -- the roll, where the SDK reports the
            signature as measured, so the whys may quote it
  rules     no audience or selling words, no liking words ("the photos show", never "you love")
  money     no seller commission: the owner pays the maker's price, so no money gate
  pages     owner.html (private: whys + evidence refs) and gift.html (no why, no count, no place)

  python ideas/1-creator-storefront/fork-1/owner_object.py --demo
  python ideas/1-creator-storefront/fork-1/owner_object.py --selftest
"""
from __future__ import annotations
import json, re, sys, tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import creator_store as cs  # noqa: E402

FIXTURE = "creator_maya"
CATS = ["ring", "pendant necklace", "rug", "wall art print", "throw pillow"]
NOT_OWNER = re.compile(r"\b(fans?|followers?|audience|merch|sell|selling|brand|loves?|likes?|favou?rite)\b", re.I)
ADDENDUM = ("These pieces are for the owner themself, or a gift list a friend can buy from. Never mention "
            "an audience, selling or a brand. Say what the photos show, never what the owner likes. "
            "Print pieces must say 'printed'; never tufted, hand-knotted, woven or wool.")
GIFT_WHY = "On the owner's wish list."


def rules(plan: dict) -> list[str]:
    errs = cs.print_rules(plan)
    errs += [f"{p['category']}: '{NOT_OWNER.search(p['why']).group(0)}' is not owner language"
             for p in plan["products"] if NOT_OWNER.search(p["why"])]
    if not any(p["signature"] for p in plan["products"]):
        errs.append("the roll's signature is measured: at least one piece must rest on it")
    return errs


def run(out: Path, fixture: str = FIXTURE, transport=cs.mock_transport) -> dict:
    r = cs.gold_sdk.read([], fixture=fixture)       # photos: the owner's whole roll; the stub ignores them
    view = cs.planner_view(r)
    plan, src = cs.get_plan(view, CATS, HERE / "plan_recorded.json", ADDENDUM, rules, "owner_object")
    recs = cs.make(plan, transport)
    gift = cs.neutral(plan, GIFT_WHY)
    gift["store"] = dict(gift["store"], about="A wish list of made-to-order pieces. Pick one as a gift.")
    cs.write(out, r, plan, recs, src, ["No seller commission: the owner pays the maker's price at checkout.",
                                       cs.RUG_NOTE], gift)
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
    ok(cs.trusted(res["reading"], "signature"), "the roll's signature is measured")
    ok(all(x["ok"] for x in res["recs"]) and len(res["recs"]) == 5, "5 of 5 bodies valid on the mock")
    gift = (tmp / "gift.html").read_text(encoding="utf-8")
    ok(not cs.public_clean(gift, res["reading"]) and "moments" not in gift, "gift page: no why, no count, no ref")
    ok(not (tmp / "public.html").exists(), "no public store in this fork")
    ok("ev-001" in (tmp / "owner.html").read_text(encoding="utf-8"), "owner page carries evidence refs (device only)")
    bad = json.loads(json.dumps(res["plan"]))
    bad["products"][0]["why"] = "Your fans love ceramics: 41% of your moments."
    ok(any("owner language" in e for e in rules(bad)), "audience / liking words refused")
    for p in bad["products"]:
        p["signature"] = []
    ok(any("rest on it" in e for e in rules(bad)), "a measured signature must be used")
    print(f"owner_object selftest: {n} checks PASS")


if __name__ == "__main__":
    selftest() if "--selftest" in sys.argv else run(cs.planner.OUT / "1-creator-storefront" / "fork-1")
