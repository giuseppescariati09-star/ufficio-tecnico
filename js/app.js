import { ICONS } from './icons.js';
import { createStore } from './storage.js';
import { isStale, loadContent, UFFICI } from './content.js';
import { daysUntil, grade, localToday, mastery, todayQueue } from './review.js';
import { buildExam, remainingSeconds, score, shuffle } from './exam.js';
import { createSync } from './sync.js';
import { LEGGI, MATERIE, articleNumber, buildLawCases, casesOfLaw, citation, filterCases, isMarked, shouldGrade, statusOf } from './catalog.js';

const store = createStore();
const root = document.getElementById('app');
let content = null;
let sync = null;
let syncTimer = null;
let session = null;
let catalogQuery = '';
let collectionFilter = 'tutte';
let cleanup = () => {};

const SVG = 'http://www.w3.org/2000/svg';

function icon(name) {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = ICONS[name];
  return svg;
}

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false || value == null) continue;
    if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else if (key === 'class') el.className = value;
    else if (key === 'width') el.style.width = value;
    else if (key in el && key !== 'list') el[key] = value;
    else el.setAttribute(key, value === true ? '' : value);
  }
  el.append(...children.flat().filter((c) => c != null && c !== false));
  return el;
}

const nomeUfficio = (id) => UFFICI.find((u) => u.id === id)?.nome ?? id;
const go = (hash) => { if (location.hash === hash) render(); else location.hash = hash; };

function mount(view, { tabs = false } = {}) {
  root.replaceChildren(view);
  document.body.classList.toggle('has-tabs', tabs);
  if (tabs) root.append(tabBar());
  window.scrollTo(0, 0);
  view.querySelector('h1')?.focus({ preventScroll: true });
}

function tabBar() {
  const raw = location.hash.replace('#', '') || 'scrivania';
  const current = raw === 'leggi' || raw.startsWith('legge-') || raw.startsWith('materia-') || raw.startsWith('scheda-') ? 'materie' : raw;
  const tab = (id, label, ic) => h('a', { href: `#${id}`, 'aria-current': current === id ? 'page' : null }, icon(ic), label);
  return h('div', { class: 'tabbar' }, h('nav', { 'aria-label': 'Sezioni' },
    tab('scrivania', 'Scrivania', 'folder'), tab('materie', 'Materie', 'layers'), tab('scritto', 'Scritto', 'clock'), tab('orale', 'Orale', 'mic'), tab('profilo', 'Profilo', 'user')));
}

function largeTitle(text) {
  return h('h1', { class: 'large-title', tabIndex: -1 }, text);
}

function storageWarning() {
  return store.persistent ? null : h('p', { class: 'notice', role: 'status' }, icon('triangle-alert'),
    h('span', {}, 'Questo browser non permette di salvare. Puoi studiare, ma il progresso si perderà alla chiusura.'));
}

function confirmDialog({ title, body, confirm, destructive, cancel = 'Annulla' }) {
  return new Promise((resolve) => {
    const dialog = h('dialog', {},
      h('p', { class: 'dialog-title' }, title),
      h('p', { class: 'dialog-body muted' }, body),
      h('div', { class: 'dialog-actions' },
        h('button', { class: destructive ? 'destructive' : 'primary', onclick: () => dialog.close('ok') }, confirm),
        h('button', { onclick: () => dialog.close('no') }, cancel)));
    dialog.addEventListener('close', () => { dialog.remove(); resolve(dialog.returnValue === 'ok'); });
    root.append(dialog);
    dialog.showModal();
  });
}

function sourceLink(c) {
  return h('a', { class: 'source', href: c.fonte, target: '_blank', rel: 'noopener noreferrer' },
    `Leggi la norma: ${c.norma}${c.articolo ? `, ${c.articolo}` : ''}`, icon('external-link'));
}

function verifiedNote(c) {
  return c.verificato
    ? h('p', { class: 'foot' }, `Controllato il ${c.verificato.split('-').reverse().join('/')} su ${c.verificatoSu}.`)
    : h('p', { class: 'foot' }, 'Bozza: non ancora controllata sul testo ufficiale.');
}

const stamped = (state) => ({ ...state, updatedAt: new Date().toISOString() });

function scheduleSync() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(runSync, 1500);
}

async function runSync() {
  const result = await sync?.syncNow();
  const route = location.hash.replace('#', '') || 'scrivania';
  if (result?.changed && route === 'scrivania') render();
}

/* Scrivania */
function queue() {
  const { newLimit, reviewLimit } = store.state.settings;
  const today = localToday();
  const main = todayQueue(content.cases, store.state.progress, today, { newLimit, reviewLimit });
  const law = todayQueue(content.lawCases, store.state.progress, today, { newLimit: 2, reviewLimit: 4 });
  return [...main, ...law];
}

function nextExam() {
  const today = localToday();
  const exams = [['Scritto', content.config.dataScritto], ['Orale', content.config.dataOrale]];
  for (const [name, date] of exams) {
    if (!date) continue;
    const days = daysUntil(date, today);
    if (days > 1) return `${name} tra ${days} giorni`;
    if (days === 1) return `${name} domani`;
    if (days === 0) return `${name} oggi`;
  }
  return null;
}

