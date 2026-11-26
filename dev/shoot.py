import json, hashlib, sys, asyncio, base64, re, os
from playwright.async_api import async_playwright
APP = sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8765/'
OUT = sys.argv[2] if len(sys.argv)>2 else 'shots'
os.makedirs(OUT, exist_ok=True)
repo = json.load(open('/home/claude/harness/real.json'))
blobs = {}; tree=[]
for p,v in repo.items():
    b64 = v['b'] if 'b' in v else base64.b64encode(v['t'].encode()).decode()
    s = hashlib.sha1((p+b64).encode()).hexdigest(); blobs[s]=b64; tree.append({"path":p,"mode":"100644","type":"blob","sha":s})
async def gh(route):
    req = route.request; u = req.url; m = req.method
    H={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,PATCH,OPTIONS'}
    j = lambda o: route.fulfill(status=200, content_type='application/json', body=json.dumps(o), headers=H)
    if m=='OPTIONS': return await route.fulfill(status=204, headers=H)
    if '/git/ref/heads/' in u: return await j({"object":{"sha":"c1"}})
    if m=='GET' and '/git/commits/' in u: return await j({"sha":"c1","tree":{"sha":"t1"}})
    if m=='GET' and '/git/trees/' in u: return await j({"tree":tree,"truncated":False})
    if m=='GET' and '/git/blobs/' in u:
        s=u.split('/git/blobs/')[1]; return await j({"encoding":"base64","content":blobs[s]})
    if m=='POST' and u.endswith('/git/blobs'): return await j({"sha":"b"+str(len(blobs))})
    if m=='POST': return await j({"sha":"x1"})
    if m=='PATCH': return await j({})
    return await route.fulfill(status=404, body='{}')
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width':393,'height':852}, device_scale_factor=2, is_mobile=True, has_touch=True, service_workers='block')
        await ctx.route('https://api.github.com/**', gh)
        pg = await ctx.new_page()
        logs=[]; pg.on('console', lambda m: logs.append(m.type+': '+m.text)); pg.on('pageerror', lambda e: logs.append('ERR '+str(e)))
        await pg.goto(APP+'index.html'); await pg.wait_for_timeout(800)
        await pg.screenshot(path=OUT+'/00-signin.png')
        await pg.fill('input[type=text]', 'MemphisAI/Memphis-Brain'); await pg.fill('input[type=password]', 'fake')
        await pg.click('button:has-text("Sign in")'); await pg.wait_for_timeout(2500)
        await pg.screenshot(path=OUT+'/01-home.png')
        async def shot(n): await pg.wait_for_timeout(700); await pg.screenshot(path=OUT+'/'+n+'.png')
        async def tryclick(sel):
            try: await pg.click(sel, timeout=2500); return True
            except Exception as e: logs.append('NOCLICK '+sel); return False
        await pg.goto(APP+'wiki.html'); await pg.wait_for_timeout(2000); await shot('02-wiki-index')
        await pg.fill('#find','Mathias'); await pg.wait_for_timeout(500); await tryclick('.hit'); await pg.wait_for_timeout(800); await shot('03-wiki-mathias')
        await pg.evaluate("document.querySelector('#page') && document.querySelector('#page').scrollTo(0,600)"); await shot('03b-wiki-mathias-scrolled')
        if await tryclick('button:has-text("Edit page")'): await shot('04-wiki-edit')
        await pg.goto(APP+'writer.html'); await pg.wait_for_timeout(2500); await shot('05-writer')
        if await tryclick('button:has-text("Continue writing")'): await pg.wait_for_timeout(1000); await shot('05b-writer-editor')
        await pg.goto(APP+'canon.html'); await pg.wait_for_timeout(2000); await shot('06-canon')
        if await tryclick('text=Characters'): await shot('06b-canon-card')
        await pg.goto(APP+'changes.html'); await pg.wait_for_timeout(2000); await shot('07-changes')
        open(OUT+'/console.txt','w').write('\n'.join(logs))
        await b.close()
asyncio.run(main())
