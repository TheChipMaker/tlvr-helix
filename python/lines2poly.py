#!/usr/bin/env python3
# lines2poly.py  --  chain F.Mask fp_line/fp_arc into filled fp_poly
import re, sys, uuid

TOL = 1e-4
inp = sys.argv[1]
outp = sys.argv[2] if len(sys.argv) > 2 else re.sub(r'(\.[^.]+)$', r'_poly\1', inp)
src = open(inp).read()

blk = re.compile(r'\t\(fp_(line|arc)\b.*?\n\t\)\n', re.S)
num = r'([-\d.]+)'
segs, keep = [], src

for m in list(blk.finditer(src)):
    t, b = m.group(1), m.group(0)
    if '(layer "F.Mask")' not in b:
        continue
    s = re.search(r'\(start '+num+r' '+num+r'\)', b).groups()
    e = re.search(r'\(end '+num+r' '+num+r'\)', b).groups()
    mid = re.search(r'\(mid '+num+r' '+num+r'\)', b)
    segs.append({'t': t,
                 's': tuple(map(float, s)),
                 'e': tuple(map(float, e)),
                 'm': tuple(map(float, mid.groups())) if mid else None})
    keep = keep.replace(b, '')

def near(a, b): return abs(a[0]-b[0]) < TOL and abs(a[1]-b[1]) < TOL

loops, pool = [], segs[:]
while pool:
    cur = [pool.pop(0)]
    while True:
        tail = cur[-1]['e']
        if near(tail, cur[0]['s']):
            break
        for i, s in enumerate(pool):
            if near(s['s'], tail):
                cur.append(pool.pop(i)); break
            if near(s['e'], tail):
                s['s'], s['e'] = s['e'], s['s']
                cur.append(pool.pop(i)); break
        else:
            break
    loops.append(cur)

def f(v): return f'{v:.6g}'

out = []
for lp in loops:
    pts = []
    for s in lp:
        if s['t'] == 'arc':
            pts.append(f"\t\t\t(arc (start {f(s['s'][0])} {f(s['s'][1])}) "
                       f"(mid {f(s['m'][0])} {f(s['m'][1])}) "
                       f"(end {f(s['e'][0])} {f(s['e'][1])}))")
        else:
            pts.append(f"\t\t\t(xy {f(s['s'][0])} {f(s['s'][1])})")
    out.append("\t(fp_poly\n\t\t(pts\n" + "\n".join(pts) + "\n\t\t)\n"
               "\t\t(stroke (width 0) (type solid))\n"
               "\t\t(fill solid)\n\t\t(layer \"F.Mask\")\n"
               f"\t\t(uuid \"{uuid.uuid4()}\")\n\t)\n")

keep = keep.replace("\t(embedded_fonts no)\n", "".join(out) + "\t(embedded_fonts no)\n")
open(outp, 'w').write(keep)
print("wrote", outp)
print(f"{len(segs)} segments -> {len(loops)} polygons")