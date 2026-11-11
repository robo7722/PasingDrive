# Baut map.json für PasingDrive aus OSM-Daten (Overpass, pasing.json).
# Projektion: equirektangulär um LAT0/LON0, x = Osten, z = Süden (Meter), gespeichert in Dezimetern.
# Aufruf: python -I build_map.py pasing.json ../map.json
import json, math, random, sys, re

SRC, DST = sys.argv[1], sys.argv[2]
LAT0, LON0 = 48.1490, 11.4600
phi = math.radians(LAT0)
KLAT = 111132.92 - 559.82 * math.cos(2 * phi) + 1.175 * math.cos(4 * phi)
KLON = 111412.84 * math.cos(phi) - 93.5 * math.cos(3 * phi)

def P(lat, lon):
    return ((lon - LON0) * KLON, -(lat - LAT0) * KLAT)

els = json.load(open(SRC, encoding='utf8'))['elements']
BX0, BZ0 = P(48.1620, 11.4380); BX1, BZ1 = P(48.1360, 11.4820)   # Kartenrand (x0<x1, z0<z1)

def inb(p, m=0): return BX0 - m <= p[0] <= BX1 + m and BZ0 - m <= p[1] <= BZ1 + m

def clip_line(g):
    # zerlegt eine Linie in Stücke innerhalb des Rands (Punkte knapp außerhalb bleiben als Abschluss)
    out = []; cur = []
    for i, p in enumerate(g):
        if inb(p, 40) or (i + 1 < len(g) and inb(g[i + 1], 40)) or (i > 0 and inb(g[i - 1], 40)): cur.append(p)
        else:
            if len(cur) >= 2: out.append(cur)
            cur = []
    if len(cur) >= 2: out.append(cur)
    return out

def clip_poly(r):
    # Sutherland-Hodgman gegen das Kartenrechteck
    def cl(pts, inside, inter):
        o = []
        for i in range(len(pts)):
            a, b = pts[i - 1], pts[i]
            if inside(b):
                if not inside(a): o.append(inter(a, b))
                o.append(b)
            elif inside(a): o.append(inter(a, b))
        return o
    def ix(x0):
        return lambda a, b: (x0, a[1] + (b[1] - a[1]) * (x0 - a[0]) / (b[0] - a[0]))
    def iz(z0):
        return lambda a, b: (a[0] + (b[0] - a[0]) * (z0 - a[1]) / (b[1] - a[1]), z0)
    r = cl(r, lambda p: p[0] >= BX0, ix(BX0))
    if r: r = cl(r, lambda p: p[0] <= BX1, ix(BX1))
    if r: r = cl(r, lambda p: p[1] >= BZ0, iz(BZ0))
    if r: r = cl(r, lambda p: p[1] <= BZ1, iz(BZ1))
    return r

def geom(e):
    return [P(g['lat'], g['lon']) for g in e.get('geometry', []) if g]

def enc(pts):
    out = []
    for x, z in pts:
        out += [round(x * 10), round(z * 10)]
    return out

def area(r):
    a = 0
    for i in range(len(r)):
        x1, z1 = r[i]; x2, z2 = r[(i + 1) % len(r)]
        a += x1 * z2 - x2 * z1
    return a / 2

def closed(r):
    return len(r) > 3 and abs(r[0][0] - r[-1][0]) < 1e-6 and abs(r[0][1] - r[-1][1]) < 1e-6

def ring(r):
    if closed(r): r = r[:-1]
    # doppelte Punkte entfernen
    o = []
    for p in r:
        if not o or math.hypot(p[0] - o[-1][0], p[1] - o[-1][1]) > 0.05: o.append(p)
    while len(o) > 2 and math.hypot(o[0][0] - o[-1][0], o[0][1] - o[-1][1]) <= 0.05: o.pop()
    return o

def orient(r, ccw):
    # ccw im x/z-System: area > 0
    a = area(r)
    return r if (a > 0) == ccw else r[::-1]

