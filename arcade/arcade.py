"""arcade.py -- the smallest Arcade platform client this project needs.

Spec: tools/arcade/openapi.json (docs.arcade.ai); rules: .claude/skills/arcade-api*/SKILL.md.

  every call      POST https://platform.arcade.ai/v1/<procedure>, JSON body, bearer key
  key             ARCADE_API_KEY from the environment or <repo>/.env; never argv, never logged
  log             one JSON line per call -> out/calls.jsonl, URL query strings
                  stripped (signed links carry credentials), no Authorization header
  NOT HERE        checkouts/* and orders/* -- paying places a real order; a human does that in
                  Studio. The client refuses those procedures outright.

  python tools/arcade/arcade.py --selftest           fake transport, no network, no key
  python tools/arcade/arcade.py categories            live: list categories (needs the key)
  python tools/arcade/arcade.py categories --save     ...and write tools/arcade/categories_live.json,
                                                      which the mock then uses instead of the fixture
"""
from __future__ import annotations
import json, os, re, sys, time, urllib.error, urllib.request, uuid
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
BASE = "https://platform.arcade.ai/v1/"
UA = "gold-arcade/0.1 (aditya.rak173@gmail.com)"
ARCADE_OUT = Path(os.environ.get("ARCADE_OUT") or REPO / "out")
LOG = ARCADE_OUT / "calls.jsonl"
REFUSED = ("checkouts/", "orders/")
POLL_S = 4          # docs: 2-5 s; faster counts against the per-IP limit


class ArcadeError(RuntimeError):
    def __init__(self, status: int, body):
        self.status, self.body = status, body
        msg = body.get("message") if isinstance(body, dict) else body
        super().__init__(f"arcade {status}: {msg}")


def load_key() -> str | None:
    if k := os.environ.get("ARCADE_API_KEY"):
        return k
    env = REPO / ".env"
    if env.exists():
        for line in env.read_text(encoding="utf-8").splitlines():
            if line.strip().startswith("ARCADE_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"\'') or None
    return None


def _strip_queries(x):
    if isinstance(x, str):
        return re.sub(r"(https?://[^\s?\"]+)\?[^\s\"]*", r"\1", x)
    if isinstance(x, dict):
        return {k: _strip_queries(v) for k, v in x.items()}
    if isinstance(x, list):
        return [_strip_queries(v) for v in x]
    return x


