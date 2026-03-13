#!/usr/bin/env node
// run: node apply-ai-training-patch.js
// This script patches your server.js in-place with the AI Training integration

const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, 'server.js');
let src = fs.readFileSync(serverPath, 'utf8');
let changed = 0;

// ── PATCH 1: Add requires after fileRoutes ─────────────────────────────────
const PATCH1_FIND = `const fileRoutes = require('./routes/fileroutes');`;
const PATCH1_ADD  = `
// ✦ AI TRAINING
const aiTrainingRoutes = require('./routes/ai-training-routes');
const { getBrainContext, refreshBrainCache } = require('./brain-context');`;

if (src.includes(PATCH1_FIND) && !src.includes('aiTrainingRoutes')) {
  src = src.replace(PATCH1_FIND, PATCH1_FIND + PATCH1_ADD);
  console.log('✅ Patch 1 applied: added AI training requires');
  changed++;
} else if (src.includes('aiTrainingRoutes')) {
  console.log('⏭️  Patch 1 already applied');
} else {
  console.error('❌ Patch 1 FAILED: could not find fileRoutes require');
}

// ── PATCH 2: Mount AI training routes ─────────────────────────────────────
const PATCH2_FIND = `app.use('/api/files', fileRoutes);`;
const PATCH2_ADD  = `
// ✦ AI TRAINING ROUTES
app.use('/api/ai/training', aiTrainingRoutes);`;

if (src.includes(PATCH2_FIND) && !src.includes("app.use('/api/ai/training'")) {
  src = src.replace(PATCH2_FIND, PATCH2_FIND + PATCH2_ADD);
  console.log('✅ Patch 2 applied: mounted /api/ai/training routes');
  changed++;
} else if (src.includes("app.use('/api/ai/training'")) {
  console.log('⏭️  Patch 2 already applied');
} else {
  console.error('❌ Patch 2 FAILED: could not find file routes mount');
}

// ── PATCH 3: Inject brainContext in /api/ai/suggestions handler ─────────────
const PATCH3_FIND = `    const policyBlock = buildPolicyBlock();
    const systemPrompt = buildSystemPrompt(storeName, customerContext, analysisBlock, policyBlock, contextQuality, messageRichness);`;
const PATCH3_REPLACE = `    const policyBlock = buildPolicyBlock();
    const brainContext = await getBrainContext(db.pool); // ✦ AI TRAINING
    const systemPrompt = buildSystemPrompt(storeName, customerContext, analysisBlock, policyBlock, contextQuality, messageRichness, brainContext);`;

if (src.includes(PATCH3_FIND)) {
  src = src.replace(PATCH3_FIND, PATCH3_REPLACE);
  console.log('✅ Patch 3 applied: brainContext injected into suggestions');
  changed++;
} else if (src.includes('getBrainContext')) {
  console.log('⏭️  Patch 3 already applied');
} else {
  console.error('❌ Patch 3 FAILED: could not find buildSystemPrompt call in suggestions handler');
}

// ── PATCH 4: Update buildSystemPrompt signature + inject brain rules ─────────
const PATCH4_FIND = `function buildSystemPrompt(storeName, customerContext, analysisBlock, policyBlock, contextQuality, messageRichness) {`;
const PATCH4_REPLACE = `function buildSystemPrompt(storeName, customerContext, analysisBlock, policyBlock, contextQuality, messageRichness, brainContext = '') {`;

if (src.includes(PATCH4_FIND)) {
  src = src.replace(PATCH4_FIND, PATCH4_REPLACE);
  console.log('✅ Patch 4a applied: updated buildSystemPrompt signature');
  changed++;
} else if (src.includes("brainContext = ''")) {
  console.log('⏭️  Patch 4a already applied');
} else {
  console.error('❌ Patch 4a FAILED: could not find buildSystemPrompt function');
}

// Patch 4b: inject brainContext block before the final JSON instruction
const PATCH4B_FIND = `Respond ONLY with valid JSON in this exact format:
{"suggestions": ["reply 1", "reply 2", "reply 3"]}`;

const PATCH4B_REPLACE = `\${brainContext ? \`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ADMIN-TRAINED RULES — HIGHEST PRIORITY (these override all defaults above):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
\${brainContext}
\` : ''}
Respond ONLY with valid JSON in this exact format:
{"suggestions": ["reply 1", "reply 2", "reply 3"]}`;

if (src.includes(PATCH4B_FIND) && !src.includes('ADMIN-TRAINED RULES')) {
  src = src.replace(PATCH4B_FIND, PATCH4B_REPLACE);
  console.log('✅ Patch 4b applied: brain rules injected into system prompt');
  changed++;
} else if (src.includes('ADMIN-TRAINED RULES')) {
  console.log('⏭️  Patch 4b already applied');
} else {
  console.error('❌ Patch 4b FAILED: could not find end of buildSystemPrompt');
}

// ── Write result ──────────────────────────────────────────────────────────
if (changed > 0) {
  // Backup original
  fs.writeFileSync(serverPath + '.bak', fs.readFileSync(serverPath));
  fs.writeFileSync(serverPath, src);
  console.log(`\n✅ ${changed} patches applied. Backup saved as server.js.bak`);
} else {
  console.log('\nℹ️  No changes made.');
}