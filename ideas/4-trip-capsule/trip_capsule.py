"""trip_capsule.py -- idea 4: one small capsule per trip, built on the Gold SDK reading.

  roll     gold_sdk.read(photos)           -> reading with trips[] (opt-in named places)
  trip     gold_sdk.read(that trip's photos) -> the trip's own signature and palette
  plan     planner (Claude with --plan and ANTHROPIC_API_KEY; else recorded_plans.json),
           checked by planner.check: colours only from the trip palette, every why quotes a share
  arcade   one wall print + one tea towel per trip, bodies validated by the mock (never live)
  pages    out/4-trip-capsule/owner_<trip>.html (local) and gift_<trip>.html (photo-free)

  python ideas/4-trip-capsule/trip_capsule.py               # demo on the invented traveller
  python ideas/4-trip-capsule/trip_capsule.py --selftest
"""
from __future__ import annotations
import html, json, os, re, sys, tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path[:0] = [str(REPO / "gold_sdk"), str(REPO / "planner"), str(REPO / "arcade")]
from gold_sdk import read  # noqa: E402
from planner import OUT, check, evidence_text, plan as claude_plan, render, to_arcade  # noqa: E402
from arcade import Arcade  # noqa: E402
from mock_arcade import mock_transport  # noqa: E402
from run_designs import pick, rid  # noqa: E402

PERSONA = "traveller_noor"
CATS = ["wall art print", "textile"]
MIN_EVENTS = 3          # ponytail: a guess; fewer moments than this and the trip palette is too thin
PRODUCT = {"wall art print": " Product: a 30 x 40 cm art print on matte archival paper, unframed.",
           "textile": " Product: a 50 x 70 cm tea towel, cotton-linen, printed on one side, hemmed edges."}
SIMPLER = " Simplify: fewer, larger shapes; no fine detail."
MONTHS = "January February March April May June July August September October November December".split()


def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")


def month(trip: dict) -> str:
    return MONTHS[int(trip["start"][5:7]) - 1]


def unmeasured(r: dict, fields: list[str]) -> list[str]:
    """The SDK reports reliability per field; list the ones this idea leans on that are unmeasured."""
    return [f for f in fields if r["reliability"].get(f, {}).get("status") != "measured"]


def trip_reading(photos: list[str], trip: dict, persona: str | None) -> dict:
    # ponytail: the app passes only the photos dated inside the trip (it has capture dates
    # locally); the stub has one invented fixture per trip instead.
    return read(photos, fixture=f"{persona}_{slug(trip['place'])}" if persona else None)


def get_plan(key: str, r: dict, recorded: dict) -> dict:
    if "--plan" in sys.argv and os.environ.get("ANTHROPIC_API_KEY"):
        return claude_plan(r, CATS)
    p = recorded[key]
    errs = check(p, CATS, r)
    assert not errs, f"recorded plan {key} fails planner.check: {errs}"
    return p


def send(briefs: list[dict]) -> list[dict]:
    """Every body goes through the mock (never live). Retry rule: one simplified retry, then
    the piece is shown as not makeable instead of hidden."""
    a = Arcade(key="arcade_sk_live_MOCK", transport=mock_transport, log=None, sleep=lambda s: None)
    cats, out = a.categories(), []
    for b in briefs:
        cat = pick(cats, b["category"])
        colors = b["colors"] if cat["world"] == "print" else None
        rec = a.design(b["prompt"], cat["categoryId"], colors=colors, request_id=rid(b))
        if not rec["ok"]:
            b = dict(b, prompt=b["prompt"] + SIMPLER)
            rec = a.design(b["prompt"], cat["categoryId"], colors=colors, request_id=rid(b))
        price = (rec.get("product") or {}).get("unitPrice", {}).get("amount")
        out.append({"brief": b, "request": rec["request"], "ok": rec["ok"], "mock_price_usd": price,
                    "reason": rec.get("reason")})
    return out


def owner_extra(trip: dict, r: dict, roll: dict, sent: list[dict]) -> str:
    e = html.escape
    rel = "".join(f"<li>{e(k)}: {e(v['status'])}{' ' + str(v['value']) if 'value' in v else ''}</li>"
                  for k, v in {**{"trips": roll['reliability'].get('trips', {'status': 'unmeasured'})}, **r["reliability"]}.items())
    ev = "".join(f"<li>{e(s['idea'])}: {e(', '.join(s['evidence']))}</li>" for s in r["signature"])
    rows = "".join(f"<li>{e(x['brief']['category'])}: {'mock ok' if x['ok'] else 'not makeable: ' + e(str(x['reason']))}"
                   f"{', mock estimate $' + x['mock_price_usd'] if x['mock_price_usd'] else ''}</li>" for x in sent)
    confirm = ("<p><b>Confirm this trip first.</b> The SDK reports trips as unmeasured, so the dates are a "
               "proposal and the gift page stays a draft until you confirm.</p>") if unmeasured(roll, ["trips"]) else ""
    return (f"<section style='display:block'><h2>{e(trip['place'])}, {e(trip['start'])} to {e(trip['end'])}, "
            f"{trip['events']} moments</h2>{confirm}<h3>Reliability (per field, from the SDK)</h3><ul>{rel}</ul>"
            f"<h3>Evidence refs (resolve to thumbnails on this device only)</h3><ul>{ev}</ul>"
            f"<h3>Arcade (mock; prices are the mock's estimate, Arcade's own anchor is about $100)</h3><ul>{rows}</ul>"
            f"<h3>What the planner saw</h3><pre style='white-space:pre-wrap'>{e(evidence_text(r))}</pre></section>")


