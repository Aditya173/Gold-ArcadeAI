"""leak_scan.py -- the gate every push to this PUBLIC repo goes through.

Fails if any tracked or staged file
  * matches a term in the private deny list ($GOLD_DENY_LIST, default ~/.config/gold/public_deny.txt; kept OUTSIDE
    this repo because it names private things),
  * is an image or other binary outside an allowlisted assets folder, or
  * looks like a secret (API keys, private keys, service-account JSON).

  python tools/leak_scan.py            # scan everything git would push
  python tools/leak_scan.py --selftest
Install as a pre-push hook:  python tools/leak_scan.py --install-hook
"""
from __future__ import annotations
import os, re, subprocess, sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
BINARY = re.compile(r"\.(jpe?g|png|heic|webp|gif|npy|safetensors|mlpackage|zip|pdf)$", re.I)
# images uploaded at the repo root by the team (demo screenshots, product images) are allowed where they are
ASSET_OK = ("storefront-app/assets/", "marketplace/fixtures/fake_products/images/", "marketplace/fixtures/images/", "docs/screens/")
SECRETS = [re.compile(p) for p in (r"sk-ant-[A-Za-z0-9_-]{20,}", r"arcade_sk_live_[A-Za-z0-9]{8,}",
                                   r"-----BEGIN [A-Z ]*PRIVATE KEY-----", r'"private_key_id"\s*:', r"AIza[0-9A-Za-z_-]{30,}")]


def deny_terms(path: str | None) -> list[re.Pattern]:
    if not path or not Path(path).exists():
        raise SystemExit("GOLD_DENY_LIST is not set or missing: refusing to call the repo clean without it")
    return [re.compile(l.strip(), re.I) for l in Path(path).read_text(encoding="utf-8").splitlines()
            if l.strip() and not l.lstrip().startswith("#")]


def files() -> list[str]:
    out = subprocess.run(["git", "-C", str(REPO), "ls-files", "--cached", "--others", "--exclude-standard"],
                         capture_output=True, text=True, check=True).stdout.split("\n")
    return [f for f in out if f and (REPO / f).is_file()]


def scan(paths: list[str], terms: list[re.Pattern], read=lambda p: (REPO / p).read_text(encoding="utf-8", errors="replace")) -> list[str]:
    bad = []
    for p in paths:
        if p == "tools/leak_scan.py":
            continue
        if BINARY.search(p) and not (p.startswith(ASSET_OK) or "/" not in p):
            bad.append(f"{p}: binary/image file")
            continue
        if BINARY.search(p):
            continue
        text = read(p)
        # generated dependency lock files list third-party package names ("decoder", ...), not our
        # content: secrets are still checked, deny terms are not
        lock = p.endswith(("package-lock.json", "yarn.lock", "pnpm-lock.yaml"))
        for t in ([] if lock else terms):
            for m in t.finditer(text):
                line = text.count("\n", 0, m.start()) + 1
                bad.append(f"{p}:{line}: deny term /{t.pattern}/ -> {m.group(0)!r}")
                break
        for s in SECRETS:
            if s.search(text):
                bad.append(f"{p}: looks like a secret ({s.pattern[:24]}...)")
    return bad


def selftest() -> None:
    terms = [re.compile("secretplace", re.I)]
    docs = {"a.md": "fine", "b.md": "we went to SecretPlace", "c.jpg": "", "d.md": "key sk-ant-" + "x" * 30,
            "storefront-app/assets/icon.png": "", "x/package-lock.json": "secretplace-decoder", "root.png": "",
            "deep/dir/c2.jpg": ""}
    bad = scan(list(docs), terms, read=lambda p: docs[p])
    assert any(b.startswith("b.md:1") for b in bad) and any(b.startswith("deep/dir/c2.jpg") for b in bad)
    assert not any(b.startswith(("c.jpg", "root.png")) for b in bad), "root-level images are allowed"
    assert any(b.startswith("d.md") and "secret" in b for b in bad)
    assert not any(b.startswith(("a.md", "storefront-app/assets", "x/package-lock.json")) for b in bad), bad
    print("leak_scan selftest: 6 checks PASS")


def main() -> int:
    if "--selftest" in sys.argv:
        selftest(); return 0
    if "--install-hook" in sys.argv:
        hook = REPO / ".git" / "hooks" / "pre-push"
        hook.write_text(f'#!/bin/sh\n"{sys.executable}" "{REPO / "tools" / "leak_scan.py"}" || exit 1\n', encoding="utf-8")
        print(f"installed {hook}"); return 0
    default = Path.home() / ".config" / "gold" / "public_deny.txt"     # private, never in this repo
    bad = scan(files(), deny_terms(os.environ.get("GOLD_DENY_LIST") or str(default)))
    for b in bad:
        print(b)
    print(f"leak_scan: {'CLEAN' if not bad else f'{len(bad)} problem(s)'}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
