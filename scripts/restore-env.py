#!/usr/bin/env python3
"""Reconstruct ABN Homes .env from the prior session rollout log.

Reads the JSONL session log, extracts every candidate value for each known
env key, and writes .env using the most frequently occurring (or longest)
candidate. Never prints secret values - only key names and value lengths.
"""
import json
import re
import sys
from collections import Counter

ROLLOUT = "/home/z/.zcode/cli/rollout/model-io-sess_ac5ff1d8-8c8c-488e-9580-c2876425cfc9.jsonl"
OUT = "/home/z/my-project/.env"

KEYS = [
    "DATABASE_URL",
    "DIRECT_URL",
    "AUTH_SECRET",
    "AUTH_URL",
    "AUTH_TRUST_HOST",
    "BASE_CURRENCY",
    "CRON_SECRET",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SECRET_KEY",
]

candidates = {k: Counter() for k in KEYS}

with open(ROLLOUT, "r", encoding="utf-8", errors="replace") as f:
    for line in f:
        if len(line) > 5_000_000:
            continue
        for key in KEYS:
            # KEY=VALUE  (VALUE runs until whitespace / quote / backslash / close-bracket)
            for m in re.finditer(key + r'\s*=\s*([^\s"\',\\)<>]+)', line):
                val = m.group(1).strip().rstrip("\\")
                if len(val) < 3:
                    continue
                candidates[key][val] += 1
            # JSON-escaped key: KEY\n = ... unlikely; also handle \"KEY\":\"VALUE\"
            for m in re.finditer(key + r'\\"\s*:\s*\\"([^"\\]+)\\"', line):
                val = m.group(1)
                if len(val) >= 3:
                    candidates[key][val] += 1


def pick(counter: Counter) -> str | None:
    if not counter:
        return None
    # Prefer most common, tie-break by longest (more complete)
    best = max(counter.items(), key=lambda kv: (kv[1], len(kv[0])))
    return best[0]


lines = []
report = []
for key in KEYS:
    val = pick(candidates[key])
    if val is None:
        report.append((key, "MISSING", 0))
        continue
    lines.append(f"{key}={val}")
    # For URLs show host only in the report; for secrets show length only
    if val.startswith(("http", "postgres")):
        try:
            u = re.match(r"[a-z]+://[^/]+", val)
            shown = u.group(0) if u else val[:12]
        except Exception:
            shown = "<url>"
        report.append((key, shown + "...", len(val)))
    else:
        report.append((key, "<secret>", len(val)))

with open(OUT, "w", encoding="utf-8") as f:
    f.write("\n".join(lines) + "\n")

print(f"Wrote {OUT} with {len(lines)} keys:")
for k, s, n in report:
    print(f"  {k:36s} {s:50s} len={n}")

# Sanity: DATABASE_URL should embed connection_limit for pgbouncer
du = pick(candidates["DATABASE_URL"]) or ""
print("\nDATABASE_URL params:", du.split("?", 1)[1] if "?" in du else "(none)")
print("DIRECT_URL params:", (pick(candidates["DIRECT_URL"]) or "").split("?", 1)[1] if "?" in (pick(candidates["DIRECT_URL"]) or "") else "(none)")
