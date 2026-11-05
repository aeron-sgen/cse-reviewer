// End-to-end test. Run from the repo root: node tests/e2e.mjs
// Set PW_CHROME to a Chromium path if Playwright's own browser is not installed.
import { chromium } from 'playwright'; import http from 'http'; import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const SHOTS = path.join(ROOT, '.verify', 'shots') + path.sep;
fs.mkdirSync(SHOTS, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; const f = path.join(ROOT, p); if (!f.startsWith(ROOT) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); r.end(fs.readFileSync(f)); }).listen(4173);
const URL0 = 'http://localhost:4173/';
const results = []; const ok = (n, c, d = '') => { results.push([n, !!c, d]); console.log((c ? 'PASS ' : 'FAIL ') + n + (d ? ' :: ' + d : '')); };
const browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
const errors = [];
async function ctx(opts = {}) { const c = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true, ...opts }); const p = await c.newPage(); p.on('pageerror', e => errors.push('pageerror ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/service.?worker|ERR_INTERNET_DISCONNECTED/i.test(m.text())) errors.push('console ' + m.text()); }); await p.goto(URL0); await p.waitForSelector('.node'); return { c, p }; }
const overflow = p => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const store = p => p.evaluate(() => JSON.parse(localStorage.getItem('tarsi-cse-v1') || 'null'));
// Identify the current question from the page, using the data the app itself loads.
const currentQ = p => p.evaluate(() => { const t = document.querySelector('.question').textContent, pa = document.querySelector('.passage')?.textContent; const q = window.CSE_QUESTIONS.find(q => q.question === t && (q.passage || undefined) === (pa || undefined)); return q ? { id: q.id, right: q.options[q.answer], options: q.options } : null; });
async function clickOpt(p, text) { const btns = await p.$$('.opt'); for (const b of btns) { const s = await b.evaluate(e => e.lastChild.textContent); if (s === text) { await b.click(); return true; } } return false; }
async function answer(p, correct) { const q = await currentQ(p); if (!q) throw new Error('question not identified: ' + await p.textContent('.question')); const text = correct ? q.right : q.options.find(o => o !== q.right); if (!await clickOpt(p, text)) throw new Error('option not found'); await p.click('[data-act=check]'); return q; }

// ---- A. Every lesson, all questions, phone width
{ const { p, c } = await ctx();
  const info = await p.evaluate(() => ({ total: window.CSE_QUESTIONS.length, nodes: document.querySelectorAll('.node').length }));
  ok('A1 all questions loaded', info.total >= 216, `${info.total} questions, ${info.nodes} lessons`);
  await p.screenshot({ path: SHOTS + 'learn-mobile.png' });
  const seen = new Set(); const badOverflow = []; let tall = 0;
  for (let i = 0; i < info.nodes; i++) {
    await p.locator('.node').nth(i).click();
    for (let guard = 0; guard < 40; guard++) {
      if (await p.$('.endscreen')) break;
      await p.waitForSelector('.question');
      const o = await overflow(p); if (o > 0) badOverflow.push(o);
      const q = await answer(p, true); seen.add(q.id);
      await p.waitForSelector('[data-act=continue]');
      const fo = await p.evaluate(() => document.querySelector('.foot').getBoundingClientRect().height / innerHeight); if (fo > tall) tall = fo;
      await p.click('[data-act=continue]');
    }
    await p.waitForSelector('.endscreen'); if (i === 0) await p.screenshot({ path: SHOTS + 'lesson-complete.png' });
    await p.click('.endscreen button');
    await p.waitForSelector('.node');
  }
  ok('A2 every question reachable through lessons', seen.size === info.total, `${seen.size} seen`);
  ok('A3 no sideways scrolling on any question at 390px', !badOverflow.length, badOverflow.slice(0, 5).join());
  ok('A4 feedback sheet leaves room', tall < 0.7, `tallest ${(tall * 100).toFixed(0)}% of screen`);
  const s = await store(p);
  ok('A5 all lessons marked done, XP and streak recorded', Object.keys(s.lessons).length === info.nodes && s.xp > 0 && s.streak === 1, `xp ${s.xp}, streak ${s.streak}`);
  await p.reload(); await p.waitForSelector('.node');
  const s2 = await store(p); ok('A6 progress survives reload', s2.xp === s.xp && await p.locator('.node.done').count() === info.nodes);
  await c.close(); }

// ---- B. Wrong answers, hearts, mistakes
{ const { p, c } = await ctx();
  await p.locator('.node').first().click(); await p.waitForSelector('.question');
  const q = await answer(p, false); await p.waitForSelector('.foot.bad');
  ok('B1 wrong answer shows correct answer and source', (await p.textContent('.explain')).includes(q.right) && (await p.textContent('.explain')).includes('Source:'));
  await p.screenshot({ path: SHOTS + 'wrong-mobile.png' });
  ok('B2 lost a heart', (await p.textContent('.hearts')).trim() === '4');
  let s = await store(p); ok('B3 miss saved to mistakes', s.q[q.id]?.bin === true);
  await p.click('[data-act=continue]');
  for (let i = 0; i < 4; i++) { await p.waitForSelector('.question'); await answer(p, false); await p.click('[data-act=continue]'); }
  await p.waitForSelector('.endscreen'); ok('B4 five misses ends lesson', (await p.textContent('.endscreen h1')) === 'Out of hearts');
  await p.screenshot({ path: SHOTS + 'out-of-hearts.png' });
  s = await store(p); ok('B5 failed lesson not marked done', Object.keys(s.lessons).length === 0);
  await p.goto(URL0 + '#/practice'); await p.waitForSelector('[data-act=mistakes]');
  const binBefore = Object.values(s.q).filter(x => x.bin).length;
  await p.click('[data-act=mistakes]');
  let rounds = 0; while (!(await p.$('.endscreen')) && rounds++ < 30) { await p.waitForSelector('.question'); await answer(p, true); await p.click('[data-act=continue]'); }
  s = await store(p); ok('B6 one right answer keeps item on list, as promised', Object.values(s.q).filter(x => x.bin).length === binBefore, `bin ${binBefore}`);
  await p.click('.endscreen button'); await p.waitForSelector('[data-act=mistakes]'); await p.click('[data-act=mistakes]');
  rounds = 0; while (!(await p.$('.endscreen')) && rounds++ < 30) { await p.waitForSelector('.question'); await answer(p, true); await p.click('[data-act=continue]'); }
  s = await store(p); ok('B7 second session clears the list', Object.values(s.q).filter(x => x.bin).length === 0);
  // retry within a session: wrong, then right, must not count as first-try
  await p.goto(URL0 + '#/learn'); await p.waitForSelector('.node'); await p.locator('.node').nth(1).click(); await p.waitForSelector('.question');
  const q2 = await answer(p, false); await p.click('[data-act=continue]');
  let guard = 0; while (!(await p.$('.endscreen')) && guard++ < 30) { await p.waitForSelector('.question'); await answer(p, true); await p.click('[data-act=continue]'); }
  const first = await p.textContent('.endstat:nth-child(2) b'); ok('B8 retried question does not count as first try', first !== '100%', first);
  s = await store(p); ok('B9 retry does not clear stats', s.q[q2.id].wrong === 1 && s.q[q2.id].right === 0 && s.q[q2.id].bin);
  // keyboard
  await p.click('.endscreen button'); await p.waitForSelector('.node'); await p.locator('.node').nth(2).click(); await p.waitForSelector('.question');
  await p.keyboard.press('2'); ok('B10 number key selects', await p.locator('.opt.sel').count() === 1);
  await p.keyboard.press('Enter'); await p.waitForSelector('[data-act=continue]'); await p.keyboard.press('Enter'); await p.waitForSelector('[data-act=check]');
  ok('B11 Enter checks and continues', true);
  await c.close(); }

// ---- C. Mock exams
{ const { p, c } = await ctx();
  await p.goto(URL0 + '#/mock'); await p.waitForSelector('[data-mock=mini]'); await p.screenshot({ path: SHOTS + 'mock-home.png' });
  await p.click('[data-mock=mini]'); await p.waitForSelector('.mockbar');
  await p.screenshot({ path: SHOTS + 'mock-question.png' });
  let s = await store(p); ok('C1 mini mock has 50 unique items', s.mock.ids.length === 50 && new Set(s.mock.ids).size === 50);
  const qmap = await p.evaluate(ids => ids.map(id => window.CSE_QUESTIONS.find(q => q.id === id).subject), s.mock.ids); const mix = {}; qmap.forEach(x => { mix[x] = (mix[x] || 0) + 1; });
  ok('C2 all four subjects included', Object.keys(mix).length === 4, JSON.stringify(mix));
  const q0 = await currentQ(p); await clickOpt(p, q0.right);
  ok('C3 no answer revealed during mock', await p.locator('.opt.right, .opt.wrong, .verdict').count() === 0);
  await p.click('[data-act=next]'); await p.click('[data-act=prev]');
  ok('C4 answer kept when navigating back', await p.locator('.opt.sel').count() === 1);
  await p.click('[aria-label="Pause and exit"]'); await p.waitForSelector('[data-act=resume]');
  const remA = (await store(p)).mock.remaining;
  await p.waitForTimeout(2500); await p.reload(); await p.waitForSelector('[data-act=resume]');
  const remB = (await store(p)).mock.remaining; ok('C5 pause stops the clock across reload', remB === remA, `${remA}->${remB}`);
  await p.click('[data-act=resume]'); await p.waitForSelector('.mockbar');
  s = await store(p);
  for (let i = s.mock.idx; i < 50; i++) { const q = await currentQ(p); await clickOpt(p, q.right); if (i < 49) await p.click('[data-act=next]'); }
  await p.click('[data-act=palette]'); await p.waitForSelector('.pal'); await p.screenshot({ path: SHOTS + 'mock-palette.png' }); await p.keyboard.press('Escape');
  await p.click('[data-act=next]'); await p.waitForSelector('.modal'); await p.click('.modal .btn.good'); await p.waitForSelector('[data-score]');
  ok('C6 all right scores 100%', (await p.getAttribute('[data-score]', 'data-score')) === '100'); await p.screenshot({ path: SHOTS + 'mock-result.png' });
  s = await store(p); ok('C7 result saved and mock cleared', s.mock === null && s.mocks.length === 1 && s.mocks[0].right === 50);
  // Unanswered exam scores 0 and timer auto-submits
  await p.goto(URL0 + '#/learn'); await p.goto(URL0 + '#/mock'); await p.waitForSelector('[data-mock=mini]'); await p.click('[data-mock=mini]'); await p.waitForSelector('.mockbar');
  await p.click('[aria-label="Pause and exit"]'); await p.waitForSelector('[data-act=resume]');
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('tarsi-cse-v1')); s.mock.remaining = 2000; localStorage.setItem('tarsi-cse-v1', JSON.stringify(s)); });
  await p.reload(); await p.waitForSelector('[data-act=resume]'); await p.click('[data-act=resume]');
  await p.waitForSelector('[data-score]', { timeout: 7000 }); ok('C8 timer expiry submits; blank scores 0', (await p.getAttribute('[data-score]', 'data-score')) === '0');
  ok('C9 missed items reviewable', await p.locator('details.rev').count() === 50);
  // Full mock
  await p.goto(URL0 + '#/learn'); await p.goto(URL0 + '#/mock'); await p.waitForSelector('[data-mock=full]'); await p.click('[data-mock=full]'); await p.waitForSelector('.mockbar');
  s = await store(p); ok('C10 full mock is 170 unique items, 190 min', s.mock.ids.length === 170 && new Set(s.mock.ids).size === 170 && Math.abs(s.mock.remaining - 190 * 60000) < 3000);
  await p.click('[aria-label="Pause and exit"]'); await p.waitForSelector('[data-mock=full]'); await p.click('[data-mock=full]'); await p.waitForSelector('.modal');
  ok('C11 asks before discarding an unfinished mock', (await p.textContent('.modal h2')).includes('Replace'));
  await c.close(); }

