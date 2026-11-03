import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MATERIE, LEGGI, buildLawCases, casesOfLaw, citation, filterCases, firstArticle, shouldGrade, statusOf } from '../js/catalog.js';

const read = (n) => JSON.parse(readFileSync(new URL(`../content/${n}.json`, import.meta.url)));
const cases = ['procedimento', 'territorio', 'beni', 'opere'].flatMap(read);
const today = '2026-11-03';

test('ogni caso ha una materia esistente e ogni materia ha domande', () => {
  const ids = new Set(MATERIE.map((m) => m.id));
  for (const c of cases) assert.ok(ids.has(c.materia), c.id);
  for (const m of MATERIE) assert.ok(cases.some((c) => c.materia === m.id), m.id);
});

test('ogni legge elencata ha domande e i codici principali ci sono', () => {
  for (const l of LEGGI) assert.ok(casesOfLaw(cases, l.id).length > 0, l.id);
  assert.equal(casesOfLaw(cases, 'contratti').length, 20);
  assert.equal(casesOfLaw(cases, 'tuel').length, 13);
  const covered = new Set(LEGGI.flatMap((l) => casesOfLaw(cases, l.id).map((c) => c.id)));
  assert.equal(covered.size, cases.length, 'nessun caso resta fuori');
});

test('stato di una domanda', () => {
  assert.equal(statusOf(undefined, today), 'nuova');
  assert.equal(statusOf({ box: 1, due: '2026-11-01' }, today), 'ripasso');
  assert.equal(statusOf({ box: 1, due: '2026-12-01' }, today), 'corso');
  assert.equal(statusOf({ box: 3, due: '2026-12-01' }, today), 'padroneggiata');
});

test('la ricerca trova testo, titolo e norma, senza badare a maiuscole e accenti', () => {
  assert.ok(filterCases(cases, { query: 'patente a crediti' }, {}, today).some((c) => c.id === 'o6'));
  assert.ok(filterCases(cases, { query: 'art. 36-bis' }, {}, today).some((c) => c.id === 't14'));
  assert.ok(filterCases(cases, { query: 'piu imprese' }, {}, today).some((c) => c.id === 'o4'));
});

test('i filtri per stato e segnate funzionano', () => {
  const progress = { t1: { box: 1, due: '2026-11-01' }, 'mark-t2': { marked: true } };
  const list = cases.filter((c) => ['t1', 't2', 't3'].includes(c.id));
  assert.deepEqual(filterCases(list, { stato: 'ripasso' }, progress, today).map((c) => c.id), ['t1']);
  assert.deepEqual(filterCases(list, { stato: 'segnate' }, progress, today).map((c) => c.id), ['t2']);
  assert.equal(filterCases(list, { stato: 'nuova' }, progress, today).length, 2);
});

test('una risposta giusta su un caso non ancora dovuto non accelera il ripasso', () => {
  assert.equal(shouldGrade(undefined, true, today), true);
  assert.equal(shouldGrade({ box: 1, due: '2026-12-01' }, true, today), false);
  assert.equal(shouldGrade({ box: 1, due: '2026-11-03' }, true, today), true);
  assert.equal(shouldGrade({ box: 1, due: '2026-12-01' }, false, today), true);
});

test('le domande sulle norme hanno 4 opzioni e una sola risposta giusta', () => {
  const law = buildLawCases(cases);
  assert.ok(law.length >= 100, `solo ${law.length}`);
  for (const q of law) {
    assert.equal(q.opzioni.length, 4, q.id);
    assert.equal(new Set(q.opzioni).size, 4, q.id);
    const source = cases.find((c) => `n-${c.id}` === q.id);
    assert.equal(q.opzioni[q.corretta], citation(source), q.id);
    assert.equal(q.fonte, source.fonte);
    assert.equal(q.verificatoSu, source.verificatoSu);
    assert.equal(q.ufficio, source.ufficio);
  }
});

test('le opzioni errate non citano lo stesso articolo della risposta giusta', () => {
  for (const q of buildLawCases(cases)) {
    const right = q.opzioni[q.corretta];
    for (const o of q.opzioni) {
      if (o === right) continue;
      const sameLaw = o.split(', ')[0] === right.split(', ')[0];
      if (sameLaw) assert.notEqual(firstArticle(o), firstArticle(right), `${q.id}: ${o}`);
    }
  }
});

test('la generazione è stabile tra un avvio e l\'altro', () => {
  assert.deepEqual(buildLawCases(cases), buildLawCases(cases));
});

test('atti senza articoli non diventano domande sulle norme', () => {
  const ids = new Set(buildLawCases(cases).map((q) => q.id));
  for (const id of ['t33', 't34', 'b15', 'o24']) assert.ok(!ids.has(`n-${id}`), id);
});
