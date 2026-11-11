"""Codemod: apply TX_OPTS to every interactive $transaction call in src/.

Prisma's interactive-transaction default (5s) is too tight over the Supabase
pooler; every `db.$transaction(...)` call site gets `, TX_OPTS` appended and
`TX_OPTS` is added to the existing '@/lib/db' import.

Usage: python scripts/codemod_tx_opts.py
"""

import os
import re
import sys

SRC = "/home/z/my-project/src"
CALL_RE = re.compile(r"db\.\$transaction\s*\(")


def find_call_close(text: str, open_idx: int) -> int:
    """Index of the ')' matching the '(' at open_idx, skipping strings."""
    depth = 0
    i = open_idx
    quote = None
    while i < len(text):
        ch = text[i]
        if quote:
            if ch == "\\":
                i += 2
                continue
            if ch == quote:
                quote = None
        elif ch in "'\"`":
            quote = ch
        elif ch in "([{":
            depth += 1
        elif ch in ")]}":
            depth -= 1
            if depth == 0:
                return i
        i += 1
    raise ValueError("unbalanced")


def main() -> None:
    changed_files = 0
    changed_sites = 0
    for root, _dirs, files in os.walk(SRC):
        for name in files:
            if not name.endswith((".ts", ".tsx")):
                continue
            path = os.path.join(root, name)
            with open(path) as fh:
                text = fh.read()
            if "db.$transaction" not in text:
                continue

            inserts = []  # (pos, length_to_replace) for the ')' positions
            for m in CALL_RE.finditer(text):
                open_idx = m.end() - 1
                close_idx = find_call_close(text, open_idx)
                between = text[open_idx + 1 : close_idx].strip()
                if "TX_OPTS" in between:
                    continue  # already applied
                inserts.append((close_idx, 1))

            if not inserts:
                continue

            for close_idx, _ in sorted(inserts, reverse=True):
                text = text[:close_idx] + ", TX_OPTS" + text[close_idx:]
                changed_sites += 1

            if "TX_OPTS" not in text.split("db.$transaction")[0]:
                # extend the existing '@/lib/db' import
                text = re.sub(
                    r"import \{ db \} from '@/lib/db'",
                    "import { db, TX_OPTS } from '@/lib/db'",
                    text,
                )
                text = re.sub(
                    r"import \{ db, TX_OPTS \} from '@/lib/db'",
                    "import { db, TX_OPTS } from '@/lib/db'",
                    text,
                )
            if "TX_OPTS" not in re.sub(CALL_RE, "", text).replace(", TX_OPTS", ""):
                pass  # import handled above when the file imports db already

            if "from '@/lib/db'" not in text:
                print(f"WARNING: {path} uses $transaction but has no db import")
                sys.exit(1)

            with open(path, "w") as fh:
                fh.write(text)
            changed_files += 1
            print(f"{path}: {len(inserts)} site(s)")

    print(f"\n{changed_sites} call site(s) across {changed_files} file(s)")


if __name__ == "__main__":
    main()
