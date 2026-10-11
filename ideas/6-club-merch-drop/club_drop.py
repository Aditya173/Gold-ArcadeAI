"""club_drop.py -- idea 6: a club's shared season album -> group pieces, plus an opt-in member piece.

  group    gold_sdk.read(the organizer's shared album), people OFF -> the season's signature and
           palette; a printed rug and a wall print for the clubhouse
  member   only a member who opted in, under an anonymous ref (person-N), with the album events
           they tagged themself into. gold_sdk.read(photos of those events) -> their own slice.
           A pendant is offered only if they tagged enough events, the SDK reports the slice's
           signature as measured, and their top idea stands out from the club's. Nobody is ever
           found by face, and a member who did not opt in is never read.
  plan     planner (Claude with --plan and ANTHROPIC_API_KEY; else recorded_plans.json), checked by
           planner.check against the reading it came from
  arcade   every body through the mock (never live)
  pages    out/6-club-merch-drop/drop_public.html (group pieces, photo-free, no members) and
           member_<ref>.html (local, that member only)

  python ideas/6-club-merch-drop/club_drop.py               # demo on the invented club
  python ideas/6-club-merch-drop/club_drop.py --selftest
"""
from __future__ import annotations
import copy, html, json, os, re, sys, tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path[:0] = [str(REPO / "gold_sdk"), str(REPO / "planner"), str(REPO / "arcade")]
from gold_sdk import read  # noqa: E402
from planner import OUT, check, evidence_text, plan as claude_plan, render, to_arcade  # noqa: E402
from arcade import Arcade  # noqa: E402
from mock_arcade import mock_transport  # noqa: E402
from run_designs import pick, rid  # noqa: E402

ALBUM_FIXTURE = "club_tidewater_album"
CLUB_CATS, MEMBER_CATS = ["rug", "wall art print"], ["pendant necklace"]
MIN_MEMBER_EVENTS = 5   # ponytail: a guess; below this a member's slice is a handful of photos
STAND_OUT = 1.5         # ponytail: member's top idea must be 1.5x its club share; unmeasured, replace with an SDK test
SIMPLER = " Simplify: fewer, larger shapes; no fine detail."
REF = re.compile(r"^person-\d+$")


def get_plan(rec: dict, r: dict, cats: list[str]) -> dict:
    if "--plan" in sys.argv and os.environ.get("ANTHROPIC_API_KEY"):
        return claude_plan(r, cats)
    errs = check(rec, cats, r)
    assert not errs, f"recorded plan fails planner.check: {errs}"
    return rec


def send(briefs: list[dict]) -> list[dict]:
    a = Arcade(key="arcade_sk_live_MOCK", transport=mock_transport, log=None, sleep=lambda s: None)
    cats, out = a.categories(), []
    for b in briefs:
        cat = pick(cats, b["category"])
        colors = b["colors"] if cat["world"] == "print" else None
        rec = a.design(b["prompt"], cat["categoryId"], colors=colors, request_id=rid(b))
        if not rec["ok"]:       # retry rule: once, simplified, then shown as not makeable
            b = dict(b, prompt=b["prompt"] + SIMPLER)
            rec = a.design(b["prompt"], cat["categoryId"], colors=colors, request_id=rid(b))
        price = (rec.get("product") or {}).get("unitPrice", {}).get("amount")
        out.append({"brief": b, "request": rec["request"], "ok": rec["ok"], "mock_price_usd": price})
    return out


def member_gate(m: dict) -> str | None:
    """Why this member gets no slice read at all, or None. Checked BEFORE any read."""
    if m.get("consent") is not True:
        return "did not opt in"
    if not REF.match(m.get("ref", "")):
        return "not an anonymous ref"
    if len(set(m.get("events", []))) < MIN_MEMBER_EVENTS:
        return f"tagged {len(set(m.get('events', [])))} events, under {MIN_MEMBER_EVENTS}"
    return None


def stands_out(member: dict, club: dict) -> str | None:
    """Why the slice gives no pendant, or None. A pendant everyone could get has no reading behind it."""
    if member["reliability"].get("signature", {}).get("status") != "measured":
        return "the SDK reports this slice's signature as unmeasured"
    top = member["signature"][0]
    base = next((s["share_of_events"] for s in club["signature"] if s["idea"] == top["idea"]), 0)
    if top["share_of_events"] < STAND_OUT * base:
        return f"top idea '{top['idea']}' is no stronger for you than for the club"
    return None


