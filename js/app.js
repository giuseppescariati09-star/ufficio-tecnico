import { ICONS } from './icons.js';
import { createStore } from './storage.js';
import { isStale, loadContent, UFFICI } from './content.js';
import { grade, localToday, mastery, todayQueue } from './review.js';
import { buildExam, remainingSeconds, score, shuffle } from './exam.js';

const store = createStore();
const root = document.getElementById('app');
let content = null;
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
  const current = location.hash.replace('#', '') || 'scrivania';
  const tab = (id, label, ic) => h('a', { href: `#${id}`, 'aria-current': current === id ? 'page' : null }, icon(ic), label);
  return h('div', { class: 'tabbar' }, h('nav', { 'aria-label': 'Sezioni' },
    tab('scrivania', 'Scrivania', 'folder'), tab('scritto', 'Scritto', 'clock'), tab('orale', 'Orale', 'mic'), tab('profilo', 'Profilo', 'user')));
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
    ? h('p', { class: 'foot' }, `Controllato sul testo ufficiale il ${c.verificato}.`)
    : h('p', { class: 'foot' }, 'Bozza: non ancora controllata sul testo ufficiale.');
}

/* Scrivania */
function queue() {
  const { newLimit, reviewLimit } = store.state.settings;
  return todayQueue(content.cases, store.state.progress, localToday(), { newLimit, reviewLimit });
}

function renderDesk() {
  const q = queue();
  const reviews = q.filter((c) => store.state.progress[c.id]?.due).length;
  const fresh = q.length - reviews;
  const hero = q.length
    ? h('div', { class: 'group hero' },
      h('p', { class: 'muted small' }, 'Pratiche di oggi'),
      h('p', { class: 'hero-number' }, String(q.length)),
      h('p', { class: 'muted small' }, `${reviews} ${reviews === 1 ? 'ripasso' : 'ripassi'}, ${fresh} ${fresh === 1 ? 'caso nuovo' : 'casi nuovi'}`))
    : h('div', { class: 'group hero' },
      h('p', { class: 'muted small' }, 'Pratiche di oggi'),
      h('p', { class: 'question' }, 'Scrivania in ordine'),
      h('p', { class: 'muted small' }, 'Per oggi hai finito. Se vuoi allenarti ancora, prova una simulazione.'));
  mount(h('main', { class: 'screen' },
    largeTitle('Scrivania'),
    storageWarning(),
    hero,
    q.length
      ? h('button', { class: 'primary', onclick: () => go('#pratica') }, 'Apri la prossima pratica')
      : h('button', { class: 'primary', onclick: () => go('#scritto') }, 'Fai una simulazione'),
    h('section', {},
      h('h2', { class: 'section-title' }, 'Padronanza per ufficio'),
      h('div', { class: 'group' }, UFFICI.map((u) => {
        const value = mastery(content.cases.filter((c) => c.ufficio === u.id), store.state.progress);
        return h('div', { class: 'row' },
          h('div', { class: 'row-line' }, h('span', {}, u.nome), h('span', { class: 'muted' }, `${value}%`)),
          h('div', { class: 'meter' }, h('span', { width: `${value}%` })));
      })))), { tabs: true });
}

/* Pratica */
function renderCase() {
  const q = queue();
  if (!q.length) { go('#scrivania'); return; }
  const c = q[0];
  const order = shuffle(c.opzioni.map((text, index) => ({ text, index })));
  const options = order.map((o) => h('button', { class: 'option', onclick: () => answer(o.index) }, o.text));
  const feedback = h('div', { class: 'feedback', 'aria-live': 'polite' });
  let done = false;

  function answer(index) {
    if (done) return;
    done = true;
    const correct = index === c.corretta;
    store.state.progress[c.id] = grade(store.state.progress[c.id], correct, localToday());
    store.save();
    order.forEach((o, i) => {
      options[i].setAttribute('aria-disabled', 'true');
      if (o.index === c.corretta) { options[i].classList.add('right'); options[i].append(icon('check')); }
      else if (o.index === index) { options[i].classList.add('wrong'); options[i].append(icon('x')); }
    });
    feedback.append(
      h('p', { class: `verdict ${correct ? 'ok' : 'no'}` }, correct ? 'Giusto.' : 'Non proprio. Torniamo su questo caso domani.'),
      h('p', {}, c.spiegazione),
      sourceLink(c),
      verifiedNote(c),
      h('button', { class: 'primary', onclick: () => { if (queue().length) renderCase(); else go('#scrivania'); } },
        queue().length ? 'Prossima pratica' : 'Torna alla scrivania'));
    feedback.scrollIntoView({ block: 'nearest' });
  }

  mount(h('main', { class: 'screen' },
    h('div', { class: 'nav' },
      h('a', { class: 'source back', href: '#scrivania' }, icon('chevron-left'), 'Scrivania'),
      h('span', { class: 'muted small' }, `${q.length} da fare`)),
    h('div', {},
      h('p', { class: 'muted small' }, `${nomeUfficio(c.ufficio)} · ${c.titolo}`),
      h('h1', { class: 'question', tabIndex: -1 }, c.testo)),
    h('div', { class: 'options' }, options),
    feedback));
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
    h('p', { class: 'foot' }, 'Durata e numero di domande sono ipotesi: il bando non li indica. Puoi cambiarli nel profilo.')), { tabs: true });
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
    h('button', { class: atEnd ? 'primary' : '', onclick: askFinish }, 'Consegna')));

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
    if (content.cases.some((c) => c.id === id)) store.state.progress[id] = grade(store.state.progress[id], false, today);
  }
  store.state.history = [...store.state.history, { date: today, onThirty: result.onThirty, passed: result.passed }].slice(-100);
  store.state.exam = null;
  store.save();
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
      store.state.oral[q.id] = { score: hit / boxes.length, date: localToday() };
      store.save();
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
        body: 'Perderai ripassi, simulazioni e impostazioni. Non si può annullare.',
        confirm: 'Cancella tutto',
        destructive: true,
      })) { store.reset(); renderProfile(); }
    } }, 'Cancella il progresso')), { tabs: true });
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
  const routes = { scrivania: renderDesk, pratica: renderCase, scritto: renderWrittenStart, esame: renderExam, orale: renderOralStart, profilo: renderProfile };
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
  } catch (err) {
    store.logError(err.message);
    renderLoadError();
    return;
  }
  render();
}

window.addEventListener('hashchange', render);
window.addEventListener('error', (e) => store.logError(e.message));
window.addEventListener('unhandledrejection', (e) => store.logError(e.reason?.message ?? 'Errore'));
try {
  navigator.serviceWorker?.register('sw.js').catch((err) => store.logError(err.message));
} catch (err) {
  store.logError(err.message);
}
start();