def _http(procedure: str, body: dict, key: str) -> tuple[int, object, dict]:
    req = urllib.request.Request(BASE + procedure, data=json.dumps(body).encode(), method="POST",
                                 headers={"Authorization": f"Bearer {key}", "User-Agent": UA,
                                          "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw, status, hdrs = r.read(), r.status, dict(r.headers)
    except urllib.error.HTTPError as e:
        raw, status, hdrs = e.read(), e.code, dict(e.headers or {})
    try:
        return status, json.loads(raw), hdrs
    except ValueError:
        return status, raw.decode("utf-8", "replace"), hdrs


class Arcade:
    def __init__(self, key: str | None = None, transport=_http, log: Path | None = LOG, sleep=time.sleep):
        # NO LIVE CALLS BEFORE THE HACKATHON (Adi, 2026-10-11): the real network transport is
        # refused unless ARCADE_LIVE=1. Fakes/mocks (any other transport) are always allowed.
        if transport is _http and os.environ.get("ARCADE_LIVE") != "1":
            raise SystemExit("Arcade API is OFF until the hackathon: set ARCADE_LIVE=1 to call platform.arcade.ai "
                             "(use the mock transport -- tools/arcade/mock_arcade.py -- before then)")
        self.key = key or load_key()
        if not self.key or not self.key.startswith("arcade_sk_live_"):
            raise SystemExit("ARCADE_API_KEY missing or not an arcade_sk_live_ key "
                             "(studio.arcade.ai -> Settings -> API keys; put it in <repo>/.env)")
        self.transport, self.log, self.sleep = transport, log, sleep

    def call(self, procedure: str, body: dict | None = None):
        if procedure.startswith(REFUSED):
            raise PermissionError(f"{procedure}: ordering is a human step in Arcade Studio, not this client")
        body = body or {}
        t = time.time()
        for attempt in range(4):
            status, resp, hdrs = self.transport(procedure, body, self.key)
            if status != 429 and status < 500:
                break
            # ponytail: fixed backoff honouring Retry-After; jitter if several workers ever share an IP
            self.sleep(max(POLL_S, float(hdrs.get("Retry-After") or 0)) * (attempt + 1))
        if self.log:
            self.log.parent.mkdir(parents=True, exist_ok=True)
            with self.log.open("a", encoding="utf-8") as f:
                f.write(json.dumps(_strip_queries({"ts": t, "procedure": procedure, "request": body,
                                                    "status": status, "ms": round((time.time() - t) * 1000),
                                                    "response": resp})) + "\n")
        if not 200 <= status < 300:
            raise ArcadeError(status, resp)
        return resp

    def wait(self, job_id: str, timeout_s: float = 600):
        t0 = time.time()
        while True:
            job = self.call("jobs/get", {"jobId": job_id})
            if job["status"] in ("succeeded", "failed"):
                return job
            if time.time() - t0 > timeout_s:
                raise TimeoutError(f"job {job_id} still {job['status']} after {timeout_s}s")
            self.sleep(POLL_S)

    def categories(self, world: str | None = None) -> list[dict]:
        items = self.call("categories/list")["items"]
        return [c for c in items if world is None or c["world"] == world]

    def design(self, prompt: str, category_id: str, colors: list[str] | None = None,
               request_id: str | None = None) -> dict:
        """patterns/create with a category -> wait -> products/get. Returns one flat record:
        ok + product (title, selections, unitPrice, images, maker) or ok=False + the reason
        (a failed job's reason is the manufacturability signal: no maker could price it)."""
        body = {"requestId": request_id or f"gold-{uuid.uuid4()}", "prompt": prompt[:1000],
                "categoryId": category_id}
        if colors:                      # print only; jewelry refuses colors
            body["colors"] = colors[:10]
        try:
            job = self.call("patterns/create", body)
        except ArcadeError as e:        # 400 = prompt/category mismatch, no job, no credits
            return {"ok": False, "stage": "admit", "status": e.status, "reason": str(e), "request": body}
        job = self.wait(job["jobId"])
        if job["status"] == "failed" or not job.get("result"):
            return {"ok": False, "stage": "job", "reason": (job.get("error") or {}).get("message"),
                    "jobId": job["jobId"], "request": body}
        product = self.call("products/get", {"productId": job["result"]["productId"]})
        return {"ok": True, "patternId": job["result"]["patternId"], "product": product, "request": body}


def _selftest() -> None:
    calls, slept = [], []
    script = {
        "categories/list": [(200, {"items": [{"categoryId": "r", "name": "Rings", "world": "jewelry", "imageUrl": None},
                                             {"categoryId": "g", "name": "Rug", "world": "print", "imageUrl": None}]}, {})],
        "patterns/create": [(429, {"code": "RATE_LIMITED"}, {"Retry-After": "7"}),
                            (200, {"jobId": "j1", "status": "running"}, {}),
                            (400, {"code": "BAD_REQUEST", "message": "not a ring"}, {})],
        "jobs/get": [(200, {"jobId": "j1", "status": "running"}, {}),
                     (200, {"jobId": "j1", "status": "succeeded", "result": {"patternId": "p1", "productId": "x1"}}, {})],
        "products/get": [(200, {"productId": "x1", "title": "14k Yellow Gold Ring",
                                "imageUrl": "https://cdn.example/a.png?sig=SECRET",
                                "unitPrice": {"amount": "836.00", "currency": "USD"}}, {})],
    }

    def fake(proc, body, key):
        calls.append((proc, body, key))
        return script[proc].pop(0)

    import tempfile
    log = Path(tempfile.mkdtemp()) / "calls.jsonl"
    a = Arcade(key="arcade_sk_live_TESTKEY", transport=fake, log=log, sleep=slept.append)
    assert [c["categoryId"] for c in a.categories("jewelry")] == ["r"]
    rec = a.design("a plain 14k yellow gold band", "r", colors=None, request_id="rid1")
    assert rec["ok"] and rec["product"]["unitPrice"]["amount"] == "836.00", rec
    assert slept[0] == 7, "429 must honour Retry-After"
    assert "colors" not in calls[1][1], "jewelry design must not send colors"
    bad = a.design("a teapot", "r", request_id="rid2")
    assert not bad["ok"] and bad["stage"] == "admit" and bad["status"] == 400
    text = log.read_text(encoding="utf-8")
    assert "TESTKEY" not in text and "SECRET" not in text and "a.png" in text, "log must drop key and signed query"
    for proc in ("checkouts/create", "orders/get"):
        try:
            a.call(proc, {})
            raise AssertionError(f"{proc} must be refused")
        except PermissionError:
            pass
    try:
        Arcade(key="sk-not-arcade", transport=fake, log=None)
        raise AssertionError("non-arcade key must be refused")
    except SystemExit:
        pass
    os.environ.pop("ARCADE_LIVE", None)
    try:
        Arcade(key="arcade_sk_live_TESTKEY", log=None)
        raise AssertionError("the live transport must be refused without ARCADE_LIVE=1")
    except SystemExit as e:
        assert "OFF until the hackathon" in str(e)
    print("arcade.py selftest: 8 checks PASS")


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        _selftest()
    elif sys.argv[1:2] == ["categories"]:
        cats = Arcade().categories()
        if "--save" in sys.argv:
            out = Path(__file__).with_name("categories_live.json")
            out.write_text(json.dumps({"_note": f"categories/list, live, {time.strftime('%Y-%m-%d %H:%M')}",
                                       "items": [{**c, "source": "live"} for c in _strip_queries(cats)]}, indent=1), encoding="utf-8")
            print(f"-> {out} ({len(cats)} categories)")
        for c in cats:
            print(f"{c['world']:8} {c['categoryId']}  {c.get('category', {}).get('name', ''):14} {c['name']}")
    else:
        print(__doc__)
