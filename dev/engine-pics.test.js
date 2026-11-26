const assert = require('assert');
const R = require('path').join(__dirname, '..') + '/';
const SM = require(R + 'shared/sync-model.js'), GH = require(R + 'github.js'), EN = require(R + 'engine.js'), ST = require(R + 'store.js');
const crypto = require('crypto');
// tiny fake GitHub
const blobs = new Map(); let tree = new Map(); let head = 'c0'; const commits = { c0: 't0' }; const trees = { t0: new Map() };
const put = (b64) => { const s = crypto.createHash('sha1').update(b64).digest('hex'); blobs.set(s, b64); return s; };
const png = Buffer.from([137,80,78,71,13,10,26,10,0,1,2,3,250,251,252]).toString('base64');
trees.t0.set('Evrynthing/Media/eV - A - picture.png', put(png));
trees.t0.set('Evrynthing/01 Law/eV - A.md', put(Buffer.from('# A\n').toString('base64')));
trees.t0.set('Evrynthing/Media/huge.jpg', put('AAAA'));
let n = 0;
async function fetch(url, o) {
  const u = url.replace('https://api.github.com/repos/o/r', ''); const m = o.method; const body = o.body ? JSON.parse(o.body) : null;
  const J = (x) => ({ ok: true, status: 200, json: async () => x });
  if (u.startsWith('/git/ref/heads/')) return J({ object: { sha: head } });
  if (m === 'GET' && u.startsWith('/git/commits/')) { const s = u.split('/').pop(); return J({ sha: s, tree: { sha: commits[s] } }); }
  if (m === 'GET' && u.startsWith('/git/trees/')) { const t = trees[u.split('/').pop().split('?')[0]]; return J({ tree: [...t].map(([path, sha]) => ({ path, sha, type: 'blob', size: path.includes('huge') ? 9e6 : 10 })) }); }
  if (m === 'GET' && u.startsWith('/git/blobs/')) return J({ encoding: 'base64', content: blobs.get(u.split('/').pop()).replace(/(.{4})/g, '$1\n') });
  if (m === 'POST' && u === '/git/blobs') { assert.strictEqual(body.encoding, 'base64'); return J({ sha: put(body.content) }); }
  if (m === 'POST' && u === '/git/trees') { const t = new Map(trees[body.base_tree]); for (const e of body.tree) e.sha ? t.set(e.path, e.sha) : t.delete(e.path); const id = 't' + (++n); trees[id] = t; return J({ sha: id }); }
  if (m === 'POST' && u === '/git/commits') { const id = 'c' + (++n); commits[id] = body.tree; return J({ sha: id }); }
  if (m === 'PATCH') { head = body.sha; return J({}); }
  throw new Error('unexpected ' + m + ' ' + u);
}
(async () => {
  const store = ST.memory();
  const E = EN.create({ store, SyncModel: SM, PhoneGitHub: GH, fetch });
  await E.signIn('o/r', 'k');
  let r = await E.sync(); assert.ok(r.ok, r.error);
  assert.strictEqual(await E.readBin('Evrynthing/Media/eV - A - picture.png'), png, 'picture pulled as base64');
  assert.strictEqual(await E.readBin('Evrynthing/Media/huge.jpg'), null, 'oversized skipped');
  assert.strictEqual(await E.read('Evrynthing/Media/eV - A - picture.png'), null, 'read() never returns picture as text');
  await assert.rejects(E.write('Evrynthing/Media/x.png', 'text'));
  await assert.rejects(E.writeBin('Evrynthing/01 Law/x.png', png));
  await assert.rejects(E.writeBin('Evrynthing/Media/x.png', 'not base64!!'));
  const neu = Buffer.from('fakejpegbytesÿ\u0000').toString('base64');
  assert.ok(await E.writeBin('Evrynthing/Media/eV - A - new.jpg', neu));
  await E.write('Evrynthing/01 Law/eV - A.md', '# A\n![[eV - A - new.jpg]]\n');
  assert.strictEqual(await E.exportText() .then((t) => t.includes('new.jpg ===')), false, 'pictures never exported as text');
  r = await E.sync(); assert.ok(r.ok, r.error); assert.strictEqual(r.pushed, 2);
  const remote = trees[commits[head]];
  assert.strictEqual(blobs.get(remote.get('Evrynthing/Media/eV - A - new.jpg')), neu, 'pushed bytes intact');
  assert.strictEqual(await E.pending(), 0);
  // clash: remote changes the picture while the phone changes it too
  const other = Buffer.from('alaric version').toString('base64');
  const t2 = new Map(remote); t2.set('Evrynthing/Media/eV - A - new.jpg', put(other)); trees.tx = t2; commits.cx = 'tx'; head = 'cx';
  await E.writeBin('Evrynthing/Media/eV - A - new.jpg', Buffer.from('phone version').toString('base64'));
  r = await E.sync(); assert.ok(r.ok, r.error);
  const t3 = trees[commits[head]];
  assert.strictEqual(blobs.get(t3.get('Evrynthing/Media/eV - A - new.jpg')), other, 'remote kept');
  assert.ok(t3.has('Evrynthing/Media/eV - A - new.from-phone.jpg'), 'ours beside it');
  assert.ok(E.isBin('Evrynthing/Media/eV - A - new.from-phone.jpg'));
  // older phone (no pics marker) re-lists once even at the same head
  const s2 = ST.memory(); const E2 = EN.create({ store: s2, SyncModel: SM, PhoneGitHub: GH, fetch });
  await E2.signIn('o/r', 'k'); await s2.put('meta', 'head', head);
  r = await E2.sync(); assert.ok(r.ok); assert.ok(r.pulled > 0, 'pulled despite same head');
  r = await E2.sync(); assert.strictEqual(r.pulled, 0);
  console.log('engine pictures: all passed');
})().catch((e) => { console.error(e); process.exit(1); });
