import sys,glob
from PIL import Image
d=sys.argv[1]; fs=sorted(glob.glob(d+'/*.png'))
if len(sys.argv)>3: fs=[f for f in fs if any(k in f for k in sys.argv[3].split(','))]
ims=[Image.open(f).resize((393,852)) for f in fs]
c=Image.new('RGB',(393*len(ims),852))
for k,i in enumerate(ims): c.paste(i,(393*k,0))
c.save(sys.argv[2]); print([f.split('/')[-1] for f in fs])
