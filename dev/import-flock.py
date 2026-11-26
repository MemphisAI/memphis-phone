#!/usr/bin/env python3
"""Copy the Hearth's Flock from Alaric (D:\\Memphis\\flock) into the phone app's flock/ folder.
Usage: python3 dev/import-flock.py <folder with flock.html, tuning.js, three.min.js>
Patches applied to the phone copy only (Alaric's flock.html is never changed):
  1. no Google Fonts links (the phone works offline; the Flock's own text is hidden anyway)
  2. window.__flockPaused: the frame loop keeps ticking but skips all work while the Hearth room is out of view
Run again whenever the Flock or its tuning changes on Alaric."""
import sys, os, re, shutil
src = sys.argv[1]; dst = os.path.join(os.path.dirname(__file__), '..', 'flock'); os.makedirs(dst, exist_ok=True)
h = open(os.path.join(src, 'flock.html'), encoding='utf-8').read()
h2 = re.sub(r'<link[^>]+fonts\.(googleapis|gstatic)\.com[^>]*>\n?', '', h)
assert h2.count('function animate(){\n    requestAnimationFrame(animate);') == 1, 'animate() changed on Alaric: update the pause patch'
h2 = h2.replace('function animate(){\n    requestAnimationFrame(animate);', 'function animate(){\n    requestAnimationFrame(animate); if(window.__flockPaused) return;   /* phone: paused while the Hearth room is out of view */', 1)
open(os.path.join(dst, 'flock.html'), 'w', encoding='utf-8').write(h2)
for f in ('tuning.js', 'three.min.js'): shutil.copyfile(os.path.join(src, f), os.path.join(dst, f))
print('flock/ updated from', src)
