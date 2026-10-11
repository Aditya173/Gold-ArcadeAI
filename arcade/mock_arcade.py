"""mock_arcade.py -- a local stand-in for platform.arcade.ai (the published OpenAPI spec, offline).

NO ARCADE CALLS BEFORE THE HACKATHON. Everything that would talk to Arcade talks to this instead:

  python transport   from mock_arcade import mock_transport
                     Arcade(key="arcade_sk_live_MOCK", transport=mock_transport, sleep=lambda s: None)
  local HTTP server  python tools/arcade/mock_arcade.py --serve 8787
                     -> POST http://127.0.0.1:8787/v1/<procedure>, JSON body, Bearer arcade_sk_live_...
                     (point the Functions emulator's ARCADE_BASE_URL at http://127.0.0.1:8787/v1)
  selftest           python tools/arcade/mock_arcade.py --selftest

What it does
  * validates every request body against the request schema in tools/arcade/openapi.json
    (required, maxLength 1000 prompt, <=10 colors, <=3 referenceIds, ...), plus the docs' rules
    the schema can't say: no colors/referenceIds/modelId on a jewelry category, products/create
    refuses jewelry. Bad body -> 400 {code: BAD_REQUEST, fieldErrors}. (Mock's choice of code;
    the live API may answer 422 for schema errors.)
  * spec-shaped responses: jobs created `running`, `succeeded` after N jobs/get polls (default 2),
    patternId + productId, products/get with a placeholder image, a mock maker, and a unitPrice
    from PRICE MODEL below. Every price object carries "mock": true. A mock price is never real.
  * idempotency like the docs: same requestId + same body replays; different body -> 409.
  * categories from tools/arcade/categories_fixture.json (each entry "source": docs|inferred), or
    from categories_live.json once `arcade.py categories --save` has run on hackathon day.
  * checkouts/create answers with a mock checkoutUrl (the app stops there); orders/get is 404.
  * fault injection, one per call:  admission (400 prompt/category mismatch) | job_fail (job fails
    "no maker can price this design") | rate_limit (429, Retry-After: 1) | unauthorized (401).
    Python: mock.inject("patterns/create", "job_fail")   HTTP: header  X-Mock-Fault: job_fail
"""
from __future__ import annotations
import itertools, json, re, sys, threading, time, uuid
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

from jsonschema import Draft202012Validator

HERE = Path(__file__).resolve().parent
SPEC = json.loads((HERE / "openapi.json").read_text(encoding="utf-8"))
FIXTURE = HERE / "categories_fixture.json"
LIVE_CATS = HERE / "categories_live.json"   # `arcade.py categories --save` on hackathon day; wins when present
FAULTS = ("admission", "job_fail", "rate_limit", "unauthorized")
NO_MAKER = "no maker can price this design"

# PRICE MODEL (mock). Basis, brief §2.1: ~$100 simple pieces, >$1,000 complex, $836 = the docs'
# plain 14k ring. 14k gold base per category; silver/brass scale it down; each complexity word
# (stones, pave, engraving...) adds 20%. Print goods are flat. ponytail: word heuristic, replace
# with real products/get prices once the hackathon has a few. Rug: TechCrunch (2025-03-24) put a
# hand-tufted 3x9 ft rug at about $400; a 5x8 is ~1.5x the area, so ~$600 (was $180, too low).
BASE_USD = {"Rings": 836, "Pendant Necklace": 690, "Earrings": 540, "Rug": 600, "Throw Pillow": 65,
            "Wall Art Print": 45, "Textile": 55, "Ceramic Plate": 70}
METAL = (("sterling", 0.15), ("silver", 0.15), ("brass", 0.12))
COMPLEX = ("diamond", "sapphire", "emerald", "ruby", "gemstone", "pavé", "pave", "halo",
           "engraved", "engraving", "filigree", "enamel", "cluster")


