p = 'src/world/dct-main.js'
s = open(p).read()

old = """    /* ------------------------------------------------------- entrance lobby */
    {
      // The counter sits on the corridor's +X side, near mid-length, clear of
      // the spine so circulation is never blocked.
      const xlCnt = cW / 2 - 0.35;
      const zlCnt = zMid + 2.4;

      b.add(box(4.6, 1.05, 0.6, 2), 'woodDark',
        { pos: [axOf(zlCnt), 0.55, azOf(xlCnt)] });
      b.add(box(4.6, 0.09, 0.78, 2), 'deskTop',
        { pos: [axOf(zlCnt), 1.12, azOf(xlCnt)] });
      b.add(box(5.4, 2.4, 0.10, 2), 'wood',
        { pos: [axOf(zlCnt), 1.2, azOf(cW / 2 + 0.04)] });
      for (let i = 0; i < 8; i++) {
        b.add(box(0.18, 2.4, 0.16, 1), 'woodDark',
          { pos: [axOf(zlCnt - 2.1 + i * 0.6), 1.2, azOf(cW / 2 - 0.02)] });
      }

      // Crest on the wall a visitor faces walking in.
      const crest2 = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9), M.crest);
      crest2.position.set(axOf(zMid), 3.1, azOf(-cW / 2 - 0.02));
      crest2.rotation.y = 0;
      b.addSign(crest2);

      // Honour boards on the opposite corridor wall.
      for (const dz of [-6.0, 6.0]) {
        b.add(box(4.2, 1.5, 0.10, 1.6), 'woodDark',
          { pos: [axOf(zMid + dz), 2.05, azOf(-cW / 2 - 0.02)] });
        b.add(box(4.0, 1.3, 0.05, 1), 'paintCream',
          { pos: [axOf(zMid + dz), 2.05, azOf(-cW / 2 - 0.08)] });
        for (let i = 0; i < 9; i++) {
          b.add(box(3.7, 0.09, 0.02, 1), 'dctBand',
            { pos: [axOf(zMid + dz), 1.52 + i * 0.13, azOf(-cW / 2 - 0.12)] });
        }
      }
    }"""

new = """    /* ------------------------------------------------------- entrance lobby */
    /**
     * Fitted out in WORLD coordinates, converted once.
     *
     * The previous version placed its furniture relative to the spine with
     * xlCnt = cW/2 - 0.35 ("clear of the spine, so circulation is never
     * blocked"). Both halves of that were wrong. cW/2 is 1.1, so xl 0.75 is
     * INSIDE a 2.2 m corridor, and zl 50.4 is the entrance bay. The result was a
     * 5.4 m timber screen standing across the mouth of the new cross-corridor —
     * a dark wall dead ahead of anyone walking in, which no amount of ceiling or
     * stair fixing could clear. The honour boards had the mirror-image bug: at
     * -cW/2 - 0.02 they sat 2 cm BEHIND the corridor wall and were never visible
     * from anywhere.
     *
     * So: aim at world positions, and let atWorld do the conversion. Inverting
     * the mapping (world_x = MAIN.x + pz - MAIN.z, world_z = MAIN.z - px + MAIN.x)
     * gives px = MAIN.x + MAIN.z - wz and pz = wx - MAIN.x + MAIN.z.
     */
    {
      const atWorld = (wx, wz) => [MAIN.x + MAIN.z - wz, 0, wx - MAIN.x + MAIN.z];
      const ccx = MAIN.x + xCrossMid;                 // cross-corridor centre, world x
      const zN = MAIN.z - 1.25;                       // its north side wall
      const zS = MAIN.z + 1.25;                       // its south side wall
      const yL = 0.085;                               // ground-floor finish level

      /**
       * Reception counter, against the north wall and facing the door.
       *
       * 0.62 deep by 3.2 long. Its west end stops 1.5 m short of the spine
       * doorway, so you can walk in, turn left and be in the main corridor
       * without going round anything.
       */
      {
        const [cx, , cz] = atWorld(ccx, zN + 0.33);
        b.add(box(0.62, 1.05, 3.2, 2), 'woodDark',
          { pos: [cx, yL + 0.525, cz] });
        b.add(box(0.80, 0.08, 3.5, 2), 'deskTop',
          { pos: [cx, yL + 1.09, cz] });
      }

      /**
       * Crest on the far wall of the corridor, square to the door.
       *
       * PlaneGeometry faces local +Z, and the group's yaw turns that into world
       * +X — that is, back toward the entrance — so rotation.y stays 0. The old
       * placement buried it 2 cm inside the wall; this one stands 5 cm proud.
       */
      {
        const crest2 = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9), M.crest);
        const [kx, , kz] = atWorld(MAIN.x - cW / 2 + 0.05, MAIN.z);
        crest2.position.set(kx, 3.1, kz);
        crest2.rotation.y = 0;
        b.addSign(crest2);
      }

      // Honour boards, on the south wall of the cross-corridor, facing across
      // it. Long along world X, so the length goes in the box's Z argument.
      for (const dx of [-1.7, 1.7]) {
        const [fx, , fz] = atWorld(ccx + dx, zS - 0.07);
        b.add(box(0.12, 1.5, 3.0, 1.6), 'woodDark',
          { pos: [fx, 2.05, fz] });
        const [px2, , pz2] = atWorld(ccx + dx, zS - 0.15);
        b.add(box(0.05, 1.3, 2.8, 1), 'paintCream',
          { pos: [px2, 2.05, pz2] });
        const [rx, , rz] = atWorld(ccx + dx, zS - 0.19);
        for (let i = 0; i < 9; i++) {
          b.add(box(0.02, 0.09, 2.5, 1), 'dctBand',
            { pos: [rx, 1.52 + i * 0.13, rz] });
        }
      }
    }"""

assert old in s, "lobby anchor not found"
s = s.replace(old, new)
open(p, 'w').write(s)
print("entrance lobby rewritten in world coordinates")
