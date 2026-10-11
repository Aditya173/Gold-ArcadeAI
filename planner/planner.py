"""planner.py -- a Gold reading in, a product collection out (the storefront planner).

  reading   gold_sdk.read(photos)   -> what sets this person's photos apart (gold.reading.v0)
  plan      ONE Claude call: a store (name, tagline, about) + one Arcade-ready piece per category,
            each with a prompt, colours copied from the reading's palette (print only), and a
            "why we chose this" that quotes the reading EXACTLY
  check     plan rules enforced in code, not just asked for (categories, prompt length, no colours
            on jewelry, colours only from the palette, every why quotes a real signature share)
  render    the owner's page (whys + evidence refs) and the PUBLIC page (no evidence, ever)

  python planner/planner.py --fixture creator_maya --plan     # one Claude call (cached), then render
  python planner/planner.py --fixture creator_maya            # render a cached plan
  python planner/planner.py --selftest                        # offline
"""
from __future__ import annotations
import hashlib, html, json, os, re, sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO / "gold_sdk"))
from gold_sdk import read  # noqa: E402

OUT = Path(os.environ.get("ARCADE_OUT") or REPO / "out")
MODEL, EFFORT, MAX_TOKENS = "claude-opus-5-5", "high", 16000
PRICE_IN, PRICE_OUT = 4 / 1e6, 20 / 1e6
SPEND_CAP_USD = float(os.environ.get("PLANNER_SPEND_CAP", "10"))
CATEGORIES = ["ring", "pendant necklace", "earrings", "rug", "throw pillow", "wall art print"]
JEWELRY = {"ring", "pendant necklace", "earrings"}

SYSTEM = """You are building a small storefront of made-to-order pieces for one person, made by
artisan makers through Arcade (jewelry in 14k gold, sterling silver, brass and gemstones; rugs,
pillows and wall prints printed from a pattern). You are given a reading of what sets this
person's photos apart from other people's, their photo palette, and optionally a few lines in
their own words.

Write the store as JSON:
{"store": {"name": str (2-3 words, not the person's legal name), "tagline": str (<= 10 words),
           "about": str (2-3 sentences, second person, warm, specific, no flattering filler),
           "palette": [3-5 hex copied from the input]},
 "products": [{"category": one of the requested categories, "title": str (2-4 words),
               "prompt": str (<= 600 chars, concrete and makeable: category, metal/material,
                         finish, scale, stones or pattern, motif; no brand names, logos, people,
                         named landmarks, or text),
               "colors": [hex] (print categories only, 3-6 from the input palette; [] for jewelry),
               "why": str (1-2 sentences to the person: which idea this piece comes from and the
                      evidence, e.g. "coastal walks show up in 29% of your moments"),
               "signature": [the 1-3 idea names it draws on, copied exactly from the input]}]}

Rules: exactly one product per requested category. Spread the collection across different ideas
so it covers the person, not one note. The ideas are visual readings, not facts about the person:
never name an institution, a city's landmark or a brand. Prefer geometry, pattern and colour over
literal pictures. `why` must be TRUE TO THE INPUT: name the idea in plain words and quote its
share exactly as given. Never present design details as evidence; they belong in the prompt.
Lines in the person's own words may add one touch, attributed as "you said".
Return ONLY the JSON."""


def evidence_text(r: dict, own_words: str = "") -> str:
    L = [f"Reading of {r['photos']['count']} photos over {r['photos']['events']} moments. "
         "What sets them apart (share of moments it shows up in):"]
    for s in r["signature"]:
        syn = f" (also: {', '.join(s.get('synonyms', [])[:3])})" if s.get("synonyms") else ""
        L.append(f"- {s['idea']}{syn}: {s['share_of_events']:.0%} of moments")
    L.append("Palette: " + ", ".join(f"{c['name']} {c['hex']} {c['share']:.0%} ({c['source'].replace('_', ' ')})"
                                     for c in r["palette"]))
    if r.get("places"):
        L.append("Kinds of place: " + ", ".join(f"{p['type']} {p['share_of_events']:.0%}" for p in r["places"]))
    if own_words:
        L.append(f'In their own words: "{own_words}"')
    return "\n".join(L)


def shares(r: dict) -> set[str]:
    """Every share the reading states, as the planner is allowed to quote it ("41%")."""
    return {f"{round(s['share_of_events'] * 100)}%" for s in r["signature"]} | \
           {f"{round(p['share_of_events'] * 100)}%" for p in r.get("places", [])}