def join_rings(ways):
    ways = [w[:] for w in ways if len(w) >= 2]
    rings = []
    while ways:
        cur = ways.pop(0)
        changed = True
        while not closed(cur) and changed:
            changed = False
            for i, w in enumerate(ways):
                if dist(cur[-1], w[0]) < 0.05: cur += w[1:]
                elif dist(cur[-1], w[-1]) < 0.05: cur += w[::-1][1:]
                elif dist(cur[0], w[-1]) < 0.05: cur = w[:-1] + cur
                elif dist(cur[0], w[0]) < 0.05: cur = w[::-1][:-1] + cur
                else: continue
                ways.pop(i); changed = True; break
        if closed(cur) or (len(cur) > 3 and dist(cur[0], cur[-1]) < 1): rings.append(cur)
    return rings

def dist(a, b): return math.hypot(a[0] - b[0], a[1] - b[1])

def polys_of(e):
    """liefert Liste von (outer, [holes]) als Punktlisten"""
    if e['type'] == 'way':
        g = geom(e)
        if not closed(g): return []
        return [(ring(g), [])]
    outs = join_rings([[P(p['lat'], p['lon']) for p in m['geometry']] for m in e.get('members', []) if m.get('role') == 'outer' and m.get('geometry')])
    ins = join_rings([[P(p['lat'], p['lon']) for p in m['geometry']] for m in e.get('members', []) if m.get('role') == 'inner' and m.get('geometry')])
    res = [(ring(o), []) for o in outs]
    for h in ins:
        h = ring(h)
        for o, hs in res:
            if pip(h[0], o): hs.append(h); break
    return res

def pip(p, r):
    x, z = p; c = False; j = len(r) - 1
    for i in range(len(r)):
        xi, zi = r[i]; xj, zj = r[j]
        if (zi > z) != (zj > z) and x < (xj - xi) * (z - zi) / (zj - zi) + xi: c = not c
        j = i
    return c

def num(s):
    if s is None: return None
    m = re.match(r'^\s*([0-9]+(?:[.,][0-9]+)?)', str(s))
    return float(m.group(1).replace(',', '.')) if m else None

names = []; nidx = {}
def name_id(n):
    if not n: return -1
    if n not in nidx: nidx[n] = len(names); names.append(n)
    return nidx[n]

# ---------------- Straßen ----------------
RW = {'motorway': 14, 'trunk': 12, 'primary': 12, 'secondary': 10, 'tertiary': 8.5, 'unclassified': 6.5, 'residential': 6.5,
      'living_street': 5.5, 'service': 4.5, 'motorway_link': 7, 'trunk_link': 7, 'primary_link': 7, 'secondary_link': 7, 'tertiary_link': 6,
      'pedestrian': 6, 'track': 3, 'footway': 2.2, 'path': 1.8, 'cycleway': 2.2, 'steps': 2.2, 'bridleway': 2, 'construction': 6, 'busway': 7}
CLS = {'motorway': 6, 'trunk': 6, 'primary': 6, 'secondary': 5, 'tertiary': 4, 'motorway_link': 5, 'trunk_link': 5, 'primary_link': 5, 'secondary_link': 5,
       'tertiary_link': 4, 'unclassified': 3, 'residential': 3, 'living_street': 3, 'busway': 3, 'construction': 3, 'service': 2, 'pedestrian': 1, 'track': 1,
       'footway': 0, 'path': 0, 'cycleway': 0, 'steps': 0, 'bridleway': 0}
