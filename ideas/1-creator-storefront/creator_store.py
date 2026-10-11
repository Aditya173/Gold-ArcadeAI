"""creator_store.py -- idea 1: a creator's curated feed -> a capsule storefront their audience can buy.

  read      gold_sdk.read(photos, fixture="creator_maya_feed")  (an invented creator until the SDK lands)
  select    the capsule menu (2 jewelry + 4 print, at least 2 entry-priced); the planner only sees
            fields the SDK reports as "measured" (a curated feed's signature is not, so it is dropped)
  plan      the recorded plan (plan_recorded.json), or one planner call with ANTHROPIC_API_KEY + --plan;
            planner.check plus this idea's rules (printed, not tufted or woven; entry pieces present)
  arcade    every body through mock_arcade.mock_transport (never live); mock prices; the 5% money gate
  pages     out/1-creator-storefront/owner.html (creator only) and public.html (photo-free, no counts)

  python ideas/1-creator-storefront/creator_store.py --demo
  python ideas/1-creator-storefront/creator_store.py --selftest
"""
from __future__ import annotations
import html, json, os, re, statistics, sys, tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
for d in ("gold_sdk", "planner", "arcade"):
    sys.path.insert(0, str(REPO / d))
import gold_sdk, planner  # noqa: E402
from arcade import Arcade  # noqa: E402
from mock_arcade import MockArcade, mock_transport  # noqa: E402
from run_designs import pick, rid  # noqa: E402

FIXTURE = "creator_maya_feed"
CATS = ["pendant necklace", "earrings", "rug", "throw pillow", "wall art print", "ceramic"]
ENTRY = {"wall art print", "throw pillow", "ceramic", "textile"}      # near the usual ~$48 merch order
MUST_SAY_PRINTED = {"rug", "throw pillow", "textile"}               # a maker reads these as woven/tufted otherwise
UNMAKEABLE = re.compile(r"\b(hand-?tufted|tufted|hand-?knotted|loom|woven|wool)\b", re.I)
COMMISSION, HOODIE_TAKE = 0.05, 12.56   # Arcade's public seller rate; what a $45 POD hoodie leaves (RESEARCH §2)
ADDENDUM = ("This is a creator's capsule their audience can buy. The photos are a curated feed, so "
            "its colours are the feed's colours. Print pieces must say 'printed'; never tufted, "
            "hand-knotted, woven or wool. A plate is decorative.")
RUG_NOTE = ("The rug's mock price is built on a hand-tufted rug figure; a printed rug is a different, likely "
            "cheaper product with no Arcade quote yet.")
PUBLIC_WHY = "Chosen with the creator from their feed."


def trusted(r: dict, field: str) -> bool:
    return r["reliability"].get(field, {}).get("status") == "measured"


def planner_view(r: dict) -> dict:
    """The planner may not lean on a field the SDK reports as unmeasured: drop it."""
    v = dict(r)
    for f in ("signature", "places", "palette"):
        if not trusted(r, f):
            v[f] = []
    return v


def print_rules(plan: dict) -> list[str]:
    errs = []
    for p in plan["products"]:
        if p["category"] in MUST_SAY_PRINTED and "printed" not in p["prompt"].lower():
            errs.append(f"{p['category']}: a print piece must say 'printed'")
        if UNMAKEABLE.search(p["prompt"]):
            errs.append(f"{p['category']}: '{UNMAKEABLE.search(p['prompt']).group(0)}' is not a printed product")
        if p["category"] == "ceramic" and not re.search(r"decorative|display", p["prompt"], re.I):
            errs.append("ceramic: must be a decorative or display plate (food-safe glaze unconfirmed)")
    return errs


def rules(plan: dict) -> list[str]:
    errs = print_rules(plan)
    if sum(p["category"] in ENTRY for p in plan["products"]) < 2:
        errs.append("capsule needs at least 2 entry-priced print pieces")
    return errs


