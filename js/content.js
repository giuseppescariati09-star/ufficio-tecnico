export const UFFICI = [
  { id: 'procedimento', nome: 'Procedimento e Comune' },
  { id: 'territorio', nome: 'Territorio' },
  { id: 'beni', nome: 'Beni del Comune' },
  { id: 'opere', nome: 'Opere pubbliche' },
];
const IDS = new Set(UFFICI.map((u) => u.id));
const filled = (v) => typeof v === 'string' && v.trim().length > 0;
const DAY = 86400000;

export function validateCase(c, { strict = false } = {}) {
  const e = [];
  for (const key of ['id', 'titolo', 'testo', 'spiegazione', 'norma', 'articolo']) {
    if (!filled(c[key])) e.push(`${c.id ?? '?'}: manca ${key}`);
  }
  if (!IDS.has(c.ufficio)) e.push(`${c.id}: ufficio non valido`);
  if (!Array.isArray(c.opzioni) || c.opzioni.length < 2 || !c.opzioni.every(filled)) e.push(`${c.id}: opzioni non valide`);
  if (!Number.isInteger(c.corretta) || c.corretta < 0 || c.corretta >= (c.opzioni?.length ?? 0)) e.push(`${c.id}: risposta corretta non valida`);
  if (!filled(c.fonte) || !c.fonte.startsWith('https://')) e.push(`${c.id}: fonte non valida`);
  if (strict && !/^\d{4}-\d{2}-\d{2}$/.test(c.verificato ?? '')) e.push(`${c.id}: non verificato`);
  return e;
}

export function validatePack(cases, opts = {}) {
  const errors = cases.flatMap((c) => validateCase(c, opts));
  const seen = new Set();
  for (const c of cases) {
    if (seen.has(c.id)) errors.push(`${c.id}: id duplicato`);
    seen.add(c.id);
  }
  return errors;
}

export function validateOral(q, { strict = false } = {}) {
  const e = [];
  for (const key of ['id', 'domanda', 'norma', 'fonte']) if (!filled(q[key])) e.push(`${q.id ?? '?'}: manca ${key}`);
  if (!Array.isArray(q.puntiChiave) || q.puntiChiave.length < 2) e.push(`${q.id}: punti chiave insufficienti`);
  if (strict && !q.verificato) e.push(`${q.id}: non verificato`);
  return e;
}

export function isStale(verified, today, days = 90) {
  if (!verified) return true;
  return (Date.parse(today) - Date.parse(verified)) / DAY > days;
}

export async function loadContent(fetcher = fetch) {
  const get = async (path) => {
    const res = await fetcher(path);
    if (!res.ok) throw new Error(`${path}: ${res.status}`);
    return res.json();
  };
  const [config, ...packs] = await Promise.all([
    get('content/config.json'),
    ...UFFICI.map((u) => get(`content/${u.id}.json`)),
  ]);
  const oral = await get('content/orale.json');
  return { config, cases: packs.flat(), oral };
}