roads = []
areas = []   # [kind, outer, holes]
for e in els:
    t = e.get('tags', {})
    h = t.get('highway')
    if e['type'] != 'way' or not h or h not in RW: continue
    if t.get('indoor') == 'yes' or t.get('level', '0').startswith('-') and h in ('footway', 'steps', 'corridor'): continue
    g = geom(e)
    if len(g) < 2: continue
    if t.get('area') == 'yes' and closed(g):
        areas.append(['paving' if h in ('pedestrian', 'footway') else 'asphalt', ring(g), []]); continue
    w = num(t.get('width'))
    if h in ('primary', 'secondary', 'tertiary', 'trunk') and num(t.get('lanes')):
        w = max(RW[h] * 0.75, num(t.get('lanes')) * 3.2 + 1.2)
    if not w or w > 30 or w < 1: w = RW[h]
    if h == 'service' and t.get('service') in ('driveway', 'parking_aisle'): w = 3.6 if t['service'] == 'driveway' else 5
    tun = 1 if t.get('tunnel') in ('yes', 'building_passage') else 0
    br = 1 if t.get('bridge') and t.get('bridge') != 'no' else 0
    oneway = 1 if t.get('oneway') == 'yes' else 0
    lanes = int(num(t.get('lanes')) or 0)
    for gg in clip_line(g):
        roads.append({'c': CLS[h], 'w': round(w, 1), 'n': name_id(t.get('name')), 'p': enc(gg), 'o': oneway, 'l': lanes, 'b': br, 't': tun})

# ---------------- Flächen ----------------
def akind(t):
    lu, le, na = t.get('landuse'), t.get('leisure'), t.get('natural')
    if na == 'water' or t.get('waterway') == 'riverbank' or lu in ('basin', 'reservoir'): return 'water'
    if le == 'swimming_pool': return 'pool'
    if lu == 'forest' or na == 'wood': return 'forest'
    if na in ('scrub', 'shrubbery', 'heath'): return 'scrub'
    if le in ('park', 'garden', 'dog_park') or lu in ('grass', 'village_green', 'recreation_ground', 'cemetery') or na == 'grassland': return 'grass'
    if lu in ('meadow', 'greenfield'): return 'meadow'
    if lu == 'farmland': return 'farm'
    if lu == 'allotments': return 'allot'
    if le == 'pitch': return 'pitch'
    if le == 'track': return 'tartan'
    if le == 'playground': return 'sand'
    if le == 'schoolyard' or lu in ('garages',): return 'asphalt'
    if t.get('amenity') == 'parking' and t.get('parking') not in ('underground', 'multi-storey'): return 'parking'
    if lu in ('railway',): return 'gravel'
    if lu in ('construction', 'brownfield'): return 'dirt'
    if lu in ('industrial', 'commercial', 'retail'): return 'urban'
    return None

for e in els:
    t = e.get('tags', {})
    if e['type'] == 'node' or 'building' in t or 'highway' in t: continue
    k = akind(t)
    if not k: continue
    for o, hs in polys_of(e):
        o = clip_poly(o)
        if len(o) >= 3: areas.append([k, o, [h for h in hs if inb(h[0])]])

# ---------------- Gebäude ----------------
FACADE = ['#ece6da', '#f1ece2', '#e8dcc2', '#efe3c6', '#dcd6cc', '#e9e2d6', '#f3efe8', '#d9cfbf', '#e6d2b5', '#cfc9c0', '#e4dccd', '#f0e4d0']
def colr(s):
    if not s: return None
    s = s.strip().lower()
    named = {'white': '#f2f2ee', 'grey': '#9a9a96', 'gray': '#9a9a96', 'red': '#9c3b2c', 'brown': '#6e4a33', 'black': '#333333', 'yellow': '#e8d27a',
             'beige': '#e3d5b8', 'darkgrey': '#555555', 'lightgrey': '#c8c8c4', 'orange': '#c8743c', 'green': '#5d7d4c', 'blue': '#56708f', 'silver': '#c0c0c0', 'tan': '#d2b48c', 'darkred': '#7a2a20'}
    if s in named: return named[s]
    if re.match(r'^#[0-9a-f]{6}$', s): return s
    if re.match(r'^#[0-9a-f]{3}$', s): return '#' + ''.join(c * 2 for c in s[1:])
    return None

