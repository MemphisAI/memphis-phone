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
        logs=[]; pg.on('console', lambda m: logs.append(m.type+': '+m.text) if m.type in ('error','warning') and 'Service Worker' not in m.text else None); pg.on('pageerror', lambda e: logs.append('ERR '+str(e)))
        async def shot(n, wait=700): await pg.wait_for_timeout(wait); await pg.screenshot(path=OUT+'/'+n+'.png')
        async def tryclick(sel, t=2500):
            try: await pg.click(sel, timeout=t); return True
            except Exception as e: logs.append('NOCLICK '+sel); return False
        await pg.goto(APP+'index.html'); await pg.wait_for_timeout(800)
        await shot('00-signin', 0)
        await pg.fill('input[type=text]', 'MemphisAI/Memphis-Brain'); await pg.fill('input[type=password]', 'fake')
        await pg.click('button:has-text("Sign in")'); await pg.wait_for_timeout(4000)
        await shot('01-home')
        await pg.evaluate("window.scrollTo(0,500)"); await shot('01b-home-scrolled'); await pg.evaluate("window.scrollTo(0,0)")
        if await tryclick('#t-right'): await shot('01c-home-settings', 500); await pg.click('.sh-scrim', position={'x':200,'y':100}); await pg.wait_for_timeout(300)
        await pg.goto(APP+'wiki.html'); await pg.wait_for_timeout(2000); await shot('02-wiki-index')
        if await tryclick('#t-right'):
            await pg.fill('#find','Ma'); await shot('02b-wiki-search', 500)
            await pg.fill('#find','Mathias'); await pg.wait_for_timeout(300); await pg.press('#find','Enter')
        await shot('03-wiki-mathias', 1200)
        await pg.evaluate("document.querySelector('#page').scrollTo(0,640)"); await shot('03b-wiki-mathias-scrolled')
        await pg.evaluate("document.querySelector('#page').scrollTo(0,0)")
        if await tryclick('.fab-c.bl'): await shot('03c-wiki-drawer', 500); await pg.mouse.click(380, 400); await pg.wait_for_timeout(400)
        if await tryclick('.fab-c.br'): await shot('04-wiki-edit'); await pg.evaluate("document.querySelector('#page').scrollTo(0,99999)"); await shot('04b-wiki-edit-bottom')
        await pg.goto(APP+'wiki.html'); await pg.wait_for_timeout(1500)
        if await tryclick('#t-right'):
            await pg.fill('#find','Niklas'); await pg.wait_for_timeout(300); await pg.press('#find','Enter'); await shot('03d-wiki-niklas', 1200)
        await pg.goto(APP+'writer.html'); await pg.wait_for_timeout(2500); await shot('05-writer')
        if await tryclick('.startbtn'): await pg.wait_for_timeout(1000); await shot('05b-writer-editor')
        await pg.evaluate("(()=>{const t=document.querySelector('#plates .ptext'); if(t){t.focus();}})()"); await shot('05c-writer-typing')
        if await tryclick('#t-right'): await shot('05d-writer-menu', 500); await pg.click('.sh-scrim', position={'x':200,'y':100}); await pg.wait_for_timeout(300)
        await pg.goto(APP+'index.html'); await pg.wait_for_timeout(2500)
        if await tryclick('a.hero'): await pg.wait_for_timeout(2500); await shot('05e-writer-from-home')
        await pg.goto(APP+'canon.html'); await pg.wait_for_timeout(2000); await shot('06-canon')
        if await tryclick('text=Characters'): await shot('06b-canon-card')
        await pg.goto(APP+'changes.html'); await pg.wait_for_timeout(2000); await shot('07-changes')
        open(OUT+'/console.txt','w').write('\n'.join(logs))
        await b.close()
asyncio.run(main())
