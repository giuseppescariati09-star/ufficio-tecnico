import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCase, validatePack, isStale } from '../js/content.js';

const good = {
  id: 'x1', ufficio: 'territorio', materia: 'edilizia', titolo: 'Caso', testo: 'Domanda', opzioni: ['a', 'b', 'c', 'd'], corretta: 1,
  spiegazione: 'Perché', norma: 'L. 241/1990', articolo: 'art. 2',
  fonte: 'https://www.normattiva.it/x', verificato: '2026-11-03', verificatoSu: 'Normattiva',
};

test('un caso completo è valido', () => {
  assert.deepEqual(validateCase(good, { strict: true }), []);
});

test('mancano i dati della fonte', () => {
  for (const key of ['norma', 'articolo', 'fonte', 'spiegazione']) {
    assert.ok(validateCase({ ...good, [key]: '' }).length > 0, key);
  }
});

test('la fonte deve essere https', () => {
  assert.ok(validateCase({ ...good, fonte: 'http://a.it' }).length > 0);
});

test('la risposta corretta deve esistere', () => {
  assert.ok(validateCase({ ...good, corretta: 4 }).length > 0);
});

test('in modalità rigorosa serve la data di verifica', () => {
  assert.deepEqual(validateCase({ ...good, verificato: null }), []);
  assert.ok(validateCase({ ...good, verificato: null }, { strict: true }).length > 0);
});

test('gli id ripetuti vengono segnalati', () => {
  assert.ok(validatePack([good, good]).some((e) => e.includes('duplicato')));
});

test('una verifica vecchia di oltre 90 giorni è da rifare', () => {
  assert.equal(isStale('2026-08-01', '2026-11-03'), true);
  assert.equal(isStale('2026-10-01', '2026-11-03'), false);
  assert.equal(isStale(null, '2026-11-03'), true);
});

test('la verifica deve dire su quale testo è stata fatta', () => {
  assert.ok(validateCase({ ...good, verificatoSu: '' }).length > 0);
});
