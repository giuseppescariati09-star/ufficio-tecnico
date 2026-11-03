import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const { chromium, devices } = createRequire(import.meta.url)('playwright');

const root = new URL('..', import.meta.url).pathname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
  try {
    const body = await readFile(join(root, path === '/' ? 'index.html' : path));
    res.writeHead(200, { 'content-type': types[extname(path)] ?? (path === '/' ? 'text/html' : 'application/octet-stream') });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));
const url = `http://localhost:${server.address().port}/`;
const shots = process.env.SHOTS;

const browser = await chromium.launch();
const iphone = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 375, height: 760 }, serviceWorkers: 'allow' });
const page = await iphone.newPage();
const problems = [];
page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()); });
page.on('pageerror', (e) => problems.push(e.message));
const external = [];
page.on('request', (r) => { if (!r.url().startsWith(url)) external.push(r.url()); });
const shot = (p) => p.waitForTimeout(350);
const noScroll = async (p) => assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'scroll orizzontale');

await page.goto(url);
await page.getByRole('heading', { name: 'Scrivania' }).waitFor();
await noScroll(page);
if (shots) await shot(page); if (shots) await page.screenshot({ path: `${shots}/1-scrivania.png` });

await page.getByRole('button', { name: 'Apri la prossima pratica' }).click();
await page.locator('.option').first().click();
await page.getByRole('link', { name: /Leggi la norma/ }).waitFor();
await noScroll(page);
if (shots) await shot(page); if (shots) await page.screenshot({ path: `${shots}/2-pratica.png`, fullPage: true });
await page.reload();
await page.locator('main').waitFor();
const saved = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('ufficio-tecnico')).progress).length);
assert.equal(saved, 1, 'progresso salvato');

await page.goto(`${url}#scritto`);
await page.getByRole('button', { name: 'Inizia la simulazione' }).click();
await page.getByText(/Domanda 1 di/).waitFor();
assert.equal(await page.getByRole('button', { name: 'Indietro' }).count(), 0, 'niente Indietro sulla prima domanda');
await page.locator('.option').first().click();
await page.getByRole('button', { name: 'Consegna' }).click();
await page.getByRole('button', { name: 'Consegna comunque' }).click();
await page.getByText(/su 30/).first().waitFor();
await noScroll(page);
if (shots) await shot(page); if (shots) await page.screenshot({ path: `${shots}/3-risultato.png` });

await page.goto(`${url}#orale`);
await page.getByRole('button', { name: 'Sorteggia una domanda' }).click();
await page.getByRole('button', { name: 'Ho finito di parlare' }).click();
await page.locator('input[type=checkbox]').first().check();
if (shots) await shot(page); if (shots) await page.screenshot({ path: `${shots}/4-orale.png` });
await page.getByRole('button', { name: 'Salva' }).click();

await page.goto(`${url}#profilo`);
await page.getByRole('heading', { name: 'Profilo' }).waitFor();
if (shots) await shot(page); if (shots) await page.screenshot({ path: `${shots}/5-profilo.png`, fullPage: true });
const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Esporta backup' }).click()]);
assert.match(download.suggestedFilename(), /ufficio-tecnico/);

await page.evaluate(async () => { await navigator.serviceWorker.ready; });
await page.reload();
await page.waitForFunction(() => navigator.serviceWorker.controller);
await iphone.setOffline(true);
await page.reload();
await page.getByRole('heading', { name: 'Profilo' }).waitFor();
await page.goto(`${url}#`);
await page.getByRole('heading', { name: 'Scrivania' }).waitFor();
await iphone.setOffline(false);

const syncCtx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 375, height: 760 } });
const syncPage = await syncCtx.newPage();
const supa = 'https://demo.supabase.co';
const api = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' };
await syncPage.route('**/content/config.json', async (route) => {
  const res = await route.fetch();
  await route.fulfill({ response: res, json: { ...(await res.json()), sync: { url: supa, key: 'pub' } } });
});
await syncPage.route(`${supa}/**`, (route) => {
  const u = route.request().url();
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: api });
  if (u.includes('/otp')) return route.fulfill({ status: 200, headers: api, body: '{}' });
  if (u.includes('/verify')) return route.fulfill({ status: 200, headers: api, body: JSON.stringify({ access_token: 't', refresh_token: 'r', expires_in: 3600, user: { email: 'a@b.it' } }) });
  return route.fulfill({ status: 200, headers: api, body: JSON.stringify([{ kind: 'case', item_id: 'p1', state: { box: 2, due: '2099-01-01', updatedAt: '2099-01-01T00:00:00.000Z' }, updated_at: '2099-01-01T00:00:00.000Z' }]) });
});
await syncPage.goto(`${url}#profilo`);
await syncPage.getByRole('heading', { name: 'Profilo' }).waitFor();
await syncPage.getByRole('button', { name: 'Invia il codice' }).click();
await syncPage.getByRole('alert').waitFor();
await syncPage.getByLabel('Email', { exact: true }).fill('a@b.it');
assert.equal(await syncPage.getByRole('alert').isVisible(), false, 'errore tolto mentre scrivi');
await syncPage.getByRole('button', { name: 'Invia il codice' }).click();
await syncPage.getByLabel('Codice ricevuto via email').fill('123456');
if (shots) { await shot(syncPage); await syncPage.screenshot({ path: `${shots}/8-sync-login.png`, fullPage: true }); }
await syncPage.getByRole('button', { name: 'Accedi' }).click();
await syncPage.getByRole('button', { name: 'Sincronizza ora' }).waitFor();
assert.equal(await syncPage.evaluate(() => JSON.parse(localStorage.getItem('ufficio-tecnico')).progress.p1.box), 2, 'progresso ricevuto');
if (shots) await syncPage.screenshot({ path: `${shots}/9-sync-attiva.png`, fullPage: true });
await syncCtx.close();

const desk = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const big = await desk.newPage();
await big.goto(url);
await big.getByRole('heading', { name: 'Scrivania' }).waitFor();
await noScroll(big);
if (shots) await shot(big); if (shots) await big.screenshot({ path: `${shots}/6-desktop.png` });

const dark = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 375, height: 760 }, colorScheme: 'dark' });
const night = await dark.newPage();
await night.goto(url);
await night.getByRole('heading', { name: 'Scrivania' }).waitFor();
if (shots) await shot(night); if (shots) await night.screenshot({ path: `${shots}/7-scuro.png` });

assert.deepEqual(problems, [], 'errori in console');
assert.deepEqual(external, [], 'richieste esterne');
await browser.close();
server.close();
console.log('e2e ok');
