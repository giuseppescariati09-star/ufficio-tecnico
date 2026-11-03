const KEY = 'ufficio-tecnico';
const APP = 'ufficio-tecnico';
const MAX_ERRORS = 50;

const defaults = () => ({
  app: APP,
  version: 1,
  progress: {},
  oral: {},
  history: [],
  exam: null,
  errors: [],
  settings: { questions: 30, minutes: 40, newLimit: 6, reviewLimit: 8 },
});

const isPlainObject = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

function merge(data) {
  const base = defaults();
  return {
    ...base,
    ...data,
    settings: { ...base.settings, ...(isPlainObject(data.settings) ? data.settings : {}) },
    oral: isPlainObject(data.oral) ? data.oral : {},
    history: Array.isArray(data.history) ? data.history : [],
    errors: Array.isArray(data.errors) ? data.errors : [],
  };
}

function browserBackend() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export function createStore(backend = browserBackend()) {
  let persistent = Boolean(backend);
  let state = defaults();
  let corrupted = false;

  if (backend) {
    try {
      const raw = backend.getItem(KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (!isPlainObject(parsed) || !isPlainObject(parsed.progress)) throw new Error('formato');
          state = merge(parsed);
        } catch {
          corrupted = true;
        }
      }
      backend.setItem(`${KEY}-probe`, '1');
    } catch {
      persistent = false;
    }
  }

  const store = {
    get state() { return state; },
    get persistent() { return persistent; },
    save() {
      if (!persistent) return;
      try {
        backend.setItem(KEY, JSON.stringify(state));
      } catch {
        persistent = false;
      }
    },
    exportBackup() {
      return JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2);
    },
    importBackup(text) {
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error('Questo file non è un backup valido.');
      }
      if (!isPlainObject(parsed) || parsed.app !== APP || !isPlainObject(parsed.progress)) {
        throw new Error('Questo file non è un backup di Ufficio tecnico.');
      }
      state = merge(parsed);
      store.save();
    },
    reset() {
      state = defaults();
      store.save();
    },
    logError(message) {
      state.errors = [...state.errors, { at: new Date().toISOString(), message: String(message) }].slice(-MAX_ERRORS);
      store.save();
    },
  };
  if (corrupted) store.logError('Dati salvati non leggibili: progresso azzerato');
  return store;
}
