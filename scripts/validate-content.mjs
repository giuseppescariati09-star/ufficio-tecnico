import { readFileSync } from 'node:fs';
import { UFFICI, validateOral, validatePack } from '../js/content.js';

const strict = process.argv.includes('--strict');
const read = (name) => JSON.parse(readFileSync(new URL(`../content/${name}.json`, import.meta.url)));
const cases = UFFICI.flatMap((u) => read(u.id));
const oral = read('orale');
const errors = [...validatePack(cases, { strict }), ...oral.flatMap((q) => validateOral(q, { strict }))];
const pending = cases.filter((c) => !c.verificato).length + oral.filter((q) => !q.verificato).length;
console.log(`${cases.length} casi, ${oral.length} domande orali, ${pending} da verificare`);
for (const e of errors) console.error(e);
process.exit(errors.length ? 1 : 0);