def run(out: Path, album_photos: list[str] | None = None, optins: list[dict] | None = None, reader=read) -> dict:
    album = reader(album_photos or [], fixture=ALBUM_FIXTURE)
    album.pop("people", None)                       # the group path never uses people
    rec = json.loads((HERE / "recorded_plans.json").read_text(encoding="utf-8"))
    if optins is None:
        optins = json.loads((HERE / "member_optins.json").read_text(encoding="utf-8"))["members"]
    out.mkdir(parents=True, exist_ok=True)
    club_plan = get_plan(rec["club"], album, CLUB_CATS)
    club_sent = send([dict(b, who="club", arm="group") for b in to_arcade(club_plan)])
    pub = render(club_plan, public=True).replace(
        "<section>", "<p class=own>Season keepsakes for the club, ordered by the organizer. "
                     "Members' own pieces are private to each member.</p><section>", 1)
    assert "person-" not in pub and "ev-" not in pub, "public page carries no member or evidence refs"
    (out / "drop_public.html").write_text(pub, encoding="utf-8")
    members = []
    for m in optins:
        why_not = member_gate(m)
        r = None if why_not else reader([], fixture=f"club_tidewater_member_{m['ref'].split('-')[1]}")
        why_not = why_not or stands_out(r, album)
        if why_not or m["ref"] not in rec["members"]:
            members.append({"ref": m["ref"], "pendant": False, "reason": why_not or "no plan recorded"})
            continue
        p = get_plan(rec["members"][m["ref"]], r, MEMBER_CATS)
        sent = send([dict(b, who=m["ref"], arm="member") for b in to_arcade(p)])
        e = html.escape
        extra = (f"<section style='display:block'><h2>Only you see this page</h2><p>Built from the {len(set(m['events']))} "
                 f"events you tagged yourself into. Evidence refs (thumbnails on your device only): "
                 f"{e(', '.join(s for x in r['signature'] for s in x['evidence']))}</p>"
                 f"<p>Reliability (per field, from the SDK): " + ", ".join(f"{k} {v['status']}" for k, v in r["reliability"].items())
                 + "</p><p>Arcade (mock): " + ", ".join(f"{x['brief']['category']} {'ok' if x['ok'] else 'not makeable'}"
                 f"{' $' + x['mock_price_usd'] + ' mock estimate' if x['mock_price_usd'] else ''}" for x in sent)
                 + f"</p><pre style='white-space:pre-wrap'>{e(evidence_text(r))}</pre></section>")
        (out / f"member_{m['ref']}.html").write_text(render(p, public=False).replace("</main>", extra + "</main>"), encoding="utf-8")
        members.append({"ref": m["ref"], "pendant": True, "sent": sent})
    all_sent = club_sent + [x for m in members for x in m.get("sent", [])]
    (out / "arcade_requests.json").write_text(json.dumps([x["request"] for x in all_sent], indent=1), encoding="utf-8")
    (out / "briefs.json").write_text(json.dumps([x["brief"] for x in all_sent], indent=1), encoding="utf-8")
    return {"club": club_sent, "members": members}


def selftest() -> None:
    n = 0

    def ok(c, what):
        nonlocal n
        assert c, what
        n += 1

    reads = []

    def spy(photos, fixture=None):
        reads.append(fixture)
        return read(photos, fixture=fixture)

    album = read([], fixture=ALBUM_FIXTURE)
    rec = json.loads((HERE / "recorded_plans.json").read_text(encoding="utf-8"))
    ok(check(rec["club"], CLUB_CATS, album) == [], "club plan passes planner.check")
    m1 = read([], fixture="club_tidewater_member_1")
    ok(check(rec["members"]["person-1"], MEMBER_CATS, m1) == [], "member plan passes planner.check against the member's own slice")
    ok(check(rec["members"]["person-1"], MEMBER_CATS, album), "the member's 56% is not a club share: refused against the album")
    bad = copy.deepcopy(rec["members"]["person-1"]); bad["products"][0]["colors"] = ["#3f5e4a"]
    ok(check(bad, MEMBER_CATS, m1), "jewelry takes no colours")
    ok(member_gate({"ref": "Sam", "consent": True, "events": list("abcdef")}) == "not an anonymous ref", "names are refused")
    flat = copy.deepcopy(m1); flat["signature"][0]["share_of_events"] = 0.25
    ok(stands_out(flat, album), "a slice that looks like the club gets no pendant")
    unm = copy.deepcopy(m1); unm["reliability"]["signature"] = {"status": "unmeasured"}
    ok(stands_out(unm, album), "an unmeasured slice gets no pendant")
    tmp = Path(tempfile.mkdtemp())
    mock_transport.inject("patterns/create", "job_fail")
    res = run(tmp, reader=spy)
    ok(reads == [ALBUM_FIXTURE, "club_tidewater_member_1"], f"only the album and the one qualifying member are read: {reads}")
    by = {m["ref"]: m for m in res["members"]}
    ok(by["person-1"]["pendant"] and not by["person-2"]["pendant"] and not by["person-3"]["pendant"], "pendant only for person-1")
    ok("under 5" in by["person-2"]["reason"] and by["person-3"]["reason"] == "did not opt in", "reasons recorded")
    ok(all(x["ok"] for x in res["club"] + by["person-1"]["sent"]), "every piece made on the mock")
    ok(res["club"][0]["request"]["prompt"].endswith(SIMPLER), "failed job retried once, simplified")
    ok("colors" not in by["person-1"]["sent"][0]["request"], "pendant body carries no colours")
    pub = (tmp / "drop_public.html").read_text(encoding="utf-8")
    ok("person-" not in pub and "ev-" not in pub and "Switchback" not in pub, "public drop: group pieces only, photo-free")
    ok("ev-412" in (tmp / "member_person-1.html").read_text(encoding="utf-8") and not (tmp / "member_person-2.html").exists(),
       "member page is local and only for the member with a pendant")
    print(f"club_drop selftest: {n} checks PASS")


def main() -> int:
    out = OUT / "6-club-merch-drop"
    res = run(out)
    print(f"  club: {sum(x['ok'] for x in res['club'])}/{len(res['club'])} group pieces made on the mock")
    for m in res["members"]:
        print(f"  {m['ref']}: {'pendant planned' if m['pendant'] else 'no pendant (' + m['reason'] + ')'}")
    print(f"-> {out}: drop_public.html (photo-free) and member_<ref>.html (local, per member)")
    return 0


if __name__ == "__main__":
    sys.exit(selftest() if "--selftest" in sys.argv else main())
