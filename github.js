'use strict';
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PhoneGitHub = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const API = 'https://api.github.com';
  class GhError extends Error { constructor(kind, msg, status) { super(msg); this.kind = kind; this.status = status || 0; } }
  function utf8ToB64(s) {
    if (typeof Buffer !== 'undefined') return Buffer.from(s, 'utf8').toString('base64');
    const b = new TextEncoder().encode(s); let bin = '';
    for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function b64ToUtf8(s) {
    s = String(s || '').replace(/\s+/g, '');
    if (typeof Buffer !== 'undefined') return Buffer.from(s, 'base64').toString('utf8');
    const bin = atob(s), b = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8').decode(b);
  }
  const okRepo = (r) => /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(String(r || ''));
  function client(opts) {
    const f = opts.fetch, token = String(opts.token || '').trim(), repo = String(opts.repo || '').trim(), branch = opts.branch || 'main';
    if (!okRepo(repo)) throw new GhError('repo', 'The repository name should look like owner/name.');
    if (!token) throw new GhError('key', 'Paste your GitHub key.');
    async function req(method, p, body) {
      let r;
      try {
        r = await f(API + '/repos/' + repo + p, {
          method, cache: 'no-store',
          headers: Object.assign({ Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
            body ? { 'Content-Type': 'application/json' } : {}),
          body: body ? JSON.stringify(body) : undefined,
        });
      } catch (e) { throw new GhError('offline', 'No connection to GitHub.'); }
      if (r.status === 401) throw new GhError('key', 'Your GitHub key was refused or has expired: paste a new one.', 401);
      if (r.status === 404) throw new GhError('repo', 'GitHub does not show ' + repo + ' to this key: check the name, and that the key may use it.', 404);
      if (r.status === 403) {
        const j = await r.json().catch(() => ({}));
        throw new GhError(/rate limit/i.test(j.message || '') ? 'other' : 'key', /rate limit/i.test(j.message || '') ? 'GitHub asks us to wait a little (too many calls).' : 'This key may not write to ' + repo + ': it needs Contents read and write.', 403);
      }
      if (r.status === 409 || r.status === 422) {
        const j = await r.json().catch(() => ({}));
        if (method === 'PATCH') throw new GhError('race', 'GitHub moved on during the sync.', r.status);
        throw new GhError('other', 'GitHub refused: ' + (j.message || r.status), r.status);
      }
      if (!r.ok) throw new GhError('other', 'GitHub answered ' + r.status + '.', r.status);
      return r.status === 204 ? null : r.json();
    }
    return {
      repo, branch,
      head: async () => (await req('GET', '/git/ref/heads/' + branch)).object.sha,
      commit: async (sha) => { const c = await req('GET', '/git/commits/' + sha); return { sha: c.sha, tree: c.tree.sha }; },
      tree: async (sha) => { const t = await req('GET', '/git/trees/' + sha + '?recursive=1'); if (t.truncated) throw new GhError('other', 'The repository is too big to list in one go.'); return t.tree; },
      blob: async (sha) => { const b = await req('GET', '/git/blobs/' + sha); return b.encoding === 'base64' ? b64ToUtf8(b.content) : String(b.content || ''); },
      createBlob: async (text) => (await req('POST', '/git/blobs', { content: utf8ToB64(text), encoding: 'base64' })).sha,
      createTree: async (base, entries) => (await req('POST', '/git/trees', { base_tree: base, tree: entries })).sha,
      createCommit: async (message, tree, parents) => (await req('POST', '/git/commits', { message, tree, parents })).sha,
      updateRef: async (sha) => { await req('PATCH', '/git/refs/heads/' + branch, { sha, force: false }); },
    };
  }
  return { client, GhError, okRepo, utf8ToB64, b64ToUtf8 };
});