def get_plan(view: dict, cats: list[str], recorded: Path, addendum: str, idea_rules, tag: str) -> tuple[dict, str]:
    if os.environ.get("ANTHROPIC_API_KEY") and "--plan" in sys.argv:
        user = f"Requested categories: {', '.join(cats)}\n\n" + planner.evidence_text(view)
        p, src = planner.ask(planner.SYSTEM + "\n\n" + addendum, user, tag), "planner call (cached)"
    else:
        p, src = json.loads(recorded.read_text(encoding="utf-8")), f"recorded plan ({recorded.name})"
    errs = planner.check(p, cats, view) + idea_rules(p)
    if errs:
        raise SystemExit(f"plan rejected: {errs}")
    return p, src


def make(plan: dict, transport=mock_transport) -> list[dict]:
    """Each piece through the real client on the mock transport. A piece no maker can price is
    reported as declined, never hidden."""
    a = Arcade(key="arcade_sk_live_MOCK", transport=transport, log=None, sleep=lambda s: None)
    cats, out = a.categories(), []
    for b, p in zip(planner.to_arcade(plan), plan["products"]):
        cat = pick(cats, b["category"])
        if not cat:
            out.append({"title": p["title"], "category": p["category"], "ok": False, "reason": "no Arcade category"})
            continue
        rec = a.design(b["prompt"], cat["categoryId"], colors=b["colors"] if cat["world"] == "print" else None,
                       request_id=rid(b))
        prod = rec.get("product") or {}
        out.append({"title": p["title"], "category": p["category"], "ok": rec["ok"], "request": rec["request"],
                    "productId": prod.get("productId"), "reason": rec.get("reason"),
                    "price": float(prod["unitPrice"]["amount"]) if rec["ok"] else None})
    return out


def money(recs: list[dict], rate: float = COMMISSION) -> dict:
    prices = [r["price"] for r in recs if r["ok"]]
    med = statistics.median(prices)
    return {"median_price": med, "rate": rate, "take": round(med * rate, 2),
            "go": med * rate >= HOODIE_TAKE, "sales_to_match_hoodie": round(HOODIE_TAKE / (med * rate), 1)}


def public_clean(page: str, r: dict) -> list[str]:
    page = re.sub(r"<style>.*?</style>", "", page, flags=re.S)
    bad = [s for s in re.findall(r"ev-\d+|person-\d+|<img", page)]
    bad += [n["label"] for n in r.get("named_places", []) if n["label"].lower() in page.lower()]
    bad += re.findall(r"\d+%", page) + (["Owner preview"] if "Owner preview" in page else [])
    return bad


def owner_extra(r: dict, plan: dict, recs: list[dict], src: str, notes: list[str]) -> str:
    e, ev = html.escape, {s["idea"]: s["evidence"] for s in r["signature"]}
    rel = "".join(f"<li>{e(k)}: {e(v['status'])}{' ' + str(v['value']) if 'value' in v else ''}"
                  f"{' (not used by the planner)' if v['status'] != 'measured' else ''}</li>"
                  for k, v in r["reliability"].items())
    rows = "".join(
        f"<tr><td>{e(x['title'])}</td><td>{e(x['category'])}</td>"
        f"<td>{'$%.0f (mock)' % x['price'] if x['ok'] else 'maker declined: ' + e(str(x['reason']))}</td>"
        f"<td>{e(', '.join(ref for i in p.get('signature', []) for ref in ev.get(i, [])) or '-')}</td></tr>"
        for x, p in zip(recs, plan["products"]))
    stub = "<p class=own><b>Stub reading:</b> an invented person, not anyone's photos.</p>" if r.get("stub") else ""
    return (f"<section style='display:block'>{stub}<h3>Owner only</h3><p class=own>Plan: {e(src)}. "
            f"The SDK reports reliability per field:</p><ul class=own>{rel}</ul>"
            "<table class=own><tr><th>Piece</th><th>Category</th><th>Price</th><th>Evidence refs (your device only)</th></tr>"
            f"{rows}</table>" + "".join(f"<p class=own>{e(n)}</p>" for n in notes) + "</section>")


def write(out: Path, r: dict, plan: dict, recs: list[dict], src: str, notes: list[str], public_plan: dict) -> None:
    out.mkdir(parents=True, exist_ok=True)
    (out / "plan.json").write_text(json.dumps(plan, indent=1), encoding="utf-8")
    (out / "arcade_requests.json").write_text(json.dumps([x["request"] for x in recs if "request" in x], indent=1), encoding="utf-8")
    owner = planner.render(plan, public=False).replace("</main>", owner_extra(r, plan, recs, src, notes) + "</main>")
    (out / "owner.html").write_text(owner, encoding="utf-8")
    pub = planner.render(public_plan, public=True)
    bad = public_clean(pub, r)
    if bad:
        raise SystemExit(f"public page refused, it carries {bad}")
    (out / "public.html").write_text(pub, encoding="utf-8")


