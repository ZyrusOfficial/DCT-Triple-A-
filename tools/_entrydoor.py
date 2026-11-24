p = 'src/world/dct-main.js'
s = open(p).read()

old = """          const zl = z0 + (i + 0.5) * bayW;      // bay centre, along the length
          const doorW = 1.0;
          const doorZl = zl - bayW / 2 + doorW / 2 + 0.12;
          const segW = bayW - doorW - 0.24;"""

new = """          const zl = z0 + (i + 0.5) * bayW;      // bay centre, along the length
          /**
           * The bay that faces the entrance gets its corridor opening where the
           * cross-corridor actually runs, not at the bay's usual door position.
           *
           * Every other bay puts its door near the bay start (bayW/2 in from the
           * centre). This one would land at zLocal 52.7 — world z 4.7 — while the
           * cross-corridor is centred on zLocal 48, world z 9.4. Four and a half
           * metres apart: the passage reached the wall and stopped.
           *
           * It is also wider (2.0 m instead of 1.0) and gets no leaf, because a
           * door swinging across a lobby threshold is just an obstruction.
           */
          const isEntryOpening = (i === entryBay && sx > 0);
          const doorW = isEntryOpening ? 2.0 : 1.0;
          const doorZl = isEntryOpening
            ? zMid - doorW / 2
            : zl - bayW / 2 + doorW / 2 + 0.12;
          const segW = bayW - doorW - (isEntryOpening ? 0 : 0.24);"""

assert old in s, "corridor-door anchor not found"
s = s.replace(old, new)

old2 = """          b.add(box(0.045, 2.02, doorW, 1), 'wood', {
            pos: [axOf(doorZl - doorW / 2 - 0.02), y0 + 1.01, azWall + sx * 0.52],
            rot: [0, Math.PI / 2 * 0.88, 0],
          });"""

new2 = """          if (!isEntryOpening) {
            b.add(box(0.045, 2.02, doorW, 1), 'wood', {
              pos: [axOf(doorZl - doorW / 2 - 0.02), y0 + 1.01, azWall + sx * 0.52],
              rot: [0, Math.PI / 2 * 0.88, 0],
            });
          }"""

assert old2 in s, "door leaf anchor not found"
s = s.replace(old2, new2)

old3 = """          // borrowed light high in the wall
          b.add(box(bayW * 0.46, 0.62, 0.05, 1.4), 'glassDark', {
            pos: [axOf(zl + bayW * 0.18), y0 + 2.52, azWall + sx * 0.08],
          });"""

new3 = """          // borrowed light high in the wall
          if (!isEntryOpening) {
            b.add(box(bayW * 0.46, 0.62, 0.05, 1.4), 'glassDark', {
              pos: [axOf(zl + bayW * 0.18), y0 + 2.52, azWall + sx * 0.08],
            });
          }"""

assert old3 in s, "borrowed light anchor not found"
s = s.replace(old3, new3)

# The segW segments are placed relative to doorZl, so re-centre them on the bay
# when the opening has moved.
old4 = """          // wall either side of the opening (long in authored X)
          b.add(box(segW, H1, 0.12, 3), 'interiorPlaster', {
            pos: [axOf(doorZl + doorW / 2 + segW / 2), y0 + H1 / 2, azWall],
          });"""

new4 = """          /**
           * Wall either side of the opening (long in authored X).
           *
           * For the entry bay the opening is off-centre in the bay, so the two
           * stubs are worked out from the bay's own ends rather than from the
           * opening: bayStart .. openingS and openingN .. bayEnd.
           */
          const bayStart = zl - bayW / 2;
          const bayEnd = zl + bayW / 2;
          const opS0 = doorZl, opS1 = doorZl + doorW;
          const stubS = opS0 - bayStart;
          const stubN = bayEnd - opS1;
          if (stubS > 0.02) {
            b.add(box(stubS, H1, 0.12, 3), 'interiorPlaster', {
              pos: [axOf(bayStart + stubS / 2), y0 + H1 / 2, azWall],
            });
          }
          if (stubN > 0.02) {
            b.add(box(stubN, H1, 0.12, 3), 'interiorPlaster', {
              pos: [axOf(opS1 + stubN / 2), y0 + H1 / 2, azWall],
            });
          }"""

assert old4 in s, "wall stub anchor not found"
s = s.replace(old4, new4)

# head over the door still uses doorZl/doorW, which is now correct for both.
open(p, 'w').write(s)
print("entry bay opening moved onto the cross-corridor and widened")