function renderDesk() {
  const q = queue();
  const today = localToday();
  const progress = store.state.progress;
  const reviews = q.filter((c) => statusOf(progress[c.id], today) === 'ripasso').length;
  const fresh = q.length - reviews;
  const marked = content.cases.filter((c) => isMarked(progress, c.id));
  const weakest = MATERIE.map((m) => {
    const list = content.cases.filter((c) => c.materia === m.id);
    return { m, list, value: mastery(list, progress) };
  }).sort((a, b) => a.value - b.value)[0];
  const hero = q.length
    ? h('div', { class: 'group hero' },
      h('p', { class: 'muted small' }, 'Pratiche di oggi'),
      h('p', { class: 'hero-number' }, String(q.length)),
      h('p', { class: 'muted small' }, `${reviews} ${reviews === 1 ? 'ripasso' : 'ripassi'}, ${fresh} ${fresh === 1 ? 'nuova' : 'nuove'}, comprese le norme`))
    : h('div', { class: 'group hero' },
      h('p', { class: 'muted small' }, 'Pratiche di oggi'),
      h('p', { class: 'question' }, 'Scrivania in ordine'),
      h('p', { class: 'muted small' }, 'Per oggi hai finito. Se vuoi allenarti ancora, scegli una materia o prova una simulazione.'));
  mount(h('main', { class: 'screen' },
    h('div', {}, largeTitle('Scrivania'), nextExam() ? h('p', { class: 'muted' }, nextExam()) : null),
    storageWarning(),
    hero,
    q.length
      ? h('button', { class: 'primary', onclick: startToday }, 'Apri la prossima pratica')
      : h('button', { class: 'primary', onclick: () => go('#scritto') }, 'Fai una simulazione'),
    h('section', {},
      h('h2', { class: 'section-title' }, 'Allenamento mirato'),
      h('div', { class: 'group' },
        linkRow({ href: '#leggi', title: 'Leggi e codici', subtitle: `${LEGGI.length} fonti, domande in ordine di articolo` }),
        linkRow({ title: 'Trova la norma', subtitle: `${content.lawCases.length} domande su leggi e articoli`, onclick: () => startSession({ title: 'Trova la norma', cases: shuffle(content.lawCases).slice(0, 15), back: '#scrivania' }) }),
        linkRow({ href: `#materia-${weakest.m.id}`, title: `Da rinforzare: ${weakest.m.nome}`, subtitle: `Padronanza ${weakest.value}%` }),
        marked.length ? linkRow({ title: 'Domande segnate', value: String(marked.length), onclick: () => startSession({ title: 'Domande segnate', cases: shuffle(marked), back: '#scrivania' }) }) : null)),
    h('section', {},
      h('h2', { class: 'section-title' }, 'Padronanza per ufficio'),
      h('div', { class: 'group' }, UFFICI.map((u) => {
        const value = mastery(content.cases.filter((c) => c.ufficio === u.id), progress);
        return h('div', { class: 'row' },
          h('div', { class: 'row-line' }, h('span', {}, u.nome), h('span', { class: 'muted' }, `${value}%`)),
          h('div', { class: 'meter' }, h('span', { width: `${value}%` })));
      })))), { tabs: true });
}

/* Sessione di domande */
function startSession({ title, cases, back, grading = true }) {
  session = { title, cases, back, grading, index: 0, results: [] };
  go('#sessione');
}

function startToday() {
  startSession({ title: 'Pratiche di oggi', cases: queue(), back: '#scrivania' });
}

function toggleMark(id) {
  const key = `mark-${id}`;
  store.state.progress[key] = stamped({ marked: !isMarked(store.state.progress, id) });
  store.save();
  scheduleSync();
}

function markButton(id) {
  const button = h('button', { class: 'quiet mark', 'aria-pressed': String(isMarked(store.state.progress, id)) });
  const paint = () => {
    const on = isMarked(store.state.progress, id);
    button.setAttribute('aria-pressed', String(on));
    button.classList.toggle('on', on);
    button.replaceChildren(icon('bookmark'), on ? 'Segnata' : 'Segna per dopo');
  };
  button.addEventListener('click', () => { toggleMark(id); paint(); });
  paint();
  return button;
}