ROOF = {'flat': 0, 'gabled': 1, 'hipped': 2, 'pyramidal': 3, 'skillion': 4, 'half-hipped': 2, 'mansard': 2, 'gambrel': 1, 'dome': 0, 'round': 1, 'saltbox': 1}
HOUSE = {'house', 'detached', 'semidetached_house', 'terrace', 'bungalow', 'farm', 'villa', 'church', 'chapel'}
SMALL = {'garage', 'garages', 'shed', 'carport', 'hut', 'kiosk', 'service', 'transformer_tower', 'bunker'}
blds = []; bnames = []
random.seed(7)
for e in els:
    t = e.get('tags', {})
    b = t.get('building')
    if not b or b == 'no' or e['type'] == 'node': continue
    if t.get('location') == 'underground' or b in ('underground',): continue
    for o, hs in polys_of(e):
        if len(o) < 3: continue
        a = abs(area(o))
        if a < 4 or not inb((sum(p[0] for p in o) / len(o), sum(p[1] for p in o) / len(o))): continue
        lv = num(t.get('building:levels')); H = num(t.get('height')); mh = num(t.get('min_height'))
        rl = num(t.get('roof:levels')) or 0
        rs = t.get('roof:shape')
        if b == 'roof':
            wall, roofH, rcode, minh = 0.3, 0, 0, (mh or 3.6)
        else:
            minh = mh or 0
            if lv is None:
                if b in SMALL: lv = 1
                elif b in HOUSE: lv = 2
                elif b in ('apartments', 'residential'): lv = 4 if a > 200 else 3
                elif b in ('commercial', 'office', 'retail', 'hospital', 'school', 'university', 'hotel', 'public', 'civic', 'train_station'): lv = 4
                elif b in ('industrial', 'warehouse'): lv = 2.5
                elif a < 40: lv = 1
                elif a < 180: lv = 2
                else: lv = 4
            if rs is None:
                pitched = (b in HOUSE or (b in ('yes', 'residential', 'apartments') and a < 260 and lv <= 3))
                rs = 'gabled' if pitched else 'flat'
            rcode = ROOF.get(rs, 0)
            lvh = 2.6 if b in SMALL else 3.1
            if rcode:
                rh = num(t.get('roof:height'))
                if rh is None: rh = 2.6 if rl else 0  # sonst im Client aus der Hausbreite
                if H is not None: wall = max(2.2, H - (rh or 0) - minh); roofH = rh or 0
                else: wall = lv * lvh; roofH = rh
                if rh == 0 and rl: roofH = rl * 2.6
            else:
                wall = (H - minh) if H else lv * lvh + (rl * 2.4 if rl else 0) + 0.6
                roofH = 0
        wc = colr(t.get('building:colour')) or FACADE[random.randrange(len(FACADE))]
        rc = colr(t.get('roof:colour'))
        if not rc:
            rc = random.choice(['#8f3f2b', '#9b4a33', '#7d3a2a', '#a35a3c', '#6d4033', '#5b4b46']) if rcode else random.choice(['#6c6c6a', '#7a7874', '#5e5e5c', '#83817c'])
        o = orient(o, True)
        rec = {'p': enc(o), 'h': round(wall, 1), 'r': rcode, 'rh': round(roofH or 0, 1), 'wc': wc, 'rc': rc}
        if minh: rec['m'] = round(minh, 1)
        if b in SMALL or b == 'roof': rec['s'] = 1
        if hs: rec['hs'] = [enc(orient(hh, False)) for hh in hs if len(hh) >= 3]
        if b == 'roof': rec['roof'] = 1
        blds.append(rec)
        if t.get('name'): bnames.append((t['name'], sum(p[0] for p in o) / len(o), sum(p[1] for p in o) / len(o)))

