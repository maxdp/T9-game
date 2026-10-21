// Page background: a soft, painterly view down a river lined with old
// cherry trees in full bloom -- thick dark trunks by the water, their
// limbs rising and dissolving into great loose clouds of blossom that
// arch over the river, petals on the water and drifting through the air.
// Dark mode turns it into the same place at night, lit by paper lanterns.
//
// It's painted rather than drawn: the blossom is hundreds of overlapping
// soft dabs that thin out into ragged edges, painted both behind and in
// front of the limbs so the trees melt into their canopies, and the whole
// scene is painted small and smoothed as it's enlarged, which blurs it
// like a photo taken with a shallow focus. Phones and desktops get their
// own framing of the scene (a narrow view down the river, or a wide one
// with the trees beside the phone). The still parts are painted once; the
// nearer trees sway in a gently gusting wind as separate layers.
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
  // The scene is painted on a working canvas twice the size of the one on
  // screen; shrinking it smooths it before the browser enlarges it.
  const work = document.createElement("canvas");
  const wctx = work.getContext("2d");
  if (!sctx || !pctx || !wctx) return;

  // The same trees every time (and on every visit).
  function seededRandom(seed) {
    return function () {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // Roughly bell-shaped, between -1 and 1.
  const bell = (r) => (r() + r() + r() - 1.5) / 1.5;

  // ---- Colors -----------------------------------------------------------

  const PALETTES = {
    day: {
      sky: ["#b5d2ec", "#dbe7f1", "#f6eef1"],
      cloud: "#ffffff",
      haze: "#fbe9ef",
      grass: ["#b9c98f", "#86a85a"],
      grassDabs: ["#9cb86b", "#c3d396", "#7a9c4f", "#d9c9c4"],
      path: "#e6d8cb",
      earth: "#8d7d65",
      water: ["#c1ccd3", "#8e9ea9"],
      waterDabs: ["#f6e3ea", "#ffffff", "#e9c6d2"],
      glint: "255, 255, 255",
      bark: ["#3a2f2f", "#4d3f3e", "#6b5a57"],
      shadow: ["#c48ea0", "#cf9daf", "#b9889a"],
      blossom: ["#e6b1c1", "#edc0ce", "#f3cfda", "#f7dbe3"],
      light: ["#fcebf0", "#fff6f8", "#ffffff"],
      leaf: ["#9fb86a", "#b5c77f"],
      petals: ["#f8c8d8", "#fbd9e5", "#f4b6cb"],
      petalAlpha: 0.85,
    },
    night: {
      sky: ["#070b1d", "#151b3e", "#2e2752"],
      cloud: "#4a4a78",
      haze: "#4c3a68",
      grass: ["#1f2a26", "#121a16"],
      grassDabs: ["#18241d", "#26352b", "#101812", "#3a3346"],
      path: "#2f2a38",
      earth: "#1c1816",
      water: ["#1d2540", "#0d1222"],
      waterDabs: ["#6a5880", "#8a7aa0", "#4c3f5e"],
      glint: "200, 205, 255",
      bark: ["#0e0b10", "#17121a", "#2a2230"],
      shadow: ["#2a2133", "#33293e", "#241c2c"],
      blossom: ["#4a3d5a", "#57486a", "#66567a", "#76658a"],
      light: ["#8f7ea3", "#a593b6", "#b9a8c8"],
      leaf: null,
      petals: ["#d9c6e0", "#e8d8ec", "#c9b3d3"],
      petalAlpha: 0.6,
      lantern: "#ffa858",
    },
  };
  let pal = night ? PALETTES.night : PALETTES.day;

  // Soft round dabs of paint, one ready-made image per color (always a
  // "#rrggbb" color), stamped at any size and strength.
  const dabCache = new Map();
  function dabImage(color) {
    let img = dabCache.get(color);
    if (!img) {
      img = document.createElement("canvas");
      img.width = img.height = 32;
      const ctx = img.getContext("2d");
      const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      g.addColorStop(0, color);
      g.addColorStop(0.45, color);
      g.addColorStop(1, color + "00");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 32, 32);
      dabCache.set(color, img);
    }
    return img;
  }
  function dab(ctx, color, x, y, r, alpha, squash = 1) {
    ctx.globalAlpha = alpha;
    ctx.drawImage(dabImage(color), x - r, y - r * squash, r * 2, r * 2 * squash);
  }
  const pick = (r, list) => list[Math.floor(r() * list.length)];

  // ---- Layout -----------------------------------------------------------
  // Looking down the river: everything recedes to a vanishing point. A spot
  // is given by its sideways distance from the river's center (dx) and its
  // height (h), both in canvas pixels as they'd be at the bottom edge of
  // the screen, and its depth p (1 at the bottom edge, shrinking toward 0
  // at the vanishing point; nearer than the bottom edge is above 1).
  let W = 0;
  let H = 0;
  let L = null;

  function layoutFor(w, h) {
    const portrait = h > w * 1.1;
    return portrait
      ? // A phone: a narrow view straight down the river, trees close on
        // either side.
        { vpx: w * 0.5, vpy: h * 0.52, river: w * 0.2, treeDx: w * 0.36, treeH: h * 0.6, spread: w * 0.7, lanternDx: w * 0.18 }
      : // A wide screen: the river runs behind the phone in the middle, the
        // trees stand beside it.
        { vpx: w * 0.5, vpy: h * 0.47, river: w * 0.1, treeDx: w * 0.2, treeH: h * 0.78, spread: w * 0.3, lanternDx: w * 0.25 };
  }
  const pt = (dx, h, p) => [L.vpx + dx * p, L.vpy + (H - L.vpy) * p - h * p];
  // Depths spread evenly along the ground (so closer together far away).
  const groundDepth = (r, near = 1.5) => 1 / (1 / near + r() * (1 / 0.03 - 1 / near));

  function bandPath(ctx, dxA, dxB, p0 = 0.003, p1 = 3) {
    const a0 = pt(dxA, 0, p0);
    const a1 = pt(dxA, 0, p1);
    const b1 = pt(dxB, 0, p1);
    const b0 = pt(dxB, 0, p0);
    ctx.beginPath();
    ctx.moveTo(a0[0], a0[1]);
    ctx.lineTo(a1[0], a1[1]);
    ctx.lineTo(b1[0], b1[1]);
    ctx.lineTo(b0[0], b0[1]);
    ctx.closePath();
  }
  const waterPath = (ctx) => bandPath(ctx, -L.river, L.river);

  // ---- Trees ------------------------------------------------------------

  const TREE_DEPTHS = [2.1, 1.5, 1.08, 0.8, 0.62, 0.49, 0.4, 0.33, 0.275, 0.23, 0.195, 0.165, 0.14, 0.12, 0.1, 0.085, 0.072, 0.06, 0.05, 0.042];

  // A tree: a thick trunk leaning a little over the water, forking into a
  // few limbs that climb and reach out over the river, each splitting
  // into a couple of branches, and a loose crown of blossom made of
  // overlapping lobes around the ends and along the upper parts of them
  // all, so the limbs disappear up into it.
  function makeTree(r, side, p) {
    const inward = -side;
    const height = L.treeH * p * (0.85 + r() * 0.3);
    const [bx, by] = pt(side * L.treeDx * (0.88 + r() * 0.25), 0, p);
    // One stout trunk, rising about halfway before it splits.
    const forkX = bx + inward * height * (0.06 + r() * 0.08);
    const forkY = by - height * (0.42 + r() * 0.1);
    const trunkW = height * (0.08 + r() * 0.025);
    const limbs = [];
    const lobes = [];
    const count = 2 + Math.floor(r() * 2);
    for (let i = 0; i < count; i++) {
      // From one reaching back over the bank to one reaching out over the
      // water: thick, short, and soon lost in the blossom.
      const t = count === 1 ? 1 : i / (count - 1);
      // (The nearest trees reach no farther than those a little way off,
      // so their crowns frame the view rather than covering it.)
      const reach = (-0.15 + t * 0.95) * L.spread * Math.min(p, 1.1) * (0.7 + r() * 0.35);
      const limb = {
        x0: forkX,
        y0: forkY,
        cx: forkX + inward * reach * 0.2,
        cy: forkY - height * (0.1 + r() * 0.08),
        ex: forkX + inward * reach * 0.6,
        ey: forkY - height * (0.22 + r() * 0.12),
        w0: trunkW * (0.6 + r() * 0.15),
      };
      limb.w1 = limb.w0 * 0.55;
      limbs.push(limb);
      // Two branches from the end of each limb, up and out.
      for (let b = 0; b < 2; b++) {
        const spread = (b === 0 ? 0.55 : -0.25) * inward * reach + (r() - 0.5) * height * 0.1;
        const branch = {
          x0: limb.ex,
          y0: limb.ey,
          cx: limb.ex + spread * 0.4,
          cy: limb.ey - height * (0.08 + r() * 0.06),
          ex: limb.ex + spread,
          ey: limb.ey - height * (0.1 + r() * 0.14) + Math.abs(spread) * 0.15,
          w0: limb.w1,
          w1: limb.w1 * 0.3,
        };
        limbs.push(branch);
        const R = height * (0.13 + r() * 0.07);
        lobes.push({ x: branch.ex, y: branch.ey, rx: R * 1.4, ry: R * 0.9 });
      }
      const R = height * (0.14 + r() * 0.06);
      lobes.push({ x: limb.ex, y: limb.ey - R * 0.2, rx: R * 1.3, ry: R * 0.85 });
    }
    return { side, p, bx, by, forkX, forkY, trunkW, limbs, lobes, height, seed: Math.floor(r() * 1e9) };
  }

  // Dabs scattered through a lobe of blossom, thick in the middle and
  // thinning out to a ragged edge; bias pulls them toward the top (-) or
  // bottom (+) of the lobe.
  function paintLobe(ctx, r, lobe, colors, density, alpha, bias) {
    const size = Math.max(1, Math.min(lobe.rx, lobe.ry) * 0.3);
    const n = 2 + Math.round((density * lobe.rx * lobe.ry) / (size * size));
    for (let i = 0; i < n; i++) {
      const gx = bell(r);
      const gy = bell(r) * 0.85 + bias;
      dab(ctx, pick(r, colors), lobe.x + gx * lobe.rx, lobe.y + gy * lobe.ry, size * (0.55 + r() * 0.8), alpha * (0.5 + r() * 0.5), 0.8);
    }
  }

  // A limb (or trunk): soft dabs of bark laid along a curve, tapering and
  // fading out toward its end (where it disappears into the blossom), so
  // it has the loose edges of a brushstroke.
  function paintLimb(ctx, color, l, scale, shift, fade, strength = 0.9) {
    const len = Math.hypot(l.cx - l.x0, l.cy - l.y0) + Math.hypot(l.ex - l.cx, l.ey - l.cy);
    const steps = Math.max(4, Math.ceil(len / Math.max(0.8, l.w1 * scale * 0.45)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = (1 - t) * (1 - t) * l.x0 + 2 * (1 - t) * t * l.cx + t * t * l.ex;
      const y = (1 - t) * (1 - t) * l.y0 + 2 * (1 - t) * t * l.cy + t * t * l.ey;
      let dx = 2 * (1 - t) * (l.cx - l.x0) + 2 * t * (l.ex - l.cx);
      let dy = 2 * (1 - t) * (l.cy - l.y0) + 2 * t * (l.ey - l.cy);
      const d = Math.hypot(dx, dy) || 1;
      dx /= d;
      dy /= d;
      const w = (l.w0 + (l.w1 - l.w0) * t) * scale;
      dab(ctx, color, x - dy * l.w0 * shift, y + dx * l.w0 * shift, w * 0.75, strength * (1 - fade * t));
    }
  }

  function paintTree(ctx, tree) {
    const r = seededRandom(tree.seed);
    // Its shadow on the grass.
    dab(ctx, night ? "#000000" : "#4a5a30", tree.bx + tree.side * -tree.trunkW, tree.by, tree.trunkW * 2.4, 0.22, 0.25);

    // Blossom in shadow, behind the limbs.
    tree.lobes.forEach((lobe) => paintLobe(ctx, r, lobe, pal.shadow, 0.9, 0.5, 0.25));

    // The trunk and limbs, each painted dark then a mid tone, and a lighter
    // edge down the trunk on the side facing the light.
    const w = tree.trunkW;
    const trunk = { x0: tree.bx, y0: tree.by + w * 0.2, cx: tree.bx, cy: (tree.by + tree.forkY) / 2, ex: tree.forkX, ey: tree.forkY, w0: w * 1.2, w1: w * 0.85 };
    [
      [pal.bark[0], 1, 0, 0.9],
      [pal.bark[1], 0.55, -0.12, 0.8],
      [pal.bark[2], 0.25, -0.3, 0.3],
    ].forEach(([color, scale, shift, strength], i) => {
      paintLimb(ctx, color, trunk, scale, shift, 0, strength);
      if (i < 2) tree.limbs.forEach((l) => paintLimb(ctx, color, l, scale, shift * 0.6, 0.8, strength));
    });
    // Roots spreading into the bank, and grass growing up around them.
    dab(ctx, pal.bark[0], tree.bx, tree.by, w * 1.1, 0.9, 0.35);
    for (let i = 0; i < 6; i++) {
      dab(ctx, pick(r, [pal.grassDabs[0], pal.grassDabs[2]]), tree.bx + bell(r) * w * 1.3, tree.by + w * (0.15 + r() * 0.2), w * (0.35 + r() * 0.3), 0.5, 0.45);
    }

    // Blossom in front, partly over the limbs, then a few bright tops and
    // (by day) touches of fresh green leaves underneath.
    tree.lobes.forEach((lobe) => paintLobe(ctx, r, lobe, pal.blossom, 1.1, 0.75, -0.08));
    tree.lobes.forEach((lobe) => paintLobe(ctx, r, lobe, pal.light, night ? 0.12 : 0.3, night ? 0.45 : 0.7, -0.4));
    if (pal.leaf) tree.lobes.forEach((lobe) => paintLobe(ctx, r, lobe, pal.leaf, 0.006, 0.3, 0.5));
    ctx.globalAlpha = 1;
  }

  // ---- The still background ----------------------------------------------

  function paintBackground(ctx) {
    const r = seededRandom(11);
    const vy = L.vpy;
    const sky = ctx.createLinearGradient(0, 0, 0, vy);
    sky.addColorStop(0, pal.sky[0]);
    sky.addColorStop(0.6, pal.sky[1]);
    sky.addColorStop(1, pal.sky[2]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, vy + 1);

    if (night) {
      for (let i = 0; i < 70; i++) dab(ctx, "#ffffff", r() * W, r() * vy, 0.8 + r(), 0.3 + r() * 0.6);
      dab(ctx, "#c8ccff", W * 0.78, H * 0.12, Math.min(W, H) * 0.12, 0.25);
      dab(ctx, "#fff8e6", W * 0.78, H * 0.12, Math.min(W, H) * 0.035, 1);
    }
    for (let i = 0; i < 7; i++) {
      const cx = r() * W;
      const cy = r() * vy * 0.7;
      const s = Math.min(W, H) * (0.06 + r() * 0.06);
      for (let j = 0; j < 10; j++) dab(ctx, pal.cloud, cx + bell(r) * s * 2.2, cy + bell(r) * s * 0.4, s * (0.5 + r() * 0.5), night ? 0.25 : 0.55, 0.6);
    }

    // The grassy banks, with dabs of lighter and darker green (and fallen
    // petals near the trees).
    ctx.globalAlpha = 1;
    const grass = ctx.createLinearGradient(0, vy, 0, H);
    grass.addColorStop(0, pal.grass[0]);
    grass.addColorStop(1, pal.grass[1]);
    ctx.fillStyle = grass;
    ctx.fillRect(0, vy, W, H - vy);
    [-1, 1].forEach((side) => {
      for (let i = 0; i < 500; i++) {
        const p = groundDepth(r);
        const [x, y] = pt(side * (L.river + r() * W * 1.4), 0, p);
        dab(ctx, pick(r, pal.grassDabs), x, y, (4 + r() * 8) * p * (W / 400) + 0.6, 0.45, 0.35);
      }
      // A pale footpath behind the trees.
      bandPath(ctx, side * L.treeDx * 1.3, side * L.treeDx * 1.5);
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = pal.path;
      ctx.fill();
      for (let i = 0; i < 300; i++) {
        const p = groundDepth(r);
        const [x, y] = pt(side * (L.river + Math.pow(r(), 1.4) * L.treeDx * 1.4), 0, p);
        dab(ctx, pick(r, pal.petals), x, y, (1.5 + r() * 2.5) * p * (W / 400) + 0.4, 0.5, 0.4);
      }
      // The earthy edge of the bank.
      bandPath(ctx, side * L.river, side * L.river * 1.06);
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = pal.earth;
      ctx.fill();
    });

    // The water: pale, reflecting the blossom along its edges, and covered
    // in petals.
    ctx.globalAlpha = 1;
    waterPath(ctx);
    const water = ctx.createLinearGradient(0, vy, 0, H);
    water.addColorStop(0, pal.water[0]);
    water.addColorStop(1, pal.water[1]);
    ctx.fillStyle = water;
    ctx.fill();
    ctx.save();
    waterPath(ctx);
    ctx.clip();
    for (let i = 0; i < 260; i++) {
      const p = groundDepth(r, 1.3);
      const u = Math.sign(r() - 0.5) * (0.6 + r() * 0.45);
      const [x, y] = pt(u * L.river, 0, p);
      dab(ctx, pick(r, pal.shadow), x, y, (6 + r() * 10) * p * (W / 400) + 0.5, 0.25, 0.4);
    }
    for (let i = 0; i < 900; i++) {
      const p = groundDepth(r, 1.3);
      const u = Math.sign(r() - 0.5) * Math.pow(r(), 0.6);
      const [x, y] = pt(u * L.river, 0, p);
      dab(ctx, pick(r, pal.waterDabs), x, y, (1.4 + r() * 2) * p * (W / 400) + 0.4, 0.55, 0.45);
    }
    ctx.restore();

    // The far end of the tunnel of trees, lost in a pale haze.
    dab(ctx, pal.haze, L.vpx, L.vpy - H * 0.02, Math.min(W, H) * 0.22, night ? 0.5 : 0.8, 0.8);
    ctx.globalAlpha = 1;
  }

  // ---- Lanterns (night) ---------------------------------------------------
  // Paper lanterns hung along both banks under the trees (over the
  // water's edge on a phone; beside the phone, along the outside of the
  // trees, on a wide screen); blurred like
  // the rest of the scene, they glow like soft orbs.
  const LANTERN_DEPTHS = [1.25, 0.86, 0.63, 0.48, 0.38];
  function lanternSpots() {
    const spots = [];
    [-1, 1].forEach((side) => {
      LANTERN_DEPTHS.forEach((p, i) => {
        const pp = p * (side > 0 ? 1.06 : 1);
        const [x, y] = pt(side * L.lanternDx, L.treeH * 0.4, pp);
        spots.push({ x, y, p: pp, phase: i * 1.7 + side });
      });
    });
    return spots;
  }
  function paintLanterns(ctx, time) {
    const scale = W / 400;
    ctx.globalCompositeOperation = "lighter";
    lanterns.forEach((l) => {
      const flicker = 0.9 + 0.06 * Math.sin(time * 7.3 + l.phase) + 0.04 * Math.sin(time * 13.1 + l.phase * 2);
      // Glow on the trees and the ground beneath.
      dab(ctx, pal.lantern, l.x, l.y, 60 * l.p * scale, 0.32 * flicker);
      dab(ctx, pal.lantern, l.x, l.y + L.treeH * 0.4 * l.p, 45 * l.p * scale, 0.18 * flicker, 0.3);
    });
    ctx.globalCompositeOperation = "source-over";
    lanterns.forEach((l) => {
      dab(ctx, "#ff8a3a", l.x, l.y, 9 * l.p * scale, 1, 1.3);
      dab(ctx, "#ffd890", l.x, l.y, 6 * l.p * scale, 1, 1.3);
      dab(ctx, "#fff6dc", l.x, l.y - 1 * l.p * scale, 3 * l.p * scale, 1, 1.2);
    });
    ctx.globalAlpha = 1;
  }

  // ---- Moving water -------------------------------------------------------

  const floaters = (() => {
    const r = seededRandom(5);
    return Array.from({ length: 90 }, () => ({ u: r() * 1.9 - 0.95, p: 0.05 + r() * 1.3, size: 0.8 + r() * 0.8 }));
  })();
  const glints = (() => {
    const r = seededRandom(99);
    return Array.from({ length: 40 }, () => ({ u: r() * 1.6 - 0.8, p: 0.06 + Math.pow(r(), 0.6) * 1.2, len: 0.08 + r() * 0.15, phase: r() * Math.PI * 2 }));
  })();
  function stepFloaters(dt) {
    floaters.forEach((f) => {
      // Slow, and slower still in the distance.
      f.p += dt * 0.012 * (0.2 + f.p);
      if (f.p > 1.4) f.p = 0.05 + Math.random() * 0.1;
    });
  }
  function paintWater(ctx, time) {
    const scale = W / 400;
    ctx.save();
    waterPath(ctx);
    ctx.clip();
    glints.forEach((g) => {
      const alpha = Math.max(0, (night ? 0.2 : 0.4) * Math.sin(time * 1.3 + g.phase));
      const [x, y] = pt(g.u * L.river, 0, g.p);
      ctx.strokeStyle = `rgba(${pal.glint}, ${alpha})`;
      ctx.lineWidth = Math.max(0.6, 1.2 * g.p * scale);
      ctx.beginPath();
      ctx.moveTo(x - g.len * L.river * g.p, y);
      ctx.lineTo(x + g.len * L.river * g.p, y);
      ctx.stroke();
    });
    floaters.forEach((f) => {
      const [x, y] = pt(f.u * L.river, 0, f.p);
      dab(ctx, pal.waterDabs[0], x, y, f.size * 2 * f.p * scale + 0.4, 0.8, 0.45);
    });
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // ---- Putting it together ----------------------------------------------

  let base = null;
  let layers = [];
  let lanterns = [];
  const LAYERS = [
    { name: "mid", min: 0.3, max: 0.9, sway: 0.005 },
    { name: "near", min: 0.9, max: 99, sway: 0.008 },
  ];

  function newCanvas() {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    return c;
  }

  function buildScene() {
    L = layoutFor(W, H);
    const r = seededRandom(1729);
    const trees = [];
    // On a tall, narrow screen the nearest trees would fill it, so they're
    // left out there.
    const nearest = H > W * 1.1 ? 1.6 : 99;
    [-1, 1].forEach((side) => {
      TREE_DEPTHS.forEach((p) => {
        const tree = makeTree(r, side, p * (1 + (r() - 0.5) * 0.1));
        if (p <= nearest) trees.push(tree);
      });
    });
    trees.sort((a, b) => a.p - b.p);
    lanterns = lanternSpots();

    base = newCanvas();
    const bctx = base.getContext("2d");
    paintBackground(bctx);
    trees.filter((t) => t.p < LAYERS[0].min).forEach((t) => paintTree(bctx, t));

    layers = [];
    LAYERS.forEach((spec) => {
      [-1, 1].forEach((side) => {
        const group = trees.filter((t) => t.side === side && t.p >= spec.min && t.p < spec.max);
        if (!group.length) return;
        const canvas = newCanvas();
        const ctx = canvas.getContext("2d");
        group.forEach((t) => paintTree(ctx, t));
        // The layer sways about the line where its trees stand.
        layers.push({ canvas, spec, anchor: Math.max(...group.map((t) => t.by)), phase: side * 1.3 + spec.min * 4 });
      });
    });
  }

  let time = 0;
  function windAt(when) {
    return 0.6 + 0.25 * Math.sin(when * 0.23) + 0.15 * Math.sin(when * 0.71 + 1.3);
  }

  function drawScene() {
    wctx.setTransform(1, 0, 0, 1, 0, 0);
    wctx.drawImage(base, 0, 0);
    paintWater(wctx, time);
    let lanternsDone = !night;
    layers.forEach((layer) => {
      if (!lanternsDone && layer.spec.name === "near") {
        // Lanterns hang in front of the middle trees, behind the nearest.
        wctx.setTransform(1, 0, 0, 1, 0, 0);
        paintLanterns(wctx, time);
        lanternsDone = true;
      }
      const wind = windAt(time - layer.spec.min * 2);
      const skew = layer.spec.sway * (wind * 0.8 + 0.35 * Math.sin(time * 0.9 + layer.phase));
      wctx.setTransform(1, 0, skew, 1, -skew * layer.anchor, 0);
      wctx.drawImage(layer.canvas, 0, 0);
    });
    wctx.setTransform(1, 0, 0, 1, 0, 0);
    if (!lanternsDone) paintLanterns(wctx, time);
    sctx.imageSmoothingQuality = "high";
    sctx.drawImage(work, 0, 0, sceneCanvas.width, sceneCanvas.height);
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

    // A small canvas, so the scene comes out soft once it's enlarged to
    // fill the screen; about the same size on every screen, so every
    // screen costs about the same to animate.
    const res = 640 / Math.max(cw, ch);
    W = Math.max(40, Math.round(cw * res));
    H = Math.max(40, Math.round(ch * res));
    work.width = W;
    work.height = H;
    sceneCanvas.width = Math.ceil(W / 2);
    sceneCanvas.height = Math.ceil(H / 2);
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