function renderSession() {
  if (!session) { go('#scrivania'); return; }
  if (session.index >= session.cases.length) { renderSummary(); return; }
  const c = session.cases[session.index];
  const total = session.cases.length;
  const order = shuffle(c.opzioni.map((text, index) => ({ text, index })));
  const letters = ['A', 'B', 'C', 'D'];
  const options = order.map((o, i) => h('button', { class: 'option', onclick: () => answer(o.index) },
    h('span', { class: 'letter', 'aria-hidden': 'true' }, letters[i]), h('span', { class: 'option-text' }, o.text)));
  const feedback = h('div', { class: 'feedback', 'aria-live': 'polite' });
  const dontKnow = h('button', { class: 'quiet', onclick: () => answer(-1) }, icon('circle-help'), 'Non lo so');
  let done = false;

  function next() {
    session.index += 1;
    cleanup();
    cleanup = () => {};
    renderSession();
  }

  function answer(index) {
    if (done) return;
    done = true;
    const correct = index === c.corretta;
    session.results.push({ id: c.id, correct });
    const today = localToday();
    if (session.grading && shouldGrade(store.state.progress[c.id], correct, today)) {
      store.state.progress[c.id] = stamped(grade(store.state.progress[c.id], correct, today));
      store.save();
      scheduleSync();
    }
    dontKnow.hidden = true;
    order.forEach((o, i) => {
      options[i].setAttribute('aria-disabled', 'true');
      if (o.index === c.corretta) { options[i].classList.add('right'); options[i].append(icon('check')); }
      else if (o.index === index) { options[i].classList.add('wrong'); options[i].append(icon('x')); }
    });
    const verdict = correct
      ? 'Giusto.'
      : (index === -1 ? 'Nessun problema: ora la vedi e torna nei ripassi.' : 'Non proprio. Torna nei ripassi.');
    const last = session.index === total - 1;
    feedback.append(
      h('p', { class: `verdict ${correct ? 'ok' : (index === -1 ? '' : 'no')}` }, verdict),
      h('div', { class: 'group law-card' },
        h('p', { class: 'law-name' }, icon('scale'), h('span', {}, citation(c))),
        h('p', { class: 'small' }, c.spiegazione)),
      sourceLink(c),
      verifiedNote(c),
      markButton(c.id),
      h('button', { class: 'primary sticky-next', onclick: next }, last ? 'Vedi il riepilogo' : 'Prossima domanda'));
    feedback.scrollIntoView({ block: 'nearest' });
  }

  const onKey = (e) => {
    if (e.target.matches('input, textarea')) return;
    if (!done && ['1', '2', '3', '4'].includes(e.key)) options[Number(e.key) - 1]?.click();
    if (done && e.key === 'Enter' && document.activeElement?.tagName !== 'A') { e.preventDefault(); next(); }
  };
  document.addEventListener('keydown', onKey);
  cleanup = () => document.removeEventListener('keydown', onKey);

  mount(h('main', { class: 'screen' },
    h('div', { class: 'nav' },
      h('a', { class: 'source back', href: session.back }, icon('chevron-left'), 'Esci'),
      h('span', { class: 'muted small' }, `${session.index + 1} di ${total}`)),
    h('div', { class: 'meter session-meter', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(total), 'aria-valuenow': String(session.index + 1), 'aria-label': 'Avanzamento' },
      h('span', { width: `${Math.round(((session.index + 1) / total) * 100)}%` })),
    h('div', {},
      h('p', { class: 'muted small' }, `${materiaName(c)} · ${c.titolo}`),
      h('h1', { class: 'question', tabIndex: -1 }, c.domanda ?? c.testo)),
    c.domanda ? h('p', { class: 'group case-text' }, c.testo) : null,
    h('div', { class: 'options' }, options),
    dontKnow,
    feedback));
}

function renderSummary() {
  const { results, cases, back, grading } = session;
  const right = results.filter((r) => r.correct).length;
  const wrong = results.filter((r) => !r.correct).map((r) => cases.find((c) => c.id === r.id));
  const percent = results.length ? Math.round((right / results.length) * 100) : 0;
  mount(h('main', { class: 'screen' },
    h('h1', { class: 'large-title', tabIndex: -1 }, 'Riepilogo'),
    h('div', { class: 'group hero' },
      h('p', { class: 'muted small' }, session.title),
      h('p', { class: 'hero-number' }, `${right} su ${results.length}`),
      h('div', { class: 'meter' }, h('span', { width: `${percent}%` })),
      h('p', { class: 'muted small summary-note' }, grading ? 'Il prossimo ripasso è già programmato.' : 'Questo giro di prova non cambia i ripassi.')),
    wrong.length ? h('section', {},
      h('h2', { class: 'section-title' }, 'Da rivedere'),
      h('div', { class: 'group' }, wrong.map((c) => h('details', {},
        h('summary', {}, c.titolo),
        h('div', {},
          h('p', { class: 'small' }, `Risposta giusta: ${c.opzioni[c.corretta]}`),
          h('p', { class: 'small muted' }, c.spiegazione),
          sourceLink(c)))))) : null,
    wrong.length ? h('button', { class: 'primary', onclick: () => startSession({ title: 'Riprova gli errori', cases: shuffle(wrong), back, grading: false }) },
      icon('rotate-ccw'), 'Riprova gli errori') : null,
    h('button', { class: wrong.length ? '' : 'primary', onclick: () => { session = null; go(back); } }, 'Chiudi il riepilogo')));
}

/* Materie e leggi */
const materiaName = (c) => MATERIE.find((m) => m.id === c.materia)?.nome ?? nomeUfficio(c.ufficio);
const STATUS = { nuova: 'Nuova', ripasso: 'Da ripassare', corso: 'In corso', padroneggiata: 'Padroneggiata' };

function linkRow({ href, title, subtitle, value, percent, onclick }) {
  return h('a', { class: 'link-row', href: href ?? '#', onclick: onclick ? (e) => { e.preventDefault(); onclick(); } : null },
    h('span', { class: 'link-main' },
      h('span', { class: 'link-title' }, title),
      subtitle ? h('span', { class: 'link-sub' }, subtitle) : null,
      percent === undefined ? null : h('span', { class: 'meter' }, h('span', { width: `${percent}%` }))),
    value ? h('span', { class: 'link-value' }, value) : null,
    icon('chevron-right'));
}

function questionRow(c, list, title) {
  const status = STATUS[statusOf(store.state.progress[c.id], localToday())];
  const marked = isMarked(store.state.progress, c.id);
  return linkRow({
    title: c.titolo,
    subtitle: `${c.articolo} · ${status}${marked ? ' · Segnata' : ''}`,
    onclick: () => startSession({ title, cases: [c, ...shuffle(list.filter((o) => o.id !== c.id))], back: location.hash || '#materie' }),
  });
}

