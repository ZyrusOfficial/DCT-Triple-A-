import re
p = 'src/world/dct-main.js'
s = open(p).read()

old = """    for (let f = 0; f < N; f++) {
      const y0 = f * FH;
      const floorY = f === 0 ? 0.085 : 0.025;
      // Cross-corridor floor, from the façade wall to the spine.
      b.add(box(roomD, 0.06, 2.4, 2.2), 'tileRed', {
        pos: [axOf(W / 2 - WT / 2 - roomD / 2), y0 + floorY, azOf(cW / 2 - 0.1)],
      });
      // Its ceiling, dropped to the same height as the rest of the floor.
      b.add(box(roomD + 0.4, 0.10, 2.6, 3), 'ceilingBoard', {
        pos: [axOf(W / 2 - WT / 2 - roomD / 2), y0 + H1, azOf(cW / 2 - 0.1)],
      });
    }"""

new = """    /**
     * Cross-corridor geometry, and the two frames it has to satisfy at once.
     *
     * It runs ACROSS the building - through the depth - so in the authored frame
     * that is the xLocal axis: from the facade-side wall (xl = +xHalf) inward to
     * the spine (xl = +cW/2). Its centre is therefore at xLocal
     * (xHalf + cW/2)/2 and its length is roomD. In the other axis it is a short
     * slot centred on the door, which is at zLocal = W/2.
     *
     * Getting this wrong is easy and silent: the first attempt passed the two
     * axes the other way round and built a 6.2 m corridor running along the
     * REAR half of the building, nowhere near the door.
     */
    const xCrossMid = (xHalf + cW / 2) / 2;
    for (let f = 0; f < N; f++) {
      const y0 = f * FH;
      const floorY = f === 0 ? 0.085 : 0.025;
      // Floor: its LENGTH runs through the depth, its WIDTH across the door slot.
      b.add(box(2.4, 0.06, roomD, 2.2), 'tileRed', {
        pos: [axOf(W / 2), y0 + floorY, azOf(xCrossMid)],
      });
      // Its own ceiling, at the same soffit height as the rest of the floor.
      b.add(box(2.6, 0.10, roomD + 0.4, 3), 'ceilingBoard', {
        pos: [axOf(W / 2), y0 + H1, azOf(xCrossMid)],
      });
      // Side walls, so it reads as a passage and not as an open end into the
      // room it replaced. 2.4 m clear between them.
      for (const sgn of [-1, 1]) {
        b.add(box(0.10, H1, roomD, 3), 'interiorPlaster', {
          pos: [axOf(W / 2 + sgn * 1.25), y0 + H1 / 2, azOf(xCrossMid)],
        });
      }
    }"""

assert old in s, "anchor not found"
s = s.replace(old, new)
open(p, 'w').write(s)
print("cross-corridor rewritten on the correct axis")
