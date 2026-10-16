// Puzzle-solved celebration: the phone buzzes in three bursts (a quick
// back-and-forth rotation, like a phone vibrating on a table) to a
// synthesized buzz + chiptune fanfare, while little 2000s-nostalgia icons
// fly across the window. No image or audio files: the icons are inline
// SVG and the sound is generated with the Web Audio API.
(() => {
  // Start time (ms) of each buzz burst, and how long each lasts.
  const BURSTS = [0, 460, 920];
  const BURST_MS = 300;

  // Icons avoid gradient ids on purpose: many copies are on screen at once
  // and get removed independently, which would break shared url(#id) fills.
  const ICONS = [
    // flip phone
    '<svg viewBox="0 0 64 64"><rect x="20" y="3" width="24" height="27" rx="5" fill="#dfe3e7" stroke="#6f777f" stroke-width="2"/><rect x="24" y="8" width="16" height="16" rx="2" fill="#3f74bd"/><rect x="18" y="31" width="28" height="30" rx="6" fill="#dfe3e7" stroke="#6f777f" stroke-width="2"/><g fill="#6f777f"><circle cx="25" cy="39" r="2"/><circle cx="32" cy="39" r="2"/><circle cx="39" cy="39" r="2"/><circle cx="25" cy="46" r="2"/><circle cx="32" cy="46" r="2"/><circle cx="39" cy="46" r="2"/><circle cx="25" cy="53" r="2"/><circle cx="32" cy="53" r="2"/><circle cx="39" cy="53" r="2"/></g></svg>',
    // MP3 player with a click wheel
    '<svg viewBox="0 0 64 64"><rect x="16" y="4" width="32" height="56" rx="6" fill="#f7f7f7" stroke="#b9bec4" stroke-width="2"/><rect x="21" y="9" width="22" height="18" rx="2" fill="#9fc3e8"/><circle cx="32" cy="44" r="11" fill="#d9dce0"/><circle cx="32" cy="44" r="4.5" fill="#f7f7f7"/></svg>',
    // burned CD
    '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="28" fill="#e6ebf0" stroke="#a8b0ba" stroke-width="2"/><circle cx="32" cy="32" r="19" fill="none" stroke="#ff9ad5" stroke-width="7" stroke-dasharray="22 98" opacity="0.75"/><circle cx="32" cy="32" r="19" fill="none" stroke="#7fdcff" stroke-width="7" stroke-dasharray="22 98" stroke-dashoffset="-60" opacity="0.75"/><circle cx="32" cy="32" r="9" fill="#f4f6f8" stroke="#a8b0ba" stroke-width="1.5"/><circle cx="32" cy="32" r="4" fill="#1b1b2f"/></svg>',
    // floppy disk
    '<svg viewBox="0 0 64 64"><path d="M8 6 h42 l6 6 v46 h-48 z" fill="#2f3a8f" stroke="#1b2266" stroke-width="2"/><rect x="18" y="6" width="26" height="17" fill="#c9ced4"/><rect x="34" y="9" width="6" height="11" fill="#2f3a8f"/><rect x="14" y="32" width="36" height="22" rx="2" fill="#f4f4f0"/><g stroke="#9aa1a8" stroke-width="1.5"><line x1="18" y1="39" x2="46" y2="39"/><line x1="18" y1="45" x2="46" y2="45"/></g></svg>',
    // egg-shaped virtual pet
    '<svg viewBox="0 0 64 64"><ellipse cx="32" cy="35" rx="22" ry="26" fill="#ff8fc7" stroke="#c4568f" stroke-width="2"/><circle cx="32" cy="6" r="3.5" fill="none" stroke="#c4568f" stroke-width="2"/><rect x="19" y="20" width="26" height="20" rx="4" fill="#cfe8c4" stroke="#8aa47d" stroke-width="1.5"/><circle cx="31" cy="31" r="4" fill="#33402d"/><circle cx="29.5" cy="29.5" r="1" fill="#cfe8c4"/><circle cx="24" cy="49" r="3" fill="#ffe06b"/><circle cx="32" cy="52" r="3" fill="#ffe06b"/><circle cx="40" cy="49" r="3" fill="#ffe06b"/></svg>',
    // handheld game console
    '<svg viewBox="0 0 64 64"><rect x="2" y="16" width="60" height="32" rx="12" fill="#7d5bd1" stroke="#4e3591" stroke-width="2"/><rect x="20" y="21" width="24" height="18" rx="2" fill="#2b2f3a"/><rect x="22" y="23" width="20" height="14" fill="#9fd8a3"/><path d="M9 30 h4 v-4 h4 v4 h4 v4 h-4 v4 h-4 v-4 h-4 z" fill="#2b2f3a"/><circle cx="51" cy="29" r="3" fill="#2b2f3a"/><circle cx="56" cy="35" r="3" fill="#2b2f3a"/></svg>',
    // CRT monitor with a green-hills wallpaper
    '<svg viewBox="0 0 64 64"><rect x="6" y="6" width="52" height="40" rx="5" fill="#e3dccb" stroke="#a69e8b" stroke-width="2"/><rect x="12" y="11" width="40" height="29" rx="3" fill="#3b86d6"/><path d="M12 40 v-8 q12 -9 22 -2 q9 -6 18 -1 v11 z" fill="#5fc24f"/><circle cx="44" cy="18" r="3" fill="#ffe27a"/><rect x="24" y="46" width="16" height="6" fill="#cfc7b4"/><rect x="16" y="52" width="32" height="6" rx="2" fill="#e3dccb" stroke="#a69e8b" stroke-width="2"/></svg>',
    // compact digital camera
    '<svg viewBox="0 0 64 64"><rect x="6" y="16" width="52" height="34" rx="6" fill="#cfd4da" stroke="#7d848c" stroke-width="2"/><rect x="12" y="12" width="12" height="6" rx="2" fill="#7d848c"/><circle cx="34" cy="33" r="12" fill="#3a3f46" stroke="#9aa1a8" stroke-width="3"/><circle cx="34" cy="33" r="5" fill="#6f8fb8"/><rect x="47" y="21" width="7" height="5" rx="1" fill="#fff6c2"/></svg>',
    // multicolored butterfly
    '<svg viewBox="0 0 64 64"><ellipse cx="20" cy="22" rx="14" ry="12" fill="#ff8a3d" transform="rotate(-25 20 22)"/><ellipse cx="44" cy="22" rx="14" ry="12" fill="#3dbbff" transform="rotate(25 44 22)"/><ellipse cx="22" cy="42" rx="10" ry="9" fill="#7be36b" transform="rotate(20 22 42)"/><ellipse cx="42" cy="42" rx="10" ry="9" fill="#ffd23d" transform="rotate(-20 42 42)"/><rect x="30" y="16" width="4" height="34" rx="2" fill="#3a3f46"/></svg>',
    // SMS bubbles
    ...['LOL', 'BRB', ':-)'].map(
      (txt) =>
        '<svg viewBox="0 0 64 48"><path d="M6 4 h52 a4 4 0 0 1 4 4 v24 a4 4 0 0 1 -4 4 h-34 l-10 9 v-9 h-8 a4 4 0 0 1 -4 -4 v-24 a4 4 0 0 1 4 -4 z" fill="#ffffff" stroke="#4f6df5" stroke-width="2.5"/><text x="32" y="26" text-anchor="middle" font-family="Courier New, monospace" font-weight="700" font-size="17" fill="#1b1b2f">' +
        txt +
        "</text></svg>"
    ),
  ];

  function buzzPhone(phone) {
    const total = BURSTS[BURSTS.length - 1] + BURST_MS;
    const steps = 10;
    const frames = [];
    for (const start of BURSTS) {
      for (let i = 0; i <= steps; i++) {
        const side = i === 0 || i === steps ? 0 : i % 2 ? 1 : -1;
        frames.push({
          transform: `translateX(${side * 1.5}px) rotate(${side * 2.4}deg)`,
          offset: (start + (BURST_MS * i) / steps) / total,
        });
      }
    }
    phone.animate(frames, { duration: total, easing: "linear" });
  }

  function launchFlyers() {
    const layer = document.createElement("div");
    layer.className = "celebrate-layer";
    document.body.appendChild(layer);
    const count = 18;
    let finished = 0;
    const vw = window.innerWidth;
    for (let i = 0; i < count; i++) {
      const el = document.createElement("div");
      el.className = "celebrate-flyer";
      el.innerHTML = ICONS[Math.floor(Math.random() * ICONS.length)];
      const size = 34 + Math.random() * 26;
      el.style.width = el.style.height = size + "px";
      el.style.top = 4 + Math.random() * 84 + "vh";
      const leftToRight = i % 2 === 0;
      const from = leftToRight ? -size - 20 : vw + 20;
      const to = leftToRight ? vw + 20 : -size - 20;
      const spin = (Math.random() < 0.5 ? -1 : 1) * (180 + Math.random() * 360);
      const bob = 15 + Math.random() * 30;
      const frames = [0, 0.25, 0.5, 0.75, 1].map((p) => ({
        transform: `translate(${from + (to - from) * p}px, ${Math.sin(p * Math.PI * 2) * bob}px) rotate(${spin * p}deg)`,
      }));
      layer.appendChild(el);
      const anim = el.animate(frames, {
        duration: 1800 + Math.random() * 1200,
        delay: i * 110 + Math.random() * 120,
        easing: "linear",
        fill: "both", // sit off-screen during the delay instead of at left:0
      });
      anim.onfinish = () => {
        el.remove();
        if (++finished === count) layer.remove();
      };
    }
  }

  // Schedules the whole sound on `ctx` starting at time `t0` (seconds), so
  // it can be played live or rendered offline for checking.
  function scheduleSound(ctx, t0) {
    const master = ctx.createGain();
    master.gain.value = 0.18;
    master.connect(ctx.destination);

    // Vibration buzz, one per burst: a low sawtooth, muffled, with its
    // volume rattled by a fast square-wave LFO.
    for (const ms of BURSTS) {
      const s = t0 + ms / 1000;
      const e = s + BURST_MS / 1000;
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = 140;
      const lowpass = ctx.createBiquadFilter();
      lowpass.type = "lowpass";
      lowpass.frequency.value = 700;
      const rattle = ctx.createGain();
      rattle.gain.value = 0.65;
      const lfo = ctx.createOscillator();
      lfo.type = "square";
      lfo.frequency.value = 32;
      const lfoDepth = ctx.createGain();
      lfoDepth.gain.value = 0.35;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, s);
      env.gain.linearRampToValueAtTime(0.9, s + 0.02);
      env.gain.setValueAtTime(0.9, e - 0.03);
      env.gain.linearRampToValueAtTime(0, e);
      lfo.connect(lfoDepth);
      lfoDepth.connect(rattle.gain);
      osc.connect(lowpass);
      lowpass.connect(rattle);
      rattle.connect(env);
      env.connect(master);
      osc.start(s);
      osc.stop(e + 0.05);
      lfo.start(s);
      lfo.stop(e + 0.05);
    }

    // Chiptune fanfare after the last buzz: a rising arpeggio and a
    // held top note, in square waves.
    const notes = [
      [523.25, 0.09],
      [659.25, 0.09],
      [783.99, 0.09],
      [1046.5, 0.16],
      [783.99, 0.09],
      [1046.5, 0.38],
    ];
    let t = t0 + (BURSTS[BURSTS.length - 1] + BURST_MS) / 1000 + 0.12;
    for (const [freq, dur] of notes) {
      const osc = ctx.createOscillator();
      osc.type = "square";
      osc.frequency.value = freq;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.45, t + 0.01);
      env.gain.setValueAtTime(0.45, t + dur * 0.7);
      env.gain.linearRampToValueAtTime(0, t + dur);
      osc.connect(env);
      env.connect(master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
      t += dur;
    }
  }

  let audioCtx = null;
  // Called from the Send key's click, so creating/resuming the audio
  // context here satisfies browsers' "needs a user gesture" rule.
  function playSound() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!audioCtx) audioCtx = new AC();
    if (audioCtx.state === "suspended") audioCtx.resume();
    scheduleSound(audioCtx, audioCtx.currentTime + 0.02);
  }

  function celebrate(phone) {
    playSound();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    buzzPhone(phone);
    launchFlyers();
  }

  window.T9Celebrate = { celebrate, scheduleSound };
})();