function renderCatalog(tab) {
  const results = h('div', { class: 'catalog-results' });
  const search = h('input', {
    id: 'catalog-search', type: 'search', autocomplete: 'off', placeholder: 'Parola, legge o articolo', value: catalogQuery,
    oninput: (e) => { catalogQuery = e.target.value; paint(); },
  });

  function paint() {
    const query = catalogQuery.trim();
    if (query) {
      const found = filterCases(content.cases, { query }, store.state.progress, localToday());
      results.replaceChildren(h('section', {},
        h('h2', { class: 'section-title' }, `${found.length} ${found.length === 1 ? 'domanda trovata' : 'domande trovate'}`),
        h('div', { class: 'group' }, found.length
          ? found.map((c) => questionRow(c, found, `Ricerca: ${query}`))
          : h('div', { class: 'row' },
            h('p', { class: 'muted' }, 'Nessuna domanda. Prova con un numero di articolo o una parola più breve.'),
            h('button', { onclick: () => { catalogQuery = ''; search.value = ''; paint(); search.focus(); } }, 'Cancella la ricerca')))));
      return;
    }
    if (tab === 'leggi') {
      results.replaceChildren(h('section', {},
        h('h2', { class: 'section-title' }, 'Dalla più presente in archivio'),
        h('div', { class: 'group' }, LEGGI.map((l) => {
          const list = casesOfLaw(content.cases, l.id);
          return linkRow({ href: `#legge-${l.id}`, title: l.nome, subtitle: `${l.sigla} · ${list.length} ${list.length === 1 ? 'domanda' : 'domande'}`, percent: mastery(list, store.state.progress) });
        }))));
      return;
    }
    results.replaceChildren(...UFFICI.map((u) => h('section', {},
      h('h2', { class: 'section-title' }, u.nome),
      h('div', { class: 'group' }, MATERIE.filter((m) => m.ufficio === u.id).map((m) => {
        const list = content.cases.filter((c) => c.materia === m.id);
        return linkRow({ href: `#materia-${m.id}`, title: m.nome, subtitle: `${list.length} ${list.length === 1 ? 'domanda' : 'domande'}`, percent: mastery(list, store.state.progress) });
      })))));
  }

  const onKey = (e) => { if (e.key === '/' && document.activeElement !== search) { e.preventDefault(); search.focus(); } };
  document.addEventListener('keydown', onKey);
  cleanup = () => document.removeEventListener('keydown', onKey);
  paint();
  mount(h('main', { class: 'screen' },
    largeTitle('Materie'),
    h('nav', { class: 'segmented', 'aria-label': 'Vista' },
      h('a', { href: '#materie', 'aria-current': tab === 'materie' ? 'page' : null }, 'Materie'),
      h('a', { href: '#leggi', 'aria-current': tab === 'leggi' ? 'page' : null }, 'Leggi e codici')),
    h('label', { class: 'search', for: 'catalog-search' }, icon('search'), h('span', {}, 'Cerca'), search),
    results), { tabs: true });
}

function renderCollection({ title, subtitle, list, back, backLabel, sortByArticle, lawHref, schedaHref }) {
  const today = localToday();
  const ordered = sortByArticle ? [...list].sort((a, b) => articleNumber(a) - articleNumber(b)) : list;
  const lawIds = new Set(ordered.map((c) => `n-${c.id}`));
  const drills = content.lawCases.filter((q) => lawIds.has(q.id));
  const body = h('div', { class: 'group' });
  const filters = [['tutte', 'Tutte'], ['nuova', 'Nuove'], ['ripasso', 'Da ripassare'], ['segnate', 'Segnate']];
  const chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Filtra le domande' });

  function paint() {
    const shown = filterCases(ordered, { stato: collectionFilter }, store.state.progress, today);
    chips.replaceChildren(...filters.map(([id, label]) => h('button', {
      class: `chip${collectionFilter === id ? ' on' : ''}`, 'aria-pressed': String(collectionFilter === id),
      onclick: () => { collectionFilter = id; paint(); },
    }, label)));
    body.replaceChildren(...(shown.length
      ? shown.map((c) => questionRow(c, shown, title))
      : [h('div', { class: 'row' },
        h('p', { class: 'muted' }, 'Qui non ci sono domande con questo filtro.'),
        h('button', { onclick: () => { collectionFilter = 'tutte'; paint(); } }, 'Mostra tutte le domande'))]));
  }
  paint();
  const here = location.hash;
  mount(h('main', { class: 'screen' },
    h('div', { class: 'nav' }, h('a', { class: 'source back', href: back }, icon('chevron-left'), backLabel)),
    h('div', {}, h('h1', { class: 'large-title', tabIndex: -1 }, title), h('p', { class: 'muted' }, subtitle)),
    h('div', { class: 'group hero' },
      h('div', { class: 'row-line' }, h('span', { class: 'muted small' }, 'Padronanza'), h('span', { class: 'muted small' }, `${mastery(list, store.state.progress)}%`)),
      h('div', { class: 'meter' }, h('span', { width: `${mastery(list, store.state.progress)}%` }))),
    h('button', { class: 'primary', onclick: () => startSession({ title, cases: shuffle(list), back: here }) }, 'Allenati su tutte'),
    drills.length ? h('button', { onclick: () => startSession({ title: `Trova la norma: ${title}`, cases: shuffle(drills), back: here }) }, icon('scale'), 'Trova la norma') : null,
    schedaHref ? h('a', { class: 'button', href: schedaHref }, icon('book-open'), 'Leggi la scheda della legge') : null,
    lawHref ? h('a', { class: 'source', href: lawHref, target: '_blank', rel: 'noopener noreferrer' }, 'Apri il testo della legge', icon('external-link')) : null,
    h('section', {},
      h('h2', { class: 'section-title' }, sortByArticle ? 'Domande in ordine di articolo' : 'Domande'),
      chips,
      body)), { tabs: true });
}

