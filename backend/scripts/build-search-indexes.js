#!/usr/bin/env node
// ============================================================================
// backend/scripts/build-search-indexes.js
// ============================================================================
// Builds the pg_trgm GIN indexes that /api/conversations/search depends on.
//
// WHY THIS IS A SEPARATE SCRIPT:
//   • A GIN trigram index on messages.content takes minutes on a large table.
//     The app pool has statement_timeout: 15s, so it could never finish there —
//     it got killed every boot while holding ACCESS EXCLUSIVE on `messages`,
//     which blocked all other queries and blew out the pool.
//   • CONCURRENTLY does not take that exclusive lock, so this is safe to run
//     against live traffic — but it cannot run inside a transaction, and it
//     cannot run on a connection with a statement timeout.
//
// LAYOUT THIS EXPECTS:
//   C:\Chat-Support-Pro\
//   ├── .env                      ← loaded from here (repo root)
//   ├── node_modules\
//   ├── frontend\
//   └── backend\
//       ├── database.js
//       └── scripts\build-search-indexes.js   ← this file
//
// USAGE (from the backend directory):
//   node scripts/build-search-indexes.js --check     # report status only
//   node scripts/build-search-indexes.js             # build
//   node scripts/build-search-indexes.js --repair    # drop INVALID and rebuild
//
// To target production from a local shell, override for the command only:
//   $env:DATABASE_URL = "<Render EXTERNAL Database URL>"
//   node scripts/build-search-indexes.js --check
//
// Run it ONCE. Afterwards IF NOT EXISTS makes it a no-op.
// ============================================================================

const path = require('path');
const fs = require('fs');

// dotenv resolves .env from the current working directory, not the script's
// location. This file lives at <repo>/backend/scripts, so the repo root is two
// levels up. Both locations are checked so it works either way.
const ENV_CANDIDATES = [
  path.join(__dirname, '..', '..', '.env'),   // <repo>/.env
  path.join(__dirname, '..', '.env'),         // <repo>/backend/.env
];
const envPath = ENV_CANDIDATES.find(p => fs.existsSync(p));
if (envPath) {
  require('dotenv').config({ path: envPath });
} else {
  console.warn('⚠️  No .env found in the repo root or backend/ — relying on the shell environment');
}

// This check must come BEFORE requiring ../database: database.js reads
// process.env.DATABASE_URL at module load to build its pool config, so a
// missing var there surfaces as a vague failure much later.
if (!process.env.DATABASE_URL && !process.env.DIRECT_DATABASE_URL) {
  console.error('❌ No DATABASE_URL found.');
  console.error('   Checked: ' + ENV_CANDIDATES.join(', '));
  console.error('   Either add it to .env, or set it for this command:');
  console.error('     $env:DATABASE_URL = "postgresql://..."');
  process.exit(1);
}

const db = require('../database');

const TARGET_INDEXES = ['idx_messages_content_trgm', 'idx_conv_email_trgm', 'idx_conv_name_trgm'];

const INVALID_CHECK = `
  SELECT c.relname AS index_name, i.indisvalid AS valid,
         pg_size_pretty(pg_relation_size(c.oid)) AS size
    FROM pg_class c
    JOIN pg_index i ON i.indexrelid = c.oid
   WHERE c.relname = ANY($1)
   ORDER BY c.relname
`;

/** Masks credentials so the host can be logged safely. */
function describeTarget(url) {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.port ? ':' + u.port : ''}${u.pathname}`;
  } catch { return 'unparseable connection string'; }
}

async function report() {
  const { rows } = await db.pool.query(INVALID_CHECK, [TARGET_INDEXES]);
  if (!rows.length) {
    console.log('\nNo trigram search indexes exist yet.');
    return rows;
  }
  console.log('\nCurrent trigram indexes:');
  for (const r of rows) {
    console.log(`  ${r.valid ? '✅' : '❌ INVALID'}  ${r.index_name.padEnd(28)} ${r.size}`);
  }
  const missing = TARGET_INDEXES.filter(n => !rows.some(r => r.index_name === n));
  if (missing.length) console.log(`  ⬜ not built: ${missing.join(', ')}`);

  const invalid = rows.filter(r => !r.valid);
  if (invalid.length) {
    console.log('\n⚠️  INVALID indexes are left behind when a CONCURRENTLY build is');
    console.log('   interrupted. Postgres will NOT use them, will NOT retry, but WILL');
    console.log('   keep maintaining them on every write. Re-run with --repair.');
  }
  return rows;
}

async function repair() {
  const { rows } = await db.pool.query(INVALID_CHECK, [TARGET_INDEXES]);
  const invalid = rows.filter(r => !r.valid);
  if (!invalid.length) { console.log('\nNothing to repair.'); return; }
  await db.withMaintenance(async (mp) => {
    for (const r of invalid) {
      console.log(`Dropping INVALID index ${r.index_name}...`);
      await mp.query(`DROP INDEX CONCURRENTLY IF EXISTS ${r.index_name}`);
    }
  });
  console.log('✅ Invalid indexes dropped. Now building fresh.');
}

async function main() {
  const args = process.argv.slice(2);
  const checkOnly = args.includes('--check');
  const doRepair = args.includes('--repair');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(' Search index builder');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(` env file:   ${envPath || '(none — using shell environment)'}`);
  console.log(` target:     ${describeTarget(process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL)}`);
  console.log(` direct url: ${process.env.DIRECT_DATABASE_URL ? 'set (used for CONCURRENTLY)' : 'not set — using DATABASE_URL'}`);

  try {
    await db.testConnection();
    console.log(' connection: ok');
  } catch (e) {
    console.error('❌ Cannot reach the database:', e.message);
    if (/ENOTFOUND/.test(e.message) && /\.internal/.test(process.env.DATABASE_URL || '')) {
      console.error('   That is an internal Render hostname — it only resolves inside');
      console.error('   Render. Use the EXTERNAL Database URL from a local shell.');
    }
    await db.closePool().catch(() => {});
    process.exit(1);
  }

  await report();

  if (checkOnly) { await db.closePool(); return; }
  if (doRepair) await repair();

  // Approximate row counts so the operator can sanity-check they are pointed at
  // the right database, and gauge how long the build will take.
  const { rows: counts } = await db.pool.query(`
    SELECT (SELECT reltuples::bigint FROM pg_class WHERE relname = 'messages')      AS messages,
           (SELECT reltuples::bigint FROM pg_class WHERE relname = 'conversations') AS conversations
  `);
  console.log(`\nApprox rows — messages: ${counts[0].messages}, conversations: ${counts[0].conversations}`);
  console.log('If those counts look too small, you are on a dev database — stop and');
  console.log('override DATABASE_URL before building.\n');
  console.log('Building with CONCURRENTLY (safe on live traffic). This can take several minutes.');
  console.log('Do not interrupt — an interrupted build leaves an INVALID index behind.\n');

  const t0 = Date.now();
  await db.buildSearchIndexes();
  console.log(`\n✅ Finished in ${Math.round((Date.now() - t0) / 1000)}s`);

  await report();
  await db.closePool();
}

// Ctrl-C mid-build is the main way an INVALID index gets created, so say so
// rather than exiting silently.
process.on('SIGINT', () => {
  console.error('\n⚠️  Interrupted. If a build was in progress it may have left an');
  console.error('   INVALID index. Re-run with --repair before trying again.');
  process.exit(130);
});

main().catch(async (e) => {
  console.error('❌ Failed:', e.message);
  await db.closePool().catch(() => {});
  process.exit(1);
});