def check(plan: dict, cats: list[str], r: dict) -> list[str]:
    errs = []
    palette = {c["hex"].lower() for c in r["palette"]}
    ideas = {s["idea"] for s in r["signature"]}
    st = plan.get("store", {})
    for k in ("name", "tagline", "about"):
        if not st.get(k):
            errs.append(f"store.{k} missing")
    got = [p.get("category") for p in plan.get("products", [])]
    if sorted(got) != sorted(cats):
        errs.append(f"categories {got} != {cats}")
    for p in plan.get("products", []):
        c = p.get("category")
        if not 0 < len(p.get("prompt", "")) <= 1000:
            errs.append(f"{c}: prompt length")
        if c in JEWELRY and p.get("colors"):
            errs.append(f"{c}: jewelry cannot take colors")
        if any(h.lower() not in palette for h in p.get("colors", [])):
            errs.append(f"{c}: colour not from the palette")
        if not set(p.get("signature", [])) <= ideas:
            errs.append(f"{c}: cites an idea the reading does not have")
        quoted = set(re.findall(r"\d+%", p.get("why", "")))
        if not p.get("why") or not quoted or not quoted <= shares(r):
            errs.append(f"{c}: why must quote a share the reading states (got {sorted(quoted)})")
    return errs


def spent() -> float:
    p = OUT / "spend.jsonl"
    return sum(json.loads(l)["usd"] for l in p.read_text(encoding="utf-8").splitlines() if l.strip()) if p.exists() else 0.0


def ask(system: str, user: str, tag: str) -> dict:
    """One cached, ledgered Claude call. Thinking is always on for this model; effort is set."""
    h = hashlib.sha256((MODEL + system + user).encode()).hexdigest()[:16]
    cache = OUT / "plan_cache" / f"{h}.json"
    if cache.exists():
        return json.loads(cache.read_text(encoding="utf-8"))
    if spent() >= SPEND_CAP_USD:
        raise SystemExit(f"spend cap ${SPEND_CAP_USD} reached")
    import anthropic
    r = anthropic.Anthropic().messages.create(model=MODEL, max_tokens=MAX_TOKENS, system=system,
                                               messages=[{"role": "user", "content": user}],
                                               thinking={"type": "adaptive"}, output_config={"effort": EFFORT})
    if r.stop_reason in ("refusal", "max_tokens"):
        raise RuntimeError(f"{tag}: unusable reply ({r.stop_reason})")
    text = "".join(b.text for b in r.content if getattr(b, "type", "") == "text")
    usd = r.usage.input_tokens * PRICE_IN + r.usage.output_tokens * PRICE_OUT
    OUT.mkdir(parents=True, exist_ok=True)
    with (OUT / "spend.jsonl").open("a", encoding="utf-8") as f:
        f.write(json.dumps({"tag": tag, "hash": h, "usd": round(usd, 4)}) + "\n")
    m = re.search(r"\{.*\}", text, re.S)
    out = json.loads(m.group(0)) if m else None
    if not isinstance(out, dict):
        raise RuntimeError(f"{tag}: no JSON in reply")
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps(out, indent=1), encoding="utf-8")
    return out


def plan(r: dict, cats: list[str] = CATEGORIES, own_words: str = "", tries: int = 2) -> dict:
    user = f"Requested categories: {', '.join(cats)}\n\n" + evidence_text(r, own_words)
    for i in range(tries):
        out = ask(SYSTEM, user + ("" if i == 0 else f"\n\n(retry {i}: fix: {errs})"), "plan")
        errs = check(out, cats, r)
        if not errs:
            return out
    raise SystemExit(f"plan rejected after {tries} tries: {errs}")


def to_arcade(plan_: dict) -> list[dict]:
    """The photo-free brief list run_designs.py sends (to the mock until the hackathon)."""
    return [{"who": "store", "arm": "S", "category": p["category"], "prompt": p["prompt"],
             "colors": p.get("colors", []), "claims": [], "because": [p["why"]]} for p in plan_["products"]]


