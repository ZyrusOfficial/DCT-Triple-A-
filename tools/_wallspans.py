p = 'src/world/dct-main.js'
s = open(p).read()

old = """      /* --------------------------------------------- corridor walls + doors */
      for (const sx of [-1, 1]) {
        const azWall = azOf(sx * cW / 2);
        for (let i = 0; i < bays; i++) {
          const zl = z0 + (i + 0.5) * bayW;      // bay centre, along the length
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
          const segW = bayW - doorW - (isEntryOpening ? 0 : 0.24);

          /**
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
          }
          // head over the door
          b.add(box(doorW + 0.24, H1 - 2.14, 0.12, 3), 'interiorPlaster', {
            pos: [axOf(doorZl), y0 + 2.14 + (H1 - 2.14) / 2, azWall],
          });
          // architrave: flat standing-band on the corridor face
          for (const q of [-1, 1]) {
            b.add(box(0.07, 2.10, 0.10, 1), 'wood', {
              pos: [axOf(doorZl + q * (doorW / 2 + 0.035)), y0 + 1.05, azWall - sx * 0.02],
            });
          }
          b.add(box(doorW + 0.2, 0.08, 0.10, 1), 'wood', {
            pos: [axOf(doorZl), y0 + 2.14, azWall - sx * 0.02],
          });"""

new = """      /* --------------------------------------------- corridor walls + doors */
      /**
       * The corridor wall, drawn as a run of SOLID spans with openings punched
       * through them.
       *
       * The older shape of this loop was one classroom door per bay, positioned
       * relative to the bay's own centre, plus — on the entrance bay only — a
       * wider opening positioned absolutely at zMid. Two things made that fail.
       * zMid is a bay BOUNDARY (48.0 on a 9.51 m pitch starting at 0.45), not a
       * bay centre, so the entrance straddles bays 4 and 5; and a blanket "skip
       * the whole entry bay" removed bay 5's door but left bay 4 sealed and
       * furnished, walling the passage off one metre from its own threshold.
       *
       * So the wall is now built from a per-side list of openings, each a
       * (centre, width) in zLocal, and the solid spans fill the gaps between
       * them. Snapping the entrance to whole bays is what makes this simple: the
       * passage is exactly bays [ccBay0, ccBay1], so there is no partial bay to
       * reason about and no doorway half-swallowed by a wall.
       */
      const openS = [];       // { c, w } in zLocal, per side
      for (let i = 0; i < bays; i++) {
        if (i >= ccBay0 && i <= ccBay1) {
          // replaced by the cross-corridor mouth
          openS.push({ c: z0 + i * bayW, w: bayW, wide: true });
          continue;
        }
        openS.push({ c: z0 + i * bayW + 0.62, w: 1.0 });
      }

      for (const sx of [-1, 1]) {
        const azWall = azOf(sx * cW / 2);
        // solid wall from the end of one opening to the start of the next
        const edges = [z0];
        for (const o of openS) { edges.push(o.c, o.c + o.w); }
        edges.push(z0 + bays * bayW);

        for (let k = 0; k < edges.length; k += 2) {
          const a = edges[k], bEnd = edges[k + 1];
          if (bEnd - a > 0.02) {
            b.add(box(bEnd - a, H1, 0.12, 3), 'interiorPlaster', {
              pos: [axOf((a + bEnd) / 2), y0 + H1 / 2, azWall],
            });
          }
        }

        for (const o of openS) {
          const doorW = o.w, doorZl = o.c;
          // head over the opening
          b.add(box(doorW, H1 - 2.14, 0.12, 3), 'interiorPlaster', {
            pos: [axOf(doorZl + doorW / 2), y0 + 2.14 + (H1 - 2.14) / 2, azWall],
          });
          if (o.wide) continue;   // a passage mouth, not a doorway: no trim, no leaf
          // architrave: flat standing-band on the corridor face
          for (const q of [0, 1]) {
            b.add(box(0.07, 2.10, 0.10, 1), 'wood', {
              pos: [axOf(doorZl + (q === 0 ? -0.035 : doorW + 0.035)), y0 + 1.05, azWall - sx * 0.02],
            });
          }
          b.add(box(doorW + 0.08, 0.08, 0.10, 1), 'wood', {
            pos: [axOf(doorZl + doorW / 2), y0 + 2.14, azWall - sx * 0.02],
          });"""

assert old in s, "wall block anchor not found"
s = s.replace(old, new)

# the leaf / borrowed light block that follows refers to isEntryOpening
old2 = """          if (!isEntryOpening) {
            b.add(box(0.045, 2.02, doorW, 1), 'wood', {
              pos: [axOf(doorZl - doorW / 2 - 0.02), y0 + 1.01, azWall + sx * 0.52],
              rot: [0, Math.PI / 2 * 0.88, 0],
            });
          }
          // borrowed light high in the wall
          if (!isEntryOpening) {
            b.add(box(bayW * 0.46, 0.62, 0.05, 1.4), 'glassDark', {
              pos: [axOf(zl + bayW * 0.18), y0 + 2.52, azWall + sx * 0.08],
            });
          }
        }
      }"""

new2 = """          b.add(box(0.045, 2.02, doorW, 1), 'wood', {
            pos: [axOf(doorZl - 0.02), y0 + 1.01, azWall + sx * 0.52],
            rot: [0, Math.PI / 2 * 0.88, 0],
          });
          // borrowed light high in the wall, beside the leaf
          b.add(box(bayW * 0.46, 0.62, 0.05, 1.4), 'glassDark', {
            pos: [axOf(doorZl + bayW * 0.34), y0 + 2.52, azWall + sx * 0.08],
          });
        }
      }"""

assert old2 in s, "leaf block anchor not found"
s = s.replace(old2, new2)

# declare the passage bay range next to entryBay
old3 = """    const entryBay = Math.floor((W / 2 - WT) / bayW);"""
new3 = """    /**
     * The entrance passage occupies whole bays, never part of one.
     *
     * zMid = 48 lands precisely on a bay boundary, so the door sits between bays
     * 4 and 5 (zLocal 38.49..48.00 and 48.00..57.51). Taking both of them gives
     * the lobby a 19 m frontage, a fraction of a 96 m building, and lets the
     * corridor wall be a simple run of solid spans and openings.
     */
    const ccBay0 = Math.floor((W / 2 - WT) / bayW) - 1;
    const ccBay1 = Math.floor((W / 2 - WT) / bayW);
    const entryBay = ccBay0;   // kept for the room-suppression test below
    /** zLocal range spanned by the passage, door centred in it. */
    const ccZ0 = z0 + ccBay0 * bayW;
    const ccZ1 = z0 + (ccBay1 + 1) * bayW;
    const ccMid = (ccZ0 + ccZ1) / 2;"""
assert old3 in s
s = s.replace(old3, new3)

open(p, 'w').write(s)
print("corridor wall rebuilt from spans and openings")
