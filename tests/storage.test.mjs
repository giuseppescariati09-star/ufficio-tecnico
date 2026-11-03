import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../js/storage.js';

const memory = (seed) => {
  const m = new Map(seed ? [['ufficio-tecnico', seed]] : []);
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) };
};

test('il progresso salvato torna al riavvio', () => {
  const b = memory();
  const s = createStore(b);
  s.state.progress.a = { box: 1, due: '2026-11-06', right: 1, wrong: 0 };
  s.save();
  assert.equal(createStore(b).state.progress.a.box, 1);
});

test('con lo storage bloccato la sessione continua', () => {
  const blocked = { getItem() { throw new Error('no'); }, setItem() { throw new Error('no'); } };
  const s = createStore(blocked);
  assert.equal(s.persistent, false);
  s.state.progress.a = { box: 1 };
  assert.doesNotThrow(() => s.save());
  assert.equal(s.state.progress.a.box, 1);
});

test('i dati corrotti non bloccano l\'avvio', () => {
  const s = createStore(memory('{non è json'));
  assert.deepEqual(s.state.progress, {});
  assert.equal(s.state.errors.length, 1);
});

test('un backup non valido viene rifiutato e non tocca i dati', () => {
  const s = createStore(memory());
  s.state.progress.a = { box: 2 };
  for (const bad of ['non json', '{}', '{"app":"altra","progress":{}}', '{"app":"ufficio-tecnico","progress":[]}']) {
    assert.throws(() => s.importBackup(bad));
  }
  assert.equal(s.state.progress.a.box, 2);
});

test('il backup esportato si può reimportare', () => {
  const s = createStore(memory());
  s.state.progress.a = { box: 3, due: '2026-11-10', right: 3, wrong: 0 };
  const text = s.exportBackup();
  const other = createStore(memory());
  other.importBackup(text);
  assert.equal(other.state.progress.a.box, 3);
});

test('il registro errori non cresce senza limite', () => {
  const s = createStore(memory());
  for (let i = 0; i < 80; i += 1) s.logError(`e${i}`);
  assert.equal(s.state.errors.length, 50);
  assert.equal(s.state.errors.at(-1).message, 'e79');
});