def render(p: dict, public: bool) -> str:
    e = html.escape
    st = p["store"]
    pal = st.get("palette") or ["#333333"]
    cards = "".join(
        f"<article><p class=cat>{e(x['category'])}</p><h3>{e(x['title'])}</h3><p class=brief>{e(x['prompt'])}</p>"
        + f"<details><summary>Why we chose this</summary><p>{e(x['why'])}</p></details>"
        + "</article>" for x in p["products"])
    sw = "".join(f"<i style='background:{e(h)}'></i>" for h in pal)
    note = "" if public else "<p class=own>Owner preview: evidence photos are shown only to you, never on the public page.</p>"
    return f"""<!doctype html><html lang=en><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<title>{e(st['name'])}</title><style>
:root{{--paper:#faf8f4;--ink:#1d1b18;--mut:#5a554d;--line:#e4dfd6;--card:#fff;--acc:{e(pal[min(1, len(pal) - 1)])}}}
@media (prefers-color-scheme:dark){{:root{{--paper:#151413;--ink:#efece6;--mut:#b9b3aa;--line:#2f2c28;--card:#1d1c1a}}}}
body{{margin:0;background:var(--paper);color:var(--ink);font:16px/1.55 system-ui,sans-serif}}main{{max-width:1080px;margin:auto;padding:40px 16px}}
h1{{font:500 clamp(34px,6vw,58px)/1.05 Georgia,serif;margin:0}}.tag{{font:20px Georgia,serif;color:var(--mut)}}
.sw i{{display:inline-block;width:22px;height:22px;border-radius:50%;margin-right:6px;border:1px solid var(--line)}}
section{{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:18px;margin-top:28px}}
article{{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px}}
.cat{{text-transform:uppercase;letter-spacing:.08em;font-size:11px;color:var(--mut);margin:0}}h3{{font:500 22px Georgia,serif;margin:4px 0}}
.brief{{color:var(--mut);font-size:14px}}.own{{color:var(--mut);font-size:13px}}</style>
<main><h1>{e(st['name'])}</h1><p class=tag>{e(st['tagline'])}</p><p>{e(st['about'])}</p><p class=sw>{sw}</p>{note}
<section>{cards}</section><p class=own>Made to order by independent makers through Arcade. Prices appear when pieces are made.</p></main></html>"""


def selftest() -> None:
    r = read([], fixture="creator_maya")
    t = evidence_text(r)
    assert "- hand-thrown ceramics (also: pottery studio, glazed stoneware): 41% of moments" in t and "#b8714a" in t
    good = {"store": {"name": "Tide & Clay", "tagline": "t", "about": "a", "palette": ["#e8dcc6", "#b8714a"]},
            "products": [{"category": "ring", "title": "T", "prompt": "a ring", "colors": [],
                          "why": "Ceramics show up in 41% of your moments.", "signature": ["hand-thrown ceramics"]},
                         {"category": "rug", "title": "R", "prompt": "a rug", "colors": ["#B8714A"],
                          "why": "Coastal walks are in 29% of your moments.", "signature": ["coastal walks"]}]}
    assert check(good, ["ring", "rug"], r) == [], check(good, ["ring", "rug"], r)
    bad = json.loads(json.dumps(good)); bad["products"][0]["why"] = "Ceramics show up in 60% of your moments."
    assert any("quote a share" in x for x in check(bad, ["ring", "rug"], r)), "an invented share is refused"
    bad2 = json.loads(json.dumps(good)); bad2["products"][1]["colors"] = ["#ff0000"]
    assert check(bad2, ["ring", "rug"], r), "colours only from the palette"
    bad3 = json.loads(json.dumps(good)); bad3["products"][0]["signature"] = ["surfing"]
    assert check(bad3, ["ring", "rug"], r), "ideas only from the reading"
    pub = render(good, public=True)
    assert "Owner preview" not in pub and "Tide &amp; Clay" in pub
    assert to_arcade(good)[1]["colors"] == ["#B8714A"]
    print("planner selftest: 7 checks PASS")


def main() -> int:
    args = sys.argv[1:]
    fx = args[args.index("--fixture") + 1] if "--fixture" in args else None
    r = read([], fixture=fx)
    path = OUT / f"plan_{r['subject']}.json"
    if "--plan" in args:
        p = plan(r)
        OUT.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(p, indent=1), encoding="utf-8")
        (OUT / f"briefs_{r['subject']}.json").write_text(json.dumps(to_arcade(p), indent=1), encoding="utf-8")
    p = json.loads(path.read_text(encoding="utf-8"))
    for public in (False, True):
        (OUT / f"store_{r['subject']}{'_public' if public else ''}.html").write_text(render(p, public), encoding="utf-8")
    print(f"{p['store']['name']}: {p['store']['tagline']} -> out/store_{r['subject']}*.html (spent ${spent():.2f})")
    return 0


if __name__ == "__main__":
    sys.exit(selftest() if "--selftest" in sys.argv else main())