function renderMateria(id) {
  const m = MATERIE.find((x) => x.id === id);
  if (!m) { go('#materie'); return; }
  const list = content.cases.filter((c) => c.materia === id);
  renderCollection({ title: m.nome, subtitle: `${nomeUfficio(m.ufficio)} · ${list.length} domande`, list, back: '#materie', backLabel: 'Materie' });
}

function renderLegge(id) {
  const l = LEGGI.find((x) => x.id === id);
  if (!l) { go('#leggi'); return; }
  const list = casesOfLaw(content.cases, id);
  const single = l.match.length === 1 && id !== 'altre' ? list.find((c) => c.norma === l.match[0])?.fonte : null;
  renderCollection({ title: l.nome, subtitle: `${l.sigla} · ${list.length} domande`, list, back: '#leggi', backLabel: 'Leggi e codici', sortByArticle: true, lawHref: single, schedaHref: l.scheda ? `#scheda-${id}` : null });
}

function renderScheda(id) {
  const doc = content.schede[id];
  if (!doc) { go('#leggi'); return; }
  const list = casesOfLaw(content.cases, id);
  const here = location.hash;
  mount(h('main', { class: 'screen' },
    h('div', { class: 'nav' }, h('a', { class: 'source back', href: `#legge-${id}` }, icon('chevron-left'), 'Domande')),
    h('div', {},
      h('h1', { class: 'large-title', tabIndex: -1 }, doc.titolo),
      h('p', { class: 'muted' }, doc.legge)),
    h('button', { class: 'primary', onclick: () => startSession({ title: doc.titolo, cases: shuffle(list), back: here }) }, `Allenati su ${list.length} domande`),
    h('a', { class: 'source', href: doc.fonte, target: '_blank', rel: 'noopener noreferrer' }, 'Apri il testo ufficiale', icon('external-link')),
    h('section', {},
      h('h2', { class: 'section-title' }, 'Scheda di studio'),
      h('div', { class: 'group' }, doc.sezioni.map((s) => h('details', { class: 'scheda' },
        h('summary', {}, h('span', {}, s.titolo), h('span', { class: 'link-value' }, String(s.punti.length))),
        h('div', {}, s.punti.map((p) => h('p', { class: 'scheda-point' },
          h('span', {}, p.testo), h('span', { class: 'scheda-art' }, p.articolo)))))))),
    doc.daRicontrollare.length ? h('section', {},
      h('h2', { class: 'section-title' }, 'Da controllare sul testo ufficiale'),
      h('details', { class: 'group scheda' },
        h('summary', {}, h('span', {}, 'Punti non confermati'), h('span', { class: 'link-value' }, String(doc.daRicontrollare.length))),
        h('div', {}, doc.daRicontrollare.map((t) => h('p', { class: 'small' }, t))))) : null,
    h('p', { class: 'foot' }, doc.aggiornamento)), { tabs: true });
}

/* Scritto */
function renderWrittenStart() {
  const { questions, minutes } = store.state.settings;
  const available = Math.min(questions, content.cases.length);
  const last = store.state.history.at(-1);
  mount(h('main', { class: 'screen' },
    largeTitle('Scritto'),
    h('div', { class: 'group hero' },
      h('p', { class: 'muted small' }, 'Simulazione'),
      h('p', { class: 'question' }, `${available} domande in ${minutes} minuti`),
      h('p', { class: 'muted small' }, `Per superarla servono almeno ${content.config.sogliaScritto} punti su 30.`)),
    available < questions ? h('p', { class: 'foot' }, `Per ora sono disponibili ${content.cases.length} casi. Il voto resta calcolato su 30.`) : null,
    h('button', { class: 'primary', onclick: startExam }, 'Inizia la simulazione'),
    last ? h('section', {},
      h('h2', { class: 'section-title' }, 'Ultima simulazione'),
      h('div', { class: 'group' }, h('div', { class: 'row row-line' },
        h('span', {}, last.date), h('span', { class: last.passed ? 'verdict ok' : 'verdict no' }, `${last.onThirty} su 30`)))) : null,
    h('p', { class: 'foot' }, 'Durata e numero di domande sono ipotesi: il bando non li indica. Altri concorsi simili usano 30 domande in 40-60 minuti. Puoi cambiarli nel profilo.')), { tabs: true });
}

function startExam() {
  const { questions, minutes } = store.state.settings;
  store.state.exam = { ...buildExam(content.cases, questions, minutes), index: 0 };
  store.save();
  go('#esame');
}

