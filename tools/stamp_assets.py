#!/usr/bin/env python3
"""Add a content-based version to every css/js link in the pages (style.css?v=1a2b3c4d),
so browsers fetch new files right after a deploy even if they cached the old ones.
Run from the repo root after changing css/ or js/:  python3 tools/stamp_assets.py"""
import hashlib, pathlib, re
root = pathlib.Path(__file__).resolve().parent.parent
assets = {p: hashlib.sha1((root / p).read_bytes()).hexdigest()[:8] for p in ["css/style.css", "js/main.js", "js/config.js"]}
for page in sorted(root.glob("*.html")):
    s = page.read_text()
    t = s
    for path, v in assets.items():
        t = re.sub(r'(["\'])' + re.escape(path) + r'(?:\?v=[0-9a-f]+)?\1', lambda m: f'{m.group(1)}{path}?v={v}{m.group(1)}', t)
    if t != s:
        page.write_text(t)
        print("stamped", page.name)
