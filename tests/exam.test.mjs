import test from 'node:test';
import assert from 'node:assert/strict';
import { buildExam, remainingSeconds, score } from '../js/exam.js';

const pool = (n, offices = ['a', 'b']) => Array.from({ length: n }, (_, i) => ({
  id: `c${i}`, ufficio: offices[i % offices.length], corretta: 0, opzioni: ['x', 'y'],
}));
const rng = () => 0.5;
const answers = (exam, right) => Object.fromEntries(exam.ids.slice(0, right).map((id) => [id, 0]));

test('la selezione è bilanciata tra gli uffici', () => {
  const exam = buildExam(pool(40), 10, 10, 0, rng);
  const byId = Object.fromEntries(pool(40).map((c) => [c.id, c]));
  const a = exam.ids.filter((id) => byId[id].ufficio === 'a').length;
  assert.equal(exam.ids.length, 10);
  assert.equal(a, 5);
  assert.equal(new Set(exam.ids).size, 10);
});

test('con pochi casi usa tutto e il voto resta su 30', () => {
  const cases = pool(3);
  const exam = buildExam(cases, 30, 30, 0, rng);
  assert.equal(exam.ids.length, 3);
  exam.answers = answers(exam, 3);
  assert.equal(score(exam, cases, 21).onThirty, 30);
});

test('21 su 30 supera, 20 no', () => {
  const cases = pool(30);
  const exam = buildExam(cases, 30, 30, 0, rng);
  exam.answers = answers(exam, 21);
  assert.equal(score(exam, cases, 21).passed, true);
  exam.answers = answers(exam, 20);
  assert.equal(score(exam, cases, 21).passed, false);
});

test('la risposta non data conta come errore', () => {
  const cases = pool(2);
  const exam = buildExam(cases, 2, 2, 0, rng);
  exam.answers = {};
  const r = score(exam, cases, 21);
  assert.equal(r.correct, 0);
  assert.equal(r.wrongIds.length, 2);
});

test('il tempo continua a scorrere a app chiusa e non diventa negativo', () => {
  const exam = buildExam(pool(2), 2, 30, 1000, rng);
  assert.equal(remainingSeconds(exam, 1000), 1800);
  assert.equal(remainingSeconds(exam, 1000 + 60000), 1740);
  assert.equal(remainingSeconds(exam, 1000 + 9999999), 0);
});
