import test from 'node:test';
import assert from 'node:assert/strict';
import { applyItems, createSync, toItems } from '../js/sync.js';
import { createStore } from '../js/storage.js';

const T1 = '2026-11-03T10:00:00.000Z';
const T2 = '2026-11-04T10:00:00.000Z';
const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };
const config = { url: 'https://x.supabase.co', key: 'pub' };
const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });

test('vince la modifica più recente per ogni caso', () => {
  const state = { progress: { a: { box: 1, updatedAt: T2 }, b: { box: 1, updatedAt: T1 } }, oral: {}, history: [] };
  const changed = applyItems(state, [
    { kind: 'case', item_id: 'a', state: { box: 0, updatedAt: T1 } },
    { kind: 'case', item_id: 'b', state: { box: 3, updatedAt: T2 } },
    { kind: 'case', item_id: 'c', state: { box: 2, updatedAt: T1 } },
  ]);
  assert.equal(state.progress.a.box, 1);
  assert.equal(state.progress.b.box, 3);
  assert.equal(state.progress.c.box, 2);
  assert.equal(changed, true);
});

test('lo storico delle simulazioni si unisce senza duplicati', () => {
  const state = { progress: {}, oral: {}, history: [{ at: T1, onThirty: 20, updatedAt: T1 }] };
  applyItems(state, [
    { kind: 'history', item_id: T1, state: { at: T1, onThirty: 20, updatedAt: T1 } },
    { kind: 'history', item_id: T2, state: { at: T2, onThirty: 25, updatedAt: T2 } },
  ]);
  assert.deepEqual(state.history.map((h) => h.onThirty), [20, 25]);
});

test('invia solo ciò che è cambiato dopo l\'ultima sincronizzazione', () => {
  const state = { progress: { a: { box: 1, updatedAt: T1 }, b: { box: 2, updatedAt: T2 } }, oral: { o: { score: 1, updatedAt: T2 } }, history: [] };
  assert.deepEqual(toItems(state, T1).map((i) => i.item_id), ['b', 'o']);
  assert.equal(toItems(state, '').length, 3);
});

test('i dati vecchi senza data vengono inviati alla prima sincronizzazione', () => {
  const state = { progress: { a: { box: 1 } }, oral: {}, history: [] };
  const [item] = toItems(state, '');
  assert.equal(item.updated_at, '1970-01-01T00:00:00.000Z');
});

test('accesso con password e sincronizzazione completa', async () => {
  const calls = [];
  const fetcher = async (url, opts) => {
    calls.push([url, opts]);
    if (url.includes('grant_type=password')) return json({ access_token: 'tok', refresh_token: 'ref', expires_in: 3600, user: { email: 'a@b.it' } });
    if (url.includes('/rpc/sync_progress')) return json([{ kind: 'case', item_id: 'r', state: { box: 2, updatedAt: T2 } }]);
    return json({}, 404);
  };
  const store = createStore(memory());
  store.state.progress.a = { box: 1, updatedAt: T1 };
  const sync = createSync({ config, store, fetcher, storage: memory(), now: () => Date.parse(T2) });
  await sync.signIn('a@b.it', 'segreta');
  assert.equal(sync.signedIn, true);
  assert.equal(sync.email, 'a@b.it');
  const result = await sync.syncNow();
  assert.equal(result.ok, true);
  assert.equal(store.state.progress.r.box, 2);
  const rpc = calls.find(([u]) => u.includes('sync_progress'))[1];
  assert.equal(rpc.headers.Authorization, 'Bearer tok');
  assert.equal(JSON.parse(rpc.body).items[0].item_id, 'a');
  assert.ok(!JSON.stringify(store.exportBackup()).includes('segreta'));
});

test('senza connessione i dati restano e l\'app non si blocca', async () => {
  const store = createStore(memory());
  store.state.progress.a = { box: 1, updatedAt: T1 };
  const storage = memory();
  storage.setItem('ufficio-tecnico-session', JSON.stringify({ access_token: 't', refresh_token: 'r', expires_at: Date.parse(T2) + 1e7, email: 'a@b.it' }));
  const sync = createSync({ config, store, fetcher: async () => { throw new Error('offline'); }, storage, now: () => Date.parse(T2) });
  const result = await sync.syncNow();
  assert.equal(result.ok, false);
  assert.equal(store.state.progress.a.box, 1);
  assert.equal(sync.signedIn, true);
});

test('il token scaduto si rinnova; se non si può, chiede un nuovo accesso', async () => {
  const store = createStore(memory());
  const storage = memory();
  storage.setItem('ufficio-tecnico-session', JSON.stringify({ access_token: 'old', refresh_token: 'r', expires_at: 0, email: 'a@b.it' }));
  const sync = createSync({ config, store, fetcher: async () => json({}, 400), storage, now: () => 1000 });
  const result = await sync.syncNow();
  assert.equal(result.ok, false);
  assert.equal(sync.signedIn, false);
});

test('una password sbagliata dà un messaggio chiaro', async () => {
  const sync = createSync({ config, store: createStore(memory()), fetcher: async () => json({}, 400), storage: memory() });
  await assert.rejects(sync.signIn('a@b.it', 'no'), /Email o password/);
  assert.equal(sync.signedIn, false);
});

test('senza configurazione la sincronizzazione resta spenta', async () => {
  const sync = createSync({ config: { url: '', key: '' }, store: createStore(memory()), fetcher: async () => { throw new Error('no'); }, storage: memory() });
  assert.equal(sync.configured, false);
  assert.equal((await sync.syncNow()).ok, false);
});