function renderExam() {
  const exam = store.state.exam;
  if (!exam) { go('#scritto'); return; }
  const byId = new Map(content.cases.map((c) => [c.id, c]));
  exam.ids = exam.ids.filter((id) => byId.has(id));
  if (!exam.ids.length || remainingSeconds(exam) === 0) { finishExam(); return; }
  exam.index = Math.min(exam.index ?? 0, exam.ids.length - 1);
  const c = byId.get(exam.ids[exam.index]);
  const timer = h('span', { class: 'timer', role: 'timer' });

  const tick = () => {
    const left = remainingSeconds(exam);
    timer.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    timer.classList.toggle('low', left <= 60);
    if (left === 0) finishExam();
  };
  tick();
  const interval = setInterval(tick, 1000);
  cleanup = () => clearInterval(interval);

  const move = (delta) => { exam.index += delta; store.save(); cleanup(); renderExam(); };
  exam.orders ??= {};
  exam.orders[c.id] ??= shuffle(c.opzioni.map((_, i) => i));
  const options = exam.orders[c.id].map((index) => h('button', {
    class: `option${exam.answers[c.id] === index ? ' selected' : ''}`,
    'aria-pressed': String(exam.answers[c.id] === index),
    onclick: () => { exam.answers[c.id] = index; store.save(); cleanup(); renderExam(); },
  }, c.opzioni[index]));
  const atEnd = exam.index === exam.ids.length - 1;

  mount(h('main', { class: 'screen' },
    h('div', { class: 'nav' },
      h('span', { class: 'muted small' }, `Domanda ${exam.index + 1} di ${exam.ids.length}`),
      timer),
    h('h1', { class: 'question', tabIndex: -1 }, c.testo),
    h('div', { class: 'options' }, options),
    h('div', { class: 'pair' },
      h('button', { onclick: () => move(-1), hidden: exam.index === 0 }, 'Indietro'),
      atEnd ? null : h('button', { onclick: () => move(1) }, 'Avanti')),
    h('button', { class: atEnd ? 'primary' : '', onclick: askFinish }, 'Consegna'),
    h('details', { class: 'group' },
      h('summary', {}, `Vai a una domanda (risposte date: ${Object.keys(exam.answers).length} di ${exam.ids.length})`),
      h('div', { class: 'exam-grid' }, exam.ids.map((id, i) => h('button', {
        class: `grid-cell${exam.answers[id] !== undefined ? ' done' : ''}${i === exam.index ? ' current' : ''}`,
        'aria-label': `Domanda ${i + 1}${exam.answers[id] !== undefined ? ', risposta data' : ''}`,
        onclick: () => move(i - exam.index),
      }, String(i + 1)))))));

  async function askFinish() {
    const missing = exam.ids.filter((id) => exam.answers[id] === undefined).length;
    if (missing && !(await confirmDialog({
      title: 'Consegnare ora?',
      body: `Hai ${missing} ${missing === 1 ? 'domanda' : 'domande'} senza risposta, e conteranno come errori.`,
      confirm: 'Consegna comunque',
      cancel: 'Continua',
    }))) return;
    finishExam();
  }
}

function finishExam() {
  cleanup();
  cleanup = () => {};
  const exam = store.state.exam;
  if (!exam) { go('#scritto'); return; }
  const result = score(exam, content.cases, content.config.sogliaScritto);
  const today = localToday();
  for (const id of result.wrongIds) {
    if (content.cases.some((c) => c.id === id)) store.state.progress[id] = stamped(grade(store.state.progress[id], false, today));
  }
  const at = new Date().toISOString();
  store.state.history = [...store.state.history, { at, updatedAt: at, date: today, onThirty: result.onThirty, passed: result.passed }].slice(-100);
  store.state.exam = null;
  store.save();
  scheduleSync();
  const wrong = result.wrongIds.map((id) => content.cases.find((c) => c.id === id)).filter(Boolean);
  mount(h('main', { class: 'screen' },
    h('h1', { class: 'large-title', tabIndex: -1 }, 'Risultato'),
    h('div', { class: 'group hero' },
      h('p', { class: 'hero-number' }, `${result.onThirty} su 30`),
      h('p', { class: `verdict ${result.passed ? 'ok' : 'no'}` },
        result.passed ? 'Prova superata.' : `Non ancora: servono ${content.config.sogliaScritto} punti.`),
      h('p', { class: 'muted small' }, `${result.correct} risposte giuste su ${result.total}.`)),
    wrong.length ? h('section', {},
      h('h2', { class: 'section-title' }, 'Da rivedere: torneranno tra le pratiche di domani'),
      h('div', { class: 'group' }, wrong.map((c) => h('details', { class: 'row-details' },
        h('summary', {}, c.titolo),
        h('div', {},
          h('p', { class: 'small' }, c.testo),
          h('p', { class: 'small' }, `Risposta giusta: ${c.opzioni[c.corretta]}`),
          h('p', { class: 'small muted' }, c.spiegazione),
          sourceLink(c)))))) : null,
    h('button', { class: 'primary', onclick: () => go('#scrivania') }, 'Torna alla scrivania')));
}

/* Orale */
function renderOralStart() {
  const done = Object.keys(store.state.oral).length;
  mount(h('main', { class: 'screen' },
    largeTitle('Orale'),
    h('div', { class: 'group hero' },
      h('p', { class: 'muted small' }, 'Davanti alla commissione'),
      h('p', { class: 'question' }, 'Rispondi a voce alta, come in aula'),
      h('p', { class: 'muted small' }, `Hai provato ${done} ${done === 1 ? 'domanda' : 'domande'} su ${content.oral.length}.`)),
    h('button', { class: 'primary', onclick: () => renderOralQuestion(pickOral()) }, 'Sorteggia una domanda'),
    h('p', { class: 'foot' }, 'L\'app non ascolta e non registra: alla fine ti valuti da solo sui punti chiave.')), { tabs: true });
}

function pickOral() {
  const scored = shuffle(content.oral).sort((a, b) => (store.state.oral[a.id]?.score ?? -1) - (store.state.oral[b.id]?.score ?? -1));
  return scored[0];
}

