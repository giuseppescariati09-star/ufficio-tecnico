export const MATERIE = [
  { id: 'procedimento', nome: 'Procedimento amministrativo', ufficio: 'procedimento' },
  { id: 'enti-locali', nome: 'Organi del Comune', ufficio: 'procedimento' },
  { id: 'contabilita', nome: 'Bilancio e contabilità', ufficio: 'procedimento' },
  { id: 'costituzione', nome: 'Costituzione', ufficio: 'procedimento' },
  { id: 'anticorruzione', nome: 'Anticorruzione', ufficio: 'procedimento' },
  { id: 'trasparenza', nome: 'Trasparenza e accesso civico', ufficio: 'procedimento' },
  { id: 'edilizia', nome: 'Edilizia', ufficio: 'territorio' },
  { id: 'urbanistica', nome: 'Urbanistica', ufficio: 'territorio' },
  { id: 'paesaggio', nome: 'Paesaggio e aree protette', ufficio: 'territorio' },
  { id: 'ambiente', nome: 'Ambiente', ufficio: 'territorio' },
  { id: 'patrimonio', nome: 'Patrimonio del Comune', ufficio: 'beni' },
  { id: 'espropri', nome: 'Espropri', ufficio: 'beni' },
  { id: 'demanio', nome: 'Demanio marittimo', ufficio: 'beni' },
  { id: 'contratti', nome: 'Contratti pubblici', ufficio: 'opere' },
  { id: 'digitale', nome: 'Piattaforme e MePA', ufficio: 'opere' },
  { id: 'sicurezza', nome: 'Sicurezza nei cantieri', ufficio: 'opere' },
];

export const LEGGI = [
  { id: 'contratti', nome: 'Codice dei contratti pubblici', sigla: 'D.Lgs. 36/2023', match: ['D.Lgs. 36/2023'] },
  { id: 'edilizia', nome: 'Testo unico edilizia', sigla: 'D.P.R. 380/2001', match: ['D.P.R. 380/2001'] },
  { id: 'l241', nome: 'Procedimento amministrativo', sigla: 'L. 241/1990', match: ['L. 241/1990'] },
  { id: 'tuel', nome: 'Testo unico enti locali', sigla: 'D.Lgs. 267/2000', match: ['D.Lgs. 267/2000'] },
  { id: 'sicurezza', nome: 'Testo unico sicurezza', sigla: 'D.Lgs. 81/2008', match: ['D.Lgs. 81/2008'] },
  { id: 'espropri', nome: 'Testo unico espropri', sigla: 'D.P.R. 327/2001', match: ['D.P.R. 327/2001'] },
  { id: 'civile', nome: 'Codice civile', sigla: 'Beni pubblici', match: ['Codice civile'] },
  { id: 'navigazione', nome: 'Codice della navigazione', sigla: 'Demanio marittimo', match: ['Codice della navigazione'] },
  { id: 'paesaggio', nome: 'Codice dei beni culturali e del paesaggio', sigla: 'D.Lgs. 42/2004', match: ['D.Lgs. 42/2004'] },
  { id: 'ambiente', nome: 'Codice dell\'ambiente', sigla: 'D.Lgs. 152/2006', match: ['D.Lgs. 152/2006'] },
  { id: 'costituzione', nome: 'Costituzione', sigla: 'Titolo V e art. 97', match: ['Costituzione'] },
  { id: 'trasparenza', nome: 'Decreto trasparenza', sigla: 'D.Lgs. 33/2013', match: ['D.Lgs. 33/2013'] },
  { id: 'anticorruzione', nome: 'Legge anticorruzione', sigla: 'L. 190/2012', match: ['L. 190/2012'] },
  { id: 'urbanistica', nome: 'Standard e legge urbanistica', sigla: 'D.M. 1444/1968 e L. 1150/1942', match: ['D.M. 1444/1968', 'L. 1150/1942'] },
  { id: 'semplificata', nome: 'Autorizzazione paesaggistica semplificata', sigla: 'D.P.R. 31/2017', match: ['D.P.R. 31/2017'] },
  { id: 'lazio', nome: 'Norme e atti del Lazio', sigla: 'Leggi, regolamenti e piani regionali', match: ['L.R. Lazio', 'R.R. Lazio', 'PTPR Lazio', 'PUAR Lazio', 'Regione Lazio'] },
  { id: 'altre', nome: 'Altre fonti', sigla: 'Soglie UE e mercato elettronico', match: ['L. 296/2006', 'Reg. delegato', 'Consip'] },
];

