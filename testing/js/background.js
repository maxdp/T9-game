// Page background: a river lined with cherry trees in full bloom, drawn in
// code -- petal-covered water down the middle, grassy banks and a footpath
// on either side, and big old trees with twisting trunks rooted by the
// water, arching over it into a tunnel of blossom.
// Dark mode turns it into the same place at night, lit by paper lanterns
// strung along the water.
//
// The scene is one fixed square picture, scaled to cover the screen and
// cropped (like a photo), so phones and desktops see the same place. The
// still parts (sky, banks, water, distant trees) are painted once; the
// nearer trees are painted once into a few layers that sway in a gently
// gusting wind, while petals drift on the water and through the air.
// requestAnimationFrame stops while the tab is hidden, and anyone who
// prefers reduced motion gets a still picture.
(function () {
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const THEME_KEY = "t9tangle-theme";
  const root = document.documentElement;
  let night = root.dataset.theme === "dark";

  const wrap = document.createElement("div");
  wrap.className = "sakura-bg";
  wrap.setAttribute("aria-hidden", "true");
  const sceneCanvas = document.createElement("canvas");
  sceneCanvas.className = "sakura-scene";
  const petalCanvas = document.createElement("canvas");
  petalCanvas.className = "sakura-petals";
  wrap.append(sceneCanvas, petalCanvas);
  document.body.prepend(wrap);
  const sctx = sceneCanvas.getContext("2d");
  const pctx = petalCanvas.getContext("2d");
  if (!sctx || !pctx) return;

  // The same trees every time (and on every visit).
  function seededRandom(seed) {
    return function () {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---- Colors -----------------------------------------------------------

  const PALETTES = {
    day: {
      sky: ["#a9cbe9", "#d5e3ef", "#f3f0f1"],
      cloud: "rgba(255, 255, 255, 0.75)",
      cloudShade: "rgba(214, 218, 230, 0.5)",
      haze: "rgba(250, 236, 242, 0.85)",
      grass: ["#b3c784", "#7fa352"],
      tuft: ["rgba(84, 124, 56, 0.45)", "rgba(178, 206, 124, 0.5)"],
      earth: ["#8a7a62", "#6c5e49"],
      path: "#e2d5c3",
      groundPetal: "rgba(250, 222, 232, 0.9)",
      water: ["#a3b0b8", "#7a8b96"],
      waterPetal: ["rgba(252, 236, 241, 0.9)", "rgba(244, 214, 225, 0.85)"],
      glint: "255, 255, 255",
      bark: "#47393a",
      barkLight: "#6e5d5a",
      blossom: ["#d99fb2", "#e6b3c3", "#efc4d1", "#f6d4de", "#fbe4eb", "#fff3f6"],
      body: "#b98a9a",
      leaf: ["#9bb767", "#86a656"],
      petals: ["#f8c8d8", "#fbd9e5", "#f4b6cb"],
      petalAlpha: 0.85,
    },
    night: {
      sky: ["#060a1c", "#121a3c", "#2c2650"],
      cloud: "rgba(70, 70, 110, 0.35)",
      cloudShade: "rgba(30, 30, 60, 0.3)",
      haze: "rgba(70, 52, 96, 0.7)",
      grass: ["#202c25", "#151e18"],
      tuft: ["rgba(8, 16, 10, 0.5)", "rgba(52, 72, 58, 0.4)"],
      earth: ["#29231f", "#1b1714"],
      path: "#36303e",
      groundPetal: "rgba(120, 96, 132, 0.8)",
      water: ["#1a2238", "#0e1424"],
      waterPetal: ["rgba(120, 100, 136, 0.5)", "rgba(96, 80, 112, 0.45)"],
      glint: "190, 200, 255",
      bark: "#120f15",
      barkLight: "#2a2230",
      blossom: ["#2c2337", "#382e45", "#463a55", "#564867", "#69597b", "#7f6e92"],
      body: "#1d1726",
      leaf: null,
      petals: ["#d9c6e0", "#e8d8ec", "#c9b3d3"],
      petalAlpha: 0.6,
      lantern: "255, 170, 90",
    },
  };
  let pal = night ? PALETTES.night : PALETTES.day;

  // ---- The scene, in scene units (a 1000 x 1000 square) ------------------
  // Looking straight down the river: everything recedes to a vanishing
  // point. A spot is given by its sideways distance from the river's
  // center line (dx) and its height above the walkways (h), both measured
  // at the bottom edge of the picture, and its depth p (1 at the bottom
  // edge, shrinking toward 0 at the vanishing point).
  const SIZE = 1000;
  const VPX = 500;
  const VPY = 455;
  const DEPTH = SIZE - VPY;
  const pt = (dx, h, p) => [VPX + dx * p, VPY + DEPTH * p - h * p];

  const WATER = 165; // half the river's width
  const DROP = 16; // water surface below the banks
  const EDGE = 14; // the sloping earth edge of each bank
  const PATH_IN = 420; // a footpath along each bank, behind the trees
  const PATH_OUT = 480;
  const NEAR = 1.6; // depth just past the bottom edge

  // A strip of ground (or wall) running the length of the river, from
  // (dxA, hA) to (dxB, hB) across it.
  function strip(ctx, dxA, hA, dxB, hB, p0 = 0.002, p1 = NEAR) {
    const a0 = pt(dxA, hA, p0);
    const a1 = pt(dxA, hA, p1);
    const b1 = pt(dxB, hB, p1);
    const b0 = pt(dxB, hB, p0);
    ctx.beginPath();
    ctx.moveTo(a0[0], a0[1]);
    ctx.lineTo(a1[0], a1[1]);
    ctx.lineTo(b1[0], b1[1]);
    ctx.lineTo(b0[0], b0[1]);
    ctx.closePath();
  }
  const waterPath = (ctx) => strip(ctx, -WATER, -DROP, WATER, -DROP);
  // Depths spread evenly along the ground (so closer together far away).
  const groundDepth = (rand) => 1 / (1 / NEAR + rand() * (1 / 0.04 - 1 / NEAR));

  // Depths spaced evenly along the ground (closer together far away).
  function depthsAlong(spacing, from = 0.03, to = NEAR) {
    const list = [];
    for (let z = 1 / to; z < 1 / from; z += spacing) list.push(1 / z);
    return list;
  }

  // ---- Trees ------------------------------------------------------------
  // Each tree grows from a twisting trunk leaning out over the water,
  // splitting into limbs that climb, spread and arch over; blossom
  // gathers in clusters along the outer branches, leaving the trunk and
  // main limbs bare.

  function growTree(rand, side, p, row) {
    const inward = -side; // left-bank trees lean right, over the water
    const size = p * (0.85 + rand() * 0.25) * (row ? 1.1 : 1);
    // The first row stands right by the water, the second farther back.
    const rootDx = row ? 560 + rand() * 120 : WATER + EDGE + 25 + rand() * 50;
    const [bx, by] = pt(side * rootDx, 0, p);
    // Old, thick trunks.
    const tree = { side, p, baseX: bx, baseY: by, baseW: 52 * size, segs: [], clusters: [] };
    const maxDepth = p > 0.3 ? 7 : 5;

    function grow(x, y, angle, len, width, depth) {
      // Trunks and main limbs bend a little as they go; finer branches
      // are a single gentle curve.
      const pieces = depth <= 1 ? 3 : 1;
      let a = angle;
      let cx = x;
      let cy = y;
      for (let i = 0; i < pieces; i++) {
        const l = len / pieces;
        if (pieces > 1) a = angle + (rand() - 0.5) * 0.3;
        const x2 = x + Math.sin(a) * l;
        const y2 = y - Math.cos(a) * l;
        const bend = (rand() - 0.5) * (pieces > 1 ? 0.35 : 0.45) * l;
        cx = (x + x2) / 2 + Math.cos(a) * bend;
        cy = (y + y2) / 2 + Math.sin(a) * bend;
        tree.segs.push({ x, y, cx, cy, x2, y2, w: width * (1 - i * 0.1) });
        x = x2;
        y = y2;
      }
      if (depth >= 5) tree.clusters.push({ x: cx, y: cy, r: len * 0.42, seed: Math.floor(rand() * 1e9) });
      if (depth >= maxDepth || len < 5) {
        tree.clusters.push({ x, y: y + len * 0.1, r: len * 0.85, seed: Math.floor(rand() * 1e9) });
        return;
      }
      const kids = depth < 2 || rand() < 0.3 ? 3 : 2;
      for (let n = 0; n < kids; n++) {
        let b =
          a +
          (n === 0 ? inward * (0.1 + rand() * 0.25) : n === 1 ? -inward * (0.15 + rand() * 0.35) : (rand() - 0.5) * 0.4);
        // Limbs climb as they spread, arching over toward the horizontal
        // only near their ends, so the canopy forms a high arch with the
        // river open beneath it.
        const target = Math.sign(b || inward) * (0.95 + depth * 0.09);
        b += (target - b) * (0.05 + depth * 0.03);
        grow(x, y, b, len * (0.7 + rand() * 0.12), width * (depth === 0 ? 0.5 : 0.62), depth + 1);
      }
    }
    // Short, stout trunks rise fairly upright before they branch, so they
    // line the banks instead of crossing in front of the river.
    const lean = row ? 0.08 + rand() * 0.12 : 0.12 + rand() * 0.14;
    grow(bx, by, inward * lean, 170 * size, tree.baseW, 0);
    return tree;
  }

  const TREE_DEPTHS = [1.3, 1.0, 0.76, 0.6, 0.49, 0.41, 0.35, 0.3, 0.26, 0.225, 0.195, 0.17, 0.148, 0.128, 0.11, 0.095, 0.082, 0.07, 0.06, 0.05];
  const TREES = (() => {
    const rand = seededRandom(1729);
    const list = [];
    [-1, 1].forEach((side) => {
      TREE_DEPTHS.forEach((p, i) => {
        // The front row starts a little way off, leaving the near water
        // open.
        if (p <= 1.05) list.push(growTree(rand, side, p * (1 + (rand() - 0.5) * 0.08), 0));
        // A few nearer trees stand farther back, between the front row's.
        const next = TREE_DEPTHS[i + 1];
        if (next && p < 1.1 && next > 0.45) list.push(growTree(rand, side, Math.sqrt(p * next), 1));
      });
    });
    return list.sort((a, b) => a.p - b.p);
  })();
  // Far trees are painted into the still background; nearer ones into
  // layers that sway (the nearest the most).
  const LAYERS = [
    { name: "mid", min: 0.3, max: 0.7, sway: 0.004 },
    { name: "near", min: 0.7, max: 99, sway: 0.006 },
  ];

  // Blossom clusters are stamped from a few ready-painted images rather
  // than painted floret by floret: copying small images is far cheaper
  // than drawing tens of thousands of tiny circles, which made switching
  // dark mode (and loading the page) slow. Each stamp is a soft body of
  // shaded blossom with florets over it, shadier underneath and brighter
  // on top; they vary in tone, so the canopy looks mottled.
  const STAMP_R = 56;
  const STAMP_VARIANTS = 10;
  const stampCache = {};
  function blossomStamps() {
    const key = night ? "night" : "day";
    if (stampCache[key]) return stampCache[key];
    const r = seededRandom(77);
    const R = STAMP_R;
    stampCache[key] = Array.from({ length: STAMP_VARIANTS }, (_, v) => {
      const c = document.createElement("canvas");
      c.width = Math.ceil(R * 2.4);
      c.height = Math.ceil(R * 1.8);
      const ctx = c.getContext("2d");
      ctx.translate(c.width / 2, c.height / 2);
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = pal.body;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc((r() - 0.5) * R * 0.7, (r() - 0.5) * R * 0.45, R * (0.5 + r() * 0.3), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 0.92;
      const tone = (v / (STAMP_VARIANTS - 1) - 0.5) * 0.35;
      const florets = [];
      for (let i = 0; i < 230; i++) {
        const a = r() * Math.PI * 2;
        const d = Math.sqrt(r()) * R;
        const dx = Math.cos(a) * d * 1.1;
        const dy = Math.sin(a) * d * 0.75;
        const light = Math.min(0.999, Math.max(0, 0.48 + tone - (dy / R) * 0.5 + (r() - 0.5) * 0.7));
        const leaf = pal.leaf && dy > 0 && r() < 0.07;
        florets.push({ dx, dy, light, leaf, size: 2.4 + r() * 1.8, pick: r() });
      }
      florets.sort((f1, f2) => f1.light - f2.light);
      florets.forEach((f) => {
        ctx.fillStyle = f.leaf
          ? pal.leaf[Math.floor(f.pick * pal.leaf.length)]
          : pal.blossom[Math.floor(f.light * pal.blossom.length)];
        ctx.beginPath();
        ctx.arc(f.dx, f.dy, f.size, 0, Math.PI * 2);
        ctx.fill();
      });
      return c;
    });
    return stampCache[key];
  }

  // Paints trees onto ctx (already scaled to scene units): their shadows
  // and bark, then the blossom stamped over the branches (lower clusters
  // first, so the brighter tops sit over them), and the bigger limbs
  // faintly through it.
  function paintTrees(ctx, trees, k) {
    if (!trees.length) return;
    // Each tree's shadow on the grass, and the flare of its roots.
    trees.forEach((tree) => {
      const w = tree.baseW;
      ctx.fillStyle = "rgba(20, 30, 10, 0.18)";
      ctx.beginPath();
      ctx.ellipse(tree.baseX, tree.baseY, w * 1.5, w * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = pal.bark;
      ctx.beginPath();
      ctx.moveTo(tree.baseX - w * 1.1, tree.baseY + w * 0.12);
      ctx.quadraticCurveTo(tree.baseX - w * 0.45, tree.baseY - w * 0.1, tree.baseX - w * 0.4, tree.baseY - w * 1.4);
      ctx.lineTo(tree.baseX + w * 0.4, tree.baseY - w * 1.4);
      ctx.quadraticCurveTo(tree.baseX + w * 0.45, tree.baseY - w * 0.1, tree.baseX + w * 1.1, tree.baseY + w * 0.12);
      ctx.closePath();
      ctx.fill();
    });
    ctx.lineCap = "round";
    ctx.strokeStyle = pal.bark;
    trees.forEach((tree) =>
      tree.segs.forEach((s) => {
        ctx.lineWidth = Math.max(0.7 / k, s.w);
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.quadraticCurveTo(s.cx, s.cy, s.x2, s.y2);
        ctx.stroke();
      })
    );

    // A lighter edge down the thicker trunks and limbs, so they look round.
    ctx.strokeStyle = pal.barkLight;
    trees.forEach((tree) =>
      tree.segs.forEach((s) => {
        if (s.w * k < 4) return;
        const off = -s.w * 0.22;
        ctx.lineWidth = s.w * 0.3;
        ctx.beginPath();
        ctx.moveTo(s.x + off, s.y);
        ctx.quadraticCurveTo(s.cx + off, s.cy, s.x2 + off, s.y2);
        ctx.stroke();
      })
    );
    ctx.strokeStyle = pal.bark;

    const stamps = blossomStamps();
    trees
      .flatMap((tree) => tree.clusters)
      .sort((a, b) => b.y - a.y)
      .forEach((c) => {
        ctx.drawImage(stamps[c.seed % stamps.length], c.x - c.r * 1.2, c.y - c.r * 0.9, c.r * 2.4, c.r * 1.8);
      });
    ctx.globalAlpha = 0.1;
    trees.forEach((tree) =>
      tree.segs.forEach((s) => {
        if (s.w * k < 2.5) return;
        ctx.lineWidth = s.w;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.quadraticCurveTo(s.cx, s.cy, s.x2, s.y2);
        ctx.stroke();
      })
    );
    ctx.globalAlpha = 1;
  }

  // ---- The still background ------------------------------------------

  function paintSky(ctx) {
    const rand = seededRandom(11);
    const sky = ctx.createLinearGradient(0, -400, 0, VPY);
    sky.addColorStop(0, pal.sky[0]);
    sky.addColorStop(0.55, pal.sky[1]);
    sky.addColorStop(1, pal.sky[2]);
    ctx.fillStyle = sky;
    ctx.fillRect(-2000, -2000, 5000, VPY + 2010);

    if (night) {
      // Stars, and a soft moon.
      ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
      for (let i = 0; i < 140; i++) {
        const x = -600 + rand() * 2200;
        const y = -500 + rand() * (VPY + 400);
        ctx.globalAlpha = 0.25 + rand() * 0.6;
        ctx.beginPath();
        ctx.arc(x, y, 0.6 + rand() * 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      const moon = ctx.createRadialGradient(735, 150, 0, 735, 150, 120);
      moon.addColorStop(0, "rgba(255, 250, 230, 1)");
      moon.addColorStop(0.2, "rgba(255, 248, 225, 1)");
      moon.addColorStop(0.23, "rgba(220, 220, 255, 0.35)");
      moon.addColorStop(1, "rgba(160, 170, 255, 0)");
      ctx.fillStyle = moon;
      ctx.fillRect(600, 20, 270, 270);
    }

    // Big soft clouds.
    for (let i = 0; i < 9; i++) {
      const cx = -300 + rand() * 1600;
      const cy = -260 + rand() * (VPY + 120);
      const w = 120 + rand() * 160;
      for (let j = 0; j < 9; j++) {
        const x = cx + (rand() - 0.5) * w * 1.6;
        const y = cy + (rand() - 0.5) * w * 0.35;
        const r = w * (0.25 + rand() * 0.25);
        // Soft-edged puffs, a little grayer underneath.
        [
          [pal.cloudShade, r * 0.3],
          [pal.cloud, 0],
        ].forEach(([color, lift]) => {
          const puff = ctx.createRadialGradient(x, y + lift, 0, x, y + lift, r);
          puff.addColorStop(0, color);
          puff.addColorStop(0.6, color);
          puff.addColorStop(1, color.replace(/[\d.]+\)$/, "0)"));
          ctx.fillStyle = puff;
          ctx.save();
          ctx.translate(0, (y + lift) * 0.4);
          ctx.scale(1, 0.6);
          ctx.beginPath();
          ctx.arc(x, y + lift, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        });
      }
    }
  }

  function paintGround(ctx) {
    const rand = seededRandom(23);
    [-1, 1].forEach((side) => {
      // Grassy banks, with tufts for texture.
      strip(ctx, side * (WATER + EDGE), 0, side * 5000, 0);
      const grass = ctx.createLinearGradient(0, VPY, 0, SIZE);
      grass.addColorStop(0, pal.grass[0]);
      grass.addColorStop(1, pal.grass[1]);
      ctx.fillStyle = grass;
      ctx.fill();
      for (let i = 0; i < 1400; i++) {
        const p = groundDepth(rand);
        const [x, y] = pt(side * (WATER + EDGE + rand() * 900), 0, p);
        ctx.fillStyle = pal.tuft[i % 2];
        ctx.beginPath();
        ctx.ellipse(x, y, (5 + rand() * 6) * p + 0.4, (1.5 + rand() * 1.5) * p + 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // A footpath behind the trees, and fallen petals on it and the
      // grass near the water.
      strip(ctx, side * PATH_IN, 0, side * PATH_OUT, 0);
      ctx.fillStyle = pal.path;
      ctx.fill();
      ctx.fillStyle = pal.groundPetal;
      for (let i = 0; i < 900; i++) {
        const p = groundDepth(rand);
        const [x, y] = pt(side * (WATER + EDGE + Math.pow(rand(), 1.5) * (PATH_OUT - WATER)), 0, p);
        ctx.beginPath();
        ctx.ellipse(x, y, 2.2 * p + 0.4, 1.2 * p + 0.3, rand() * 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // The bank's earthy edge sloping down to the water.
      strip(ctx, side * WATER, -DROP, side * (WATER + EDGE), 0);
      const earth = ctx.createLinearGradient(0, VPY, 0, SIZE);
      earth.addColorStop(0, pal.earth[0]);
      earth.addColorStop(1, pal.earth[1]);
      ctx.fillStyle = earth;
      ctx.fill();
    });

    // The water, covered in drifting petals.
    waterPath(ctx);
    const water = ctx.createLinearGradient(0, VPY, 0, SIZE);
    water.addColorStop(0, pal.water[0]);
    water.addColorStop(1, pal.water[1]);
    ctx.fillStyle = water;
    ctx.fill();
    ctx.save();
    ctx.clip();
    for (let i = 0; i < 2600; i++) {
      const p = 0.04 + Math.pow(rand(), 0.7) * 1.3;
      // Thicker along the banks, where petals collect.
      const u = Math.sign(rand() - 0.5) * Math.pow(rand(), 0.6);
      const [x, y] = pt(u * WATER, -DROP, p);
      ctx.fillStyle = pal.waterPetal[i % 2];
      ctx.beginPath();
      ctx.ellipse(x, y, 2.4 * p + 0.3, 1.1 * p + 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // The far end of the tunnel of trees fades into a pale haze.
  function paintHaze(ctx) {
    const haze = ctx.createRadialGradient(VPX, VPY - 30, 0, VPX, VPY - 30, 260);
    haze.addColorStop(0, pal.haze);
    haze.addColorStop(1, pal.haze.replace(/[\d.]+\)$/, "0)"));
    ctx.fillStyle = haze;
    ctx.fillRect(VPX - 300, VPY - 330, 600, 600);
  }

  // ---- Lanterns (night) ---------------------------------------------------
  // A string of paper lanterns hung along each side of the river.
  const LANTERN_H = 205;
  const LANTERN_DX = 135;
  const LANTERNS = [];
  [-1, 1].forEach((side) => {
    [0.88, 0.64, 0.49, 0.39, 0.32].forEach((p, i) => {
      LANTERNS.push({ side, p: p * (side > 0 ? 1.04 : 1), phase: i * 1.7 + side });
    });
  });

  function paintLanternStrings(ctx) {
    ctx.strokeStyle = "rgba(120, 82, 56, 0.8)";
    ctx.lineWidth = 0.9;
    [-1, 1].forEach((side) => {
      const own = LANTERNS.filter((l) => l.side === side).sort((a, b) => a.p - b.p);
      ctx.beginPath();
      own.forEach((l, i) => {
        const [x, y] = pt(side * LANTERN_DX, LANTERN_H + 22, l.p);
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          const prev = pt(side * LANTERN_DX, LANTERN_H + 22, own[i - 1].p);
          ctx.quadraticCurveTo((x + prev[0]) / 2, Math.max(y, prev[1]) + 14 * l.p, x, y);
        }
      });
      ctx.stroke();
    });
  }

  function paintLanterns(ctx, time) {
    // Their glow lights up the blossoms and the walls around them...
    ctx.globalCompositeOperation = "lighter";
    LANTERNS.forEach((l) => {
      const [x, y] = pt(l.side * LANTERN_DX, LANTERN_H, l.p);
      const flicker = 0.9 + 0.06 * Math.sin(time * 7.3 + l.phase) + 0.04 * Math.sin(time * 13.1 + l.phase * 2);
      const r = 260 * l.p;
      const glow = ctx.createRadialGradient(x, y, 0, x, y, r);
      glow.addColorStop(0, `rgba(${pal.lantern}, ${0.5 * flicker})`);
      glow.addColorStop(0.3, `rgba(${pal.lantern}, ${0.16 * flicker})`);
      glow.addColorStop(1, `rgba(${pal.lantern}, 0)`);
      ctx.fillStyle = glow;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    });
    ctx.globalCompositeOperation = "source-over";
    // ...and then the lanterns themselves: glowing paper, dark caps.
    LANTERNS.forEach((l) => {
      const [x, y] = pt(l.side * LANTERN_DX, LANTERN_H, l.p);
      const w = 19 * l.p;
      const h = 26 * l.p;
      const body = ctx.createRadialGradient(x, y - h * 0.15, 0, x, y, w * 1.2);
      body.addColorStop(0, "#fff6d6");
      body.addColorStop(0.5, "#ffc46e");
      body.addColorStop(1, "#e2602c");
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(170, 70, 30, 0.45)";
      ctx.lineWidth = Math.max(0.4, 0.8 * l.p);
      for (let k = -2; k <= 2; k++) {
        ctx.beginPath();
        ctx.ellipse(x, y + k * h * 0.3, w * Math.sqrt(1 - Math.pow(k * 0.3, 2)), h * 0.06, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = "#1a1210";
      ctx.fillRect(x - w * 0.55, y - h - 2.5 * l.p, w * 1.1, 3.5 * l.p);
      ctx.fillRect(x - w * 0.55, y + h - 1 * l.p, w * 1.1, 3.5 * l.p);
    });
  }

  // Lanterns and sunlight on the moving water.
  function paintWaterLight(ctx, time) {
    ctx.save();
    waterPath(ctx);
    ctx.clip();
    if (night) {
      ctx.globalCompositeOperation = "lighter";
      LANTERNS.forEach((l) => {
        // A lantern's reflection: a wavering streak under it.
        for (let k = 0; k < 7; k++) {
          const h = -2 * DROP - LANTERN_H + k * 14;
          const [x, y] = pt(l.side * LANTERN_DX, h, l.p);
          const wob = Math.sin(time * 2.2 + k * 1.3 + l.phase) * 3 * l.p;
          ctx.fillStyle = `rgba(${pal.lantern}, ${0.45 - k * 0.055})`;
          ctx.beginPath();
          ctx.ellipse(x + wob, y, (9 - k * 0.6) * l.p, 2.2 * l.p, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      ctx.globalCompositeOperation = "source-over";
    }
    glints.forEach((g) => {
      const drift = ((time * g.speed + g.phase) % 1) * 2 - 1;
      const [x, y] = pt((g.u + drift * 0.08) * WATER, -DROP, g.p);
      const alpha = Math.max(0, (night ? 0.18 : 0.35) * Math.sin(time * 1.4 + g.phase));
      ctx.strokeStyle = `rgba(${pal.glint}, ${alpha})`;
      ctx.lineWidth = Math.max(0.5, 1.6 * g.p);
      ctx.beginPath();
      ctx.moveTo(x - g.len * g.p, y);
      ctx.lineTo(x + g.len * g.p, y);
      ctx.stroke();
    });
    // Petals floating down the river toward us.
    floaters.forEach((f) => {
      const [x, y] = pt(f.u * WATER, -DROP, f.p);
      ctx.fillStyle = pal.waterPetal[f.shade];
      ctx.beginPath();
      ctx.ellipse(x, y, 2.6 * f.p + 0.3, 1.2 * f.p + 0.25, f.rot, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  const glints = (() => {
    const rand = seededRandom(99);
    return Array.from({ length: 50 }, () => ({
      u: rand() * 1.8 - 0.9,
      p: 0.06 + Math.pow(rand(), 0.6) * 1.2,
      len: 6 + rand() * 14,
      speed: 0.02 + rand() * 0.03,
      phase: rand() * Math.PI * 2,
    }));
  })();
  const floaters = (() => {
    const rand = seededRandom(5);
    return Array.from({ length: 140 }, () => ({
      u: rand() * 1.9 - 0.95,
      p: 0.05 + rand() * 1.3,
      rot: rand() * 3,
      shade: rand() < 0.5 ? 0 : 1,
    }));
  })();
  function stepFloaters(dt) {
    floaters.forEach((f) => {
      // Slow, and slower still in the distance.
      f.p += dt * 0.012 * (0.2 + f.p);
      if (f.p > NEAR) f.p = 0.05 + Math.random() * 0.1;
    });
  }

  // ---- Putting it together ----------------------------------------------

  let k = 1; // canvas pixels per scene unit
  let ox = 0;
  let oy = 0;
  let base = null;
  let layers = [];

  function newCanvas() {
    const c = document.createElement("canvas");
    c.width = sceneCanvas.width;
    c.height = sceneCanvas.height;
    return c;
  }

  function buildScene() {
    base = newCanvas();
    const bctx = base.getContext("2d");
    bctx.setTransform(k, 0, 0, k, ox, oy);
    paintSky(bctx);
    paintGround(bctx);
    paintTrees(bctx, TREES.filter((t) => t.p < LAYERS[0].min), k);
    paintHaze(bctx);

    layers = [];
    LAYERS.forEach((spec) => {
      [-1, 1].forEach((side) => {
        const trees = TREES.filter((t) => t.side === side && t.p >= spec.min && t.p < spec.max);
        if (!trees.length) return;
        const canvas = newCanvas();
        const ctx = canvas.getContext("2d");
        ctx.setTransform(k, 0, 0, k, ox, oy);
        paintTrees(ctx, trees, k);
        layers.push({
          canvas,
          spec,
          // The layer sways about the line where its trees stand.
          anchor: oy + Math.max(...trees.map((t) => t.baseY)) * k,
          phase: side * 1.3 + spec.min * 4,
        });
      });
    });
  }

  let time = 0;
  function windAt(when) {
    return 0.6 + 0.25 * Math.sin(when * 0.23) + 0.15 * Math.sin(when * 0.71 + 1.3);
  }

  function drawScene() {
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.drawImage(base, 0, 0);
    sctx.setTransform(k, 0, 0, k, ox, oy);
    paintWaterLight(sctx, time);
    let lanternsDone = !night;
    layers.forEach((layer) => {
      if (!lanternsDone && layer.spec.name === "near") {
        // Lanterns hang in front of the middle trees, behind the nearest.
        sctx.setTransform(k, 0, 0, k, ox, oy);
        paintLanternStrings(sctx);
        paintLanterns(sctx, time);
        lanternsDone = true;
      }
      const wind = windAt(time - layer.spec.min * 2);
      const skew = layer.spec.sway * (wind * 0.8 + 0.35 * Math.sin(time * 0.9 + layer.phase));
      sctx.setTransform(1, 0, skew, 1, -skew * layer.anchor, 0);
      sctx.drawImage(layer.canvas, 0, 0);
    });
  }

  // ---- Petals in the air ---------------------------------------------------

  let PW = 0;
  let PH = 0;
  let petalRatio = 1;
  let petals = [];

  function newPetal(anywhere) {
    const r = Math.random;
    return {
      // New petals blow in from the top or the left edge.
      x: anywhere ? r() * PW : r() < 0.6 ? r() * PW : -20,
      y: anywhere ? r() * PH : r() < 0.6 ? -20 : r() * PH * 0.7,
      size: 4 + r() * 5,
      fall: 18 + r() * 22,
      drift: 25 + r() * 30,
      flutter: 10 + r() * 20,
      flutterSpeed: 0.8 + r() * 1.4,
      rot: r() * Math.PI * 2,
      spin: (r() - 0.5) * 2.4,
      flip: r() * Math.PI * 2,
      flipSpeed: 1 + r() * 2.5,
      phase: r() * Math.PI * 2,
      shade: Math.floor(r() * 3),
    };
  }

  function stepPetals(dt) {
    const wind = windAt(time);
    petals.forEach((p, i) => {
      p.x += (p.drift * wind + Math.sin(time * p.flutterSpeed + p.phase) * p.flutter) * dt;
      p.y += p.fall * dt;
      p.rot += p.spin * dt;
      p.flip += p.flipSpeed * dt;
      if (p.y > PH + 20 || p.x > PW + 20) petals[i] = newPetal(false);
    });
  }

  function drawPetals() {
    pctx.setTransform(petalRatio, 0, 0, petalRatio, 0, 0);
    pctx.clearRect(0, 0, PW, PH);
    pctx.globalAlpha = pal.petalAlpha;
    petals.forEach((p) => {
      pctx.save();
      pctx.translate(p.x, p.y);
      pctx.rotate(p.rot);
      // Tumbling: the petal narrows as it turns edge-on.
      pctx.scale(1, 0.25 + 0.75 * Math.abs(Math.cos(p.flip)));
      pctx.fillStyle = pal.petals[p.shade];
      pctx.beginPath();
      pctx.ellipse(0, 0, p.size, p.size * 0.62, 0, 0, Math.PI * 2);
      pctx.fill();
      pctx.restore();
    });
    pctx.globalAlpha = 1;
  }

  // ---- Sizing, theme and the frame loop -------------------------------------

  let sizeKey = "";
  function build(force) {
    const box = wrap.getBoundingClientRect();
    const cw = Math.max(1, Math.round(box.width));
    const ch = Math.max(1, Math.round(box.height));
    if (!force && `${cw}x${ch}` === sizeKey) return;
    sizeKey = `${cw}x${ch}`;

    // Enough canvas pixels to look crisp, scaled down on big screens so
    // every screen costs about the same to animate.
    const res = Math.min(1, 800 / Math.max(cw, ch));
    sceneCanvas.width = Math.round(cw * res);
    sceneCanvas.height = Math.round(ch * res);
    // Cover the screen with the square scene, keeping the vanishing point
    // a little above the middle of the screen.
    k = Math.max(sceneCanvas.width, sceneCanvas.height) / SIZE;
    ox = (sceneCanvas.width - SIZE * k) / 2;
    oy = Math.min(0, Math.max(sceneCanvas.height - SIZE * k, sceneCanvas.height * 0.44 - VPY * k));
    buildScene();

    petalRatio = Math.min(2, window.devicePixelRatio || 1);
    PW = cw;
    PH = ch;
    petalCanvas.width = Math.round(cw * petalRatio);
    petalCanvas.height = Math.round(ch * petalRatio);
    // About one petal per 40,000 square pixels: a light flurry.
    const count = reduceMotion ? 0 : Math.round(Math.min(45, Math.max(12, (cw * ch) / 40000)));
    petals = Array.from({ length: count }, () => newPetal(true));

    drawScene();
    drawPetals();
  }

  // Dark mode: the switch under the phone. The choice is remembered in
  // this browser (the page's <head> applies it before anything draws).
  const toggle = document.getElementById("dark-toggle");
  function setNight(on) {
    night = on;
    pal = night ? PALETTES.night : PALETTES.day;
    root.dataset.theme = night ? "dark" : "light";
    if (toggle) toggle.setAttribute("aria-checked", String(night));
    try {
      localStorage.setItem(THEME_KEY, night ? "dark" : "light");
    } catch (e) {
      // Not remembered; the next visit starts in light mode.
    }
    // Fade from the old scene to the new one.
    const fade = document.createElement("canvas");
    fade.className = "sakura-fade";
    fade.width = sceneCanvas.width;
    fade.height = sceneCanvas.height;
    fade.getContext("2d").drawImage(sceneCanvas, 0, 0);
    wrap.insertBefore(fade, petalCanvas);
    build(true);
    requestAnimationFrame(() => {
      fade.style.opacity = "0";
      setTimeout(() => fade.remove(), 800);
    });
  }
  if (toggle) {
    toggle.setAttribute("aria-checked", String(night));
    toggle.addEventListener("click", () => setNight(!night));
  }

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => build(false), 200);
  });
  build(true);
  if (reduceMotion) return;

  let last = null;
  function tick(now) {
    const dt = last === null ? 0 : Math.min(0.05, (now - last) / 1000);
    last = now;
    time += dt;
    stepFloaters(dt);
    drawScene();
    stepPetals(dt);
    drawPetals();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