def neutral(plan: dict, why: str, keep=lambda p: True) -> dict:
    p = json.loads(json.dumps(plan))
    p["products"] = [dict(x, why=why) for x in p["products"] if keep(x)]
    return p


def run(out: Path, fixture: str = FIXTURE, transport=mock_transport) -> dict:
    r = gold_sdk.read([], fixture=fixture)          # photos: the creator's chosen feed; the stub ignores them
    view = planner_view(r)
    plan, src = get_plan(view, CATS, HERE / "plan_recorded.json", ADDENDUM, rules, "creator_store")
    recs = make(plan, transport)
    m = money(recs)
    notes = [f"Your take at Arcade's public {m['rate']:.0%} on the median piece (${m['median_price']:.2f}, mock): "
             f"${m['take']:.2f}, against ${HOODIE_TAKE} on one $45 print-on-demand hoodie. "
             f"{'GO' if m['go'] else 'NO-GO'} until Arcade answers the markup / rate question (OPEN_QUESTIONS.md).",
             "Palette: the feed's colours (partly its editing preset), not the colours of your days.", RUG_NOTE]
    write(out, r, plan, recs, src, notes, neutral(plan, PUBLIC_WHY))
    print(f"{plan['store']['name']}: {sum(x['ok'] for x in recs)}/{len(recs)} pieces on the mock, {src}; "
          f"money gate {'GO' if m['go'] else 'NO-GO'} (take ${m['take']:.2f}/piece) -> {out}")
    return {"reading": r, "plan": plan, "recs": recs, "money": m}


def selftest() -> None:
    n = 0

    def ok(c, what):
        nonlocal n
        assert c, what
        n += 1

    tmp = Path(tempfile.mkdtemp())
    res = run(tmp)
    ok(res["reading"]["stub"] and res["plan"]["products"], "pipeline runs on the stub reading")
    ok(planner_view(res["reading"])["signature"] == [], "unmeasured signature never reaches the planner")
    ok(all(not p["signature"] for p in res["plan"]["products"]), "no piece cites the unmeasured signature")
    ok(all(x["ok"] for x in res["recs"]) and len(res["recs"]) == 6, "6 of 6 bodies valid on the mock")
    ok(all("colors" not in x["request"] for x in res["recs"] if x["category"] in planner.JEWELRY), "jewelry sends no colours")
    ok(not res["money"]["go"], "at 5% the money gate is NO-GO")
    ok(money(res["recs"], rate=0.20)["go"], "a 20% rate or markup would flip it")
    pub = (tmp / "public.html").read_text(encoding="utf-8")
    ok(not public_clean(pub, res["reading"]), "public page: no refs, no counts, no owner note")
    ok("Owner only" in (tmp / "owner.html").read_text(encoding="utf-8"), "owner page carries the owner section")
    bad = json.loads(json.dumps(res["plan"]))
    bad["products"][2]["prompt"] = "Hand-tufted wool rug, 5x8 ft, terracotta grid."
    ok(any("tufted" in x or "printed" in x for x in rules(bad)), "a tufted rug is refused")
    bad["products"] = [x for x in bad["products"] if x["category"] not in ENTRY]
    ok(any("entry-priced" in x for x in rules(bad)), "a capsule with no entry piece is refused")
    m = MockArcade()
    m.inject("patterns/create", "job_fail")
    recs = make(res["plan"], transport=m)
    ok(not recs[0]["ok"] and recs[0]["reason"] == "no maker can price this design", "a maker decline is reported")
    try:
        write(tmp, res["reading"], res["plan"], res["recs"], "x", [], res["plan"])
        ok(False, "a public page with shares must be refused")
    except SystemExit as e:
        ok("refused" in str(e), "public page with counts refused")
    print(f"creator_store selftest: {n} checks PASS")


if __name__ == "__main__":
    selftest() if "--selftest" in sys.argv else run(planner.OUT / HERE.name)
