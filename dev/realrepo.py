import os, json, base64
root='/home/claude/memphis-brain'; R={}
for d,_,fs in os.walk(root):
    if '/.git' in d: continue
    for f in fs:
        p=os.path.join(d,f); rel=os.path.relpath(p,root)
        b=open(p,'rb').read()
        try: R[rel]={'t':b.decode('utf-8')}
        except: R[rel]={'b':base64.b64encode(b).decode()}
json.dump(R,open('real.json','w')); print(len(R), sum(1 for v in R.values() if 'b' in v))
