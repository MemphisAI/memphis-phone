'use strict';
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PhoneEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const TEXT = /\.(md|json|txt)$/i;
  function create(opts) {
    const store = opts.store, SM = opts.SyncModel, GH = opts.PhoneGitHub, fetchFn = opts.fetch;
    const now = opts.now || (() => Date.now());
    const iso = () => new Date(now()).toISOString();
    let busy = null, listeners = [];
    const tell = (ev) => { for (const f of listeners) { try { f(ev); } catch (e) {   } } };
    async function gh() {
      const token = await store.get('meta', 'token'), repo = await store.get('meta', 'repo');
      if (!token || !repo) throw new GH.GhError('key', 'Not signed in.');
      return GH.client({ fetch: fetchFn, token, repo });
    }
    const keep = (p) => SM.synced(p) && TEXT.test(p);
    async function signIn(repo, token) {
      const c = GH.client({ fetch: fetchFn, token, repo });
      await c.head();
      const was = await store.get('meta', 'repo');
      if (was && was !== c.repo) { await store.clear('files'); await store.del('meta', 'head'); await store.del('meta', 'tree'); }
      await store.put('meta', 'repo', c.repo);
      await store.put('meta', 'token', String(token).trim());
      return true;
    }
    async function signedIn() { return !!(await store.get('meta', 'token')) && !!(await store.get('meta', 'repo')); }
    async function forgetKey() { await store.del('meta', 'token'); }
    async function read(p) {
      const o = await store.get('outbox', p); if (o) return o.del ? null : o.text;
      const f = await store.get('files', p); return f ? f.text : null;
    }
    async function list(prefix) {
      const a = new Set((await store.keys('files')).concat(await store.keys('outbox')));
      for (const o of await store.all('outbox')) if (o.del) a.delete(o.path);
      return [...a].filter((p) => !prefix || p === prefix || p.indexOf(prefix + '/') === 0).sort();
    }
    async function write(p, text) {
      if (!keep(p)) throw new Error('Only the book\'s own folders can be written from the phone.');
      text = String(text);
      const f = await store.get('files', p), o = await store.get('outbox', p);
      if (!o && f && f.text === text) return false;
      if (o && o.base === (f ? f.sha : null) && o.baseText === text && !o.copy) { await store.del('outbox', p); tell({ pending: await pending() }); return true; }
      await store.put('outbox', p, o ? Object.assign(o, { text, del: false, at: iso() }) : { path: p, text, base: f ? f.sha : null, baseText: f ? f.text : null, copy: false, at: iso() });
      tell({ pending: await pending() });
      return true;
    }
    async function pending() { return (await store.keys('outbox')).length; }
    async function discard(p) {
      const f = await store.get('files', p), o = await store.get('outbox', p);
      if (!o || f) return false;
      await store.del('outbox', p); tell({ pending: await pending() });
      return true;
    }
    async function remove(p) {
      if (!keep(p) || !SM.isCopy(p)) throw new Error('Only a copy kept beside a page can be removed from the phone.');
      const f = await store.get('files', p), o = await store.get('outbox', p);
      if (!f) { if (o) { await store.del('outbox', p); tell({ pending: await pending() }); } return !!o; }
      await store.put('outbox', p, { path: p, text: '', del: true, base: f.sha, baseText: f.text, copy: false, at: iso() });
      tell({ pending: await pending() });
      return true;
    }
    const local = { get: (k) => store.get('meta', 'app:' + k), put: (k, v) => store.put('meta', 'app:' + k, v) };
    async function pull(c) {
      const head = await c.head();
      if (head === (await store.get('meta', 'head'))) return { pulled: 0, head };
      const cm = await c.commit(head);
      const entries = (await c.tree(cm.tree)).filter((e) => e.type === 'blob' && keep(e.path));
      const remote = new Map(entries.map((e) => [e.path, e.sha]));
      const local = new Map((await store.all('files')).map((f) => [f.path, f]));
      const todo = entries.filter((e) => !local.has(e.path) || local.get(e.path).sha !== e.sha);
      let i = 0, done = 0;
      async function worker() {
        while (i < todo.length) {
          const e = todo[i++];
          const text = await c.blob(e.sha);
          await store.put('files', e.path, { path: e.path, text, sha: e.sha });
          done++; if (done % 20 === 0) tell({ progress: done, of: todo.length });
        }
      }
      await Promise.all([worker(), worker(), worker(), worker(), worker(), worker()]);
      let removed = 0;
      for (const p of local.keys()) if (!remote.has(p)) { await store.del('files', p); removed++; }
      for (const o of await store.all('outbox')) {
        const rsha = remote.get(o.path) || null;
        if (rsha === o.base) continue;
        if (o.del) { await store.del('outbox', o.path); continue; }
        const now = rsha ? await store.get('files', o.path) : null;
        if (now && now.text === o.text) { await store.del('outbox', o.path); continue; }
        if (now && (SM.stampOnly(now.text, o.text) || SM.stampOnly(o.text, o.baseText))) { await store.del('outbox', o.path); continue; }
        if (now && o.baseText != null && SM.stampOnly(now.text, o.baseText)) { await store.put('outbox', o.path, Object.assign(o, { base: rsha, baseText: now.text, copy: false })); continue; }
        if (o.path === SM.DECISIONS && rsha) {
          const theirs = (await store.get('files', o.path)).text;
          const m = SM.mergeDecisions(o.baseText ? JSON.parse(o.baseText) : {}, JSON.parse(o.text), JSON.parse(theirs)).state;
          await store.put('outbox', o.path, Object.assign(o, { text: JSON.stringify(m, null, 1), base: rsha, baseText: theirs }));
        } else if (!o.copy) await store.put('outbox', o.path, Object.assign(o, { copy: true }));
      }
      await store.put('meta', 'head', head); await store.put('meta', 'tree', cm.tree);
      return { pulled: todo.length, removed, head };
    }
    async function push(c) {
      const out = await store.all('outbox');
      if (!out.length) return { pushed: 0, copies: [] };
      const head = await store.get('meta', 'head'), tree = await store.get('meta', 'tree');
      const taken = new Set(await store.keys('files')), plan = [], copies = [];
      for (const o of out) {
        const to = o.copy ? SM.copyName(o.path, (x) => taken.has(x)) : o.path;
        taken.add(to);
        if (o.copy) copies.push(to);
        plan.push({ o, to, sha: o.del ? null : await c.createBlob(o.text) });
      }
      const nt = await c.createTree(tree, plan.map((x) => ({ path: x.to, mode: '100644', type: 'blob', sha: x.sha })));
      const msg = 'Phone ' + iso().slice(0, 16).replace('T', ' ') + ': ' + plan.length + (plan.length === 1 ? ' change' : ' changes') + (copies.length ? ' (' + copies.length + ' beside as .from-phone)' : '');
      const nc = await c.createCommit(msg, nt, head ? [head] : []);
      await c.updateRef(nc);
      for (const x of plan) {
        if (x.o.del) await store.del('files', x.to);
        else await store.put('files', x.to, { path: x.to, text: x.o.text, sha: x.sha });
        await store.del('outbox', x.o.path);
      }
      await store.put('meta', 'head', nc); await store.put('meta', 'tree', nt);
      return { pushed: plan.length, copies };
    }
    function sync() {
      if (busy) return busy;
      busy = (async () => {
        tell({ running: true });
        let res;
        const t0 = now();
        try {
          const c = await gh();
          let p = await pull(c), u;
          const t1 = now();
          try { u = await push(c); }
          catch (e) { if (e.kind !== 'race') throw e; p = await pull(c); u = await push(c); }
          res = { ok: true, pulled: p.pulled, pushed: u.pushed, copies: u.copies };
          await store.put('meta', 'lastOk', iso()); await store.del('meta', 'lastError');
          await store.put('meta', 'lastTook', { ms: now() - t0, pullMs: t1 - t0, pulled: p.pulled, pushed: u.pushed, at: iso() });
        } catch (e) {
          res = { ok: false, kind: e.kind || 'other', error: e.message || String(e) };
          await store.put('meta', 'lastError', res.error);
        }
        busy = null;
        res.pending = await pending();
        tell(Object.assign({ running: false }, res));
        return res;
      })();
      return busy;
    }
    async function status() {
      return { signedIn: await signedIn(), repo: await store.get('meta', 'repo'), pending: await pending(),
        files: (await store.keys('files')).length, lastOk: await store.get('meta', 'lastOk'), lastError: await store.get('meta', 'lastError'), lastTook: await store.get('meta', 'lastTook'), running: !!busy };
    }
    async function exportText() {
      const out = await store.all('outbox');
      if (!out.length) return '';
      return out.filter((o) => !o.del).map((o) => '=== ' + o.path + ' (changed on the phone ' + o.at.slice(0, 16).replace('T', ' ') + ') ===\n' + o.text).join('\n\n');
    }
    const on = (f) => { listeners.push(f); return () => { listeners = listeners.filter((x) => x !== f); }; };
    return { signIn, signedIn, forgetKey, read, write, list, pending, discard, remove, local, sync, status, exportText, on };
  }
  return { create, TEXT };
});
