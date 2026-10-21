// Page background: paintings of a river lined with cherry trees in bloom
// (by day, and at night with paper lanterns), with petals drifting across
// in front of them.
//
// The paintings themselves are CSS backgrounds (see .sakura-photo in the
// page): a wide one for wider screens and a tall one for phones, chosen by
// the screen's shape, slowly drifting so the scene feels alive. Dark mode
// fades the night painting in over the day one. This script runs the dark
// mode switch and animates the petals; requestAnimationFrame stops while
// the tab is hidden, and anyone who prefers reduced motion gets no
// drifting petals (and the paintings hold still).
(function () {
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const THEME_KEY = "t9tangle-theme";
  const root = document.documentElement;
  let night = root.dataset.theme === "dark";

  const wrap = document.createElement("div");
  wrap.className = "sakura-bg";
  wrap.setAttribute("aria-hidden", "true");
  const day = document.createElement("div");
  day.className = "sakura-photo sakura-day";
  const nightPhoto = document.createElement("div");
  nightPhoto.className = "sakura-photo sakura-night";
  const petalCanvas = document.createElement("canvas");
  petalCanvas.className = "sakura-petals";
  wrap.append(day, nightPhoto, petalCanvas);
  document.body.prepend(wrap);
  const pctx = petalCanvas.getContext("2d");

  const PETALS = {
    day: { colors: ["#f8c8d8", "#fbd9e5", "#f4b6cb"], alpha: 0.85 },
    night: { colors: ["#f2d6e4", "#fbe6ee", "#e6c4d8"], alpha: 0.7 },
  };

  // ---- Petals in the air ---------------------------------------------------

  let PW = 0;
  let PH = 0;
  let ratio = 1;
  let petals = [];
  let time = 0;

  function windAt(when) {
    return 0.6 + 0.25 * Math.sin(when * 0.23) + 0.15 * Math.sin(when * 0.71 + 1.3);
  }

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
    const look = night ? PETALS.night : PETALS.day;
    pctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    pctx.clearRect(0, 0, PW, PH);
    pctx.globalAlpha = look.alpha;
    petals.forEach((p) => {
      pctx.save();
      pctx.translate(p.x, p.y);
      pctx.rotate(p.rot);
      // Tumbling: the petal narrows as it turns edge-on.
      pctx.scale(1, 0.25 + 0.75 * Math.abs(Math.cos(p.flip)));
      pctx.fillStyle = look.colors[p.shade];
      pctx.beginPath();
      pctx.ellipse(0, 0, p.size, p.size * 0.62, 0, 0, Math.PI * 2);
      pctx.fill();
      pctx.restore();
    });
    pctx.globalAlpha = 1;
  }

  let sizeKey = "";
  function resize() {
    const box = wrap.getBoundingClientRect();
    const cw = Math.max(1, Math.round(box.width));
    const ch = Math.max(1, Math.round(box.height));
    if (`${cw}x${ch}` === sizeKey) return;
    sizeKey = `${cw}x${ch}`;
    ratio = Math.min(2, window.devicePixelRatio || 1);
    PW = cw;
    PH = ch;
    petalCanvas.width = Math.round(cw * ratio);
    petalCanvas.height = Math.round(ch * ratio);
    // About one petal per 40,000 square pixels: a light flurry.
    const count = reduceMotion ? 0 : Math.round(Math.min(45, Math.max(12, (cw * ch) / 40000)));
    petals = Array.from({ length: count }, () => newPetal(true));
    drawPetals();
  }

  // ---- Dark mode ------------------------------------------------------------
  // The switch under the phone. The choice is remembered in this browser
  // (the page's <head> applies it before anything draws); the CSS fades
  // between the paintings.
  const toggle = document.getElementById("dark-toggle");
  function setNight(on) {
    night = on;
    root.dataset.theme = night ? "dark" : "light";
    if (toggle) toggle.setAttribute("aria-checked", String(night));
    try {
      localStorage.setItem(THEME_KEY, night ? "dark" : "light");
    } catch (e) {
      // Not remembered; the next visit starts in light mode.
    }
    drawPetals();
  }
  if (toggle) {
    toggle.setAttribute("aria-checked", String(night));
    toggle.addEventListener("click", () => setNight(!night));
  }

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 200);
  });
  resize();
  if (reduceMotion) return;

  let last = null;
  function tick(now) {
    const dt = last === null ? 0 : Math.min(0.05, (now - last) / 1000);
    last = now;
    time += dt;
    stepPetals(dt);
    drawPetals();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