// ---- D. Backup, flags, reset
{ const { p, c } = await ctx();
  await p.locator('.node').first().click(); await p.waitForSelector('.question'); const q = await answer(p, false);
  await p.click('.flagbtn'); await p.waitForSelector('.modal textarea'); await p.fill('.modal textarea', 'test note'); await p.click('.modal .btn');
  let s = await store(p); ok('D1 flag saved with note', s.flags[q.id]?.note === 'test note');
  await p.click('[data-act=continue]'); await p.click('[aria-label="Leave lesson"]'); await p.waitForSelector('.modal'); await p.click('.modal .btn.ghost');
  await p.goto(URL0 + '#/me'); await p.waitForSelector('[data-act=backup]'); await p.screenshot({ path: SHOTS + 'progress.png', fullPage: true });
  ok('D2 flag listed on Progress', (await p.textContent('main')).includes(q.id));
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-act=backup]')]); const file = SHOTS + 'backup.json'; await dl.saveAs(file);
  await p.click('button:has-text("Reset")'); await p.click('.modal .btn.danger'); s = await store(p); ok('D3 reset clears data', s.xp === 0 && !Object.keys(s.q).length);
  await p.setInputFiles('input[type=file]', file); await p.waitForSelector('.modal'); await p.click('.modal .btn.good'); s = await store(p); ok('D4 backup restores data', s.flags[q.id]?.note === 'test note' && s.q[q.id]);
  fs.writeFileSync(SHOTS + 'bad.json', '{"hello":1}'); await p.setInputFiles('input[type=file]', SHOTS + 'bad.json'); await p.waitForSelector('.toast:has-text("not a valid")'); ok('D5 invalid backup refused', true);
  await c.close(); }

