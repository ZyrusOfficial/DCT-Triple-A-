p = 'src/world/dct-main.js'
s = open(p).read()

# The lobby crest and counter were positioned on MAIN.z (== zMid); recentre them
# on ccMid, which is where the passage actually is.
s = s.replace(
    "        const [kx, , kz] = atWorld(MAIN.x - cW / 2 + 0.05, MAIN.z);",
    "        const [kx, , kz] = atWorld(MAIN.x - cW / 2 + 0.05, MAIN.z + (zMid - ccMid));",
    1)

s = s.replace(
    "      const [cx, , cz] = atWorld(ccx, zN + 0.33);",
    "      const [cx, , cz] = atWorld(ccx, MAIN.z + (zMid - ccMid) + zN - MAIN.z + 0.33);",
    1)

open(p, 'w').write(s)
print("lobby furniture recentred on the passage")
