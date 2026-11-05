// Usage: node tools/validate.mjs [subject]   Exits 1 on any error.
import fs from 'fs'; import { SCOPE } from './skills.mjs';
const only = process.argv[2]; const errs = []; const seenId = new Set(); const seenQ = new Map(); let total = 0;
for (const subject of Object.keys(SCOPE)) {
  if (only && only !== subject) continue;
  const f = `data/src/${subject}.json`;
  if (!fs.existsSync(f)) { errs.push(`${f}: missing`); continue; }
  let qs; try { qs = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { errs.push(`${f}: bad JSON ${e.message}`); continue; }
  if (!Array.isArray(qs)) { errs.push(`${f}: not an array`); continue; }
  const counts = {};
  for (const q of qs) {
    total++; const t = q.id || JSON.stringify(q).slice(0, 50); const bad = m => errs.push(`${t}: ${m}`);
    if (!q.id || seenId.has(q.id)) bad('missing/duplicate id'); seenId.add(q.id);
    if (q.subject !== subject) bad('wrong subject');
    if (!(q.skill in SCOPE[subject])) bad('unknown skill ' + q.skill);
    counts[q.skill] = (counts[q.skill] || 0) + 1;
    if (!['en', 'fil'].includes(q.lang)) bad('lang');
    if (subject !== 'verbal' && q.lang !== 'en') bad('scope says this subject is in English');
    if (![1, 2, 3].includes(q.difficulty)) bad('difficulty');
    if (typeof q.question !== 'string' || q.question.trim().length < 5) bad('question');
    if (!Array.isArray(q.options) || q.options.length !== 4 || q.options.some(o => typeof o !== 'string' || !o.trim())) bad('need 4 non-empty options');
    else {
      if (new Set(q.options.map(o => o.trim().toLowerCase())).size !== 4) bad('duplicate options');
      if (q.options.some(o => /\b(all|none|both) of the (above|choices)\b|\b(lahat|wala) sa (itaas|nabanggit)\b|\b(A|B|C|D) and (A|B|C|D)\b/i.test(o))) bad('position-dependent option breaks shuffling');
    }
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) bad('answer index');
    if (typeof q.explanation !== 'string' || q.explanation.trim().length < 15) bad('explanation');
    if (/\b(option|choice|letter) [A-D1-4]\b/i.test(q.explanation || '')) bad('explanation refers to option position');
    if (subject === 'general' && !(q.source && q.source.trim())) bad('general info needs source');
    if (q.table && !(Array.isArray(q.table.headers) && Array.isArray(q.table.rows) && q.table.rows.every(r => r.length === q.table.headers.length))) bad('table shape');
    const key = (q.question || '').trim().toLowerCase() + '|' + (q.passage || '').slice(0, 40);
    if (seenQ.has(key)) bad('duplicate of ' + seenQ.get(key)); seenQ.set(key, q.id);
  }
  for (const [s, n] of Object.entries(SCOPE[subject])) if ((counts[s] || 0) < n) errs.push(`${subject}/${s}: ${counts[s] || 0} of ${n}`);
  if (subject === 'verbal') { const fil = qs.filter(q => q.lang === 'fil').length; if (fil < qs.length * 0.35) errs.push(`verbal: only ${fil}/${qs.length} in Filipino`); }
  console.log(subject, qs.length, JSON.stringify(counts));
}
console.log('total', total, 'errors', errs.length); errs.slice(0, 60).forEach(e => console.log(' -', e)); process.exit(errs.length ? 1 : 0);