def gift_page(p: dict, trip: dict, draft: bool) -> str:
    g = render(p, public=True)
    note = "<p class=own><b>Draft, do not share yet:</b> confirm the trip first.</p>" if draft else ""
    return g.replace("<section>", f"<p class=own>{html.escape(trip['place'])}, {month(trip)}</p>{note}<section>", 1)


def run(out: Path, photos: list[str] | None = None, persona: str | None = PERSONA) -> dict:
    photos = photos or []
    roll = read(photos, fixture=persona)
    recorded = json.loads((HERE / "recorded_plans.json").read_text(encoding="utf-8"))
    out.mkdir(parents=True, exist_ok=True)
    result, briefs_all = {"capsules": [], "skipped": []}, []
    for trip in roll.get("trips", []):
        if trip["events"] < MIN_EVENTS:
            result["skipped"].append({"place": trip["place"], "reason": f"{trip['events']} moments, under {MIN_EVENTS}"})
            continue
        r = trip_reading(photos, trip, persona)
        p = get_plan(slug(trip["place"]), r, recorded)
        briefs = [dict(b, who=f"trip-{slug(trip['place'])}", arm="trip", prompt=b["prompt"] + PRODUCT[b["category"]])
                  for b in to_arcade(p)]
        sent = send(briefs)
        briefs_all += [x["brief"] for x in sent]
        page = render(p, public=False).replace("</main>", owner_extra(trip, r, roll, sent) + "</main>")
        (out / f"owner_{slug(trip['place'])}.html").write_text(page, encoding="utf-8")
        draft = bool(unmeasured(roll, ["trips"]))
        (out / f"gift_{slug(trip['place'])}.html").write_text(gift_page(p, trip, draft), encoding="utf-8")
        result["capsules"].append({"place": trip["place"], "pieces": len(sent), "ok": sum(x["ok"] for x in sent),
                                   "draft": draft, "requests": [x["request"] for x in sent]})
    (out / "arcade_requests.json").write_text(json.dumps(result["capsules"], indent=1), encoding="utf-8")
    (out / "briefs.json").write_text(json.dumps(briefs_all, indent=1), encoding="utf-8")
    return result


def selftest() -> None:
    n = 0

    def ok(c, what):
        nonlocal n
        assert c, what
        n += 1

    tmp = Path(tempfile.mkdtemp())
    rec = json.loads((HERE / "recorded_plans.json").read_text(encoding="utf-8"))
    oax = read([], fixture="traveller_noor_oaxaca")
    ok(check(rec["oaxaca"], CATS, oax) == [], "recorded Oaxaca plan passes planner.check")
    bad = json.loads(json.dumps(rec["oaxaca"])); bad["products"][0]["why"] = "Courtyards are in 80% of this trip."
    ok(check(bad, CATS, oax), "an invented share is refused")
    bad = json.loads(json.dumps(rec["oaxaca"])); bad["products"][1]["colors"] = ["#6e6a66"]
    ok(check(bad, CATS, oax), "another trip's colour is refused (palette is per trip)")
    mock_transport.inject("patterns/create", "job_fail")
    res = run(tmp)
    ok([c["place"] for c in res["capsules"]] == ["Oaxaca", "Edinburgh"], f"two capsules: {res}")
    ok(res["skipped"] and res["skipped"][0]["place"] == "Halifax", "a 2-moment trip gets no capsule")
    ok(all(c["ok"] == c["pieces"] == 2 for c in res["capsules"]), "every piece made on the mock after the retry rule")
    first = res["capsules"][0]["requests"][0]
    ok(first["prompt"].endswith(SIMPLER) and "matte archival" in first["prompt"], "the failed job was retried once, simplified")
    ok(all(len(q["prompt"]) <= 1000 and "categoryId" in q for c in res["capsules"] for q in c["requests"]), "bodies within spec")
    pal = {c["hex"] for c in oax["palette"]}
    ok(all(set(q.get("colors", [])) <= pal for q in res["capsules"][0]["requests"]), "Oaxaca colours come from the Oaxaca reading")
    gift = (tmp / "gift_oaxaca.html").read_text(encoding="utf-8")
    ok("ev-" not in gift and "2026-03-06" not in gift and "Owner preview" not in gift, "gift page: no evidence refs, no exact dates")
    ok("Oaxaca, March" in gift and "Draft, do not share yet" in gift, "gift page: place + month, draft until the trip is confirmed")
    own = (tmp / "owner_oaxaca.html").read_text(encoding="utf-8")
    ok("ev-501" in own and "trips: unmeasured" in own, "owner page: evidence refs and per-field reliability")
    ok(json.loads((tmp / "briefs.json").read_text(encoding="utf-8"))[0]["who"] == "trip-oaxaca", "briefs ready for run_designs")
    print(f"trip_capsule selftest: {n} checks PASS")


def main() -> int:
    out = OUT / "4-trip-capsule"
    res = run(out)
    for c in res["capsules"]:
        print(f"  {c['place']}: {c['ok']}/{c['pieces']} pieces made on the mock{' (draft: confirm the trip)' if c['draft'] else ''}")
    for s in res["skipped"]:
        print(f"  {s['place']}: no capsule ({s['reason']})")
    print(f"-> {out}: owner_<trip>.html (local only) and gift_<trip>.html (photo-free)")
    return 0


if __name__ == "__main__":
    sys.exit(selftest() if "--selftest" in sys.argv else main())
