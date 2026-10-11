"""scrape.py -- pull a public Instagram account's recent post images for brand onboarding.

Uses gallery-dl (pip install gallery-dl), logged OUT: no account, no cookies. Tested 2026-10-11 against a public
creator account: first image of the latest 12 posts in ~13 s. Instaloader was also tried and got HTTP 429 on its
first request, so it isn't used.

  latest posts -> first image of each (carousels contribute one) -> videos skipped -> pinned posts dropped
  -> newest first -> at most `max_images` -> each shrunk to <= 1600 px JPEG under 1 MB (Arcade takes up to 10 MiB;
  the backend's JSON body is the real cap)

Fragile by nature: Instagram can start blocking logged-out access at any time. Callers must keep the upload
fallback. INSTAGRAM_SCRAPE_FAKE=1 serves generated images through the same pipeline (tests, offline demo).

  python instagram/scrape.py --handle wishbonekitchen --out /tmp/ig --json
  python instagram/scrape.py --selftest
"""
from __future__ import annotations
import argparse, io, json, os, re, subprocess, sys, tempfile
from pathlib import Path

HANDLE = re.compile(r"^[A-Za-z0-9._]{1,30}$")     # validated BEFORE it is put in a URL or a command line
MAX_SIDE, MAX_BYTES = 1600, 1_000_000


class ScrapeError(RuntimeError):
    pass


def clean_handle(h: str) -> str:
    h = (h or "").strip().lstrip("@")
    if not HANDLE.match(h):
        raise ValueError("not an Instagram handle (letters, numbers, . and _, up to 30)")
    return h


def _download(handle: str, posts: int, raw: Path) -> None:
    """gallery-dl into `raw`: first image of each of the latest `posts` posts, with metadata JSON beside it."""
    cmd = [sys.executable, "-m", "gallery_dl", "--post-range", f"1-{posts}", "--filter", "num <= 1",
           "-o", "extractor.instagram.videos=false", "-o", "extractor.instagram.include=posts",
           "--write-metadata", "-D", str(raw), f"https://www.instagram.com/{handle}/"]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=120, encoding="utf-8", errors="replace")
    except subprocess.TimeoutExpired:
        raise ScrapeError("Instagram did not answer within 120 s")
    if r.returncode != 0 and not list(raw.glob("*.jpg")):
        tail = (r.stderr or r.stdout).strip().splitlines()[-1:] or ["no output"]
        raise ScrapeError(f"gallery-dl failed: {tail[0][:200]}")


def _fake(raw: Path) -> None:
    """Generated stand-ins with gallery-dl's file + metadata layout (one is pinned, one is old)."""
    from PIL import Image
    days = ["2026-10-08 13:34:23", "2026-09-25 11:44:09", "2026-09-18 16:50:29", "2026-08-20 14:49:46", "2024-08-12 12:58:20"]
    cols = [(200, 71, 45), (237, 210, 122), (243, 234, 215), (122, 122, 58), (90, 34, 48)]
    for i, (d, c) in enumerate(zip(days, cols)):
        stem = f"30000000000000000{i}_10000000000000000{i}"
        Image.new("RGB", (3024, 4032), c).save(raw / f"{stem}.jpg", quality=95)
        (raw / f"{stem}.jpg.json").write_text(json.dumps({
            "post_id": f"30000000000000000{i}", "post_shortcode": f"FAKE{i}", "num": 1, "date": d,
            "pinned": i == 4, "description": f"fake caption {i}", "width": 3024, "height": 4032}), encoding="utf-8")


def _shrink(src: Path, dst: Path) -> tuple[int, int, int]:
    from PIL import Image, ImageOps
    im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
    im.thumbnail((MAX_SIDE, MAX_SIDE))
    for q in (85, 75, 65, 55):
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=q, optimize=True)
        if buf.tell() <= MAX_BYTES:
            break
    dst.write_bytes(buf.getvalue())
    return im.width, im.height, buf.tell()


def scrape(handle: str, out: Path, posts: int = 12, max_images: int = 6, drop_pinned: bool = True) -> dict:
    handle = clean_handle(handle)
    out.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        raw = Path(tmp)
        (_fake if os.environ.get("INSTAGRAM_SCRAPE_FAKE") == "1" else lambda r: _download(handle, posts, r))(raw)
        rows = []
        for meta in raw.glob("*.json"):
            m = json.loads(meta.read_text(encoding="utf-8"))
            img = raw / meta.name[:-5]                      # "<file>.jpg.json" -> "<file>.jpg"
            if not img.exists() or (drop_pinned and m.get("pinned")) or int(m.get("num") or 1) > 1:
                continue
            rows.append((m, img))
        rows.sort(key=lambda r: str(r[0].get("date") or ""), reverse=True)
        images = []
        for m, img in rows[:max_images]:
            mid = str(m.get("post_id") or m.get("media_id") or img.stem.split("_")[0])
            dst = out / f"{mid}.jpg"
            w, h, n = _shrink(img, dst)
            images.append({"mediaId": mid, "shortcode": m.get("post_shortcode") or m.get("shortcode"),
                           "takenAt": str(m.get("date") or ""), "caption": (m.get("description") or "")[:300],
                           "file": str(dst), "mediaType": "image/jpeg", "byteLength": n, "width": w, "height": h})
    if not images:
        raise ScrapeError("no public image posts found (private account, only videos, or Instagram blocked the request)")
    return {"handle": handle, "source": "fake" if os.environ.get("INSTAGRAM_SCRAPE_FAKE") == "1" else "gallery-dl",
            "images": images}


def selftest() -> None:
    os.environ["INSTAGRAM_SCRAPE_FAKE"] = "1"
    with tempfile.TemporaryDirectory() as d:
        r = scrape("@wishbonekitchen", Path(d), max_images=6)
        assert r["handle"] == "wishbonekitchen" and r["source"] == "fake"
        assert len(r["images"]) == 4, "the pinned post is dropped"
        assert [i["takenAt"][:10] for i in r["images"]][0] == "2026-10-08", "newest first"
        assert all(max(i["width"], i["height"]) <= MAX_SIDE and i["byteLength"] <= MAX_BYTES for i in r["images"])
        assert len(scrape("wishbonekitchen", Path(d), max_images=2)["images"]) == 2
    for bad in ("", "a b", "x" * 31, "../etc", "--range", "user;rm"):
        try:
            clean_handle(bad)
            raise AssertionError(f"{bad!r} must be refused")
        except ValueError:
            pass
    print("instagram scrape selftest: 6 checks PASS")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")          # captions carry emoji; Windows defaults to cp1252
    ap = argparse.ArgumentParser()
    ap.add_argument("--handle"); ap.add_argument("--out"); ap.add_argument("--posts", type=int, default=12)
    ap.add_argument("--max", type=int, default=6); ap.add_argument("--keep-pinned", action="store_true")
    ap.add_argument("--json", action="store_true"); ap.add_argument("--selftest", action="store_true")
    a = ap.parse_args()
    if a.selftest:
        selftest(); sys.exit(0)
    try:
        res = scrape(a.handle, Path(a.out or tempfile.mkdtemp()), a.posts, a.max, not a.keep_pinned)
    except ValueError as e:
        print(json.dumps({"error": {"code": "invalid-argument", "message": str(e)}})); sys.exit(2)
    except ScrapeError as e:
        print(json.dumps({"error": {"code": "unavailable", "message": str(e)}})); sys.exit(3)
    print(json.dumps(res, ensure_ascii=False) if a.json else "\n".join(f"{i['takenAt']}  {i['file']}  {i['byteLength']//1024} KB" for i in res["images"]))