# ---------------- Bahn, Wasser ----------------
rails = []; water = []
for e in els:
    t = e.get('tags', {})
    if e['type'] != 'way': continue
    r = t.get('railway')
    if r in ('rail', 'tram', 'light_rail', 'subway', 'disused', 'construction') and t.get('tunnel') != 'yes':
        g = geom(e)
        for g in clip_line(g): rails.append({'p': enc(g), 'b': 1 if t.get('bridge') and t.get('bridge') != 'no' else 0, 'k': 1 if r == 'tram' else 0})
    if r in ('platform',) and closed(geom(e)):
        areas.append(['platform', ring(geom(e)), []])
    ww = t.get('waterway')
    if ww in ('river', 'canal', 'stream', 'drain', 'ditch') and t.get('tunnel') not in ('yes', 'culvert'):
        g = geom(e)
        w = num(t.get('width')) or {'river': 14, 'canal': 9, 'stream': 3, 'drain': 2, 'ditch': 1.5}[ww]
        for g in clip_line(g): water.append({'p': enc(g), 'w': w})

# ---------------- Bäume & Punkte ----------------
trees = []; lamps = []; signals = []
for e in els:
    t = e.get('tags', {})
    if e['type'] == 'node':
        x, z = P(e['lat'], e['lon'])
        if not inb((x, z)): continue
        if t.get('natural') == 'tree':
            hh = num(t.get('height')) or random.uniform(8, 16)
            trees += [round(x * 10), round(z * 10), round(min(30, hh) * 10)]
        elif t.get('highway') == 'street_lamp': lamps += [round(x * 10), round(z * 10)]
        elif t.get('highway') == 'traffic_signals': signals += [round(x * 10), round(z * 10)]
    elif e['type'] == 'way' and t.get('natural') == 'tree_row':
        g = geom(e)
        for i in range(len(g) - 1):
            (x1, z1), (x2, z2) = g[i], g[i + 1]; L = math.hypot(x2 - x1, z2 - z1); n = max(1, int(L / 9))
            for k in range(n):
                f = (k + 0.5) / n; trees += [round((x1 + (x2 - x1) * f) * 10), round((z1 + (z2 - z1) * f) * 10), round(random.uniform(9, 15) * 10)]

# Streupflanzung in Wald/Park/Gestrüpp (nicht auf Gebäuden/Straßen)
CELL = 25
grid = {}
def gadd(key, item):
    grid.setdefault(key, []).append(item)
