// Merges data/src/*.json into questions.js, the file the app loads.
import fs from 'fs'; import { SCOPE } from './skills.mjs';
const all = Object.keys(SCOPE).flatMap(s => JSON.parse(fs.readFileSync(`data/src/${s}.json`, 'utf8')));
fs.writeFileSync('questions.js', 'window.CSE_QUESTIONS=' + JSON.stringify(all) + ';\n');
console.log('built', all.length);
