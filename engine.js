'use strict';
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PhoneEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const TEXT = /\.(md|json|txt)$/i;
  const MEDIA = /^(Evrynthing\/Media|Home\/Photos)\/[^/]+\.(png|jpe?g|webp|gif)$/i;
  const MAX_BIN = 8 * 1024 * 1024;
  const isBin = (p) => MEDIA.test(String(p || ''));
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
    const keep = (p) => SM.synced(p) && (TEXT.test(p) || isBin(p));
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
      if (isBin(p)) return null;
      const o = await store.get('outbox', p); if (o) return o.del ? null : o.text;
      const f = await store.get('files', p); return f ? f.text : null;
    }
    async function readBin(p) {
      if (!isBin(p)) return null;
      const o = await store.get('outbox', p); if (o) return o.del ? null : o.b64;
      const f = await store.get('files', p); return f ? f.b64 : null;
    }
    async function writeBin(p, b64) {
      if (!keep(p) || !isBin(p)) throw new Error('Pictures can only go into Evrynthing/Media or Home/Photos (png, jpg, webp or gif).');
      b64 = String(b64 || '').replace(/\s+/g, '');
      if (!b64 || !/^[A-Za-z0-9+/]+=*$/.test(b64)) throw new Error('That picture could not be read.');
      if (b64.length * 0.75 > MAX_BIN) throw new Error('That picture is bigger than 8 MB.');
      const f = await store.get('files', p), o = await store.get('outbox', p);
      if (!o && f && f.b64 === b64) return false;
      await store.put('outbox', p, o ? Object.assign(o, { b64, del: false, at: iso() }) : { path: p, bin: true, b64, base: f ? f.sha : null, copy: false, at: iso() });
      tell({ pending: await pending() });
      return true;
    }
    async function list(prefix) {
      const a = new Set((await store.keys('files')).concat(await store.keys('outbox')));
      for (const o of await store.all('outbox')) if (o.del) a.delete(o.path);
      return [...a].filter((p) => !prefix || p === prefix || p.indexOf(prefix + '/') === 0).sort();
    }
    async function write(p, text) {
      if (!keep(p) || isBin(p)) throw new Error('Only the book\'s own folders can be written from the phone.');
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
      const home = /^Home\/([^/]+\.md|Photos\/[^/]+)$/.test(String(p || ''));
      if (!keep(p) || !(SM.isCopy(p) || home)) throw new Error('Only a copy kept beside a page, or a thing in the Home, can be removed from the phone.');
      const f = await store.get('files', p), o = await store.get('outbox', p);
      if (!f) { if (o) { await store.del('outbox', p); tell({ pending: await pending() }); } return !!o; }
      await store.put('outbox', p, { path: p, text: '', del: true, bin: !!f.bin, base: f.sha, baseText: f.bin ? null : f.text, copy: false, at: iso() });
      tell({ pending: await pending() });
      return true;
    }
    const local = { get: (k) => store.get('meta', 'app:' + k), put: (k, v) => store.put('meta', 'app:' + k, v) };
    async function pull(c) {
      const head = await c.head();
      if (head === (await store.get('meta', 'head')) && (await store.get('meta', 'pics'))) return { pulled: 0, head };
      const cm = await c.commit(head);
      const entries = (await c.tree(cm.tree)).filter((e) => e.type === 'blob' && keep(e.path) && !(isBin(e.path) && e.size > MAX_BIN));
      const remote = new Map(entries.map((e) => [e.path, e.sha]));
      const local = new Map((await store.all('files')).map((f) => [f.path, f]));
      const todo = entries.filter((e) => !local.has(e.path) || local.get(e.path).sha !== e.sha);
      let i = 0, done = 0;
      async function worker() {
        while (i < todo.length) {
          const e = todo[i++];
          if (isBin(e.path)) await store.put('files', e.path, { path: e.path, bin: true, b64: await c.blobB64(e.sha), sha: e.sha });
          else await store.put('files', e.path, { path: e.path, text: await c.blob(e.sha), sha: e.sha });
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
        if (o.bin) {
          const cur = rsha ? await store.get('files', o.path) : null;
          if (cur && cur.b64 === o.b64) { await store.del('outbox', o.path); continue; }
          await store.put('outbox', o.path, Object.assign(o, { base: rsha, copy: !!rsha }));
          continue;
        }
        const now = rsha ? await store.get('files', o.path) : null;
        if (now && now.text === o.text) { await store.del('outbox', o.path); continue; }
        if (now && (SM.stampOnly(now.text, o.text) || SM.stampOnly(o.text, o.baseText))) { await store.del('outbox', o.path); continue; }
        if (now && o.baseText != null && SM.stampOnly(now.text, o.baseText)) { await store.put('outbox', o.path, Object.assign(o, { base: rsha, baseText: now.text, copy: false })); continue; }
        if (!now) { await store.put('outbox', o.path, Object.assign(o, { base: null, baseText: null, copy: false })); continue; }
        let m;
        try { m = SM.mergeFile(o.path, o.baseText, now.text, o.text, { prefer: 'theirs' }); }
        catch (e) { m = { text: o.text, lost: now.text, loser: 'ours' }; }
        if (m.lost) {
          const k = SM.keptName(o.path, Date.parse(iso()), m.loser === 'ours' ? 'alaric' : 'phone');
          await store.put('outbox', k, { path: k, text: m.lost, base: null, baseText: null, copy: false, at: iso() });
        }
        await store.put('outbox', o.path, Object.assign(o, { text: m.text, base: rsha, baseText: now.text, copy: false }));
      }
      await store.put('meta', 'head', head); await store.put('meta', 'tree', cm.tree); await store.put('meta', 'pics', 1);
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
        plan.push({ o, to, sha: o.del ? null : o.bin ? await c.createBlobB64(o.b64) : await c.createBlob(o.text) });
      }
      const nt = await c.createTree(tree, plan.map((x) => ({ path: x.to, mode: '100644', type: 'blob', sha: x.sha })));
      const msg = 'Phone ' + iso().slice(0, 16).replace('T', ' ') + ': ' + plan.length + (plan.length === 1 ? ' change' : ' changes') + (copies.length ? ' (' + copies.length + ' beside as .from-phone)' : '');
      const nc = await c.createCommit(msg, nt, head ? [head] : []);
      await c.updateRef(nc);
      for (const x of plan) {
        if (x.o.del) await store.del('files', x.to);
        else if (x.o.bin) await store.put('files', x.to, { path: x.to, bin: true, b64: x.o.b64, sha: x.sha });
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
      return out.filter((o) => !o.del && !o.bin).map((o) => '=== ' + o.path + ' (changed on the phone ' + o.at.slice(0, 16).replace('T', ' ') + ') ===\n' + o.text).join('\n\n');
    }
    const on = (f) => { listeners.push(f); return () => { listeners = listeners.filter((x) => x !== f); }; };
    return { signIn, signedIn, forgetKey, read, readBin, writeBin, isBin, write, list, pending, discard, remove, local, sync, status, exportText, on };
  }
  return { create, TEXT, MEDIA };
});
