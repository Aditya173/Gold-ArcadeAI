"""host_line.py -- idea 5: a host's room photos -> a proposed house line plus one pillow per room.

  rooms    gold_sdk.read(each room's photos)  -> that room's palette and signature
  house    gold_sdk.read(all rooms' photos)   -> the property's reading; house colours are the
           property colours that recur in 2+ rooms (only if the SDK reports palette as measured)
  plan     planner (Claude with --plan and ANTHROPIC_API_KEY; else recorded_plans.json), checked by
           planner.check, plus: house pieces use house colours only; each pillow carries its room's
           accent and says it echoes it
  arcade   house rug + house print (only with a house look) and one pillow per room, mock only
  pages    out/5-host-room-line/host_board.html (local) and guest_preview.html (photo-free)

  python ideas/5-host-room-line/host_line.py               # demo on the invented host
  python ideas/5-host-room-line/host_line.py --selftest
"""
from __future__ import annotations
import colorsys, copy, html, json, os, sys, tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path[:0] = [str(REPO / "gold_sdk"), str(REPO / "planner"), str(REPO / "arcade")]
from gold_sdk import read  # noqa: E402
from planner import OUT, check, evidence_text, plan as claude_plan, render, to_arcade  # noqa: E402
from arcade import Arcade  # noqa: E402
from mock_arcade import mock_transport  # noqa: E402
from run_designs import pick, rid  # noqa: E402

HOUSE_FIXTURE = "host_wren_house"
ROOM_FIXTURES = {"bedroom": "host_wren_bedroom", "living": "host_wren_living", "loft": "host_wren_loft"}
HOUSE_CATS, ROOM_CATS = ["rug", "wall art print"], ["throw pillow"]
MIN_HOUSE_COLOURS = 2
SIMPLER = " Simplify: fewer, larger shapes; no fine detail."
GUEST_BANNED = ("chosen by your host", "picked by your host", "the room you stayed in", "ev-", "person-")


def rgb(h: str) -> tuple[int, ...]:
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def near(a: str, b: str, tol: float = 20) -> bool:
    # ponytail: RGB distance; switch to Lab delta-E if real readings drift more than a few units
    return sum((x - y) ** 2 for x, y in zip(rgb(a), rgb(b))) ** 0.5 <= tol


def measured(r: dict, field: str) -> bool:
    return r["reliability"].get(field, {}).get("status") == "measured"


def house_colours(house: dict, rooms: dict[str, dict]) -> list[dict]:
    """Property colours found in 2+ rooms. None unless every reading's palette is measured."""
    if not all(measured(r, "palette") for r in [house, *rooms.values()]) or len(rooms) < 2:
        return []
    out = []
    for c in house["palette"]:
        k = sum(any(near(c["hex"], x["hex"]) for x in r["palette"]) for r in rooms.values())
        if k >= 2:
            out.append({**c, "rooms": k})
    return out if len(out) >= MIN_HOUSE_COLOURS else []


def accent(room: dict, house_cols: list[dict]) -> str | None:
    """The room's most saturated colour that is not a house colour."""
    own = [c["hex"] for c in room["palette"] if not any(near(c["hex"], h["hex"]) for h in house_cols)]
    sat = {h: colorsys.rgb_to_hsv(*(v / 255 for v in rgb(h)))[1] for h in own}
    best = max(sat, key=sat.get, default=None)
    return best if best and sat[best] >= 0.35 else None


def line_errors(house_plan: dict | None, room_plans: dict[str, dict], house_cols: list[dict], accents: dict) -> list[str]:
    errs = []
    hc = {c["hex"] for c in house_cols}
    for p in (house_plan or {}).get("products", []):
        if not set(x.lower() for x in p["colors"]) <= hc:
            errs.append(f"house {p['category']}: colour outside the house colours")
    for room, p in room_plans.items():
        x = p["products"][0]
        if accents.get(room) and accents[room] not in [c.lower() for c in x["colors"]]:
            errs.append(f"{room}: pillow does not carry the room accent {accents[room]}")
        if "echo" not in x["why"]:
            errs.append(f"{room}: why must say the pillow echoes a colour already in the room")
    return errs


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


