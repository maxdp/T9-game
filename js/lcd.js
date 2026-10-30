// The phone's screen as a real low-resolution LCD.
//
// Everything on the screen is drawn onto one grid of LCD pixels: a canvas
// with one canvas pixel per LCD pixel, scaled up without smoothing. Each
// LCD pixel is a whole number of device pixels (so they're all exactly the
// same size, with crisp edges): about 1.4 CSS pixels, rounded to the
// nearest device pixel -- 4x4 device pixels on most phones.
//
// The screen's ordinary page content stays underneath, laid out as usual
// but invisible: it's still what gets tapped (tiles, arrows, the Stats
// scroll bar) and what screen readers read. Its text is set in the
// bitmap fonts' own font files (built by tools/lcd-font/build.py), so it
// wraps and lines up exactly as the bitmaps do. Whenever it changes, this
// redraws the screen from it: each box's background and borders, snapped
// to the grid, and each character's bitmap at its place, snapped the same
// way, so every pixel of every piece of text sits on the one grid. Emoji
// and the status icons are little pixel sprites.
(function () {
  const screen = document.querySelector(".phone-screen");
  const FONTS = window.T9_LCD_FONTS;
  if (!screen || !FONTS || !document.fonts) return;

  const canvas = document.createElement("canvas");
  canvas.className = "lcd-canvas";
  canvas.setAttribute("aria-hidden", "true");
  const ctx = canvas.getContext("2d");
  // A faint dark line between neighboring LCD pixels, like the gaps on a
  // real LCD of the time -- only where an LCD pixel is big enough (3+
  // device pixels) for a one-device-pixel gap to leave it looking solid.
  const gaps = document.createElement("canvas");
  gaps.className = "lcd-canvas lcd-gaps";
  gaps.setAttribute("aria-hidden", "true");
  const gctx = gaps.getContext("2d");
  if (!ctx || !gctx) return;

  // CSS pixels per LCD pixel: about TARGET, but a whole number of device
  // pixels.
  const TARGET = 1.4;
  let g = 1;
  let dpr = 1;
  let cellDevicePx = 1;
  function updateScale() {
    dpr = window.devicePixelRatio || 1;
    cellDevicePx = Math.max(1, Math.round(TARGET * dpr));
    g = cellDevicePx / dpr;
    screen.style.setProperty("--g", `${g}px`);
  }

  // Each font's glyphs as rows of "#" (lit) and "." (dark).
  const glyphs = {};
  Object.entries(FONTS).forEach(([name, font]) => {
    glyphs[name] = {};
    Object.entries(font.glyphs).forEach(([ch, rows]) => {
      glyphs[name][ch] = rows.split("/");
    });
  });

  // Pixel sprites for the emoji the game uses: each letter is a color.
  const DISC = ["..###..", ".#####.", "#######", "#######", "#######", ".#####.", "..###.."];
  const SPRITES = {
    "🟢": { rows: DISC, colors: { "#": "#4fd36b" } },
    "🟡": { rows: DISC, colors: { "#": "#ffd23f" } },
    "🔴": { rows: DISC, colors: { "#": "#ff5a5a" } },
    "🟣": { rows: DISC, colors: { "#": "#b77ae8" } },
    "😈": {
      rows: ["P.....P", "PP...PP", ".PPPPP.", "PkPPPkP", "PPPPPPP", "PPkkkPP", ".PPPPP."],
      colors: { P: "#b77ae8", k: "#2a1840" },
    },
    "🍀": {
      rows: [".GG.GG.", "GGGGGGG", "GGdGdGG", ".GGdGG.", "GGdGdGG", "GGGGGGG", ".GG.GG."],
      colors: { G: "#4fd36b", d: "#1f7a3a" },
    },
  };
  const ARROW = ["#...", "##..", "###.", "####", "###.", "##..", "#..."];
  // The status bar's icons, as fixed pixel art (boxes from the page's own
  // styles round onto the grid unevenly at small sizes).
  const STATUS_ICONS = {
    "phone-signal": {
      align: "left",
      rows: [
        ".........##",
        ".........##",
        "......##.##",
        "......##.##",
        "...##.##.##",
        "...##.##.##",
        "##.##.##.##",
        "##.##.##.##",
      ],
    },
    "phone-battery": {
      align: "right",
      rows: [
        "###########.",
        "#.........#.",
        "#.#######.##",
        "#.#######.##",
        "#.#######.##",
        "#.........#.",
        "###########.",
      ],
    },
  };

  // ---- Drawing helpers (all in LCD pixels) --------------------------------

  let originX = 0;
  let originY = 0;
  const cellX = (x) => Math.round((x - originX) / g);
  const cellY = (y) => Math.round((y - originY) / g);

  function parseColor(str) {
    const m = /rgba?\(([^)]+)\)/.exec(str || "");
    if (!m) return null;
    const parts = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  }
  function setFill(color, opacity) {
    ctx.fillStyle = `rgba(${color.r},${color.g},${color.b},${color.a * opacity})`;
  }

  // How far in from the side a rounded corner of radius r starts on row y
  // of a box spanning rows y0..y1.
  function cornerInset(y, y0, y1, r) {
    if (r <= 0) return 0;
    let d = 0;
    if (y < y0 + r) d = y0 + r - (y + 0.5);
    else if (y >= y1 - r) d = y + 0.5 - (y1 - r);
    else return 0;
    return Math.round(r - Math.sqrt(Math.max(0, r * r - d * d)));
  }

  function boxCells(rect) {
    return { x0: cellX(rect.left), x1: cellX(rect.right), y0: cellY(rect.top), y1: cellY(rect.bottom) };
  }

  // A box's background and borders, with rounded corners.
  function paintBox(cs, rect, opacity) {
    const { x0, x1, y0, y1 } = boxCells(rect);
    const w = x1 - x0;
    const h = y1 - y0;
    if (w <= 0 || h <= 0) return;
    const r = Math.min(Math.round(parseFloat(cs.borderTopLeftRadius) / g) || 0, Math.floor(Math.min(w, h) / 2));
    const side = (name) => {
      const width = parseFloat(cs[`border${name}Width`]) || 0;
      const color = parseColor(cs[`border${name}Color`]);
      if (width <= 0 || cs[`border${name}Style`] === "none" || !color || color.a === 0) return { n: 0, color: null };
      return { n: Math.max(1, Math.round(width / g)), color };
    };
    const top = side("Top");
    const right = side("Right");
    const bottom = side("Bottom");
    const left = side("Left");

    const bg = parseColor(cs.backgroundColor);
    if (bg && bg.a > 0) {
      setFill(bg, opacity);
      for (let y = y0; y < y1; y++) {
        const inset = cornerInset(y, y0, y1, r);
        ctx.fillRect(x0 + inset, y, w - 2 * inset, 1);
      }
    }
    if (!top.n && !right.n && !bottom.n && !left.n) return;
    const ix0 = x0 + left.n;
    const ix1 = x1 - right.n;
    const iy0 = y0 + top.n;
    const iy1 = y1 - bottom.n;
    const ir = Math.max(0, r - Math.max(top.n, left.n));
    for (let y = y0; y < y1; y++) {
      const inset = cornerInset(y, y0, y1, r);
      const a = x0 + inset;
      const b = x1 - inset;
      if (y < iy0 || y >= iy1) {
        const s = y < iy0 ? top : bottom;
        if (s.color) {
          setFill(s.color, opacity);
          ctx.fillRect(a, y, b - a, 1);
        }
        continue;
      }
      const innerInset = cornerInset(y, iy0, iy1, ir);
      const c = ix0 + innerInset;
      const d = ix1 - innerInset;
      if (left.color && c > a) {
        setFill(left.color, opacity);
        ctx.fillRect(a, y, c - a, 1);
      }
      if (right.color && b > d) {
        setFill(right.color, opacity);
        ctx.fillRect(d, y, b - d, 1);
      }
    }
  }

  function paintBitmap(rows, x, y, scale, colorFor) {
    rows.forEach((row, ry) => {
      for (let rx = 0; rx < row.length; rx++) {
        const fill = colorFor(row[rx]);
        if (!fill) continue;
        ctx.fillStyle = fill;
        ctx.fillRect(x + rx * scale, y + ry * scale, scale, scale);
      }
    });
  }

  const range = document.createRange();

  // An element's own text, each character's bitmap where the (invisible)
  // laid-out text has it.
  function paintText(el, cs, opacity) {
    const family = cs.fontFamily.includes("T9 LCD Tiny") ? "T9 LCD Tiny" : "T9 LCD";
    const font = FONTS[family];
    const set = glyphs[family];
    const em = font.ascent + font.descent;
    const scale = Math.max(1, Math.round(parseFloat(cs.fontSize) / (em * g)));
    const color = parseColor(cs.color);
    if (!color) return;
    const ink = `rgba(${color.r},${color.g},${color.b},${color.a * opacity})`;
    const upper = cs.textTransform === "uppercase";
    el.childNodes.forEach((node) => {
      if (node.nodeType !== 3) return;
      const text = node.data;
      for (let i = 0; i < text.length; ) {
        const cp = text.codePointAt(i);
        const len = cp > 0xffff ? 2 : 1;
        let ch = String.fromCodePoint(cp);
        if (upper) ch = ch.toUpperCase();
        const sprite = SPRITES[ch];
        const rows = set[ch];
        if ((sprite || rows) && !/\s/.test(ch)) {
          range.setStart(node, i);
          range.setEnd(node, i + len);
          const rect = range.getClientRects()[0];
          if (rect) {
            if (rows) {
              paintBitmap(rows, cellX(rect.left), cellY(rect.top), scale, (c) => (c === "#" ? ink : null));
            } else {
              // Emoji: centered where the emoji was laid out.
              const w = sprite.rows[0].length * scale;
              const h = sprite.rows.length * scale;
              const x = Math.round(((rect.left + rect.right) / 2 - originX) / g - w / 2);
              const y = Math.round(((rect.top + rect.bottom) / 2 - originY) / g - h / 2);
              ctx.globalAlpha = opacity;
              paintBitmap(sprite.rows, x, y, scale, (c) => sprite.colors[c] || null);
              ctx.globalAlpha = 1;
            }
          }
        }
        i += len;
      }
    });
  }

  // Bits drawn by CSS pseudo-elements, which aren't in the page to read.
  // A status icon, against its side of the status bar and centered on it.
  function paintStatusIcon(icon, cs, rect, opacity) {
    const color = parseColor(cs.color) || { r: 244, g: 248, b: 255, a: 1 };
    const w = icon.rows[0].length;
    const x = icon.align === "left" ? cellX(rect.left) : cellX(rect.right) - w;
    const y = Math.round(((rect.top + rect.bottom) / 2 - originY) / g - icon.rows.length / 2);
    const ink = `rgba(${color.r},${color.g},${color.b},${color.a * opacity})`;
    paintBitmap(icon.rows, x, y, 1, (c) => (c === "#" ? ink : null));
  }

  function paintExtras(el, cs, rect, opacity) {
    if (el.classList.contains("tutorial-arrow")) {
      const rows = el.classList.contains("prev") ? ARROW.map((r) => [...r].reverse().join("")) : ARROW;
      const x = Math.round(((rect.left + rect.right) / 2 - originX) / g - 2);
      const y = Math.round(((rect.top + rect.bottom) / 2 - originY) / g - 3.5);
      const alpha = el.disabled ? 0.3 : 1;
      paintBitmap(rows, x, y, 1, (c) => (c === "#" ? `rgba(244,248,255,${alpha * opacity})` : null));
    }
  }

  function walk(parent, parentOpacity) {
    for (const el of parent.children) {
      if (el === canvas || el === gaps) continue;
      const cs = getComputedStyle(el);
      if (cs.display === "none") continue;
      // The screen's own children are invisible (the canvas shows them).
      const opacity = parentOpacity * (parent === screen ? 1 : parseFloat(cs.opacity));
      if (opacity <= 0.01) continue;
      const rect = el.getBoundingClientRect();
      const visible = cs.visibility === "visible";
      const icon = Object.keys(STATUS_ICONS).find((name) => el.classList.contains(name));
      if (icon) {
        if (visible) paintStatusIcon(STATUS_ICONS[icon], cs, rect, opacity);
        continue;
      }
      if (visible) {
        paintBox(cs, rect, opacity);
        paintExtras(el, cs, rect, opacity);
      }
      const clips = cs.overflowX !== "visible" || cs.overflowY !== "visible";
      if (clips) {
        const { x0, x1, y0, y1 } = boxCells(rect);
        ctx.save();
        ctx.beginPath();
        ctx.rect(x0, y0, x1 - x0, y1 - y0);
        ctx.clip();
      }
      if (visible) paintText(el, cs, opacity);
      walk(el, opacity);
      if (clips) ctx.restore();
    }
  }

  // The screen's backlit background, as in the CSS: a radial gradient from
  // the top left, darker toward the edges.
  function paintBackdrop(cols, rows) {
    const cx = cols * 0.3;
    const radius = Math.hypot(cols * 0.7, rows);
    const grad = ctx.createRadialGradient(cx, 0, 0, cx, 0, radius);
    grad.addColorStop(0, "#3f74bd");
    grad.addColorStop(0.45, "#1e4178");
    grad.addColorStop(1, "#0d2143");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cols, rows);
    [0.3, 0.16, 0.07].forEach((alpha, i) => {
      ctx.fillStyle = `rgba(0,0,0,${alpha})`;
      ctx.fillRect(i, i, cols - 2 * i, 1);
      ctx.fillRect(i, rows - 1 - i, cols - 2 * i, 1);
      ctx.fillRect(i, i + 1, 1, rows - 2 * i - 2);
      ctx.fillRect(cols - 1 - i, i + 1, 1, rows - 2 * i - 2);
    });
  }

  function paintGaps(cols, rows) {
    const show = cellDevicePx >= 3;
    gaps.hidden = !show;
    if (!show) return;
    const w = cols * cellDevicePx;
    const h = rows * cellDevicePx;
    if (gaps.width === w && gaps.height === h) return;
    gaps.width = w;
    gaps.height = h;
    gctx.clearRect(0, 0, w, h);
    gctx.fillStyle = "rgba(0, 0, 0, 0.16)";
    for (let x = 0; x < cols; x++) gctx.fillRect(x * cellDevicePx, 0, 1, h);
    for (let y = 0; y < rows; y++) gctx.fillRect(0, y * cellDevicePx, w, 1);
  }

  function draw() {
    const box = screen.getBoundingClientRect();
    // The grid starts on a device pixel, so every LCD pixel covers whole
    // device pixels even when the phone sits at a fractional position.
    originX = Math.round(box.left * dpr) / dpr;
    originY = Math.round(box.top * dpr) / dpr;
    const cols = Math.max(1, Math.ceil(box.width / g));
    const rows = Math.max(1, Math.ceil(box.height / g));
    if (canvas.width !== cols || canvas.height !== rows) {
      canvas.width = cols;
      canvas.height = rows;
    }
    paintGaps(cols, rows);
    [canvas, gaps].forEach((c) => {
      c.style.width = `${cols * g}px`;
      c.style.height = `${rows * g}px`;
      c.style.transform = `translate(${originX - box.left}px, ${originY - box.top}px)`;
    });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cols, rows);
    paintBackdrop(cols, rows);
    walk(screen, 1);
  }

  let pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      draw();
    });
  }

  function start() {
    updateScale();
    screen.prepend(canvas, gaps);
    screen.classList.add("lcd");
    draw();
    // Redraw whenever anything on the screen changes (but not for the
    // canvas's own size changes).
    new MutationObserver((records) => {
      if (records.some((r) => r.target !== canvas && r.target !== gaps)) schedule();
    }).observe(screen, { subtree: true, childList: true, characterData: true, attributes: true });
    screen.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", () => {
      updateScale();
      schedule();
    });
    // Moving the window to a screen with a different pixel density.
    const watchDensity = () => {
      const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      mq.addEventListener("change", () => {
        updateScale();
        schedule();
        watchDensity();
      }, { once: true });
    };
    if (window.matchMedia) watchDensity();
  }

  Promise.all([document.fonts.load('10px "T9 LCD"'), document.fonts.load('10px "T9 LCD Tiny"')])
    .then((faces) => {
      // Without the fonts, the screen just keeps its ordinary look.
      if (faces.every((f) => f.length)) start();
    })
    .catch(() => {});
})();
