import test from 'node:test';
import assert from 'node:assert/strict';
import { INTERVALS, addDays, grade, mastery, todayQueue } from '../js/review.js';

const today = '2026-11-03';
const cases = ['a', 'b', 'c', 'd'].map((id) => ({ id }));

test('gli intervalli sono quelli del progetto', () => {
  assert.deepEqual(INTERVALS, [1, 3, 7, 14, 30]);
});

test('addDays attraversa il cambio ora e il mese', () => {
  assert.equal(addDays('2026-10-24', 2), '2026-10-26');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});

test('risposta giusta su un caso nuovo: torna dopo 3 giorni', () => {
  const s = grade(undefined, true, today);
  assert.equal(s.box, 1);
  assert.equal(s.due, '2026-11-06');
});

test('risposta giusta al livello massimo: resta a 30 giorni', () => {
  const s = grade({ box: 4, due: today, right: 4, wrong: 0 }, true, today);
  assert.equal(s.box, 4);
  assert.equal(s.due, '2026-12-03');
});

test('risposta sbagliata: riparte da 1 giorno', () => {
  const s = grade({ box: 3, due: today, right: 3, wrong: 0 }, false, today);
  assert.equal(s.box, 0);
  assert.equal(s.due, '2026-11-04');
  assert.equal(s.wrong, 1);
});

test('la coda mette prima i ripassi e rispetta i limiti', () => {
  const progress = {
    a: { box: 1, due: '2026-11-01', right: 1, wrong: 0 },
    b: { box: 1, due: '2026-12-01', right: 1, wrong: 0 },
  };
  const q = todayQueue(cases, progress, today, { newLimit: 1, reviewLimit: 8 });
  assert.deepEqual(q.map((c) => c.id), ['a', 'c']);
});

test('una data di sistema precedente non blocca la coda', () => {
  const progress = { a: { box: 1, due: '2030-01-01', right: 1, wrong: 0 } };
  const q = todayQueue([{ id: 'a' }], progress, today, { newLimit: 4, reviewLimit: 8 });
  assert.deepEqual(q, []);
});

test('un dato salvato non valido conta come caso nuovo', () => {
  const q = todayQueue([{ id: 'a' }], { a: 'rotto' }, today, { newLimit: 4, reviewLimit: 8 });
  assert.deepEqual(q.map((c) => c.id), ['a']);
  assert.equal(grade('rotto', true, today).box, 1);
  assert.equal(mastery([{ id: 'a' }], { a: { box: 'x' } }), 0);
});

test('la padronanza va da 0 a 100', () => {
  assert.equal(mastery(cases, {}), 0);
  const all = Object.fromEntries(cases.map((c) => [c.id, { box: 4, due: today, right: 5, wrong: 0 }]));
  assert.equal(mastery(cases, all), 100);
  assert.equal(mastery([], {}), 0);
});

test('i casi nuovi alternano gli uffici', () => {
  const mix = [{ id: 'a', ufficio: 'x' }, { id: 'b', ufficio: 'x' }, { id: 'c', ufficio: 'y' }];
  const q = todayQueue(mix, {}, today, { newLimit: 2, reviewLimit: 8 });
  assert.deepEqual(q.map((c) => c.id), ['a', 'c']);
});
