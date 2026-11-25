'use strict';
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PhoneStore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const TABLES = ['files', 'outbox', 'meta'];

  function memory() {
    const t = { files: new Map(), outbox: new Map(), meta: new Map() };
    const copy = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));
    return {
      get: async (tb, k) => copy(t[tb].get(k)),
      put: async (tb, k, v) => { t[tb].set(k, copy(v)); },
      del: async (tb, k) => { t[tb].delete(k); },
      all: async (tb) => [...t[tb].values()].map(copy),
      keys: async (tb) => [...t[tb].keys()],
      clear: async (tb) => { t[tb].clear(); },
    };
  }

  function idb(name) {
    let dbp = null;
    const open = () => dbp || (dbp = new Promise((resolve, reject) => {
      const rq = indexedDB.open(name || 'memphis-phone', 1);
      rq.onupgradeneeded = () => { for (const tb of TABLES) if (!rq.result.objectStoreNames.contains(tb)) rq.result.createObjectStore(tb); };
      rq.onsuccess = () => resolve(rq.result);
      rq.onerror = () => reject(rq.error);
    }));
    const run = (tb, mode, fn) => open().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(tb, mode), st = tx.objectStore(tb);
      let out; const rq = fn(st);
      if (rq) rq.onsuccess = () => { out = rq.result; };
      tx.oncomplete = () => resolve(out);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('storage refused'));
    }));
    return {
      get: (tb, k) => run(tb, 'readonly', (s) => s.get(k)),
      put: (tb, k, v) => run(tb, 'readwrite', (s) => s.put(v, k)).then(() => undefined),
      del: (tb, k) => run(tb, 'readwrite', (s) => s.delete(k)).then(() => undefined),
      all: (tb) => run(tb, 'readonly', (s) => s.getAll()),
      keys: (tb) => run(tb, 'readonly', (s) => s.getAllKeys()),
      clear: (tb) => run(tb, 'readwrite', (s) => s.clear()).then(() => undefined),
    };
  }

  return { memory, idb, TABLES };
});