// ---- F. Guide tab
{ const { p, c } = await ctx();
  await p.click('.mobile-tabs a[href="#/guide"]'); await p.waitForSelector('.guide');
  const text = await p.textContent('main'); const n = await p.evaluate(() => window.CSE_QUESTIONS.length);
  ok('F1 Guide opens from the tab bar', (await p.textContent('h1')) === 'How this app works' && await p.locator('.mobile-tabs a.on').textContent() === 'Guide');
  ok('F2 Guide uses live numbers', text.includes(`${n} original practice questions`) && text.includes('38 short lessons') && text.includes('5 hearts') && text.includes('170 items in 3 h 10 min') && text.includes('50 items in 56 min') && text.includes('2 separate sessions') && text.includes('30 XP'));
  await p.screenshot({ path: SHOTS + 'guide-mobile.png', fullPage: true });
  for (const w of [320, 390]) { await p.setViewportSize({ width: w, height: 700 }); const fit = await p.evaluate(() => [...document.querySelectorAll('.mobile-tabs .tab')].map(t => { const r = document.createRange(); r.selectNodeContents(t); return r.getClientRects().length && t.scrollWidth <= t.clientWidth && t.getBoundingClientRect().height < 70; })); ok(`F3 five tabs fit on one line at ${w}px`, fit.length === 5 && fit.every(Boolean), JSON.stringify(fit)); }
  await p.setViewportSize({ width: 390, height: 844 }); await p.goto(URL0 + '#/learn'); await p.reload(); await p.waitForSelector('.node'); ok('F4 path still loads after visiting Guide', await p.locator('.node').count() === 38);
  await c.close(); }

