const readline = require('readline/promises');
const { stdin, stdout } = require('process');

const BASE = 'http://localhost:3000';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6OCwiZW1haWwiOiJkbG9uZXIwMDI2QGdtYWlsLmNvbSIsInJvbGUiOiJhZG1pbiIsIm5hbWUiOiJDdXN0b21lciBTdXBwb3J0IiwiaWF0IjoxNzgzNjkxMjI4LCJleHAiOjE3ODQyOTYwMjh9.khGZoJ4u5lKgZcOKtW57TUCjzD-1TLrl94KpbcP3Zcs';

const RULE_CATEGORIES = ['toneRules', 'avoidPatterns', 'preferPatterns', 'productKnowledge', 'customPolicies', 'responseExamples'];

function countRules(brain) {
  return RULE_CATEGORIES.reduce((sum, key) => sum + (Array.isArray(brain[key]) ? brain[key].length : 0), 0);
}

function replaceExact(categoryArr, oldSubstring, newSubstring) {
  const matches = categoryArr.filter(r => r.text.includes(oldSubstring));
  if (matches.length !== 1) {
    throw new Error(`Expected exactly 1 match for:\n"${oldSubstring.slice(0, 80)}..."\nFound ${matches.length}`);
  }
  matches[0].text = matches[0].text.replace(oldSubstring, newSubstring);
}