def price(cat: dict, prompt: str) -> dict:
    p = (prompt or "").lower()
    usd = BASE_USD.get(cat["name"], 600 if cat["world"] == "jewelry" else 60)
    if cat["world"] == "jewelry":
        usd *= next((f for w, f in METAL if w in p), 1.0)
        pos = re.sub(r"\b(?:no|without|non)[- ]+\w+(?:\s+(?:or|and|nor)\s+\w+)*", " ", p)  # "no engraving" is not engraving
        usd *= 1 + 0.2 * sum(w in pos for w in COMPLEX)
    return {"amount": f"{usd:.2f}", "currency": "USD", "mock": True,
            "basis": "mock price model (brief §2.1), not an Arcade price"}


def _schema(proc: str, part: str):
    op = SPEC["paths"].get("/" + proc, {}).get("post")
    if not op:
        return None
    node = op["requestBody"] if part == "request" else op["responses"]["200"]
    return node["content"]["application/json"]["schema"]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _err(status, code, message, **extra):
    return status, {"code": code, "message": message, **extra}, {}


OPTIONS = {"jewelry": [("metal", "Metal", ["14k-yellow-gold", "14k-white-gold", "sterling-silver"])],
           "print": [("size", "Size", ["small", "medium", "large"])]}


class MockArcade:
    """Callable as an arcade.Arcade transport: (procedure, body, key) -> (status, json, headers)."""

    def __init__(self, polls: int = 2, image_base: str = "https://mock.arcade.invalid/", categories: Path | None = None):
        self.polls, self.image_base = polls, image_base
        cats = categories or (LIVE_CATS if LIVE_CATS.exists() else FIXTURE)
        self.categories = {c["categoryId"]: c for c in json.loads(cats.read_text(encoding="utf-8"))["items"]}
        self.jobs, self.patterns, self.products, self.seen, self.faults = {}, {}, {}, {}, {}
        self._ids = itertools.count(9000001)
        self.lock = threading.Lock()

    def inject(self, procedure: str, fault: str) -> None:
        assert fault in FAULTS, fault
        self.faults.setdefault(procedure, []).append(fault)

    def __call__(self, procedure: str, body: dict, key: str | None, fault: str | None = None):
        with self.lock:
            if fault is None and self.faults.get(procedure):
                fault = self.faults[procedure].pop(0)
            return self._handle(procedure, body or {}, key, fault)

    # ---- dispatch -------------------------------------------------------------------------
    def _handle(self, proc, body, key, fault):
        if fault == "unauthorized" or not (key or "").startswith("arcade_sk_live_"):
            return _err(401, "UNAUTHORIZED", "API key missing, invalid, expired or revoked (mock)")
        if fault == "rate_limit":
            return 429, {"code": "RATE_LIMITED", "message": "slow down (mock)"}, {"Retry-After": "1"}
        schema = _schema(proc, "request")
        if schema is None:
            return _err(404, "NOT_FOUND", f"no procedure {proc}")
        errs = [{"path": "/".join(map(str, e.absolute_path)) or "(body)", "message": e.message[:300]}
                for e in Draft202012Validator(schema).iter_errors(body)]
        if errs:
            return _err(400, "BAD_REQUEST", "request body does not match the spec (mock)", fieldErrors=errs)
        if "requestId" in body:                         # idempotency, docs §Common gotchas
            canon = json.dumps(body, sort_keys=True)
            if (proc, body["requestId"]) in self.seen:
                prev, out = self.seen[(proc, body["requestId"])]
                if prev != canon:
                    return _err(409, "CONFLICT", "requestId reused with a different body")
                return out() if callable(out) else out
        fn = getattr(self, "_" + proc.replace("/", "_"), None)
        if fn is None:
            return _err(501, "NOT_IMPLEMENTED", f"{proc} is in the spec but not in the mock")
        out = fn(body, fault)
        if "requestId" in body and 200 <= out[0] < 300:
            jid = out[1].get("jobId")
            self.seen[(proc, body["requestId"])] = (canon, (lambda: (200, self._job(jid), {})) if jid else out)
        return out

    def _cat(self, cid):
        return self.categories.get(cid)

    def _categories_list(self, body, fault):
        return 200, {"items": list(self.categories.values())}, {}

    def _selections(self, cat, sent):
        opts, sel, ok = OPTIONS[cat["world"]], {}, True
        for k, _, vals in opts:
            v = sent.get(k, vals[0])
            ok &= v in vals
            sel[k] = v if v in vals else vals[0]
        return opts, sel, ok and set(sent) <= {k for k, _, _ in opts}

    def _categories_get(self, body, fault):
        cat = self._cat(body["categoryId"])
        if not cat:
            return _err(404, "NOT_FOUND", "unknown categoryId")
        opts, sel, ok = self._selections(cat, body.get("selections") or {})
        options = [{"key": k, "label": lab, "values": [{"value": v, "label": v.replace("-", " "),
                    "isDefault": i == 0, "available": True} for i, v in enumerate(vals)]} for k, lab, vals in opts]
        return 200, {**{k: cat[k] for k in ("categoryId", "name", "world")}, "options": options,
                     "selections": sel, "canManufacture": ok}, {}

    def _new_job(self, kind, result, fail=None):
        jid = f"mock-job-{uuid.uuid4().hex[:12]}"
        self.jobs[jid] = {"kind": kind, "result": result, "fail": fail, "polls": 0, "createdAt": _now(), "completedAt": None}
        return 200, self._job(jid), {}

    def _job(self, jid):
        j = self.jobs[jid]
        done = j["polls"] >= self.polls
        status = "running" if not done else ("failed" if j["fail"] else "succeeded")
        if done and not j["completedAt"]:
            j["completedAt"] = _now()
            if not j["fail"]:
                j["result"]["register"]()
        result = None if status != "succeeded" else {k: v for k, v in j["result"].items() if k != "register"}
        return {"jobId": jid, "kind": j["kind"], "status": status, "result": result,
                "error": {"message": j["fail"]} if status == "failed" else None,
                "createdAt": j["createdAt"], "completedAt": j["completedAt"] if status == "succeeded" else None}

    def _jobs_get(self, body, fault):
        if body["jobId"] not in self.jobs:
            return _err(404, "NOT_FOUND", "unknown jobId")
        self.jobs[body["jobId"]]["polls"] += 1
        return 200, self._job(body["jobId"]), {}

    def _make_product(self, prid, pid, cat, prompt, selections):
        img = f"{self.image_base}placeholder/{prid}.svg"
        self.products[prid] = {
            "productId": prid, "title": f"{cat['name']} (mock)", "categoryId": cat["categoryId"],
            "maker": {"makerId": "mock-maker", "name": "Mock Maker (not a real maker)"},
            "selections": selections, "selectionLabel": ", ".join(v.replace("-", " ") for v in selections.values()),
            "imageUrl": img, "createdAt": _now(), "images": [{"url": img}],
            "description": "Mock product: no Arcade design exists yet.", "careInstructions": "",
            "volumeDiscounts": None, "patternId": pid, "unitPrice": price(cat, prompt)}

    def _patterns_create(self, body, fault):
        cat = None
        if "categoryId" in body:
            cat = self._cat(body["categoryId"])
            if not cat:
                return _err(400, "BAD_REQUEST", "unknown categoryId",
                            fieldErrors=[{"path": "categoryId", "message": "not in categories/list"}])
            if cat["world"] == "jewelry":
                bad = [k for k in ("colors", "referenceIds", "modelId") if body.get(k)]
                if bad:
                    return _err(400, "BAD_REQUEST", f"a jewelry design takes no {', '.join(bad)}",
                                fieldErrors=[{"path": k, "message": "not allowed for a jewelry category"} for k in bad])
                if fault == "admission":
                    return _err(400, "BAD_REQUEST", f"This prompt does not describe a {cat['name']} piece (mock admission)")
        if fault == "admission" and not (cat and cat["world"] == "jewelry"):
            return _err(400, "BAD_REQUEST", "prompt/category mismatch (mock admission)")
        pid, prid = f"mock-pattern-{uuid.uuid4().hex[:12]}", f"mock-product-{uuid.uuid4().hex[:12]}"

        def register():
            self.patterns[pid] = {"patternId": pid, "imageUrl": f"{self.image_base}placeholder/{pid}.svg",
                                  "thumbnailUrl": f"{self.image_base}placeholder/{pid}.svg", "width": 1024, "height": 1024,
                                  "prompt": body["prompt"], "sourcePatternId": None, "createdAt": _now(),
                                  "jewelry": bool(cat and cat["world"] == "jewelry")}
            if cat:
                self._make_product(prid, pid, cat, body["prompt"], self._selections(cat, {})[1])
        result = {"patternId": pid, "register": register, **({"productId": prid} if cat else {})}
        return self._new_job("pattern", result, NO_MAKER if fault == "job_fail" else None)

    def _patterns_get(self, body, fault):
        p = self.patterns.get(body["patternId"])
        return (200, {k: v for k, v in p.items() if k != "jewelry"}, {}) if p else _err(404, "NOT_FOUND", "unknown patternId")

    def _products_create(self, body, fault):
        cat, pat = self._cat(body["categoryId"]), self.patterns.get(body["patternId"])
        if not cat or not pat:
            return _err(404, "NOT_FOUND", "unknown categoryId or patternId")
        if cat["world"] == "jewelry" or pat["jewelry"]:
            return _err(400, "BAD_REQUEST", "products/create does not make jewelry; use patterns/create with the categoryId")
        _, sel, ok = self._selections(cat, body["selections"])
        if not ok or sel != body["selections"]:
            return _err(400, "BAD_REQUEST", "selections must be the complete object from categories/get")
        prid = f"mock-product-{uuid.uuid4().hex[:12]}"
        result = {"productId": prid, "register": lambda: self._make_product(prid, pat["patternId"], cat, pat["prompt"], sel)}
        return self._new_job("product", result, NO_MAKER if fault == "job_fail" else None)

    def _products_get(self, body, fault):
        p = self.products.get(body["productId"])
        return (200, p, {}) if p else _err(404, "NOT_FOUND", "unknown productId")

    def _checkouts_create(self, body, fault):
        missing = [l["productId"] for l in body["lines"] if l["productId"] not in self.products]
        if missing:
            return _err(404, "NOT_FOUND", f"unknown productId {missing[0]}")
        cid = str(next(self._ids))
        return 200, {"checkoutId": cid, "checkoutUrl": f"{self.image_base}checkout/{cid}", "mock": True}, {}

    def _orders_get(self, body, fault):
        return _err(404, "NOT_FOUND", "no order: a mock checkout is never paid")


