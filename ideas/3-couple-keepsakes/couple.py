"""couple.py -- idea 3: a couple's two camera rolls (both opted in) -> keepsakes for the couple: a matching
pendant pair one partner buys for the other, plus a rug, a print and a pillow for a link-only registry.

  read      gold_sdk.read(both_rolls, fixture="couple_june_and_ola")  (an invented couple until the SDK lands)
  consent   both partners opted in: `people` is present, measured, and has two recurring refs. With one
            roll (no people field) the run stops here: no one-partner guessing
  plan      recorded plan or one planner call; planner.check plus couple rules: no rings, no city or trip
            name in any prompt or why, no "where you met"
  pair      the pendant is ONE design ordered as quantity 2: products/get (quantity 2) and the buyer's
            checkouts/create body are validated on the mock. Gold never sends a checkout; a human pays
  pages     out/3-couple-keepsakes/owner.html (the couple only: trips, evidence refs) and
            public.html (the link-only guest page: no photos, places, dates or counts)

The plumbing (reliability gate, plan check, mock run, page writer) is shared with idea 1:
../1-creator-storefront/creator_store.py.

  python ideas/3-couple-keepsakes/couple.py --demo
  python ideas/3-couple-keepsakes/couple.py --selftest
"""
from __future__ import annotations
import json, re, sys, tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "1-creator-storefront"))
import creator_store as cs  # noqa: E402

FIXTURE = "couple_june_and_ola"
CATS = ["pendant necklace", "rug", "wall art print", "throw pillow"]
KEY = "arcade_sk_live_MOCK"
NEVER = re.compile(r"where you met|engage|first date|\bex\b", re.I)
ADDENDUM = ("These are keepsakes for a couple, read from both partners' rolls. The pendant is one design the "
            "buyer orders as a matching pair. Never name a city, a trip or a venue; never claim where they met. "
            "No rings. Print pieces must say 'printed'; never tufted, hand-knotted, woven or wool.")
GUEST_WHY = "Picked by Gold from the couple's photos together."


def couple(r: dict) -> list[str]:
    """Both partners' consent shows up as the opt-in `people` field. No field, no couple."""
    people = sorted(r.get("people", []), key=lambda p: -p["events"])
    if len(people) < 2 or not cs.trusted(r, "people"):
        raise SystemExit("consent gate: both partners must opt in (the reading has no measured `people` pair)")
    return [p["ref"] for p in people[:2]]


def rules(plan: dict, r: dict) -> list[str]:
    errs = cs.print_rules(plan)
    names = [n["label"].lower() for n in r.get("named_places", [])] + [t["place"].lower() for t in r.get("trips", [])]
    for p in plan["products"]:
        text = (p["prompt"] + " " + p["why"]).lower()
        if p["category"] == "ring":
            errs.append("no rings: sizing and the stakes of a band make it a poor first product")
        errs += [f"{p['category']}: names '{n}'" for n in names if n in text]
        if NEVER.search(text):
            errs.append(f"{p['category']}: '{NEVER.search(text).group(0)}' is a claim only the couple can make")
    return errs


def order_pair(recs: list[dict], transport) -> dict:
    """The pair: one pendant product, quantity 2. Validated on the mock; the buyer pays at checkoutUrl."""
    pend = next(x for x in recs if x["category"] == "pendant necklace" and x["ok"])
    a = cs.Arcade(key=KEY, transport=transport, log=None, sleep=lambda s: None)
    quote = a.call("products/get", {"productId": pend["productId"], "quantity": 2})
    body = {"requestId": f"pair-{pend['productId']}", "lines": [{"productId": pend["productId"], "quantity": 2}]}
    status, resp, _ = transport("checkouts/create", body, KEY)   # mock only: the client refuses checkouts
    assert status == 200, resp
    unit = float(quote["unitPrice"]["amount"])
    return {"unit": unit, "pair": round(2 * unit, 2), "bodies": [{"products/get": {"productId": pend["productId"], "quantity": 2}},
                                                                 {"checkouts/create": body}]}


def run(out: Path, fixture: str = FIXTURE, transport=cs.mock_transport) -> dict:
    r = cs.gold_sdk.read([], fixture=fixture)       # photos: both partners' rolls, read on their own phones
    pair = couple(r)
    plan, src = cs.get_plan(cs.planner_view(r), CATS, HERE / "plan_recorded.json", ADDENDUM,
                            lambda p: rules(p, r), "couple")
    recs = cs.make(plan, transport)
    order = order_pair(recs, transport)
    together = next(p["events"] for p in r["people"] if p["ref"] == pair[1]) / r["photos"]["events"]
    trips = [f"{t['place']} ({t['start']} to {t['end']}, {t['events']} moments)" for t in r.get("trips", [])] \
        if cs.trusted(r, "named_places") else ["(named places not opted in)"]
    notes = [f"Partners {pair[0]} and {pair[1]}: the second appears in {together:.0%} of the moments.",
             "Trips (owner page only, never in a prompt or on the guest page): " + "; ".join(trips) + ".",
             f"Pendant pair: one design, quantity 2, ${order['unit']:.2f} each, ${order['pair']:.2f} the pair (mock). "
             "Is the chain included? Unverified until a real products/get.", cs.RUG_NOTE]
    cs.write(out, r, plan, recs, src, notes, cs.neutral(plan, GUEST_WHY))
    (out / "order_requests.json").write_text(json.dumps(order["bodies"], indent=1), encoding="utf-8")
    print(f"{plan['store']['name']}: {sum(x['ok'] for x in recs)}/{len(recs)} pieces on the mock, {src}; "
          f"pendant pair ${order['pair']:.2f} (mock) -> {out}")
    return {"reading": r, "plan": plan, "recs": recs, "order": order}


def selftest() -> None:
    n = 0

    def ok(c, what):
        nonlocal n
        assert c, what
        n += 1

    tmp = Path(tempfile.mkdtemp())
    res = run(tmp)
    r = res["reading"]
    ok(all(x["ok"] for x in res["recs"]) and len(res["recs"]) == 4, "4 of 4 bodies valid on the mock")
    ok(res["order"]["pair"] == round(2 * res["order"]["unit"], 2), "the pair is one design at quantity 2")
    guest = (tmp / "public.html").read_text(encoding="utf-8")
    ok(not cs.public_clean(guest, r), "guest page: no refs, counts or named places")
    ok(not any(t["place"] in guest or t["start"] in guest for t in r["trips"]), "guest page: no trips or dates")
    owner = (tmp / "owner.html").read_text(encoding="utf-8")
    ok("Lisbon" in owner and "person-2" in owner, "owner page carries the trips and the pair")
    one_roll = {k: v for k, v in r.items() if k != "people"}
    try:
        couple(one_roll)
        ok(False, "one roll must stop at the consent gate")
    except SystemExit as e:
        ok("consent gate" in str(e), "one roll stops at the consent gate")
    bad = json.loads(json.dumps(res["plan"]))
    bad["products"][2]["prompt"] = "Printed wall art print of Lisbon rooftops."
    bad["products"][1]["why"] = "The rug from where you met: 34% of your moments."
    errs = rules(bad, r)
    ok(any("lisbon" in e for e in errs) and any("where you met" in e for e in errs), "places and claims refused")
    bad["products"][0]["category"] = "ring"
    ok(any("no rings" in e for e in rules(bad, r)), "rings refused")
    print(f"couple selftest: {n} checks PASS")


if __name__ == "__main__":
    selftest() if "--selftest" in sys.argv else run(cs.planner.OUT / HERE.name)
