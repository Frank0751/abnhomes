#!/usr/bin/env bash
# Restore the local dev environment after a sandbox recycle.
# The recycle kills processes and wipes gitignored paths (.env, pgdata/),
# so this script rebuilds both idempotently. Safe to run any time.
set -e
cd /home/z/my-project

# 1. .env
if ! grep -q '^DATABASE_URL="postgresql://' .env 2>/dev/null; then
  SECRET=$(openssl rand -hex 32)
  cat > .env <<EOF
DATABASE_URL="postgresql://abn:abn@localhost:5433/abn"
DIRECT_URL="postgresql://abn:abn@localhost:5433/abn"
AUTH_SECRET="$SECRET"
AUTH_URL="http://localhost:3000"
AUTH_TRUST_HOST="true"
BASE_CURRENCY="GHS"
EOF
  echo "[restore] .env recreated"
else
  echo "[restore] .env ok"
fi

# 2. embedded postgres (binaries + platform package)
if [ ! -x pgdata/node_modules/@embedded-postgres/linux-x64/native/bin/postgres ]; then
  mkdir -p pgdata
  cd pgdata
  [ -f package.json ] || npm init -y >/dev/null 2>&1
  npm install embedded-postgres --no-audit --no-fund >/dev/null 2>&1 || true
  npm install-scripts approve @embedded-postgres/linux-x64 >/dev/null 2>&1 || true
  npm rebuild @embedded-postgres/linux-x64 --foreground-scripts >/dev/null 2>&1 || true
  cd ..
  echo "[restore] embedded-postgres reinstalled"
else
  echo "[restore] embedded-postgres ok"
fi

# 3. start PG if not listening
if ss -ltn | grep -q 5433; then
  echo "[restore] postgres already up"
else
  node scripts/start-pg.js > scripts/pg.log 2>&1 &
  for i in $(seq 1 40); do
    sleep 1
    ss -ltn | grep -q 5433 && break
  done
  ss -ltn | grep -q 5433 && echo "[restore] postgres started" || { echo "[restore] postgres FAILED"; tail -5 scripts/pg.log; exit 1; }
fi

# 4. dev server if not listening
if ss -ltn | grep -q :3000; then
  echo "[restore] dev server already up"
else
  (npm run dev > scripts/dev-server.log 2>&1 &)
  for i in $(seq 1 40); do
    sleep 2
    curl -s -o /dev/null --max-time 5 http://localhost:3000/ && break
  done
  curl -s -o /dev/null --max-time 10 http://localhost:3000/ && echo "[restore] dev server up" || echo "[restore] dev server not responding yet"
fi

echo "[restore] done"