mock_transport = MockArcade()

PLACEHOLDER = ('<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="100%" height="100%" '
               'fill="#ddd"/><text x="50%" y="50%" text-anchor="middle" font-family="sans-serif" font-size="28" '
               'fill="#555">MOCK - not an Arcade design</text></svg>').encode()


def serve(port: int, mock: MockArcade | None = None, ready: threading.Event | None = None, box: list | None = None):
    mock = mock or MockArcade(image_base=f"http://127.0.0.1:{port}/mock/")

    class H(BaseHTTPRequestHandler):
        def _send(self, status, payload, hdrs=None, ctype="application/json"):
            data = payload if isinstance(payload, bytes) else json.dumps(payload).encode()
            self.send_response(status)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(data)))
            for k, v in (hdrs or {}).items():
                self.send_header(k, v)
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            if self.path.startswith("/mock/placeholder/"):
                return self._send(200, PLACEHOLDER, ctype="image/svg+xml")
            self._send(404, {"code": "NOT_FOUND", "message": "POST /v1/<procedure>"})

        def do_POST(self):
            if not self.path.startswith("/v1/"):
                return self._send(404, {"code": "NOT_FOUND", "message": "POST /v1/<procedure>"})
            try:
                raw = self.rfile.read(int(self.headers.get("Content-Length") or 0))
                body = json.loads(raw) if raw.strip() else {}
            except ValueError:
                return self._send(400, {"code": "BAD_REQUEST", "message": "body is not JSON"})
            auth = self.headers.get("Authorization") or ""
            key = auth[7:] if auth.startswith("Bearer ") else None
            fault = self.headers.get("X-Mock-Fault")
            if fault and fault not in FAULTS:
                return self._send(400, {"code": "BAD_REQUEST", "message": f"X-Mock-Fault must be one of {FAULTS}"})
            self._send(*mock(self.path[4:].split("?")[0], body, key, fault=fault))

        def log_message(self, *a):
            pass

    httpd = HTTPServer(("127.0.0.1", port), H)
    if box is not None:
        box.append(httpd)
    if ready:
        ready.set()
    if not ready:
        print(f"mock Arcade on http://127.0.0.1:{httpd.server_port}/v1  (ARCADE_BASE_URL); Ctrl-C stops")
    httpd.serve_forever()