def board_extra(house: dict, rooms: dict, house_cols: list, accents: dict, sent: list) -> str:
    e = html.escape
    hc = "".join(f"<li><i style='display:inline-block;width:14px;height:14px;background:{c['hex']}'></i> "
                 f"{e(c['name'])} {c['hex']}: in {c['rooms']} of {len(rooms)} rooms</li>" for c in house_cols)
    look = (f"<ul>{hc}</ul>" if house_cols else
            "<p><b>No house look.</b> Fewer than 2 colours recur across rooms (or the SDK reports a palette as "
            "unmeasured), so the line is one pillow per room only.</p>")
    rel = "".join(f"<li>{e(n)}: " + ", ".join(f"{k} {v['status']}" for k, v in r["reliability"].items())
                  + f"; accent {accents.get(n) or 'none'}</li>" for n, r in {"house": house, **rooms}.items())
    rows = "".join(f"<li>{e(x['brief']['who'])} {e(x['brief']['category'])}: {'mock ok' if x['ok'] else 'not makeable'}"
                   f"{', mock estimate $' + x['mock_price_usd'] if x['mock_price_usd'] else ''}</li>" for x in sent)
    return (f"<section style='display:block'><h2>Host board (local only)</h2><h3>House colours</h3>{look}"
            f"<h3>Reliability per field, per reading (from the SDK)</h3><ul>{rel}</ul>"
            f"<h3>Arcade (mock; not quotes, lead time unknown)</h3><ul>{rows}</ul>"
            "<h3>Ask before ordering</h3><ul><li>Which units, and at fit-out or refresh?</li>"
            "<li>Does a rental piece need to be washable?</li><li>Made to order takes weeks: keep a spare per unit, or reorder?</li></ul>"
            f"<h3>What the planner saw (house)</h3><pre style='white-space:pre-wrap'>{e(evidence_text(house))}</pre></section>")


def run(out: Path, photos_by_room: dict[str, list[str]] | None = None, readings: tuple | None = None) -> dict:
    """photos_by_room: the host's own upload, one folder per room. `readings` overrides the reads (tests)."""
    photos_by_room = photos_by_room or {k: [] for k in ROOM_FIXTURES}
    if readings:
        house, rooms = readings
    else:
        house = read([p for ps in photos_by_room.values() for p in ps], fixture=HOUSE_FIXTURE)
        rooms = {k: read(v, fixture=ROOM_FIXTURES.get(k)) for k, v in photos_by_room.items()}
    rec = json.loads((HERE / "recorded_plans.json").read_text(encoding="utf-8"))
    hcols = house_colours(house, rooms)
    accents = {k: accent(r, hcols) for k, r in rooms.items()}
    house_plan = get_plan(rec["house"], house, HOUSE_CATS) if hcols else None
    room_plans = {k: get_plan(rec["rooms"][k], r, ROOM_CATS) for k, r in rooms.items() if accents[k]}
    errs = line_errors(house_plan, room_plans, hcols, accents)
    assert not errs, errs
    briefs = [dict(b, who="house", arm="host") for b in (to_arcade(house_plan) if house_plan else [])]
    for k, p in room_plans.items():
        briefs += [dict(b, who=f"room-{k}", arm="host") for b in to_arcade(p)]
    sent = send(briefs)
    line = {"store": (house_plan or {}).get("store") or
            {"name": "Room pillows", "tagline": "One room photo in, one pillow out",
             "about": "A proposed pillow for each room, each in a colour that room already has.",
             "palette": [a for a in accents.values() if a]},
            "products": [*(house_plan or {}).get("products", []), *(x for p in room_plans.values() for x in p["products"])]}
    out.mkdir(parents=True, exist_ok=True)
    board = render(line, public=False).replace("</main>", board_extra(house, rooms, hcols, accents, sent) + "</main>")
    guest = render(line, public=True).replace(
        "<section>", "<p class=own><b>Preview, not a store.</b> Proposed pieces: if the host orders this line, "
                     "guests could buy the same pieces here.</p><section>", 1)
    assert not [w for w in GUEST_BANNED if w in guest.lower()], "guest page overclaims or leaks"
    (out / "host_board.html").write_text(board, encoding="utf-8")
    (out / "guest_preview.html").write_text(guest, encoding="utf-8")
    (out / "arcade_requests.json").write_text(json.dumps([x["request"] for x in sent], indent=1), encoding="utf-8")
    (out / "briefs.json").write_text(json.dumps([x["brief"] for x in sent], indent=1), encoding="utf-8")
    return {"house_colours": [c["hex"] for c in hcols], "accents": accents, "sent": sent}