async function main() {
  // ── 1. Fetch current brain ──────────────────────────────────────────────
  const { brain } = await fetch(`${BASE}/api/ai/training/brain`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  }).then(r => r.json());

  const totalBefore = countRules(brain);
  console.log(`\n📊 Total rules in brain right now: ${totalBefore}`);

  // Snapshot untouched categories so we can prove after the fact they didn't move
  const untouchedBefore = {};
  for (const key of RULE_CATEGORIES) {
    if (key !== 'preferPatterns' && key !== 'productKnowledge') {
      untouchedBefore[key] = JSON.stringify(brain[key]);
    }
  }

  // ── 2. Apply the edits (in memory only, nothing written yet) ────────────
  const SEMAX_WRONG = "Semax can be administered subcutaneously or intranasally; the intranasal route is unique among catalog peptides and provides rapid cognitive onset. Morning administration is preferred for best nootropic and cognitive benefits. Standard cycle is 10–20 days on, 10 days off.";
  const beforePreferCount = brain.preferPatterns.length;
  brain.preferPatterns = brain.preferPatterns.filter(r => r.text !== SEMAX_WRONG);
  if (brain.preferPatterns.length !== beforePreferCount - 1) {
    throw new Error('Semax preferPatterns entry not found or matched more than once — aborting, nothing written');
  }

  replaceExact(
    brain.productKnowledge,
    "VIP 5mg: intranasal route standard for CIRS; baseline VIP levels and inflammatory markers before starting; administer at consistent intervals; min 2L water/day; professional guidance required.",
    "VIP 5mg: subcutaneous injection only, never intranasal; baseline VIP levels and inflammatory markers before starting; administer at consistent intervals; min 2L water/day; professional guidance required."
  );
  replaceExact(
    brain.productKnowledge,
    "VIP 5mg intranasal: Wks 1–2 50mcg (1 unit) 1–4x/day, Wks 3–4 50mcg 4x/day, Wks 5+ 50mcg 4x/day maintenance;",
    "VIP 5mg subcutaneous: Wks 1–2 50mcg (1 unit) 1–4x/day, Wks 3–4 50mcg 4x/day, Wks 5+ 50mcg 4x/day maintenance;"
  );
  replaceExact(
    brain.productKnowledge,
    "Oxytocin 2mg SQ or intranasal 1x/day Wks1-2:50mcg(2.5u),Wks3-4:100mcg(5u),Wks5+:100-200mcg(5-10u);intranasal rapid onset;mood/social effects develop over days-weeks;same time daily,2L/day.",
    "Oxytocin 2mg SQ only 1x/day Wks1-2:50mcg(2.5u),Wks3-4:100mcg(5u),Wks5+:100-200mcg(5-10u);never intranasal;mood/social effects develop over days-weeks;same time daily,2L/day."
  );
  replaceExact(
    brain.productKnowledge,
    "VIP:SQ injection only. ALT:conflicts with rule stating intranasal is primary VIP route for CIRS protocols.",
    "VIP:SQ injection only, never intranasal."
  );

  const totalAfter = countRules(brain);
  const expectedAfter = totalBefore - 1; // only the Semax delete changes the count
  console.log(`📊 Total rules after edits (in memory): ${totalAfter} (expected ${expectedAfter})`);
  if (totalAfter !== expectedAfter) {
    throw new Error(`Rule count mismatch! Expected ${expectedAfter}, got ${totalAfter}. Aborting — nothing written.`);
  }
  console.log('✅ Rule count check passed — exactly 1 entry removed, 0 entries added, 4 entries edited in place.\n');

  // ── 3. Check backup throttle status BEFORE writing ───────────────────────
  const { backups } = await fetch(`${BASE}/api/ai/training/consolidate-backups`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  }).then(r => r.json());

  const lastManualBackup = backups.find(b => b.reason === 'pre-manual-edit');
  let willTakeFreshBackup = true;
  if (lastManualBackup) {
    const minutesSince = (Date.now() - new Date(lastManualBackup.backed_up_at).getTime()) / 60000;
    if (minutesSince < 30) {
      willTakeFreshBackup = false;
      console.log(`⚠️  BACKUP WARNING: last pre-manual-edit backup was ${minutesSince.toFixed(1)} min ago (#${lastManualBackup.id}, ${lastManualBackup.backed_up_at}).`);
      console.log(`   The 30-min throttle will SKIP taking a new backup for this write.`);
      console.log(`   Your safety net for this change is that existing backup, not a fresh one.\n`);
    } else {
      console.log(`✅ Last pre-manual-edit backup was ${minutesSince.toFixed(1)} min ago (>30) — a FRESH backup will be taken automatically before this write.\n`);
    }
  } else {
    console.log(`✅ No prior pre-manual-edit backup found — a FRESH backup will be taken automatically before this write.\n`);
  }

  // ── 4. Show the diff and require explicit confirmation ───────────────────
  console.log('--- productKnowledge entries mentioning VIP or Oxytocin, AFTER edit ---');
  brain.productKnowledge
    .filter(r => r.text.includes('VIP') || r.text.includes('Oxytocin'))
    .forEach((r, i) => console.log(`\n[${i}] (${r.source})\n${r.text}`));

  const rl = readline.createInterface({ input: stdin, output: stdout });
  const answer = await rl.question(
    `\nType "yes" to write these changes to the LIVE brain (${willTakeFreshBackup ? 'fresh backup will be taken' : 'NO fresh backup — relying on older one'}), anything else to abort: `
  );
  rl.close();

  if (answer.trim().toLowerCase() !== 'yes') {
    console.log('❌ Aborted by user — nothing written.');
    return;
  }

  // ── 5. Write ───────────────────────────────────────────────────────────
  const res = await fetch(`${BASE}/api/ai/training/brain`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ brain }),
  });
  const result = await res.json();
  console.log('\nServer response:', result);

  if (!res.ok) {
    console.log('❌ Write failed — brain was NOT modified. See server response above.');
    return;
  }

  // ── 6. Post-write verification ────────────────────────────────────────
  const { brain: after } = await fetch(`${BASE}/api/ai/training/brain`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  }).then(r => r.json());

  const totalPostWrite = countRules(after);
  console.log(`\n📊 Post-write total rule count: ${totalPostWrite} (expected ${expectedAfter})`);

  let untouchedOk = true;
  for (const key of RULE_CATEGORIES) {
    if (key !== 'preferPatterns' && key !== 'productKnowledge') {
      if (JSON.stringify(after[key]) !== untouchedBefore[key]) {
        untouchedOk = false;
        console.log(`🚨 ${key} CHANGED — this category was never supposed to be touched! Investigate before trusting this write.`);
      }
    }
  }
  if (untouchedOk) console.log('✅ toneRules, avoidPatterns, customPolicies, responseExamples confirmed unchanged.');

  const stillHasIntranasal = after.productKnowledge.some(r =>
    (r.text.includes('VIP') || r.text.includes('Oxytocin')) && /intranasal(?! is primary)/i.test(r.text) && !r.text.toLowerCase().includes('never intranasal') && !r.text.toLowerCase().includes('subcutaneous injection only, never intranasal')
  );
  if (stillHasIntranasal) {
    console.log('🚨 A VIP/Oxytocin entry mentioning "intranasal" still exists that doesn\'t look corrected — check manually.');
  } else {
    console.log('✅ No uncorrected intranasal references found for VIP/Oxytocin in productKnowledge.');
  }

  const { backups: backupsAfter } = await fetch(`${BASE}/api/ai/training/consolidate-backups`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  }).then(r => r.json());
  const newestManual = backupsAfter.find(b => b.reason === 'pre-manual-edit');
  console.log(`\n🗂️  Most recent pre-manual-edit backup is now #${newestManual?.id} at ${newestManual?.backed_up_at} — this is your rollback point if needed (POST /consolidate-restore with { backupId: ${newestManual?.id} }).`);
}

main().catch(err => {
  console.error('\n❌ SCRIPT ABORTED — nothing was written to the live brain.');
  console.error(err.message);
});