# ---- selftest ---------------------------------------------------------------------------------
def _selftest() -> None:
    import tempfile, urllib.error, urllib.request
    sys.path.insert(0, str(HERE))
    from arcade import Arcade
    n = 0

    def ok(cond, what):
        nonlocal n
        assert cond, what
        n += 1

    def shaped(proc, resp):           # the mock's 200s must match the spec's response schema
        errs = list(Draft202012Validator(_schema(proc, "response")).iter_errors(resp))
        ok(not errs, f"{proc} response not spec-shaped: {[e.message for e in errs[:3]]}")

    K, m = "arcade_sk_live_MOCK", MockArcade(polls=2, categories=FIXTURE)
    fix = json.loads(FIXTURE.read_text(encoding="utf-8"))["items"]
    ok(all(c["source"] in ("docs", "inferred") for c in fix), "every fixture entry names its source")
    ok({c["name"] for c in fix if c["source"] == "docs"} == {"Rings", "Pendant Necklace"}, "docs examples present")
    ring, pend, rug = "8e1f5c3a-0000-4000-8000-000000000001", "b52d9e07-0000-4000-8000-000000000002", "inferred-rug"

    # validation
    st, r, _ = m("patterns/create", {"prompt": "x"}, K)
    ok(st == 400 and any("requestId" in e["message"] for e in r["fieldErrors"]), "missing requestId -> 400")
    ok(m("patterns/create", {"requestId": "a", "prompt": "x" * 1001}, K)[0] == 400, "prompt > 1000 -> 400")
    ok(m("patterns/create", {"requestId": "a", "prompt": "x", "colors": ["#000000"] * 11, "categoryId": rug}, K)[0] == 400, ">10 colors -> 400")
    ok(m("patterns/create", {"requestId": "a", "prompt": "x", "referenceIds": ["r"] * 4}, K)[0] == 400, ">3 referenceIds -> 400")
    st, r, _ = m("patterns/create", {"requestId": "a", "prompt": "ring", "categoryId": ring, "colors": ["#c9a227"]}, K)
    ok(st == 400 and r["fieldErrors"][0]["path"] == "colors", "colors on jewelry -> 400")
    ok(m("patterns/create", {"requestId": "a", "prompt": "ring", "categoryId": pend, "referenceIds": ["r1"]}, K)[0] == 400, "referenceIds on jewelry -> 400")
    ok(m("jobs/get", {}, K)[0] == 400 and m("products/get", {"productId": ""}, K)[0] == 400, "other procedures validated too")
    st, r, _ = m("categories/list", {}, K)
    shaped("categories/list", r)
    st, r, _ = m("categories/get", {"categoryId": rug, "selections": {}}, K)
    ok(r["canManufacture"], "categories/get fills a complete selection")
    shaped("categories/get", r)

    # job lifecycle through the real client, and the price model
    a = Arcade(key=K, transport=m, log=None, sleep=lambda s: None)
    rec = a.design("a plain 14k yellow gold band", ring, request_id="docs-ring")
    ok(rec["ok"] and rec["product"]["unitPrice"] == {**rec["product"]["unitPrice"], "amount": "836.00", "mock": True}, f"docs ring = $836 mock: {rec}")
    shaped("products/get", rec["product"])
    ok(float(a.design("14k gold ring, diamond pave halo, engraved", ring)["product"]["unitPrice"]["amount"]) > 1000, "complex piece > $1,000")
    ok(float(a.design("a small sterling silver disc pendant", pend)["product"]["unitPrice"]["amount"]) < 150, "simple silver ~ $100")
    pc = {"name": "Pendant Necklace", "world": "jewelry"}
    ok(price(pc, "14k gold pendant. No stones, no engraving, no text.")["amount"] == "690.00" and price(pc, "14k pendant, engraved")["amount"] == "828.00", "negated complexity words are free")
    j = m("patterns/create", {"requestId": "life", "prompt": "terracotta stripes", "categoryId": rug, "colors": ["#c65d3b"]}, K)[1]
    shaped("patterns/create", j)
    s1, s2 = (m("jobs/get", {"jobId": j["jobId"]}, K)[1] for _ in range(2))
    ok(j["status"] == s1["status"] == "running" and s1["result"] is None, "job starts running")
    ok(s2["status"] == "succeeded" and s2["result"]["productId"] and s2["completedAt"], "succeeds after N polls")
    shaped("jobs/get", s1); shaped("jobs/get", s2)
    shaped("patterns/get", m("patterns/get", {"patternId": s2["result"]["patternId"]}, K)[1])
    ok(m("patterns/create", {"requestId": "life", "prompt": "terracotta stripes", "categoryId": rug, "colors": ["#c65d3b"]}, K)[1]["jobId"] == j["jobId"], "same requestId+body replays")
    ok(m("patterns/create", {"requestId": "life", "prompt": "other"}, K)[0] == 409, "same requestId, new body -> 409")
    sel = m("categories/get", {"categoryId": rug, "selections": {"size": "large"}}, K)[1]["selections"]
    pj = m("products/create", {"requestId": "pc", "patternId": s2["result"]["patternId"], "categoryId": rug, "selections": sel}, K)
    ok(pj[0] == 200 and pj[1]["kind"] == "product", "products/create on print")
    ok(m("products/create", {"requestId": "pc2", "patternId": s2["result"]["patternId"], "categoryId": ring, "selections": {"metal": "14k-white-gold"}}, K)[0] == 400, "products/create refuses jewelry")
    ok(m("products/create", {"requestId": "pc3", "patternId": s2["result"]["patternId"], "categoryId": rug, "selections": {}}, K)[0] == 400, "partial selections refused")

    # each fault
    m.inject("patterns/create", "admission")
    bad = a.design("a teapot", ring, request_id="adm")
    ok(not bad["ok"] and bad["stage"] == "admit" and bad["status"] == 400, "admission 400 -> stage admit")
    m.inject("patterns/create", "job_fail")
    bad = a.design("an impossible lattice", pend, request_id="jf")
    ok(not bad["ok"] and bad["stage"] == "job" and bad["reason"] == NO_MAKER, "job failure -> no maker")
    slept = []
    a2 = Arcade(key=K, transport=m, log=None, sleep=slept.append)
    m.inject("categories/list", "rate_limit")
    ok(a2.categories("jewelry") and slept and slept[0] >= 1, "429 retried after Retry-After")
    m.inject("categories/list", "unauthorized")
    try:
        a.categories()
        raise AssertionError("401 must raise")
    except Exception as e:  # noqa: BLE001
        ok(getattr(e, "status", None) == 401, "401 -> ArcadeError")
    ok(m("categories/list", {}, "sk-wrong")[0] == 401, "non-arcade key -> 401")

    # run_designs --mock end to end, on synthetic briefs in a temp dir (no photos, no live)
    import importlib, os
    tmp = Path(tempfile.mkdtemp())
    os.environ.pop("ARCADE_LIVE", None)
    rd = importlib.import_module("run_designs")
    rd.OUT = tmp
    (tmp / "b.json").write_text(json.dumps([
        {"who": "t", "arm": "a", "category": "ring", "prompt": "a plain 14k yellow gold band", "colors": ["#c9a227"]},
        {"who": "t", "arm": "a", "category": "rug", "prompt": "terracotta stripes", "colors": ["#c65d3b"]},
        {"who": "t", "arm": "a", "category": "ceramic", "prompt": "blue rim plate", "colors": []}]), encoding="utf-8")
    argv = sys.argv
    try:
        sys.argv = ["run_designs.py", "--mock", "--briefs", "b.json"]
        ok(rd.main() == 0, "run_designs --mock runs")
        recs = [json.loads(l) for l in (tmp / "designs_mock.jsonl").read_text(encoding="utf-8").splitlines()]
        ok(len(recs) == 3 and all(r["ok"] for r in recs) and "colors" not in recs[0]["request"], f"3 mock designs, jewelry without colors: {recs}")
        ok(not (tmp / "designs.jsonl").exists(), "mock never writes the live designs log")
        ok(rd.main() == 0 and len((tmp / "designs_mock.jsonl").read_text(encoding="utf-8").splitlines()) == 3, "resume skips done briefs")
        sys.argv = ["run_designs.py", "--briefs", "b.json"]
        try:
            rd.main()
            raise AssertionError("run_designs without --mock must refuse live without ARCADE_LIVE")
        except SystemExit as e:
            ok("OFF until the hackathon" in str(e), "live still refused")
    finally:
        sys.argv = argv

    # the HTTP server
    ready, box = threading.Event(), []
    threading.Thread(target=serve, args=(0,), kwargs={"ready": ready, "box": box,
                     "mock": MockArcade(polls=1, image_base="http://127.0.0.1:0/mock/", categories=FIXTURE)}, daemon=True).start()
    ready.wait(5)
    base = f"http://127.0.0.1:{box[0].server_port}"

    def post(proc, body, key=K, fault=None):
        h = {"Content-Type": "application/json", **({"Authorization": f"Bearer {key}"} if key else {}),
             **({"X-Mock-Fault": fault} if fault else {})}
        req = urllib.request.Request(f"{base}/v1/{proc}", data=json.dumps(body).encode(), headers=h, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=10) as r:
                return r.status, json.loads(r.read()), dict(r.headers)
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read()), dict(e.headers)

    ok(post("categories/list", {})[0] == 200, "server: categories/list")
    ok(post("categories/list", {}, key=None)[0] == 401, "server: no key -> 401")
    st, _, h = post("categories/list", {}, fault="rate_limit")
    ok(st == 429 and h.get("Retry-After") == "1", "server: 429 + Retry-After")
    ok(post("patterns/create", {"requestId": "s", "prompt": "x" * 1001})[0] == 400, "server: validation")
    ok(post("patterns/create", {"requestId": "s0", "prompt": "a teapot", "categoryId": ring}, fault="admission")[0] == 400, "server: admission fault")
    jid = post("patterns/create", {"requestId": "s1", "prompt": "a plain 14k gold band", "categoryId": ring})[1]["jobId"]
    job = post("jobs/get", {"jobId": jid})[1]
    st, prod, _ = post("products/get", {"productId": job["result"]["productId"]})
    ok(job["status"] == "succeeded" and prod["unitPrice"]["mock"] is True, "server: lifecycle + mock price")
    fj = post("patterns/create", {"requestId": "s2", "prompt": "x", "categoryId": ring}, fault="job_fail")[1]["jobId"]
    ok(post("jobs/get", {"jobId": fj})[1]["error"]["message"] == NO_MAKER, "server: job_fail fault")
    st, co, _ = post("checkouts/create", {"requestId": "c1", "lines": [{"productId": prod["productId"], "quantity": 1}]})
    ok(st == 200 and co["mock"] and co["checkoutUrl"], "server: checkoutUrl (the app stops here)")
    with urllib.request.urlopen(f"{base}/mock/placeholder/x.svg", timeout=10) as r:
        ok(b"MOCK" in r.read(), "server: placeholder image")
    box[0].shutdown()
    print(f"mock_arcade selftest: {n} checks PASS")


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        _selftest()
    elif "--serve" in sys.argv:
        i = sys.argv.index("--serve")
        serve(int(sys.argv[i + 1]) if len(sys.argv) > i + 1 else 8787)
    else:
        print(__doc__)
