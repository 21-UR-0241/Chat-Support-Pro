const readline = require('readline/promises');
const { stdin, stdout } = require('process');

const BASE = 'http://localhost:3000';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6OCwiZW1haWwiOiJkbG9uZXIwMDI2QGdtYWlsLmNvbSIsInJvbGUiOiJhZG1pbiIsIm5hbWUiOiJDdXN0b21lciBTdXBwb3J0IiwiaWF0IjoxNzgzNjkxMjI4LCJleHAiOjE3ODQyOTYwMjh9.khGZoJ4u5lKgZcOKtW57TUCjzD-1TLrl94KpbcP3Zcs';


async function main() {
  const { brain } = await fetch(`${BASE}/api/ai/training/brain`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  }).then(r => r.json());

  const totalBefore = Object.values({
    tone: brain.toneRules, avoid: brain.avoidPatterns, prefer: brain.preferPatterns,
    product: brain.productKnowledge, policy: brain.customPolicies, example: brain.responseExamples,
  }).reduce((s, arr) => s + (arr?.length || 0), 0);
  console.log(`📊 Total rules right now: ${totalBefore}`);

  const untouchedBefore = {};
  for (const key of ['toneRules', 'avoidPatterns', 'preferPatterns', 'productKnowledge', 'customPolicies']) {
    untouchedBefore[key] = JSON.stringify(brain[key]);
  }

  const beforeExampleCount = brain.responseExamples.length;
  if (beforeExampleCount !== 10) {
    throw new Error(`Expected 10 existing responseExamples, found ${beforeExampleCount} — brain state has changed, stop and re-check before proceeding.`);
  }
  const allConsolidated = brain.responseExamples.every(r => r.source === 'consolidated');
  if (!allConsolidated) {
    throw new Error('Not all 10 existing examples have source "consolidated" — someone may have already edited these. Stop and re-check.');
  }

  brain.responseExamples = [
    "Injectable's the move here, not oral, stomach acid and enzymes break peptides down before they'd ever get absorbed. For recovery I'd go TB-500 + BPC-157 + GHK-Cu + KPV + Ipamorelin, that covers tissue repair, healing, and skin support together. Are you newer to peptides, or do you want me to jump straight to starting doses?",
    "No in-person pickup, sorry, we ship only. For the timing, a few options: have it held at the front desk, redirect to a nearby UPS access point, or push delivery back a day or two, whichever's easiest. Which do you want?",
    "For your 20mg vial: add 2mL BAC water, that's 10mg/mL. On an insulin syringe, 10 units = 1mg = 0.1mL. So a 0.5mg starting dose is 5 units, 0.05mL. Tell me your target dose and I'll break down the units.",
    "Vancouver to Burnaby shouldn't take that long, fair to be annoyed. UPS shows the worst-case window on purpose, weekends and backlog included, real delivery's almost always faster. What's your tracking number? I'll pull it and give you a tighter estimate, but you're likely looking at a day or two.",
    "David, no chargeback needed, I've got you. I can see your order and I know it's lost. I'll get a replacement out and I'm chasing the carrier on the original now. Same address, or a new one?",
    "That redness and itching right at the site is a pretty normal reaction, not an infection. Rotate injection sites more and try a cold compress right after, that usually settles it. If it keeps spreading, gets worse, or you get a fever after a few days of that, go see a doctor in person.",
    "Ah, sorry, looks like the [product] didn't make it into your order, that's on us. Is the shipping address still the same? I'll get that reshipped with tracking today, no need to send anything back or send photos.",
    "No problem, I can do a one-time exception and add the swap to your next order instead, no return needed. What's your order number?",
    "We ran out of reconstitution solution, that's on us, sorry. Can you confirm your shipping address? I'll get replacements out as soon as we're restocked and follow up here once it's confirmed.",
  ].map(text => ({ text, source: 'admin-feedback' }));

  const totalAfter = Object.values({
    tone: brain.toneRules, avoid: brain.avoidPatterns, prefer: brain.preferPatterns,
    product: brain.productKnowledge, policy: brain.customPolicies, example: brain.responseExamples,
  }).reduce((s, arr) => s + (arr?.length || 0), 0);
  const expectedAfter = totalBefore - 1; // 10 removed, 9 added
  console.log(`📊 Total rules after edit (in memory): ${totalAfter} (expected ${expectedAfter})`);
  if (totalAfter !== expectedAfter) {
    throw new Error(`Count mismatch. Expected ${expectedAfter}, got ${totalAfter}. Aborting — nothing written.`);
  }
  console.log('✅ Count check passed — 10 blobbed examples removed, 9 rewritten examples added, all with source "admin-feedback" (golden).\n');

  const { backups } = await fetch(`${BASE}/api/ai/training/consolidate-backups`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  }).then(r => r.json());
  const lastManual = backups.find(b => b.reason === 'pre-manual-edit');
  let freshBackup = true;
  if (lastManual) {
    const minsSince = (Date.now() - new Date(lastManual.backed_up_at).getTime()) / 60000;
    if (minsSince < 30) {
      freshBackup = false;
      console.log(`⚠️  Last pre-manual-edit backup was ${minsSince.toFixed(1)} min ago — throttle will SKIP a fresh backup. Rollback point is backup #${lastManual.id} instead.\n`);
    } else {
      console.log(`✅ Last pre-manual-edit backup was ${minsSince.toFixed(1)} min ago — a fresh backup will be taken.\n`);
    }
  }

  console.log('--- New responseExamples ---');
  brain.responseExamples.forEach((r, i) => console.log(`\n[${i}] (${r.source})\n${r.text}`));

  const rl = readline.createInterface({ input: stdin, output: stdout });
  const answer = await rl.question(`\nType "yes" to write (${freshBackup ? 'fresh backup will be taken' : 'NO fresh backup, relying on older one'}), anything else to abort: `);
  rl.close();
  if (answer.trim().toLowerCase() !== 'yes') { console.log('❌ Aborted — nothing written.'); return; }

  const res = await fetch(`${BASE}/api/ai/training/brain`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ brain }),
  });
  console.log('\nServer response:', await res.json());
  if (!res.ok) { console.log('❌ Write failed — brain not modified.'); return; }

  const { brain: after } = await fetch(`${BASE}/api/ai/training/brain`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  }).then(r => r.json());

  let untouchedOk = true;
  for (const key of ['toneRules', 'avoidPatterns', 'preferPatterns', 'productKnowledge', 'customPolicies']) {
    if (JSON.stringify(after[key]) !== untouchedBefore[key]) {
      untouchedOk = false;
      console.log(`🚨 ${key} CHANGED — was never supposed to be touched!`);
    }
  }
  if (untouchedOk) console.log('✅ All other categories confirmed unchanged.');

  const stillConsolidated = after.responseExamples.filter(r => r.source === 'consolidated');
  console.log(stillConsolidated.length === 0
    ? '✅ Zero responseExamples remain with source "consolidated".'
    : `🚨 ${stillConsolidated.length} still marked "consolidated" — check manually.`);

  const { backups: backupsAfter } = await fetch(`${BASE}/api/ai/training/consolidate-backups`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  }).then(r => r.json());
  const newest = backupsAfter.find(b => b.reason === 'pre-manual-edit');
  console.log(`\n🗂️  Rollback point: backup #${newest?.id} at ${newest?.backed_up_at}`);
}

main().catch(err => {
  console.error('\n❌ ABORTED — nothing written.');
  console.error(err);
});