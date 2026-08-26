// Loads the built admin page in a real browser and fails on any console error.
// A vite build succeeding proves the bundle parses; it says nothing about
// whether the page survives being executed.
// Playwright is intentionally NOT a devDependency: it is a large install with a
// browser download, and the always-on guard for this bug class is the
// react-hooks/rules-of-hooks lint rule in `npm test`, which needs neither. This
// script is the deeper belt-and-braces check — it actually executes the page —
// so it skips cleanly rather than failing when playwright is absent.
let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.log('- admin smoke skipped: playwright is not installed (npm i -D playwright)');
  process.exit(0);
}
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, globSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const ROOT = process.argv[2];
const PAGE = process.argv[3] || '/admin.html';
const TYPES = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css',
                '.mp3':'audio/mpeg', '.json':'application/json', '.svg':'image/svg+xml' };

const server = createServer(async (req, res) => {
  try {
    const rel = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
    const body = await readFile(join(ROOT, rel));
    res.writeHead(200, { 'Content-Type': TYPES[extname(rel)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(r => server.listen(0, r));
const port = server.address().port;

// The environment ships a Chromium at PLAYWRIGHT_BROWSERS_PATH that may not match
// the version this playwright build expects, so point at it explicitly rather
// than letting playwright resolve (and fail to find) its own download.
const EXECUTABLE = process.env.PLAYWRIGHT_CHROMIUM_PATH
  || globSync('/opt/pw-browsers/chromium-*/chrome-linux/chrome')[0]
  || '';
const browser = await chromium.launch(existsSync(EXECUTABLE) ? { executablePath: EXECUTABLE } : {});
const page = await browser.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(`UNCAUGHT: ${e.message}`));

await page.goto(`http://localhost:${port}${PAGE}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const rootHtml = await page.evaluate(() => {
  const el = document.getElementById('root') || document.body;
  return (el.innerHTML || '').trim().length;
});

await browser.close();
server.close();

// Network failures are expected: there is no API server here. Only script
// errors matter, and a hook-at-module-scope crash shows up as UNCAUGHT.
const fatal = errors.filter(e => !/Failed to load resource|net::ERR|favicon|websocket|WebSocket/i.test(e));

console.log(`rendered content in #root: ${rootHtml} chars`);
if (fatal.length) {
  console.error(`\n✗ ${fatal.length} script error(s):`);
  for (const e of fatal.slice(0, 5)) console.error('   ' + e.slice(0, 300));
  process.exit(1);
}
if (rootHtml === 0) { console.error('\n✗ blank page — #root rendered nothing'); process.exit(1); }
console.log('✓ admin page mounts with no script errors');
