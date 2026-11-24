p = 'src/world/dct-main.js'
s = open(p).read()

# 1. room suppression: both bays of the passage, facade side
s = s.replace(
    "          if (i === entryBay && sx > 0) continue;",
    "          if (i >= ccBay0 && i <= ccBay1 && sx > 0) continue;", 1)

# 2. cross-corridor floor / ceiling / walls: span the whole passage, centred ccMid
s = s.replace(
    "      b.add(box(2.4, 0.06, roomD, 2.2), 'tileRed', {\n        pos: [axOf(W / 2), y0 + floorY + 0.01, azOf(xCrossMid)],\n      });",
    "      const ccLen = ccZ1 - ccZ0;\n      b.add(box(ccLen, 0.06, roomD, 2.2), 'tileRed', {\n        pos: [axOf(ccMid), y0 + floorY + 0.01, azOf(xCrossMid)],\n      });", 1)

s = s.replace(
    "      b.add(box(2.6, 0.10, roomD + 0.4, 3), 'ceilingBoard', {\n        pos: [axOf(W / 2), y0 + H1, azOf(xCrossMid)],\n      });",
    "      b.add(box(ccLen, 0.10, roomD + 0.4, 3), 'ceilingBoard', {\n        pos: [axOf(ccMid), y0 + H1, azOf(xCrossMid)],\n      });", 1)

s = s.replace(
    "      // Side walls, so it reads as a passage and not as an open end into the\n      // room it replaced. 2.4 m clear between them.\n      for (const sgn of [-1, 1]) {\n        b.add(box(0.10, H1, roomD, 3), 'interiorPlaster', {\n          pos: [axOf(W / 2 + sgn * 1.25), y0 + H1 / 2, azOf(xCrossMid)],\n        });\n      }",
    "      // Its two side walls are the flanks of the passage: the floor-plate edges\n      // of the bays it occupies, left standing when the rooms were suppressed.\n      for (const sgn of [-1, 1]) {\n        b.add(box(0.10, H1, roomD, 3), 'interiorPlaster', {\n          pos: [axOf(ccMid + sgn * (ccLen / 2 + 0.05)), y0 + H1 / 2, azOf(xCrossMid)],\n        });\n      }", 1)

open(p, 'w').write(s)
print("cross-corridor now spans both bays")
