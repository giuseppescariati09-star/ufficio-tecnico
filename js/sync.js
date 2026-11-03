const SESSION_KEY = 'ufficio-tecnico-session';
const EPOCH = '1970-01-01T00:00:00.000Z';
const REFRESH_MARGIN = 60000;

const stamp = (s) => s?.updatedAt ?? '';

function historyId(h) {
  return h.at ?? `${h.date}-${h.onThirty}`;
}

function browserStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function toItems(state, since = '') {
  const records = [
    ...Object.entries(state.progress).map(([id, s]) => ['case', id, s]),
    ...Object.entries(state.oral).map(([id, s]) => ['oral', id, s]),
    ...state.history.map((h) => ['history', historyId(h), h]),
  ];
  return records
    .filter(([, , s]) => s && typeof s === 'object' && (!since || stamp(s) > since))
    .map(([kind, item_id, s]) => ({ kind, item_id, state: s, updated_at: stamp(s) || EPOCH }));
}

export function applyItems(state, rows) {
  let changed = false;
  const take = (map, id, incoming) => {
    if (stamp(incoming) > stamp(map[id]) || !map[id]) {
      map[id] = incoming;
      changed = true;
    }
  };
  const history = Object.fromEntries(state.history.map((h) => [historyId(h), h]));
  for (const row of rows) {
    if (row.kind === 'case') take(state.progress, row.item_id, row.state);
    else if (row.kind === 'oral') take(state.oral, row.item_id, row.state);
    else if (row.kind === 'history') take(history, row.item_id, row.state);
  }
  state.history = Object.values(history)
    .sort((a, b) => historyId(a).localeCompare(historyId(b)))
    .slice(-100);
  return changed;
}

export function createSync({ config, store, fetcher = (...a) => fetch(...a), storage = browserStorage(), now = Date.now }) {
  const configured = Boolean(config?.url && config?.key);
  let session = null;
  let running = null;

  try {
    session = JSON.parse(storage?.getItem(SESSION_KEY) ?? 'null');
  } catch {
    session = null;
  }

  const persist = () => {
    try {
      if (session) storage?.setItem(SESSION_KEY, JSON.stringify(session));
      else storage?.removeItem(SESSION_KEY);
    } catch {
      // Senza storage la sessione dura fino alla chiusura.
    }
  };

  const post = (path, body, token) => fetcher(`${config.url}${path}`, {
    method: 'POST',
    headers: {
      apikey: config.key,
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const saveTokens = (data, email) => {
    session = {
      ...session,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: now() + data.expires_in * 1000,
      email: data.user?.email ?? email ?? session?.email,
    };
    persist();
  };

  async function token() {
    if (session.expires_at - now() > REFRESH_MARGIN) return session.access_token;
    const res = await post('/auth/v1/token?grant_type=refresh_token', { refresh_token: session.refresh_token });
    if (!res.ok) {
      if (res.status < 500) {
        session = null;
        persist();
        throw new Error('Accedi di nuovo per sincronizzare.');
      }
      throw new Error(`Rinnovo accesso: ${res.status}`);
    }
    saveTokens(await res.json());
    return session.access_token;
  }

  async function run() {
    const startedAt = new Date(now()).toISOString();
    const items = toItems(store.state, session.lastSyncAt ?? '');
    const res = await post('/rest/v1/rpc/sync_progress', { items }, await token());
    if (!res.ok) throw new Error(`Sincronizzazione: ${res.status}`);
    const changed = applyItems(store.state, await res.json());
    store.save();
    session = { ...session, lastSyncAt: startedAt };
    persist();
    return { ok: true, changed };
  }

  return {
    get configured() { return configured; },
    get signedIn() { return Boolean(session); },
    get email() { return session?.email ?? ''; },
    get lastSyncAt() { return session?.lastSyncAt ?? ''; },
    async signIn(email, password) {
      const res = await post('/auth/v1/token?grant_type=password', { email, password });
      if (res.status === 429) throw new Error('Troppi tentativi. Riprova tra qualche minuto.');
      if (!res.ok) throw new Error('Email o password non corrette. Controllale e riprova.');
      saveTokens(await res.json(), email);
    },
    syncNow() {
      if (!configured || !session) return Promise.resolve({ ok: false, off: true });
      running ??= run()
        .catch((err) => {
          store.logError(err.message);
          return { ok: false, error: err.message };
        })
        .finally(() => { running = null; });
      return running;
    },
    forceFull() {
      if (session) {
        session = { ...session, lastSyncAt: '' };
        persist();
      }
    },
    async resetRemote() {
      if (!session) return;
      const res = await post('/rest/v1/rpc/reset_progress', {}, await token());
      if (!res.ok) throw new Error('Non riesco a cancellare il progresso online. Riprova con la connessione.');
      session = { ...session, lastSyncAt: '' };
      persist();
    },
    signOut() {
      session = null;
      persist();
    },
  };
}
