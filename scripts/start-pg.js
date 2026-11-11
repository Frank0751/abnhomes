#!/usr/bin/env node
// Boots the embedded PostgreSQL instance for local ABN Homes development.
// Idempotent: if something already listens on the port, exits 0.
// Run in the background:  node scripts/start-pg.js &
// Binaries come from pgdata/node_modules (embedded-postgres), data in pgdata/data.
const net = require('net');
const path = require('path');
const fs = require('fs');
const { createRequire } = require('module');

const ROOT = path.join(__dirname, '..');
const PG_DIR = path.join(ROOT, 'pgdata', 'data');
const PORT = 5433;
const USER = 'abn';
const PASSWORD = 'abn';
const DB = 'abn';

function portOpen() {
  return new Promise((resolve) => {
    const s = net.connect(PORT, '127.0.0.1');
    s.once('connect', () => { s.destroy(); resolve(true); });
    s.once('error', () => resolve(false));
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  if (await portOpen()) {
    console.log(`postgres already running on ${PORT}`);
    process.exit(0);
  }

  const req = createRequire(path.join(ROOT, 'pgdata', 'package.json'));
  const EmbeddedPostgres = req('embedded-postgres').default;
  if (!EmbeddedPostgres) throw new Error('embedded-postgres default export missing');

  const pg = new EmbeddedPostgres({
    databaseDir: PG_DIR,
    user: USER,
    password: PASSWORD,
    port: PORT,
    persistent: true,
    onLog: () => {}, // keep the log quiet
    onError: (msg) => console.error('[pg-error]', String(msg).slice(0, 300)),
  });

  const firstRun = !fs.existsSync(path.join(PG_DIR, 'PG_VERSION'));
  if (firstRun) {
    console.log('initialising new postgres cluster ...');
    await pg.initialise();
  }
  await pg.start();
  // Wait for the port to accept connections
  for (let i = 0; i < 60; i++) {
    if (await portOpen()) break;
    await sleep(500);
  }
  try {
    await pg.createDatabase(DB);
    console.log(`database ${DB} created`);
  } catch {
    // already exists
  }
  console.log(`postgres ready on ${PORT} (db ${DB}, user ${USER})`);
  // Keep the daemon alive
  setInterval(() => {}, 1 << 30);
})().catch((err) => {
  console.error('failed to start postgres:', err);
  process.exit(1);
});