// ---- E. Layout on every tab: desktop, dark, narrow. Storage blocked. Offline.
for (const [name, opts] of [['desktop', { viewport: { width: 1280, height: 800 } }], ['dark-mobile', { colorScheme: 'dark' }], ['narrow-320', { viewport: { width: 320, height: 640 } }], ['dark-desktop', { viewport: { width: 1280, height: 800 }, colorScheme: 'dark' }]]) {
  const { p, c } = await ctx(opts); const over = {};
  for (const t of ['learn', 'practice', 'mock', 'me', 'guide']) { await p.goto(URL0 + '#/' + t); await p.waitForTimeout(120); over[t] = await overflow(p); await p.screenshot({ path: `${SHOTS}${name}-${t}.png` }); }
  await p.goto(URL0 + '#/learn'); await p.waitForSelector('.node'); await p.locator('.node').first().click(); await p.waitForSelector('.question'); await answer(p, false); await p.waitForSelector('.foot.bad'); await p.screenshot({ path: `${SHOTS}${name}-feedback.png` });
  const sk = await overflow(p);
  ok(`E ${name}: no sideways scrolling`, Object.values(over).every(v => v <= 0) && sk <= 0, JSON.stringify(over));
  await c.close(); }
{ const c = await browser.newContext({ viewport: { width: 390, height: 844 } }); await c.addInitScript(() => { const t = () => { throw new Error('blocked'); }; Storage.prototype.getItem = t; Storage.prototype.setItem = t; }); const p = await c.newPage(); const e0 = errors.length; p.on('pageerror', e => errors.push('pageerror ' + e.message)); await p.goto(URL0); await p.waitForSelector('.node');
  await p.locator('.node').first().click(); await p.waitForSelector('.question'); await answer(p, true); await p.click('[data-act=continue]'); ok('E5 runs with storage blocked', errors.length === e0); await c.close(); }
{ const { p, c } = await ctx(); const total = await p.evaluate(() => window.CSE_QUESTIONS.length); await p.evaluate(() => navigator.serviceWorker.ready); await p.reload(); await p.waitForSelector('.node'); await p.waitForFunction(() => navigator.serviceWorker.controller); await c.setOffline(true); await p.reload(); await p.waitForSelector('.node'); const cnt = await p.evaluate(() => window.CSE_QUESTIONS.length); await p.locator('.node').first().click(); await p.waitForSelector('.question'); const fontOk = await p.evaluate(async () => { await document.fonts.ready; return document.fonts.check('700 16px Nunito'); }); ok('E6 works offline after first load', cnt === total && fontOk, `questions ${cnt}, font ${fontOk}`); await c.close(); }

ok('Z no JS or console errors in any run', errors.length === 0, errors.slice(0, 5).join(' | '));
console.log(`\n${results.filter(r => r[1]).length}/${results.length} passed`); await browser.close(); srv.close(); process.exit(results.some(r => !r[1]) ? 1 : 0);
