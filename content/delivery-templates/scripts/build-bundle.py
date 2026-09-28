#!/usr/bin/env python3
"""Regenerate bundle.json from chapter markdown + disclaimer + open-points-rules."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = json.loads((ROOT / "chapter-schema.json").read_text(encoding="utf-8"))
DISCLAIMER = (ROOT / "disclaimer.txt").read_text(encoding="utf-8").strip()
OP_RULES = json.loads((ROOT / "open-points-rules.json").read_text(encoding="utf-8"))
VERSION = (ROOT / "VERSION").read_text(encoding="utf-8").strip()

chapters_out = []
cover_md = None

for ch in sorted(SCHEMA["chapters"], key=lambda c: c["order"]):
    path = ROOT / ch["templateFile"]
    md = path.read_text(encoding="utf-8")
    if ch.get("role") == "cover" or ch["id"] == "00-cover":
        cover_md = md
        continue
    chapters_out.append(
        {
            "id": ch["id"],
            "file": ch["templateFile"],
            "title": ch["title"],
            "markdown": md,
        }
    )

if cover_md is None:
    raise SystemExit("cover chapter missing")

bundle = {
    "version": VERSION,
    "disclaimer": DISCLAIMER,
    "coverMarkdown": cover_md,
    "chapters": chapters_out,
    "openPointsRules": OP_RULES,
    "defaultDocumentVersion": SCHEMA.get("defaultVersion", "1.0"),
}

out = ROOT / "bundle.json"
out.write_text(json.dumps(bundle, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Wrote {out} ({len(chapters_out)} chapters + cover, version {VERSION})")
