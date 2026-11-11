"""Set GitHub Actions repository secrets via the REST API.

Values arrive through environment variables so nothing sensitive is stored
in this file (the scripts/ directory is tracked in the public repo):

    GITHUB_TOKEN    classic PAT with repo scope
    KEEPALIVE_URL   full Supabase pooler URL for the keep-alive job
    SITE_URL        production URL the sweeper should call
    CRON_SECRET     bearer token for /api/cron/*  (generated if empty)

Usage:
    GITHUB_TOKEN=... KEEPALIVE_URL=... SITE_URL=... CRON_SECRET=... \
        python scripts/set_repo_secrets.py
"""

import base64
import os
import secrets as pysecrets
import sys
import urllib.request

from nacl import encoding, public

REPO = "Frank0751/abnhomes"
API = f"https://api.github.com/repos/{REPO}"


def api_call(path: str, payload: dict | None = None) -> dict | list:
    token = os.environ["GITHUB_TOKEN"]
    request = urllib.request.Request(
        f"{API}{path}",
        data=None if payload is None else __import__("json").dumps(payload).encode(),
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
        },
        method="GET" if payload is None else "PUT",
    )
    with urllib.request.urlopen(request) as response:
        body = response.read()
    return __import__("json").loads(body) if body.strip() else {}


def put_secret(name: str, value: str, key_id: str, key: str) -> None:
    recipient = public.PublicKey(key.encode(), encoding.Base64Encoder())
    sealed = public.SealedBox(recipient).encrypt(value.encode())
    api_call(
        f"/actions/secrets/{name}",
        {"encrypted_value": base64.b64encode(sealed).decode(), "key_id": key_id},
    )
    print(f"set {name} ({len(value)} chars)")


def main() -> None:
    for var in ("GITHUB_TOKEN", "KEEPALIVE_URL", "SITE_URL"):
        if not os.environ.get(var):
            sys.exit(f"missing env var: {var}")

    pk = api_call("/actions/secrets/public-key")
    key_id, key = pk["key_id"], pk["key"]

    cron = os.environ.get("CRON_SECRET") or pysecrets.token_hex(24)
    if not os.environ.get("CRON_SECRET"):
        print(f"GENERATED_CRON_SECRET={cron}")

    put_secret("SUPABASE_KEEPALIVE_DATABASE_URL", os.environ["KEEPALIVE_URL"], key_id, key)
    put_secret("PROD_SITE_URL", os.environ["SITE_URL"], key_id, key)
    put_secret("CRON_SECRET", cron, key_id, key)
    print("done")


if __name__ == "__main__":
    main()