bpolys = []
for b in blds:
    pts = b['p']; r = [(pts[i] / 10, pts[i + 1] / 10) for i in range(0, len(pts), 2)]
    xs = [p[0] for p in r]; zs = [p[1] for p in r]
    bpolys.append(r)
    for cx in range(int(min(xs) // CELL), int(max(xs) // CELL) + 1):
        for cz in range(int(min(zs) // CELL), int(max(zs) // CELL) + 1): gadd((cx, cz), ('b', len(bpolys) - 1))
segs = []
for rd in roads:
    pts = rd['p']; r = [(pts[i] / 10, pts[i + 1] / 10) for i in range(0, len(pts), 2)]
    for i in range(len(r) - 1):
        segs.append((r[i], r[i + 1], rd['w'] / 2 + 1.2))
        (x1, z1), (x2, z2) = r[i], r[i + 1]
        for cx in range(int(min(x1, x2) // CELL) - 1, int(max(x1, x2) // CELL) + 2):
            for cz in range(int(min(z1, z2) // CELL) - 1, int(max(z1, z2) // CELL) + 2): gadd((cx, cz), ('s', len(segs) - 1))

def segd(p, a, b):
    ax, az = a; bx, bz = b; dx, dz = bx - ax, bz - az; L = dx * dx + dz * dz
    t = 0 if L == 0 else max(0, min(1, ((p[0] - ax) * dx + (p[1] - az) * dz) / L))
    return math.hypot(p[0] - ax - dx * t, p[1] - az - dz * t)

def free(p):
    for kind, i in grid.get((int(p[0] // CELL), int(p[1] // CELL)), []):
        if kind == 'b' and pip(p, bpolys[i]): return False
        if kind == 's' and segd(p, segs[i][0], segs[i][1]) < segs[i][2]: return False
    return True

DENS = {'forest': 70, 'scrub': 140, 'grass': 420, 'allot': 260, 'meadow': 1400}
scat = 0
for k, o, hs in areas:
    if k not in DENS: continue
    xs = [p[0] for p in o]; zs = [p[1] for p in o]
    A = abs(area(o)); n = int(A / DENS[k])
    for _ in range(n * 3):
        if n <= 0: break
        p = (random.uniform(min(xs), max(xs)), random.uniform(min(zs), max(zs)))
        if not pip(p, o) or any(pip(p, h) for h in hs) or not free(p): continue
        hh = random.uniform(10, 22) if k == 'forest' else random.uniform(3, 6) if k == 'scrub' else random.uniform(7, 16)
        trees += [round(p[0] * 10), round(p[1] * 10), round(hh * 10)]; n -= 1; scat += 1

# ---------------- Startpunkte (aus OSM-Namen) ----------------
spots = []
def addspot(label, x, z):
    if any(q['n'] == label for q in spots) or not inb((x, z), -60): return
    spots.append({'n': label, 'x': round(x, 1), 'z': round(z, 1)})
for e in els:
    t = e.get('tags', {})
    if e['type'] == 'node' and t.get('railway') == 'station':
        x, z = P(e['lat'], e['lon']); addspot('Bahnhof ' + t.get('name', ''), x, z)
want = {'Pasinger Marienplatz': 'Pasinger Marienplatz', 'Pasing Arcaden': 'Pasing Arcaden', 'Pasinger Stadtpark': 'Pasinger Stadtpark',
        'Pasinger Fabrik': 'Pasinger Fabrik', 'Rathaus Pasing': 'Rathaus Pasing', 'Maria Schutz': 'Kirche Maria Schutz'}
seen = set()
for e in els:
    t = e.get('tags', {}); n = t.get('name')
    if not n or n in seen: continue
    for k, lbl in want.items():
        if k.lower() in n.lower():
            g = geom(e) if e['type'] == 'way' else []
            if e['type'] == 'relation':
                g = [P(p['lat'], p['lon']) for m in e.get('members', []) if m.get('geometry') for p in m['geometry']]
            if not g: continue
            addspot(lbl, sum(p[0] for p in g) / len(g), sum(p[1] for p in g) / len(g)); seen.add(n); break
# große Straßen: Mitte der längsten Segmentkette je Name
for nm in ['Landsberger Straße', 'Bodenseestraße', 'Pippinger Straße', 'Am Knie', 'Gleichmannstraße', 'Agnes-Bernauer-Straße', 'Offenbachstraße', 'Planegger Straße', 'Lortzingstraße', 'Würmkanal']:
    if nm in nidx:
        best = None
        for rd in roads:
            if rd['n'] == nidx[nm] and (best is None or len(rd['p']) > len(best['p'])): best = rd
        if best:
            k = (len(best['p']) // 4) * 2; addspot(nm, best['p'][k] / 10, best['p'][k + 1] / 10)

xs = [p for r in roads for p in r['p'][0::2]]; zs = [p for r in roads for p in r['p'][1::2]]
xs = [BX0 * 10, BX1 * 10]; zs = [BZ0 * 10, BZ1 * 10]
out = {'lat0': LAT0, 'lon0': LON0, 'klat': KLAT, 'klon': KLON,
       'bounds': [min(xs) / 10, min(zs) / 10, max(xs) / 10, max(zs) / 10],
       'names': names, 'roads': roads, 'areas': [[k, enc(o), [enc(h) for h in hs]] for k, o, hs in areas],
       'blds': blds, 'rails': rails, 'water': water, 'trees': trees, 'lamps': lamps, 'signals': signals, 'spots': spots,
       'attrib': '© OpenStreetMap-Mitwirkende (ODbL)'}
json.dump(out, open(DST, 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'))
print('roads', len(roads), 'areas', len(areas), 'blds', len(blds), 'rails', len(rails), 'water', len(water), 'trees', len(trees) // 3, 'scatter', scat, 'lamps', len(lamps) // 2, 'signals', len(signals) // 2)
print('spots', spots)
print('bounds', out['bounds'])
