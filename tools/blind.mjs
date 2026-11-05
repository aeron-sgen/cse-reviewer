// Writes .verify/<subject>.blind.json: same questions with answer, explanation and source removed.
import fs from 'fs'; const s = process.argv[2];
const qs = JSON.parse(fs.readFileSync(`data/src/${s}.json`, 'utf8'));
fs.writeFileSync(`.verify/${s}.blind.json`, JSON.stringify(qs.map(({ id, skill, lang, passage, table, question, options }) => ({ id, skill, lang, passage, table, question, options })), null, 1));
console.log('blind', s, qs.length);