const NOT_ARTICLES = /^(?!.*\bart).*/;
const normalize = (text) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function casesOfLaw(cases, lawId) {
  const law = LEGGI.find((l) => l.id === lawId);
  if (!law) return [];
  return cases.filter((c) => law.match.some((m) => c.norma.includes(m)));
}

export function statusOf(state, today) {
  if (!state || !Number.isInteger(state.box) || typeof state.due !== 'string') return 'nuova';
  if (state.due <= today) return 'ripasso';
  return state.box >= 3 ? 'padroneggiata' : 'corso';
}

export const isMarked = (progress, id) => progress[`mark-${id}`]?.marked === true;

export function filterCases(cases, { query = '', stato = 'tutte' } = {}, progress = {}, today = '') {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  return cases.filter((c) => {
    if (stato === 'segnate' && !isMarked(progress, c.id)) return false;
    if (!['tutte', 'segnate'].includes(stato) && statusOf(progress[c.id], today) !== stato) return false;
    if (!words.length) return true;
    const text = normalize(`${c.titolo} ${c.testo} ${c.norma} ${c.articolo}`);
    return words.every((w) => text.includes(w));
  });
}

export function shouldGrade(state, correct, today) {
  if (!correct) return true;
  const status = statusOf(state, today);
  return status === 'nuova' || status === 'ripasso';
}

export const citation = (c) => `${c.norma}, ${c.articolo}`;

export function firstArticle(text) {
  return text.match(/artt?\.\s*(\d+(?:-[a-z]+)?)/i)?.[1] ?? '';
}

export function articleNumber(c) {
  const parts = firstArticle(c.articolo).split('-');
  const suffix = ['bis', 'ter', 'quater', 'quinquies', 'sexies', 'septies', 'octies', 'nonies'].indexOf(parts[1]) + 1;
  return Number(parts[0] || 9999) + suffix / 100;
}

function hash(text) {
  let h = 7;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) % 1000003;
  return h;
}

const usable = (c) => !c.norma.includes(';') && firstArticle(c.articolo) !== '' && !NOT_ARTICLES.test(c.articolo);

export function buildLawCases(cases) {
  const pool = cases.filter(usable);
  const rotated = (list, seed) => {
    const offset = list.length ? seed % list.length : 0;
    return [...list.slice(offset), ...list.slice(0, offset)];
  };
  return pool.map((c) => {
    const right = citation(c);
    const article = firstArticle(c.articolo);
    const distinct = (list) => [...new Set(list.map(citation))];
    const sameLaw = distinct(pool.filter((o) => o.norma === c.norma && firstArticle(o.articolo) !== article && citation(o) !== right));
    const otherLaw = distinct(pool.filter((o) => o.norma !== c.norma && o.ufficio === c.ufficio));
    const seed = hash(c.id);
    const articles = new Set([article]);
    const wrong = [];
    for (const option of rotated(sameLaw, seed)) {
      if (wrong.length === 3) break;
      const a = firstArticle(option);
      if (!articles.has(a)) { wrong.push(option); articles.add(a); }
    }
    for (const option of rotated(otherLaw, seed)) {
      if (wrong.length === 3) break;
      wrong.push(option);
    }
    const opzioni = [...wrong];
    const corretta = seed % 4;
    opzioni.splice(Math.min(corretta, opzioni.length), 0, right);
    return {
      id: `n-${c.id}`,
      tipo: 'norma',
      ufficio: c.ufficio,
      materia: c.materia,
      titolo: `Trova la norma: ${c.titolo}`,
      domanda: 'Quale norma disciplina direttamente questo caso?',
      testo: c.testo,
      opzioni,
      corretta: Math.min(corretta, opzioni.length - 1),
      spiegazione: c.spiegazione,
      norma: c.norma,
      articolo: c.articolo,
      fonte: c.fonte,
      verificato: c.verificato,
      verificatoSu: c.verificatoSu,
    };
  }).filter((q) => q.opzioni.length === 4);
}
