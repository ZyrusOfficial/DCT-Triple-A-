import re
p = 'src/world/dct-main.js'
s = open(p).read()

old = """      /* ------------------------------------------------------------ stairs */
      if (f < N - 1) {
        for (const sx of [-1, 1]) {
          const xlSt = sx * (xHalf - 1.5);
          const steps = 22;
          const rise = FH / steps;
          const run = 0.29;
          for (let i = 0; i < steps; i++) {
            b.add(box(run * 0.96, rise, 2.9, 1), 'concreteTrim', {
              pos: [axOf(zMid + (i - steps / 2) * run), y0 + rise * (i + 0.5), azOf(xlSt)],
            });
          }
          b.add(box(steps * run, FH, 0.12, 2), 'interiorPlaster', {
            pos: [axOf(zMid), y0 + FH / 2, azOf(xlSt + sx * 1.5)],
          });
          for (let i = 0; i < steps; i += 3) {
            b.add(cylinder(0.035, 0.035, 0.95, 6), 'steel', {
              pos: [axOf(zMid + (i - steps / 2) * run), y0 + rise * i + 0.48,
                    azOf(xlSt - sx * 1.35)],
            });
          }
        }
      }"""

new = """      /* ------------------------------------------------------------ stairs */
      /**
       * The stairs were centred on zMid, which is the same zLocal as the front
       * door: the flight climbed straight up through the entrance. Its lowest
       * treads landed at y 1.95 right over the doorway, so walking in you met a
       * concrete soffit at head height and a timber stringer across the lobby,
       * and the run of treads blocked the way through to the spine.
       *
       * Two stairwells now, one at each END of the building, each a straight
       * flight lying along the length inside the outer wall. Nothing occupies
       * the middle, so the entrance bay belongs to the entrance.
       */
      if (f < N - 1) {
        for (const sx of [-1, 1]) {
          for (const endSign of [-1, 1]) {
            const xlSt = sx * (xHalf - 1.5);
            const steps = 22;
            const rise = FH / steps;
            const run = 0.29;
            // flight springs from the end wall and climbs inward
            const zStart = endSign < 0 ? WT + 0.35 : W - WT - 0.35;
            const zC = zStart + endSign * (steps * run) / 2;
            for (let i = 0; i < steps; i++) {
              const zStep = zStart + endSign * (i + 0.5) * run;
              b.add(box(run * 0.96, rise * (i + 1), 2.9, 1), 'concreteTrim', {
                pos: [axOf(zStep), y0 + rise * (i + 1) / 2, azOf(xlSt)],
              });
            }
            // the enclosing shaft wall, on the corridor side of the flight
            b.add(box(steps * run, FH, 0.12, 2), 'interiorPlaster', {
              pos: [axOf(zC), y0 + FH / 2, azOf(xlSt + sx * 1.5)],
            });
            for (let i = 0; i < steps; i += 3) {
              b.add(cylinder(0.035, 0.035, 0.95, 6), 'steel', {
                pos: [axOf(zStart + endSign * (i + 0.5) * run), y0 + rise * i + 0.48,
                      azOf(xlSt - sx * 1.35)],
              });
            }
          }
        }
      }"""

assert old in s, "stairs anchor not found"
s = s.replace(old, new)
open(p, 'w').write(s)
print("stairs moved to the two ends of the building")