function renderOralQuestion(q) {
  const started = Date.now();
  const timer = h('span', { class: 'timer', role: 'timer' }, '0:00');
  const interval = setInterval(() => {
    const s = Math.floor((Date.now() - started) / 1000);
    timer.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }, 1000);
  cleanup = () => clearInterval(interval);
  mount(h('main', { class: 'screen' },
    h('div', { class: 'nav' },
      h('a', { class: 'source back', href: '#orale' }, icon('chevron-left'), 'Orale'), timer),
    h('h1', { class: 'question', tabIndex: -1 }, q.domanda),
    h('p', { class: 'muted' }, 'Parla ad alta voce. Quando hai finito, controlla cosa hai toccato.'),
    h('button', { class: 'primary', onclick: () => { cleanup(); cleanup = () => {}; renderOralReview(q); } }, 'Ho finito di parlare')));
}

function renderOralReview(q) {
  const boxes = q.puntiChiave.map((text) => {
    const input = h('input', { type: 'checkbox' });
    return { input, row: h('label', { class: 'check' }, input, h('span', {}, text)) };
  });
  mount(h('main', { class: 'screen' },
    h('div', { class: 'nav' }, h('a', { class: 'source back', href: '#orale' }, icon('chevron-left'), 'Orale')),
    h('h1', { class: 'question', tabIndex: -1 }, q.domanda),
    h('section', {},
      h('h2', { class: 'section-title' }, 'Segna i punti che hai spiegato bene'),
      h('div', { class: 'group' }, boxes.map((b) => b.row))),
    h('a', { class: 'source', href: q.fonte, target: '_blank', rel: 'noopener noreferrer' }, `Ripassa su: ${q.norma}`, icon('external-link')),
    verifiedNote(q),
    h('button', { class: 'primary', onclick: () => {
      const hit = boxes.filter((b) => b.input.checked).length;
      store.state.oral[q.id] = stamped({ score: hit / boxes.length, date: localToday() });
      store.save();
      scheduleSync();
      go('#orale');
    } }, 'Salva')));
}

/* Profilo */
function renderProfile() {
  const { settings } = store.state;
  const today = localToday();
  const all = [...content.cases, ...content.oral];
  const pending = all.filter((c) => !c.verificato).length;
  const stale = all.filter((c) => c.verificato && isStale(c.verificato, today)).length;
  const message = h('p', { class: 'small', role: 'status' });
  const number = (label, key, min, max) => h('label', { class: 'field' }, h('span', {}, label), h('input', {
    type: 'number', inputMode: 'numeric', min, max, value: settings[key],
    oninput: () => { message.textContent = ''; },
    onchange: (e) => {
      const value = Math.round(Number(e.target.value));
      if (!Number.isFinite(value) || value < min || value > max) {
        message.className = 'error';
        message.textContent = `${label}: inserisci un numero da ${min} a ${max}.`;
        e.target.value = settings[key];
        return;
      }
      settings[key] = value;
      store.save();
      message.className = 'small muted';
      message.textContent = 'Salvato.';
    },
  }));
  const file = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, 'aria-label': 'File di backup', onchange: async (e) => {
    const [f] = e.target.files;
    if (!f) return;
    try {
      store.importBackup(await f.text());
      sync.forceFull();
      scheduleSync();
      renderProfile();
    } catch (err) {
      message.className = 'error';
      message.textContent = err.message;
    }
  } });
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;

  mount(h('main', { class: 'screen' },
    largeTitle('Profilo'),
    storageWarning(),
    h('section', {},
      h('h2', { class: 'section-title' }, 'Concorso'),
      h('div', { class: 'group' },
        h('div', { class: 'row row-line' }, h('span', {}, 'Ente'), h('span', { class: 'muted' }, content.config.ente)),
        h('div', { class: 'row row-line' }, h('span', {}, 'Soglia'), h('span', { class: 'muted' }, `${content.config.sogliaScritto} su 30`)))),
    h('section', {},
      h('h2', { class: 'section-title' }, 'Allenamento'),
      h('div', { class: 'group' },
        number('Domande per simulazione', 'questions', 5, 200),
        number('Minuti per simulazione', 'minutes', 1, 240),
        number('Casi nuovi al giorno', 'newLimit', 0, 50),
        number('Ripassi al giorno', 'reviewLimit', 1, 200)),
      message),
    h('section', {},
      h('h2', { class: 'section-title' }, 'Contenuti'),
      h('div', { class: 'group' },
        h('div', { class: 'row row-line' }, h('span', {}, 'Da controllare'), h('span', { class: 'muted' }, String(pending))),
        h('div', { class: 'row row-line' }, h('span', {}, 'Verifica oltre 90 giorni'), h('span', { class: 'muted' }, String(stale))))),
    syncSection(),
    h('section', {},
      h('h2', { class: 'section-title' }, 'Backup'),
      h('div', { class: 'stack' },
        h('button', { onclick: exportBackup }, icon('download'), 'Esporta backup'),
        h('button', { onclick: () => file.click() }, icon('upload'), 'Importa'))),
    file,
    standalone ? null : h('p', { class: 'foot' }, 'Su iPhone: apri in Safari, tocca Condividi e scegli "Aggiungi alla schermata Home".'),
    h('button', { class: 'destructive', onclick: async () => {
      if (await confirmDialog({
        title: 'Cancellare il progresso?',
        body: sync.signedIn
          ? 'Perderai ripassi, simulazioni e impostazioni, anche sugli altri dispositivi. Non si può annullare.'
          : 'Perderai ripassi, simulazioni e impostazioni. Non si può annullare.',
        confirm: 'Cancella tutto',
        destructive: true,
      })) {
        try {
          await sync.resetRemote();
          store.reset();
          renderProfile();
        } catch (err) {
          message.className = 'error';
          message.textContent = err.message;
        }
      }
    } }, 'Cancella il progresso')), { tabs: true });
}

