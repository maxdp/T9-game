// Puzzle-solved celebration: the phone buzzes in three bursts (a quick
// back-and-forth rotation, like a phone vibrating on a table) to a
// synthesized buzz + chiptune fanfare, while little 2000s-nostalgia icons
// fly across the window. No image or audio files: the icons are inline
// SVG and the sound is generated with the Web Audio API.
(() => {
  // Start time (ms) of each buzz burst, and how long each lasts.
  const BURSTS = [0, 460, 920];
  const BURST_MS = 300;
  // Every flying icon is drawn at this one size (px).
  const ICON_SIZE = 72;

  // Each icon is a function of a per-copy id: copies fly at the same time
  // and are removed independently, so gradient ids must be unique per copy
  // (a shared url(#id) breaks as soon as the copy defining it is removed).
  const ICONS = [
    // egg-shaped virtual pet
    (u) => `<svg viewBox="0 0 64 64"><defs><radialGradient id="egg${u}" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#ffd3ec"/><stop offset="0.55" stop-color="#ff8fc7"/><stop offset="1" stop-color="#d4508f"/></radialGradient></defs>
      <circle cx="32" cy="6" r="3.5" fill="none" stroke="#b9bec4" stroke-width="2"/>
      <ellipse cx="32" cy="35" rx="22" ry="26" fill="url(#egg${u})" stroke="#b84a85" stroke-width="2"/>
      <circle cx="15" cy="27" r="1.6" fill="#fff" opacity=".8"/><circle cx="48" cy="44" r="1.4" fill="#fff" opacity=".8"/><circle cx="46" cy="19" r="1.2" fill="#fff" opacity=".8"/><circle cx="17" cy="47" r="1.1" fill="#fff" opacity=".8"/>
      <rect x="18" y="19" width="28" height="22" rx="5" fill="#8f3d6b"/>
      <rect x="21" y="22" width="22" height="16" rx="2" fill="#c8dfa9"/>
      <g fill="#3c4a2e"><rect x="28" y="25" width="8" height="2"/><rect x="26" y="27" width="12" height="7"/><rect x="27" y="34" width="2" height="2"/><rect x="35" y="34" width="2" height="2"/></g>
      <rect x="29" y="29" width="2" height="2" fill="#c8dfa9"/><rect x="33" y="29" width="2" height="2" fill="#c8dfa9"/>
      <g fill="#ffe06b" stroke="#c99a1e" stroke-width="1"><circle cx="24" cy="49" r="3.2"/><circle cx="32" cy="52" r="3.2"/><circle cx="40" cy="49" r="3.2"/></g>
      <g fill="#fff" opacity=".7"><circle cx="23" cy="48" r="1"/><circle cx="31" cy="51" r="1"/><circle cx="39" cy="48" r="1"/></g>
      <ellipse cx="21" cy="17" rx="6" ry="3" fill="#fff" opacity=".4" transform="rotate(-35 21 17)"/></svg>`,
    // floppy disk
    (u) => `<svg viewBox="0 0 64 64"><defs><linearGradient id="fd${u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4251ba"/><stop offset="1" stop-color="#222a75"/></linearGradient><linearGradient id="fs${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3f5f7"/><stop offset="1" stop-color="#a7afb8"/></linearGradient></defs>
      <path d="M6 5 h44 l9 9 v44 a2 2 0 0 1 -2 2 h-51 a2 2 0 0 1 -2 -2 v-51 a2 2 0 0 1 2 -2 z" fill="url(#fd${u})" stroke="#161d57" stroke-width="2"/>
      <rect x="17" y="5" width="28" height="19" rx="1" fill="url(#fs${u})" stroke="#7d848c" stroke-width="1"/>
      <rect x="35" y="8.5" width="6" height="12" rx="1" fill="#222a75"/>
      <rect x="11" y="31" width="41" height="25" rx="2" fill="#f7f5ee"/>
      <rect x="11" y="31" width="41" height="5" rx="2" fill="#ff8a8a"/>
      <g stroke="#c1c6cc" stroke-width="1.1"><line x1="15" y1="42" x2="48" y2="42"/><line x1="15" y1="47" x2="48" y2="47"/><line x1="15" y1="52" x2="48" y2="52"/></g>
      <path d="M17 45.5 q3 -4 6 0 t6 0 t6 0" fill="none" stroke="#3d4ab0" stroke-width="1.5" stroke-linecap="round"/>
      <rect x="53.5" y="51" width="3" height="4" fill="#161d57"/></svg>`,
    // click-wheel MP3 player
    (u) => `<svg viewBox="0 0 64 64"><defs><linearGradient id="ip${u}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#dfe2e6"/><stop offset=".2" stop-color="#ffffff"/><stop offset=".8" stop-color="#ffffff"/><stop offset="1" stop-color="#d3d7dc"/></linearGradient></defs>
      <rect x="15" y="3" width="34" height="58" rx="7" fill="url(#ip${u})" stroke="#a9afb6" stroke-width="1.5"/>
      <rect x="19" y="8" width="26" height="20" rx="2" fill="#1f2a36"/>
      <rect x="20.5" y="9.5" width="23" height="17" rx="1" fill="#c3dcf4"/>
      <rect x="20.5" y="13" width="23" height="3.5" fill="#4f8fd6"/>
      <g stroke="#6d8aa8" stroke-width="1"><line x1="22" y1="19.5" x2="38" y2="19.5"/><line x1="22" y1="23" x2="35" y2="23"/></g>
      <circle cx="32" cy="44" r="12.5" fill="#eceef0" stroke="#c9cdd2" stroke-width="1"/>
      <circle cx="32" cy="44" r="4.8" fill="#fbfbfb" stroke="#c9cdd2" stroke-width="1"/>
      <g fill="#8f979f"><rect x="29.5" y="33.6" width="5" height="1.6" rx=".6"/><path d="M40.5 42.5 l2.5 1.5 -2.5 1.5z M43 42.5 l2.5 1.5 -2.5 1.5z"/><path d="M23.5 42.5 l-2.5 1.5 2.5 1.5z M21 42.5 l-2.5 1.5 2.5 1.5z"/><path d="M29.8 52.3 l2.6 1.5 -2.6 1.5z"/><rect x="33.1" y="52.3" width="1" height="3"/><rect x="34.5" y="52.3" width="1" height="3"/></g></svg>`,
    // burned CD
    (u) => `<svg viewBox="0 0 64 64"><defs><linearGradient id="cd${u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f7fa"/><stop offset=".5" stop-color="#d2d9e0"/><stop offset="1" stop-color="#eef2f5"/></linearGradient></defs>
      <circle cx="32" cy="32" r="29" fill="url(#cd${u})" stroke="#9aa3ad" stroke-width="1.5"/>
      <g fill="none" stroke-width="7" opacity=".5"><circle cx="32" cy="32" r="21" stroke="#ff8ad1" stroke-dasharray="18 114"/><circle cx="32" cy="32" r="21" stroke="#ffe36e" stroke-dasharray="14 118" stroke-dashoffset="-18"/><circle cx="32" cy="32" r="21" stroke="#7fe0ff" stroke-dasharray="18 114" stroke-dashoffset="-32"/><circle cx="32" cy="32" r="21" stroke="#a6ff9e" stroke-dasharray="14 118" stroke-dashoffset="-50"/><circle cx="32" cy="32" r="21" stroke="#ff8ad1" stroke-dasharray="18 114" stroke-dashoffset="-66"/><circle cx="32" cy="32" r="21" stroke="#ffe36e" stroke-dasharray="14 118" stroke-dashoffset="-84"/><circle cx="32" cy="32" r="21" stroke="#7fe0ff" stroke-dasharray="18 114" stroke-dashoffset="-98"/><circle cx="32" cy="32" r="21" stroke="#a6ff9e" stroke-dasharray="14 118" stroke-dashoffset="-116"/></g>
      <circle cx="32" cy="32" r="11" fill="#f7f9fb" stroke="#b5bdc6" stroke-width="1"/>
      <circle cx="32" cy="32" r="7.5" fill="none" stroke="#cfd5db" stroke-width="1"/>
      <circle cx="32" cy="32" r="4" fill="#1b1b2f"/></svg>`,
    // :-) text bubble
    (u) => `<svg viewBox="0 0 64 64"><defs><linearGradient id="sb${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#dce4ff"/></linearGradient></defs>
      <path d="M8 10 h48 a5 5 0 0 1 5 5 v24 a5 5 0 0 1 -5 5 h-30 l-11 10 v-10 h-7 a5 5 0 0 1 -5 -5 v-24 a5 5 0 0 1 5 -5 z" fill="url(#sb${u})" stroke="#4f6df5" stroke-width="2.5" stroke-linejoin="round"/>
      <rect x="9" y="12" width="46" height="5" rx="2.5" fill="#fff" opacity=".7"/>
      <text x="32" y="34" text-anchor="middle" font-family="Courier New, monospace" font-weight="700" font-size="19" fill="#1b1b2f">:-)</text></svg>`,
    // green kick scooter
    (u) => `<svg viewBox="0 0 64 64"><defs><linearGradient id="dk${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eef1f4"/><stop offset="1" stop-color="#99a2ab"/></linearGradient></defs>
      <path d="M45 9 L50 45" stroke="#2f9a2f" stroke-width="4.5" stroke-linecap="round"/>
      <path d="M45 9 L50 45" stroke="#5fd65f" stroke-width="2" stroke-linecap="round"/>
      <path d="M50 45 L52 53" stroke="#9aa3ab" stroke-width="3" stroke-linecap="round"/>
      <path d="M37 8.5 h16" stroke="#2f9a2f" stroke-width="3.5" stroke-linecap="round"/>
      <rect x="35" y="6.3" width="6" height="4.4" rx="2" fill="#1f2328"/><rect x="49" y="6.3" width="6" height="4.4" rx="2" fill="#1f2328"/>
      <path d="M6 52 A8 8 0 0 1 20 46" stroke="#2f9a2f" stroke-width="3" fill="none" stroke-linecap="round"/>
      <rect x="11" y="44" width="40" height="5" rx="2.5" fill="url(#dk${u})" stroke="#6f777f" stroke-width="1"/>
      <rect x="15" y="44.6" width="30" height="2" rx="1" fill="#2b2f36"/>
      <circle cx="49.5" cy="44.5" r="3" fill="#2f9a2f" stroke="#1d6b1d" stroke-width="1"/>
      <g stroke="#2f9a2f" stroke-width="1.5"><circle cx="14" cy="54" r="7" fill="#8ff07f" fill-opacity=".85"/><circle cx="52" cy="54" r="7" fill="#8ff07f" fill-opacity=".85"/></g>
      <g fill="#dfe3e7" stroke="#7d848c" stroke-width="1"><circle cx="14" cy="54" r="2.6"/><circle cx="52" cy="54" r="2.6"/></g></svg>`,
    // purple cube console, corner facing the viewer
    (u) => `<svg viewBox="0 0 64 64"><defs><linearGradient id="gt${u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a28bf0"/><stop offset="1" stop-color="#7b5fd6"/></linearGradient></defs>
      <path d="M21 15 Q32 -5 43 15" stroke="#2f2168" stroke-width="4.5" fill="none" stroke-linecap="round"/>
      <polygon points="32,8 56,20 32,32 8,20" fill="url(#gt${u})"/>
      <polygon points="8,20 32,32 32,59 8,47" fill="#5b43b5"/>
      <polygon points="32,32 56,20 56,47 32,59" fill="#45338f"/>
      <ellipse cx="32" cy="20" rx="11" ry="5.5" fill="#6d55c9" stroke="#45338f" stroke-width="1.2"/>
      <ellipse cx="32" cy="20" rx="3.5" ry="1.75" fill="#45338f"/>
      <polyline points="8,20 32,32 56,20" fill="none" stroke="#c3b2ff" stroke-width="1"/>
      <line x1="32" y1="32" x2="32" y2="59" stroke="#2f2168" stroke-width="1"/>
      <g fill="#241855"><polygon points="11,42.5 15,44.5 15,47 11,45"/><polygon points="16.5,45.25 20.5,47.25 20.5,49.75 16.5,47.75"/><polygon points="22,48 26,50 26,52.5 22,50.5"/><polygon points="27.5,50.75 31.5,52.75 31.5,55.25 27.5,53.25"/></g>
      <ellipse cx="45" cy="39" rx="2.4" ry="2.8" fill="#241855" transform="rotate(-25 45 39)"/>
      <ellipse cx="45" cy="39" rx="1" ry="1.2" fill="#8f7be8" transform="rotate(-25 45 39)"/></svg>`,
    // wrapped chocolate roll: white twisted tips, red stripes, brown middle
    (u) => `<svg viewBox="0 0 64 64"><defs><linearGradient id="tb${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7d4627"/><stop offset=".45" stop-color="#5a2e16"/><stop offset="1" stop-color="#3a1b0a"/></linearGradient><linearGradient id="tw${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#dcd7cc"/></linearGradient></defs>
      <g transform="rotate(-20 32 32)">
      <path d="M13 32 L2 21 L6 26.5 L3 32 L6 37.5 L2 43 Z" fill="url(#tw${u})" stroke="#c4bdaf" stroke-width="1" stroke-linejoin="round"/>
      <path d="M51 32 L62 21 L58 26.5 L61 32 L58 37.5 L62 43 Z" fill="url(#tw${u})" stroke="#c4bdaf" stroke-width="1" stroke-linejoin="round"/>
      <g stroke="#c4bdaf" stroke-width=".8"><line x1="5" y1="26" x2="11" y2="31"/><line x1="5" y1="38" x2="11" y2="33"/><line x1="59" y1="26" x2="53" y2="31"/><line x1="59" y1="38" x2="53" y2="33"/></g>
      <rect x="11" y="24" width="42" height="16" rx="6" fill="url(#tw${u})" stroke="#c4bdaf" stroke-width="1"/>
      <rect x="21" y="24" width="22" height="16" fill="url(#tb${u})"/>
      <g fill="#d61f26"><rect x="15" y="24" width="2.4" height="16"/><rect x="18.6" y="24" width="2.4" height="16"/><rect x="43" y="24" width="2.4" height="16"/><rect x="46.6" y="24" width="2.4" height="16"/></g>
      <rect x="12" y="26" width="40" height="2.6" rx="1.3" fill="#fff" opacity=".3"/></g></svg>`,
    // jawbreaker: white, shaded like a ball, with messy paint splotches
    (u) => `<svg viewBox="0 0 64 64"><defs><radialGradient id="jw${u}" cx=".36" cy=".3" r=".78"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#f4f2ec"/><stop offset=".82" stop-color="#d8d3c8"/><stop offset="1" stop-color="#aaa396"/></radialGradient><radialGradient id="jd${u}" cx=".36" cy=".3" r=".78"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".32"/></radialGradient><clipPath id="jc${u}"><circle cx="32" cy="32" r="27"/></clipPath></defs>
      <circle cx="32" cy="32" r="27" fill="url(#jw${u})"/>
      <g clip-path="url(#jc${u})">
      <path d="M13 24 C14 17 22 15 25 19 C28 22 26 27 22 28 C19 29 20 33 16 32 C12 31 12 28 13 24 Z" fill="#e8433f"/><circle cx="27.5" cy="15" r="1.2" fill="#e8433f"/><circle cx="10.5" cy="29" r=".9" fill="#e8433f"/>
      <path d="M36 36 C39 32 47 33 48 38 C49 43 44 47 40 45 C37 44 34 46 33 42 C32 39 34 38 36 36 Z" fill="#2f86e8"/><circle cx="50.5" cy="44" r="1.1" fill="#2f86e8"/><circle cx="31" cy="47.5" r=".8" fill="#2f86e8"/>
      <path d="M34 12 C38 9 44 11 43 15 C42 19 37 18 35 20 C32 22 29 18 30 15 C31 13 32 13 34 12 Z" fill="#f5c71a"/><circle cx="46" cy="10.5" r=".9" fill="#f5c71a"/>
      <path d="M17 41 C20 38 26 40 26 44 C26 48 22 51 18 50 C15 49 13 46 14 44 C15 42 15 42 17 41 Z" fill="#3cbf5a"/><circle cx="28" cy="51" r="1" fill="#3cbf5a"/>
      <path d="M51 22 C54 21 57 25 56 29 C55 32 52 31 51 28 C50 26 49 23 51 22 Z" fill="#9b5de5"/>
      <circle cx="32" cy="32" r="27" fill="url(#jd${u})"/></g>
      <circle cx="32" cy="32" r="27" fill="none" stroke="#9e978a" stroke-width="1"/>
      <ellipse cx="22" cy="18" rx="7.5" ry="4" fill="#fff" opacity=".9" transform="rotate(-32 22 18)"/>
      <circle cx="31" cy="12.5" r="1.4" fill="#fff" opacity=".8"/></svg>`,
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

  let flyerCount = 0;

  function launchFlyers() {
    const layer = document.createElement("div");
    layer.className = "celebrate-layer";
    document.body.appendChild(layer);
    const count = 18;
    // Deal icons like a shuffled deck (each one twice) rather than picking
    // at random, so a single celebration always shows the full variety.
    const deck = [];
    while (deck.length < count) deck.push(...ICONS);
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    let finished = 0;
    const vw = window.innerWidth;
    for (let i = 0; i < count; i++) {
      const el = document.createElement("div");
      el.className = "celebrate-flyer";
      el.innerHTML = deck[i]("c" + ++flyerCount);
      const size = ICON_SIZE;
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