def selftest() -> None:
    n = 0

    def ok(c, what):
        nonlocal n
        assert c, what
        n += 1

    house = read([], fixture=HOUSE_FIXTURE)
    rooms = {k: read([], fixture=f) for k, f in ROOM_FIXTURES.items()}
    hc = house_colours(house, rooms)
    ok({c["hex"] for c in hc} == {"#ebe3d3", "#6b4a33", "#77784f", "#b08d57"}, f"house colours recur in 2+ rooms: {hc}")
    ok({k: accent(r, hc) for k, r in rooms.items()} == {"bedroom": "#a4512f", "living": "#2f6f73", "loft": "#c98b3a"},
       "accent = the room's most saturated non-house colour (charcoal is not an accent)")
    ok(near("#ebe3d3", "#e9e1d1") and not near("#ebe3d3", "#6b4a33"), "near() tolerates small drift only")
    shifted = copy.deepcopy(rooms)
    for i, r in enumerate(shifted.values()):          # no colour in common across rooms
        for c in r["palette"]:
            c["hex"] = "#%02x%02x%02x" % ((rgb(c["hex"])[0] + 60 * i) % 256, rgb(c["hex"])[1], (rgb(c["hex"])[2] + 90 * i) % 256)
    ok(house_colours(house, shifted) == [], "rooms that share no colour give no house look")
    unm = copy.deepcopy(rooms); unm["loft"]["reliability"]["palette"] = {"status": "unmeasured"}
    ok(house_colours(house, unm) == [], "an unmeasured palette blocks the house claim")
    rec = json.loads((HERE / "recorded_plans.json").read_text(encoding="utf-8"))
    ok(check(rec["house"], HOUSE_CATS, house) == [] and all(
        check(rec["rooms"][k], ROOM_CATS, rooms[k]) == [] for k in rooms), "recorded plans pass planner.check")
    bad = copy.deepcopy(rec["rooms"]); bad["bedroom"]["products"][0]["why"] = "Rust bedding shows up in 50% of this room's moments."
    ok(line_errors(None, bad, hc, {"bedroom": "#a4512f"}), "a pillow why must say it echoes the room's colour")
    badh = copy.deepcopy(rec["house"]); badh["products"][0]["colors"] = ["#a4512f"]
    ok(line_errors(badh, {}, hc, {}), "house pieces use house colours only")
    tmp = Path(tempfile.mkdtemp())
    mock_transport.inject("patterns/create", "job_fail")
    res = run(tmp)
    ok(len(res["sent"]) == 5 and all(x["ok"] for x in res["sent"]), "rug + print + 3 pillows made on the mock")
    ok(res["sent"][0]["request"]["prompt"].endswith(SIMPLER), "failed job retried once, simplified")
    guest = (tmp / "guest_preview.html").read_text(encoding="utf-8")
    ok("Preview, not a store" in guest and "ev-" not in guest and "Host board" not in guest, "guest page: photo-free, labelled a preview")
    board = (tmp / "host_board.html").read_text(encoding="utf-8")
    ok("in 3 of 3 rooms" in board and "washable" in board, "host board shows k-of-n rooms and the buyer questions")
    uh = copy.deepcopy(house); uh["reliability"]["palette"] = {"status": "unmeasured"}
    res2 = run(Path(tempfile.mkdtemp()), readings=(uh, rooms))
    ok(all(x["brief"]["category"] == "throw pillow" for x in res2["sent"]) and len(res2["sent"]) == 3,
       "no house look -> pillows only")
    print(f"host_line selftest: {n} checks PASS")


def main() -> int:
    out = OUT / "5-host-room-line"
    res = run(out)
    print(f"  house colours: {', '.join(res['house_colours']) or 'none (pillows only)'}")
    for k, a in res["accents"].items():
        print(f"  {k}: accent {a or 'none'}")
    print(f"  {sum(x['ok'] for x in res['sent'])}/{len(res['sent'])} pieces made on the mock")
    print(f"-> {out}: host_board.html (local only) and guest_preview.html (photo-free)")
    return 0


if __name__ == "__main__":
    sys.exit(selftest() if "--selftest" in sys.argv else main())