function syncSection() {
  const title = h('h2', { class: 'section-title' }, 'iPhone e iPad');
  if (!sync.configured) return h('section', {}, title, h('p', { class: 'foot section-foot' }, 'Sincronizzazione non ancora attiva.'));
  if (sync.signedIn) {
    const status = h('p', { class: 'foot section-foot', role: 'status' }, sync.lastSyncAt
      ? `Ultima sincronizzazione: ${new Date(sync.lastSyncAt).toLocaleString('it-IT')}.`
      : 'Non ancora sincronizzato.');
    const button = h('button', { onclick: async () => {
      button.textContent = 'Sincronizzo…';
      const result = await sync.syncNow();
      if (result.ok) { renderProfile(); return; }
      button.textContent = 'Sincronizza ora';
      if (!sync.signedIn) { renderProfile(); return; }
      status.textContent = 'Non riesco a sincronizzare. Il progresso è al sicuro su questo dispositivo: riprova con la connessione.';
    } }, 'Sincronizza ora');
    return h('section', {}, title,
      h('div', { class: 'group' }, h('div', { class: 'row row-line' }, h('span', {}, 'Account'), h('span', { class: 'muted ellipsis' }, sync.email))),
      status,
      h('div', { class: 'stack' }, button, h('button', { onclick: () => { sync.signOut(); renderProfile(); } }, 'Esci da questo dispositivo')));
  }

  const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
  const error = h('p', { class: 'error section-foot', role: 'alert', hidden: true });
  const showError = (text) => { error.textContent = text; error.hidden = false; };
  const clearError = () => { error.hidden = true; };
  const email = h('input', {
    id: 'sync-email', type: 'email', autocomplete: 'email', inputMode: 'email', placeholder: 'nome@esempio.it',
    onfocus: clearError, oninput: clearError,
    onblur: () => { if (email.value && !validEmail(email.value)) showError('Inserisci un\'email come nome@esempio.it.'); },
  });
  const password = h('input', { id: 'sync-password', type: 'password', autocomplete: 'current-password', onfocus: clearError, oninput: clearError });
  const submit = h('button', { class: 'primary', onclick: async () => {
    const address = email.value.trim();
    if (!validEmail(address)) { email.focus(); showError('Inserisci un\'email come nome@esempio.it.'); return; }
    if (!password.value) { password.focus(); showError('Inserisci la password.'); return; }
    submit.textContent = 'Accesso…';
    try {
      await sync.signIn(address, password.value);
      sync.forceFull();
      await sync.syncNow();
      renderProfile();
    } catch (err) {
      submit.textContent = 'Accedi';
      showError(err.message.startsWith('Failed') ? 'Serve la connessione. Riprova quando sei online.' : err.message);
    }
  } }, 'Accedi');
  return h('section', {}, title,
    h('p', { class: 'foot section-foot' }, 'Accedi su entrambi i dispositivi per ritrovare lo stesso progresso.'),
    h('div', { class: 'group' },
      h('label', { class: 'stacked', for: 'sync-email' }, h('span', {}, 'Email'), email),
      h('label', { class: 'stacked', for: 'sync-password' }, h('span', {}, 'Password'), password)),
    error,
    h('div', { class: 'stack sync-submit' }, submit));
}

function exportBackup() {
  const url = URL.createObjectURL(new Blob([store.exportBackup()], { type: 'application/json' }));
  const a = h('a', { href: url, download: `ufficio-tecnico-${localToday()}.json` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* Router */
function render() {
  cleanup();
  cleanup = () => {};
  const route = location.hash.replace('#', '') || 'scrivania';
  if (store.state.exam && route !== 'esame' && remainingSeconds(store.state.exam) > 0 && route === 'scritto') { renderExam(); return; }
  if (route.startsWith('materia-')) { collectionFilter = 'tutte'; renderMateria(route.slice(8)); return; }
  if (route.startsWith('scheda-')) { renderScheda(route.slice(7)); return; }
  if (route.startsWith('legge-')) { collectionFilter = 'tutte'; renderLegge(route.slice(6)); return; }
  const routes = {
    scrivania: renderDesk,
    sessione: renderSession,
    materie: () => renderCatalog('materie'),
    leggi: () => renderCatalog('leggi'),
    scritto: renderWrittenStart,
    esame: renderExam,
    orale: renderOralStart,
    profilo: renderProfile,
  };
  (routes[route] ?? renderDesk)();
}

function renderLoadError() {
  mount(h('main', { class: 'screen' },
    largeTitle('Ufficio tecnico'),
    h('p', {}, 'Non riesco a caricare le pratiche. Controlla la connessione e riprova.'),
    h('button', { class: 'primary', onclick: start }, 'Riprova')));
}

async function start() {
  try {
    content = await loadContent();
    content.lawCases = buildLawCases(content.cases);
    sync = createSync({ config: content.config.sync, store });
  } catch (err) {
    store.logError(err.message);
    renderLoadError();
    return;
  }
  render();
  runSync();
}

window.addEventListener('hashchange', render);
window.addEventListener('online', () => runSync());
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') runSync(); });
window.addEventListener('error', (e) => store.logError(e.message));
window.addEventListener('unhandledrejection', (e) => store.logError(e.reason?.message ?? 'Errore'));
try {
  navigator.serviceWorker?.register('sw.js').catch((err) => store.logError(err.message));
} catch (err) {
  store.logError(err.message);
}
start();
