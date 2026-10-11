"""gold_sdk.py -- the ONE boundary between this repo and Gold.

`read(photos)` returns a `gold.reading.v0` (see README.md, contract.schema.json). FOR THE DEMO the
reading is an uploaded Gold INSIGHT PACK (insights/archetype-*.json) or an invented example
(fixtures/), chosen per user: `read([], fixture="archetype-small-table-host")`. How photos are read
is not in this repo; the protected Gold SDK replaces `_gold_read` here. Until it does, `read()`
returns an INVENTED fixture (marked `"stub": true`) so the planner, the app and the ideas can be
built and tested end to end.

  from gold_sdk import read, validate
  r = read(["a.jpg", "b.jpg"], fixture="creator_maya")

  python gold_sdk/gold_sdk.py --selftest
"""
from __future__ import annotations
import json, os, re, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
FIXTURES = HERE / "fixtures"      # invented example people
INSIGHTS = HERE / "insights"      # Gold insight packs (archetypes) uploaded for the demo
HEX = re.compile(r"^#[0-9a-f]{6}$")


def _gold_read(photos: list[str]) -> dict | None:
    """Replaced by the protected Gold SDK. Returns None here: no reading code ships in this repo."""
    try:
        import gold_protected  # type: ignore  # the protected package, when installed
    except ImportError:
        return None
    return gold_protected.read(photos)


def _path(name: str) -> Path:
    for d in (INSIGHTS, FIXTURES):
        if (d / f"{name}.json").exists():
            return d / f"{name}.json"
    raise FileNotFoundError(f"no insight pack or fixture named {name!r}; have {fixtures()}")


def fixtures() -> list[str]:
    """Every pack a demo user can be given: Gold insight packs first, then invented examples."""
    return sorted(p.stem for p in INSIGHTS.glob("*.json")) + sorted(p.stem for p in FIXTURES.glob("*.json"))


def read(photos: list[str], fixture: str | None = None) -> dict:
    fixture = fixture or os.environ.get("GOLD_SDK_FIXTURE")
    if not fixture:
        real = _gold_read(photos)
        if real is not None:
            validate(real)
            return real
        fixture = "creator_maya"
    r = json.loads(_path(fixture).read_text(encoding="utf-8"))
    r["stub"] = True                       # every consumer can see this is not a real reading
    validate(r)
    return r


def validate(r: dict) -> None:
    """The contract's load-bearing rules, without a jsonschema dependency."""
    assert r.get("schema") == "gold.reading.v0", "schema"
    for k in ("photos", "signature", "palette", "places", "reliability"):
        assert k in r, f"missing {k}"
    for s in r["signature"]:
        assert s["idea"] and 0 <= s["share_of_events"] <= 1 and 0 <= s["strength"] <= 1, s
        assert isinstance(s["evidence"], list)
    for c in r["palette"]:
        assert HEX.match(c["hex"]) and c["source"] in ("lives_with", "goes_to", "saves"), c
    for p in r.get("people", []):
        assert re.match(r"^person-\d+$", p["ref"]), "people are anonymous refs, never names"


def selftest() -> None:
    assert {"creator_maya", "couple_june_and_ola"} <= set(fixtures())
    assert sum(f.startswith("archetype-") for f in fixtures()) >= 8, "the 8 Gold archetype packs"
    assert read([], fixture="archetype-night-shift-builder")["archetype"]["name"] == "Night-Shift Builder"
    r = read(["x.jpg"], fixture="creator_maya")
    assert r["stub"] is True and r["signature"][0]["idea"] == "hand-thrown ceramics"
    for f in fixtures():
        validate(read([], fixture=f))
    bad = dict(r, people=[{"ref": "Ola", "events": 3}])
    try:
        validate(bad)
        raise AssertionError("named people must be refused")
    except AssertionError as e:
        assert "anonymous" in str(e)
    assert _gold_read([]) is None, "no reading code ships in the public repo"
    print(f"gold_sdk selftest: {len(fixtures())} fixtures valid, 4 checks PASS")


if __name__ == "__main__":
    selftest() if "--selftest" in sys.argv else print(json.dumps(read(sys.argv[1:]), indent=1))
