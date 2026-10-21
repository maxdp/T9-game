// Page background: a daytime view along a river lined with cherry trees in
// bloom, drawn in code. The scene is painted at a quarter of the screen's
// resolution, shrunk to an eighth and stretched back up by the browser's
// smooth scaling, so it reads as soft and far away -- a blur without any
// blur filter, which would cost far more to redraw every frame on slower
// phones. The blossoms sway in a gentle wind while petals drift across in
// front of it. requestAnimationFrame stops while
// the tab is hidden, and anyone who prefers reduced motion gets a still
// frame with no drifting petals.
(function () {
  const SCALE = 0.25; // scene pixels per CSS pixel (shown at half that)
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
  const work = document.createElement("canvas");
  const wctx = work.getContext("2d");
  const pctx = petalCanvas.getContext("2d");
  if (!sctx || !pctx || !wctx) return;

  // The same layout every time the scene is rebuilt (e.g. on resize), so
  // the trees don't jump around.
  function seededRandom(seed) {
    return function () {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const BLOSSOM_COLORS = ["#f8c8d8", "#fbd9e5", "#f4b6cb", "#fde8ef", "#f6bfd2", "#ffeef4"];

  // ---- Scene layout ---------------------------------------------------
  // Looking down the river toward the horizon: depth t runs from 0 at the
  // horizon to 1 at the bottom of the screen (and a little past it).
  let W = 0;
  let H = 0;
  let base = null; // the still parts: sky, hills, banks, water
  let trees = [];
  let glints = [];
  const HORIZON = 0.42;

  const yAt = (t) => H * (HORIZON + (1 - HORIZON) * t);
  // The river runs in from the lower left and bends away toward the
  // horizon right of center, so it shows beside the phone, not just behind.
  const riverCenter = (t) => W * (0.6 - 0.28 * t + 0.04 * Math.sin(t * 5 + 0.6));
  const riverHalf = (t) => W * (0.01 + 0.16 * t);

  function riverPath(ctx) {
    ctx.beginPath();
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * 1.1;
      ctx.lineTo(riverCenter(t) - riverHalf(t), yAt(t));
    }
    for (let i = steps; i >= 0; i--) {
      const t = (i / steps) * 1.1;
      ctx.lineTo(riverCenter(t) + riverHalf(t), yAt(t));
    }
    ctx.closePath();
  }

  function paintBase(ctx) {
    const rand = seededRandom(7);
    const hz = yAt(0);

    const sky = ctx.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, "#a7d3f3");
    sky.addColorStop(0.6, "#d4ebf9");
    sky.addColorStop(1, "#f7e8ef");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, hz + 1);

    // A few soft clouds.
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    for (let i = 0; i < 6; i++) {
      const cx = rand() * W;
      const cy = hz * (0.12 + rand() * 0.45);
      const r = Math.min(W, H) * (0.05 + rand() * 0.05);
      for (let j = 0; j < 4; j++) {
        ctx.beginPath();
        ctx.ellipse(cx + (j - 1.5) * r * 0.8, cy + (j % 2) * r * 0.2, r, r * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Hazy hills on the horizon, the farther ones paler.
    [
      { color: "#c9d5e8", height: 0.11, freq: 2.1, phase: 0.4 },
      { color: "#b7c8de", height: 0.07, freq: 3.3, phase: 1.9 },
    ].forEach((hill) => {
      ctx.fillStyle = hill.color;
      ctx.beginPath();
      ctx.moveTo(0, hz + 1);
      for (let x = 0; x <= W; x += 2) {
        const u = x / W;
        const y = hz - H * hill.height * (0.55 + 0.3 * Math.sin(u * hill.freq * Math.PI + hill.phase) + 0.15 * Math.sin(u * 11 + hill.phase));
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, hz + 1);
      ctx.closePath();
      ctx.fill();
    });

    // Grassy banks, greener up close.
    const ground = ctx.createLinearGradient(0, hz, 0, H);
    ground.addColorStop(0, "#d7e2c6");
    ground.addColorStop(1, "#a9cc92");
    ctx.fillStyle = ground;
    ctx.fillRect(0, hz, W, H - hz);

    // Stone edging along both banks, then the water.
    ctx.save();
    ctx.lineWidth = Math.max(1, W * 0.012);
    ctx.strokeStyle = "#e9e1d3";
    riverPath(ctx);
    ctx.stroke();
    ctx.restore();

    // A pale footpath along each bank.
    const unit = Math.min(W, H * 1.4);
    ctx.fillStyle = "rgba(240, 228, 208, 0.75)";
    [-1, 1].forEach((side) => {
      ctx.beginPath();
      const steps = 24;
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * 1.1;
        ctx.lineTo(riverCenter(t) + side * (riverHalf(t) + unit * PATH_SETBACK[0] * t), yAt(t));
      }
      for (let i = steps; i >= 0; i--) {
        const t = (i / steps) * 1.1;
        ctx.lineTo(riverCenter(t) + side * (riverHalf(t) + unit * PATH_SETBACK[1] * t), yAt(t));
      }
      ctx.closePath();
      ctx.fill();
    });

    // Soft shade on the grass under each tree.
    ctx.fillStyle = "rgba(70, 110, 60, 0.18)";
    trees.forEach((tree) => {
      ctx.beginPath();
      ctx.ellipse(tree.topX, tree.baseY, tree.R * 1.1, tree.R * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    riverPath(ctx);
    const water = ctx.createLinearGradient(0, hz, 0, H);
    water.addColorStop(0, "#d9eaf3");
    water.addColorStop(1, "#8fc4de");
    ctx.fillStyle = water;
    ctx.fill();
  }

  // Blossom shades from the shadowed underside of a canopy to its sunlit
  // top.
  const CANOPY_SHADES = ["#eba3bb", "#f2b4c8", "#f6c3d4", "#f9d2df", "#fcdfe8", "#ffedf3"];

  // How far each row of trees stands back from the water, as a share of
  // the scene's size at that depth.
  const ROW_SETBACKS = [0.03, 0.34, 0.68, 1.02, 1.36];
  const PATH_SETBACK = [0.13, 0.21];

  function makeTrees() {
    const rand = seededRandom(42);
    const unit = Math.min(W, H * 1.4);
    const list = [];
    // Trees stop short of the foreground, leaving open grass and water
    // below them, which keeps the view feeling far away.
    const depths = [];
    for (let t = 0.03; t < 0.62; t *= 1.2) depths.push(t);
    depths.forEach((t) => {
      // A row of trees right on each bank, then more rows set back from
      // it, out to the edges of the screen.
      [-1, 1].forEach((side) => {
        ROW_SETBACKS.forEach((setback, row) => {
        const tt = t * (1 + (rand() - 0.5) * 0.12) + (side > 0 ? 0.01 : 0) - row * 0.012;
        if (tt <= 0.02) return;
        const baseX = riverCenter(tt) + side * (riverHalf(tt) + unit * (setback + (row ? rand() * 0.1 : 0)) * tt);
        const baseY = yAt(tt);
        const trunkH = unit * (0.3 + rand() * 0.06) * tt;
        // Cherry trees along a river lean out over the water.
        const lean = -side * unit * (row ? 0.02 : 0.07 + rand() * 0.04) * tt;
        const topX = baseX + lean;
        const topY = baseY - trunkH;
        const R = unit * (0.15 + rand() * 0.04) * tt;
        const blobs = [];
        // Far trees are tiny, so fewer blossom clusters do.
        const blobCount = Math.round(10 + 16 * Math.min(1, tt / 0.3));
        for (let b = 0; b < blobCount; b++) {
          const a = rand() * Math.PI * 2;
          const d = Math.sqrt(rand());
          const dy = Math.sin(a) * d * R * 0.6;
          // Lower in the canopy is shadier.
          const light = Math.min(1, Math.max(0, 0.5 - dy / (R * 1.2) + (rand() - 0.5) * 0.5));
          blobs.push({
            // A wide, low canopy that spreads more toward the river.
            dx: Math.cos(a) * d * R * 1.25 - side * R * 0.25,
            dy,
            r: R * (0.2 + rand() * 0.2),
            color: CANOPY_SHADES[Math.round(light * (CANOPY_SHADES.length - 1))],
            phase: rand() * Math.PI * 2,
          });
        }
        // Shady blossoms first, so the sunlit ones sit on top.
        blobs.sort((x, y) => y.dy - x.dy);
        list.push({ t: tt, row, side, baseX, baseY, topX, topY, R, trunkW: Math.max(0.5, unit * 0.012 * tt), blobs, phase: rand() * Math.PI * 2 });
        });
      });
    });
    // Far to near, so nearer trees are painted over farther ones.
    return list.sort((a, b) => a.t - b.t);
  }

  function makeGlints() {
    const rand = seededRandom(99);
    const list = [];
    for (let i = 0; i < 40; i++) {
      const t = 0.05 + rand() * 1.0;
      list.push({ t, offset: rand() * 2 - 1, len: 0.15 + rand() * 0.3, speed: 0.02 + rand() * 0.03, phase: rand() * Math.PI * 2 });
    }
    return list;
  }

  // ---- Drawing the scene ---------------------------------------------

  let time = 0;

  // How hard the wind blows right now: a slow swell with gentle gusts.
  function windAt(when) {
    return 0.65 + 0.25 * Math.sin(when * 0.23) + 0.1 * Math.sin(when * 0.71 + 1.3);
  }

  function treeSway(tree, blob) {
    const wind = windAt(time - tree.t * 1.5);
    return (
      Math.sin(time * 0.8 + tree.phase) * tree.R * 0.035 * wind +
      Math.sin(time * 2.1 + blob.phase) * tree.R * 0.015 * wind +
      tree.R * 0.03 * wind
    );
  }

  function drawTree(ctx, tree) {
    const sway = tree.blobs.length ? treeSway(tree, tree.blobs[0]) * 0.4 : 0;
    ctx.strokeStyle = "#8a716b";
    ctx.lineWidth = tree.trunkW;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(tree.baseX, tree.baseY);
    ctx.quadraticCurveTo(tree.baseX, (tree.baseY + tree.topY) / 2, tree.topX + sway, tree.topY);
    ctx.stroke();
    tree.blobs.forEach((blob) => {
      ctx.fillStyle = blob.color;
      ctx.beginPath();
      ctx.arc(tree.topX + blob.dx + treeSway(tree, blob), tree.topY + blob.dy, blob.r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Blossoms mirrored in the water, faint and rippling.
  function drawReflections(ctx) {
    ctx.save();
    riverPath(ctx);
    ctx.clip();
    ctx.globalAlpha = 0.28;
    trees.forEach((tree) => {
      // Only the riverside row stands close enough to show in the water.
      if (tree.row !== 0) return;
      tree.blobs.forEach((blob) => {
        const y = tree.baseY + (tree.baseY - (tree.topY + blob.dy));
        const ripple = Math.sin(time * 1.6 + y * 0.35) * tree.R * 0.04;
        ctx.fillStyle = blob.color;
        ctx.beginPath();
        ctx.ellipse(tree.topX + blob.dx + treeSway(tree, blob) + ripple, y, blob.r, blob.r * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
      });
    });
    ctx.globalAlpha = 1;
    // Sunlight glinting on the current.
    glints.forEach((g) => {
      const t = g.t;
      const drift = ((time * g.speed + g.phase) % 1) * 2 - 1;
      const x = riverCenter(t) + (g.offset * 0.7 + drift * 0.15) * riverHalf(t);
      const y = yAt(t);
      const alpha = 0.25 + 0.25 * Math.sin(time * 1.3 + g.phase);
      ctx.strokeStyle = `rgba(255, 255, 255, ${Math.max(0, alpha)})`;
      ctx.lineWidth = Math.max(0.5, H * 0.006 * t);
      ctx.beginPath();
      ctx.moveTo(x - riverHalf(t) * g.len * 0.5, y);
      ctx.lineTo(x + riverHalf(t) * g.len * 0.5, y);
      ctx.stroke();
    });
    ctx.restore();
  }

  function drawScene() {
    wctx.drawImage(base, 0, 0);
    drawReflections(wctx);
    trees.forEach((tree) => drawTree(wctx, tree));
    sctx.imageSmoothingQuality = "high";
    sctx.drawImage(work, 0, 0, sceneCanvas.width, sceneCanvas.height);
  }

  // ---- Petals ---------------------------------------------------------

  let PW = 0;
  let PH = 0;
  let petalRatio = 1;
  let petals = [];
  const petalRand = Math.random;

  function newPetal(anywhere) {
    const size = 4 + petalRand() * 5;
    return {
      // New petals blow in from the top or the left edge.
      x: anywhere ? petalRand() * PW : petalRand() < 0.6 ? petalRand() * PW : -20,
      y: anywhere ? petalRand() * PH : petalRand() < 0.6 ? -20 : petalRand() * PH * 0.7,
      size,
      fall: 18 + petalRand() * 22,
      drift: 25 + petalRand() * 30,
      flutter: 10 + petalRand() * 20,
      flutterSpeed: 0.8 + petalRand() * 1.4,
      rot: petalRand() * Math.PI * 2,
      spin: (petalRand() - 0.5) * 2.4,
      flip: petalRand() * Math.PI * 2,
      flipSpeed: 1 + petalRand() * 2.5,
      phase: petalRand() * Math.PI * 2,
      color: BLOSSOM_COLORS[Math.floor(petalRand() * 3)],
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
    petals.forEach((p) => {
      pctx.save();
      pctx.translate(p.x, p.y);
      pctx.rotate(p.rot);
      // Tumbling: the petal narrows as it turns edge-on.
      pctx.scale(1, 0.25 + 0.75 * Math.abs(Math.cos(p.flip)));
      pctx.fillStyle = p.color;
      pctx.globalAlpha = 0.8;
      pctx.beginPath();
      pctx.ellipse(0, 0, p.size, p.size * 0.62, 0, 0, Math.PI * 2);
      pctx.fill();
      pctx.restore();
    });
  }

  // ---- Sizing and the frame loop -------------------------------------

  function build() {
    const box = wrap.getBoundingClientRect();
    const cw = Math.max(1, box.width);
    const ch = Math.max(1, box.height);

    W = Math.max(40, Math.round(cw * SCALE));
    H = Math.max(40, Math.round(ch * SCALE));
    work.width = W;
    work.height = H;
    sceneCanvas.width = Math.ceil(W / 2);
    sceneCanvas.height = Math.ceil(H / 2);
    trees = makeTrees();
    base = document.createElement("canvas");
    base.width = W;
    base.height = H;
    paintBase(base.getContext("2d"));
    glints = makeGlints();

    petalRatio = Math.min(2, window.devicePixelRatio || 1);
    const resized = Math.abs(PW - cw) > 1 || Math.abs(PH - ch) > 1;
    PW = cw;
    PH = ch;
    petalCanvas.width = Math.round(cw * petalRatio);
    petalCanvas.height = Math.round(ch * petalRatio);
    // About one petal per 40,000 square pixels: a light flurry.
    const count = reduceMotion ? 0 : Math.round(Math.min(45, Math.max(12, (cw * ch) / 40000)));
    if (resized || petals.length !== count) {
      petals = Array.from({ length: count }, () => newPetal(true));
    }

    drawScene();
    drawPetals();
  }

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(build, 150);
  });
  build();
  if (reduceMotion) return;

  // The blurred scene only needs redrawing every other frame; the petals
  // move every frame.
  let last = null;
  let frame = 0;
  function tick(now) {
    const dt = last === null ? 0 : Math.min(0.05, (now - last) / 1000);
    last = now;
    time += dt;
    frame++;
    if (frame % 2 === 0) drawScene();
    stepPetals(dt);
    drawPetals();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
