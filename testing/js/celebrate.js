// Puzzle-solved celebration: the phone buzzes in three bursts (a quick
// back-and-forth rotation, like a phone vibrating on a table) to a
// synthesized buzz + chiptune fanfare, while little 2000s-nostalgia icons
// burst in from both sides like confetti from party poppers, slow sharply
// and come to rest on and around the phone. They stay (draggable, in case
// one covers something) until the game clears them. Also the short chime
// for each correct answer. No image or audio files: the icons are inline
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
    // jawbreaker: white, shaded like a ball, with rainbow paint splotches
    // placed on the sphere and projected flat (so the ones near the rim
    // squash, which sells the 3D shape).
    (u) => `<svg viewBox="0 0 64 64"><defs><radialGradient id="jw${u}" cx=".36" cy=".3" r=".78"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#f6f4ef"/><stop offset=".82" stop-color="#dcd7cd"/><stop offset="1" stop-color="#aaa396"/></radialGradient><radialGradient id="jd${u}" cx=".36" cy=".3" r=".78"><stop offset=".45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".38"/></radialGradient><clipPath id="jc${u}"><circle cx="32" cy="32" r="27"/></clipPath></defs><circle cx="32" cy="32" r="27" fill="url(#jw${u})"/><g clip-path="url(#jc${u})"><path d="M12.5 46.8 C13.1 47.9 14.2 49.3 15.1 49.9 C16 50.5 16.9 50.4 17.9 50.5 C18.9 50.5 20.4 50.9 21.2 50.4 C21.9 49.9 22.6 48.3 22.2 47.2 C21.7 46.2 19.6 45 18.5 44.2 C17.4 43.4 16.8 43.4 15.7 42.6 C14.7 41.9 12.9 39.7 12.2 39.8 C11.4 39.9 11.2 42 11.2 43.2 C11.3 44.3 11.8 45.7 12.5 46.8Z" fill="#e8433f"/><path d="M9.6 40.2 C9.7 40.4 10 41 10.1 41 C10.2 41.1 10.4 40.8 10.4 40.6 C10.5 40.4 10.6 40 10.5 39.8 C10.4 39.6 10.1 39.4 9.9 39.3 C9.8 39.3 9.6 39.3 9.6 39.5 C9.5 39.6 9.5 39.9 9.6 40.2Z" fill="#e8433f"/><path d="M12.2 39.3 C12.4 39.3 12.8 39.3 12.9 39 C12.9 38.8 12.7 38.1 12.5 37.8 C12.3 37.5 11.9 37.3 11.7 37.3 C11.5 37.3 11.2 37.6 11.1 37.9 C11.1 38.3 11.2 39 11.4 39.2 C11.5 39.5 11.9 39.4 12.2 39.3Z" fill="#e8433f"/><path d="M38.6 10.8 C37.4 10.5 36.3 10.1 35.7 10.4 C35.1 10.6 35.2 11.5 35 12 C34.8 12.5 34.7 12.7 34.6 13.4 C34.5 14.1 33.8 15.8 34.3 16.3 C34.8 16.8 36.8 16.4 37.8 16.3 C38.9 16.3 39.8 16.4 40.5 16 C41.2 15.7 41.6 15 41.9 14.4 C42.2 13.7 43 12.5 42.4 11.9 C41.8 11.3 39.7 11 38.6 10.8Z" fill="#ff8c1a"/><path d="M35.4 19.5 C35.3 19.6 35.2 19.7 35.2 19.9 C35.2 20.1 35.3 20.5 35.5 20.5 C35.7 20.6 36 20.4 36.2 20.3 C36.3 20.2 36.4 19.9 36.3 19.8 C36.3 19.6 36.1 19.3 36 19.2 C35.8 19.2 35.5 19.3 35.4 19.5Z" fill="#ff8c1a"/><path d="M44.5 12.8 C44.5 12.6 44.3 12.2 44.1 12.1 C43.9 11.9 43.4 11.8 43.2 11.8 C42.9 11.8 42.6 11.9 42.6 12.1 C42.7 12.3 43.1 12.5 43.3 12.7 C43.6 12.9 43.9 13.1 44.1 13.1 C44.3 13.1 44.5 12.9 44.5 12.8Z" fill="#ff8c1a"/><path d="M31.8 20.3 C32.8 21.5 35.5 23 37.2 23.1 C38.9 23.2 40.5 21.6 41.9 20.9 C43.3 20.3 45.7 20.1 45.7 19 C45.7 18 42.7 16.1 41.9 14.8 C41.1 13.6 41.8 12.3 40.9 11.7 C40.1 11.1 38.3 11.3 36.7 11.3 C35.2 11.3 32.8 11 31.9 11.7 C31 12.4 31.5 14 31.4 15.4 C31.4 16.8 30.9 19 31.8 20.3Z" fill="#f5c71a"/><path d="M50.1 19.5 C50.3 19.4 50.4 19 50.3 18.7 C50.2 18.3 49.8 17.8 49.5 17.6 C49.2 17.4 48.8 17.5 48.6 17.6 C48.5 17.8 48.5 18.2 48.6 18.5 C48.8 18.8 49.1 19.2 49.3 19.3 C49.6 19.5 50 19.6 50.1 19.5Z" fill="#f5c71a"/><path d="M47 16.4 C47.2 16.2 46.9 15.7 46.7 15.3 C46.5 14.9 46.2 14.3 45.8 14.1 C45.5 14 44.8 14 44.6 14.2 C44.3 14.4 44.2 14.9 44.4 15.3 C44.6 15.7 45.3 16.5 45.7 16.6 C46.1 16.8 46.8 16.7 47 16.4Z" fill="#f5c71a"/><path d="M15.6 15.6 C16.3 15.9 18.7 14.1 20.1 14.3 C21.5 14.5 22.8 17.1 23.9 16.8 C25.1 16.5 26.3 13.9 27.2 12.7 C28.1 11.6 29.3 10.6 29.2 9.9 C29 9.2 27.1 8.9 26.2 8.6 C25.3 8.3 24.9 7.7 24 7.9 C23 8 21.8 8.8 20.4 9.5 C19.1 10.3 16.7 11.4 15.9 12.4 C15.1 13.4 14.9 15.3 15.6 15.6Z" fill="#3cbf5a"/><path d="M18.2 21.3 C18.4 20.9 18.3 20.3 18.1 20.1 C17.9 19.9 17.3 19.7 17 19.9 C16.6 20.1 16.2 20.8 16.2 21.1 C16.1 21.5 16.2 21.9 16.4 22.1 C16.6 22.2 17.1 22.4 17.4 22.3 C17.7 22.2 18.1 21.6 18.2 21.3Z" fill="#3cbf5a"/><path d="M24.5 19.6 C24.6 19.8 24.8 20.1 25.1 20.1 C25.3 20.1 25.6 19.9 25.8 19.8 C25.9 19.6 26.1 19.3 26 19.1 C26 18.9 25.8 18.7 25.6 18.6 C25.4 18.6 24.9 18.7 24.8 18.9 C24.6 19 24.5 19.4 24.5 19.6Z" fill="#3cbf5a"/><path d="M17.9 44.1 C16.8 42.9 16.4 41.4 15.4 40.7 C14.4 40 13 39.6 12 39.7 C11 39.7 9.7 40 9.5 41 C9.4 42 10.6 44.4 11.3 45.8 C12 47.1 12.7 48.1 13.9 49.2 C15.1 50.3 17 52.1 18.2 52.5 C19.5 52.8 20.6 52.1 21.3 51.2 C22 50.4 23 48.8 22.4 47.6 C21.8 46.4 19.1 45.2 17.9 44.1Z" fill="#2f86e8"/><path d="M22.7 54.3 C22.9 54.5 23.4 54.7 23.7 54.8 C24 54.8 24.5 54.7 24.5 54.6 C24.5 54.4 24.1 54.1 23.8 53.9 C23.5 53.7 23.2 53.6 22.9 53.5 C22.6 53.5 22.1 53.5 22 53.6 C22 53.8 22.4 54.1 22.7 54.3Z" fill="#2f86e8"/><path d="M22.1 54.7 C22 54.8 22.4 55.1 22.7 55.3 C22.9 55.5 23.3 55.7 23.6 55.7 C23.9 55.8 24.3 55.8 24.4 55.7 C24.5 55.6 24.5 55.3 24.3 55.1 C24.1 55 23.5 54.8 23.1 54.7 C22.8 54.6 22.2 54.6 22.1 54.7Z" fill="#2f86e8"/><path d="M54.3 30.4 C54.6 31.9 54 34.2 54.4 35 C54.7 35.8 55.9 35.1 56.5 35.1 C57.1 35 57.7 35.6 58.1 34.8 C58.4 34 58.6 31.6 58.5 30.2 C58.4 28.8 57.9 27.4 57.5 26.5 C57.1 25.5 56.7 25 56.1 24.5 C55.6 24.1 54.8 23.5 54.2 23.8 C53.6 24.1 52.6 25.2 52.6 26.3 C52.6 27.4 54 29 54.3 30.4Z" fill="#9b5de5"/><path d="M53.3 37.8 C53.3 37.9 53.5 37.9 53.7 37.8 C53.8 37.7 53.9 37.3 54 37.1 C54 36.9 53.8 36.7 53.7 36.7 C53.6 36.6 53.4 36.7 53.3 36.8 C53.2 36.9 53.2 37.2 53.2 37.3 C53.1 37.5 53.2 37.7 53.3 37.8Z" fill="#9b5de5"/><path d="M55.2 38.2 C55 38.4 54.8 38.8 54.7 39.2 C54.6 39.5 54.4 40.1 54.5 40.4 C54.5 40.6 54.8 40.8 55.1 40.6 C55.3 40.5 55.6 39.8 55.7 39.4 C55.9 39 55.9 38.3 55.8 38.1 C55.7 37.9 55.3 38.1 55.2 38.2Z" fill="#9b5de5"/><path d="M45.2 43.1 C45.2 44.3 44.5 45.7 44.9 46.5 C45.2 47.2 46.4 47.8 47.4 47.7 C48.4 47.6 49.7 46.6 50.6 45.8 C51.5 44.9 52.6 43.6 53 42.5 C53.4 41.4 53.4 39.9 53.1 39 C52.8 38 52.1 37 51.3 36.9 C50.6 36.8 49.8 38 48.7 38.4 C47.7 38.7 45.7 38.4 45.1 39.2 C44.6 40 45.3 41.8 45.2 43.1Z" fill="#ff4fa3"/><path d="M53.5 35.1 C53.4 35.4 53.4 35.9 53.5 36.1 C53.7 36.4 53.9 36.6 54.1 36.6 C54.3 36.5 54.7 35.9 54.7 35.6 C54.8 35.3 54.6 34.9 54.5 34.7 C54.3 34.5 54.2 34.5 54 34.5 C53.8 34.6 53.5 34.8 53.5 35.1Z" fill="#ff4fa3"/><path d="M43 43.3 C43.2 43.1 43.2 42.7 43.1 42.4 C43 42.2 42.8 41.9 42.6 41.9 C42.4 41.9 42 42.2 41.9 42.4 C41.7 42.7 41.6 42.9 41.7 43.2 C41.7 43.4 41.9 43.7 42.2 43.7 C42.4 43.7 42.9 43.5 43 43.3Z" fill="#ff4fa3"/><path d="M50.4 13.2 C49.7 12.3 46.9 10.9 45.6 10.1 C44.4 9.3 44.1 9 42.8 8.5 C41.5 8 38.2 7 37.7 7.2 C37.3 7.5 39.4 9.1 40.1 9.9 C40.7 10.7 40.9 10.8 41.5 11.9 C42.1 13 42.5 16 43.5 16.5 C44.5 17.1 46.1 15.3 47.2 15.1 C48.4 15 49.7 15.8 50.3 15.5 C50.8 15.1 51.2 14.1 50.4 13.2Z" fill="#e8433f"/><path d="M51.4 18.3 C51.1 17.9 50.5 17.3 50.3 17.3 C50.1 17.2 50 17.8 50 18.1 C50 18.4 50.2 18.8 50.3 19.1 C50.5 19.4 50.9 19.8 51.2 19.9 C51.5 20 51.9 19.9 52 19.7 C52 19.4 51.7 18.7 51.4 18.3Z" fill="#e8433f"/><path d="M36 6 C36.2 6 36.4 5.9 36.4 5.9 C36.3 5.8 36 5.6 35.7 5.6 C35.4 5.5 34.9 5.5 34.6 5.5 C34.3 5.5 33.9 5.6 33.9 5.6 C33.9 5.7 34.5 5.8 34.8 5.9 C35.2 6 35.7 6 36 6Z" fill="#e8433f"/><path d="M19.3 26.9 C20 26.6 20.6 24.5 20.9 23.5 C21.1 22.5 20.8 21.6 20.6 20.9 C20.4 20.2 20 20 19.6 19.2 C19.2 18.3 19 15.9 18.2 15.9 C17.4 15.9 15.4 17.8 14.7 18.9 C14 20 14.3 21.2 14.1 22.3 C14 23.5 13.4 25.1 13.8 25.6 C14.1 26.1 15.5 25.1 16.4 25.3 C17.4 25.6 18.5 27.2 19.3 26.9Z" fill="#ff8c1a"/><path d="M13.4 18 C13.4 17.9 12.9 18.1 12.7 18.2 C12.5 18.4 12.2 18.7 12.1 18.9 C12 19.1 11.9 19.5 12 19.6 C12.1 19.8 12.3 20.1 12.5 20 C12.7 19.8 12.9 19.3 13.1 18.9 C13.2 18.6 13.5 18.1 13.4 18Z" fill="#ff8c1a"/><path d="M21.4 24.6 C21.4 25 21.5 25.6 21.8 25.8 C22 26 22.6 25.8 22.9 25.6 C23.2 25.5 23.7 25.1 23.7 24.9 C23.8 24.6 23.5 24.2 23.2 24 C23 23.8 22.5 23.5 22.2 23.6 C21.9 23.7 21.5 24.2 21.4 24.6Z" fill="#ff8c1a"/><path d="M25.8 45.9 C26.7 44.9 27 43 27 41.3 C27 39.7 26.9 37.3 25.9 36 C24.9 34.8 22.7 34.2 21.1 33.8 C19.6 33.3 17.9 33.1 16.7 33.6 C15.5 34.1 14.1 35.6 13.9 36.9 C13.6 38.2 14.7 40.2 15.3 41.5 C15.9 42.9 16.4 44 17.5 45 C18.5 45.9 20.2 47.2 21.5 47.3 C22.9 47.4 24.9 46.9 25.8 45.9Z" fill="#f5c71a"/><path d="M18.6 31.2 C18.8 31.5 19.3 31.6 19.6 31.6 C19.9 31.5 20.5 31.3 20.6 31 C20.7 30.7 20.5 30.2 20.3 29.9 C20.1 29.6 19.8 29.2 19.5 29.2 C19.2 29.2 18.8 29.6 18.6 30 C18.5 30.3 18.5 30.9 18.6 31.2Z" fill="#f5c71a"/><path d="M13.2 32.5 C13 32.2 12.5 32.1 12.2 32.2 C11.9 32.3 11.5 32.8 11.4 33.2 C11.4 33.6 11.6 34.4 11.8 34.7 C12 34.9 12.5 34.8 12.7 34.7 C13 34.6 13.4 34.3 13.4 34 C13.5 33.6 13.4 32.8 13.2 32.5Z" fill="#f5c71a"/><path d="M48.3 15 C48.3 16 50.7 18.7 50.9 20.1 C51.2 21.6 49.4 22.7 49.7 23.8 C50.1 24.8 52 26 52.9 26.4 C53.8 26.9 54.4 26.5 55.1 26.4 C55.7 26.4 56.6 26.8 56.7 26.1 C56.8 25.4 56.3 23.7 55.9 22.3 C55.5 21 55.3 19.3 54.5 18.1 C53.7 16.8 52 15.1 51 14.6 C49.9 14.1 48.3 14.1 48.3 15Z" fill="#3cbf5a"/><path d="M57.9 25.8 C58 25.9 58.1 26.2 58.1 26.3 C58.2 26.5 58.3 26.7 58.3 26.6 C58.3 26.6 58.2 26.2 58.2 25.9 C58.1 25.7 58 25.4 58 25.3 C57.9 25.2 57.9 25.2 57.9 25.3 C57.9 25.4 57.9 25.6 57.9 25.8Z" fill="#3cbf5a"/><path d="M51.6 31 C51.6 31.2 52 31.4 52.2 31.5 C52.4 31.6 52.6 31.6 52.7 31.4 C52.9 31.2 53 30.7 52.9 30.5 C52.9 30.2 52.6 30 52.4 29.9 C52.3 29.9 52.1 30 51.9 30.2 C51.8 30.3 51.5 30.7 51.6 31Z" fill="#3cbf5a"/><circle cx="32" cy="32" r="27" fill="url(#jd${u})"/></g><circle cx="32" cy="32" r="27" fill="none" stroke="#9e978a" stroke-width="1"/><ellipse cx="22" cy="18" rx="7.5" ry="4" fill="#fff" opacity=".85" transform="rotate(-32 22 18)"/><circle cx="31" cy="12.5" r="1.4" fill="#fff" opacity=".75"/></svg>`,
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
  let layer = null;

  // How many icons one celebration throws: each of the nine once, plus
  // repeats.
  const FLYER_COUNT = 15;

  // Icons spread evenly over the landing zone (best-of-several random
  // candidates, keeping whichever is farthest from those already placed)
  // rather than purely at random, so they don't pile up on one another.
  // No icon lands on `avoid` (the New puzzle key, the next thing to tap).
  function landingSpots(zone, count, avoid, size) {
    const spots = [];
    for (let i = 0; i < count; i++) {
      let best = null;
      let bestDist = -1;
      for (let c = 0; c < 12; c++) {
        const p = {
          x: zone.left + Math.random() * (zone.right - zone.left),
          y: zone.top + Math.random() * (zone.bottom - zone.top),
        };
        const hitsAvoid =
          avoid &&
          p.x < avoid.right && p.x + size > avoid.left && p.y < avoid.bottom && p.y + size > avoid.top;
        // (Only if every candidate so far hit it is one allowed through.)
        if (hitsAvoid && (best || c < 11)) continue;
        const d = spots.reduce((m, q) => Math.min(m, Math.hypot(p.x - q.x, p.y - q.y)), Infinity);
        if (d > bestDist) {
          best = p;
          bestDist = d;
        }
      }
      spots.push(best);
    }
    return spots;
  }

  // Lets a resting icon be dragged out of the way (mouse or touch).
  function makeDraggable(el, anim) {
    el.addEventListener("pointerdown", (e) => {
      if (anim.playState !== "finished") anim.finish();
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      const startX = e.clientX - el.offsetLeft;
      const startY = e.clientY - el.offsetTop;
      el.classList.add("dragging");
      const move = (ev) => {
        el.style.left = ev.clientX - startX + "px";
        el.style.top = ev.clientY - startY + "px";
      };
      const up = () => {
        el.classList.remove("dragging");
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerup", up);
        el.removeEventListener("pointercancel", up);
      };
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
    });
  }

  function launchFlyers(phone) {
    clear();
    // The layer covers the whole page (body is position: relative), so
    // resting icons scroll along with the phone; it clips anything outside
    // the page, so off-screen launch points never add scrollbars.
    layer = document.createElement("div");
    layer.className = "celebrate-layer";
    document.body.appendChild(layer);

    const size = ICON_SIZE;
    const body = document.body.getBoundingClientRect();
    const ph = phone.getBoundingClientRect();
    const pageW = document.body.clientWidth;
    // Landing zone: the phone plus a margin around it, kept on the page.
    const zone = {
      left: Math.max(4, ph.left - body.left - 50),
      right: Math.min(pageW - size - 4, ph.right - body.left + 50 - size),
      top: ph.top - body.top - 20,
      bottom: ph.bottom - body.top + 10 - size,
    };
    const key = document.getElementById("hang-give-up");
    let avoid = null;
    if (key) {
      const k = key.getBoundingClientRect();
      // Padded, since a tilted icon reaches past its own square.
      const pad = 14;
      avoid = {
        left: k.left - body.left - pad,
        right: k.right - body.left + pad,
        top: k.top - body.top - pad,
        bottom: k.bottom - body.top + pad,
      };
    }
    const spots = landingSpots(zone, FLYER_COUNT, avoid, size);
    // The poppers fire from just off each side of the window, level with
    // the visible part of the phone.
    const visTop = Math.max(ph.top, 0);
    const visBottom = Math.min(ph.bottom, window.innerHeight);
    const launchY = (visTop + visBottom) / 2 - body.top - size / 2;

    const deck = [...ICONS];
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    while (deck.length < FLYER_COUNT) deck.push(ICONS[Math.floor(Math.random() * ICONS.length)]);

    for (let i = 0; i < FLYER_COUNT; i++) {
      const el = document.createElement("div");
      el.className = "celebrate-flyer";
      el.innerHTML = deck[i]("c" + ++flyerCount);
      el.style.width = el.style.height = size + "px";
      const spot = spots[i];
      el.style.left = spot.x + "px";
      el.style.top = spot.y + "px";

      const fromLeft = i % 2 === 0;
      const startX = fromLeft ? -body.left - size - 10 : window.innerWidth - body.left + 10;
      const startY = launchY + (Math.random() - 0.5) * 120;
      const dx = startX - spot.x;
      const dy = startY - spot.y;
      // Popper burst: a fast start that decays exponentially, with a
      // slight upward arc and a spin that winds down into a resting tilt.
      const lift = 40 + Math.random() * 70;
      const restTilt = (Math.random() - 0.5) * 50;
      const spin = (fromLeft ? 1 : -1) * (360 + Math.random() * 360);
      const frames = [];
      const steps = 24;
      for (let k = 0; k <= steps; k++) {
        const p = k / steps;
        const ease = 1 - Math.exp(-6 * p);
        const remain = k === steps ? 0 : 1 - ease / (1 - Math.exp(-6));
        const arc = Math.sin(Math.min(1, ease * 1.15) * Math.PI) * lift;
        frames.push({
          transform: `translate(${dx * remain}px, ${dy * remain - arc * remain}px) rotate(${restTilt + spin * remain}deg)`,
        });
      }
      layer.appendChild(el);
      const anim = el.animate(frames, {
        duration: 1100 + Math.random() * 300,
        delay: (fromLeft ? 0 : 60) + Math.random() * 140,
        easing: "linear",
        fill: "both",
      });
      makeDraggable(el, anim);
    }
  }

  // Removes any icons left from the last celebration (New puzzle, or a
  // switch between modes), with a quick fade.
  function clear() {
    if (!layer) return;
    const old = layer;
    layer = null;
    old.style.transition = "opacity 0.2s ease";
    old.style.opacity = "0";
    setTimeout(() => old.remove(), 220);
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

  // Game-show "wrong answer" buzzer for an incorrect guess: a flat, low,
  // steady tone (two slightly detuned sawtooth waves, so it has that harsh
  // buzzy beat), held for under half a second with no change in pitch.
  function scheduleBuzzer(ctx, t0) {
    const master = ctx.createGain();
    master.gain.value = 0.16;
    master.connect(ctx.destination);
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 1400;
    const env = ctx.createGain();
    const end = t0 + 0.42;
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(0.8, t0 + 0.01);
    env.gain.setValueAtTime(0.8, end - 0.04);
    env.gain.linearRampToValueAtTime(0, end);
    lowpass.connect(env);
    env.connect(master);
    for (const freq of [98, 103.5]) {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = freq;
      osc.connect(lowpass);
      osc.start(t0);
      osc.stop(end + 0.02);
    }
  }

  // A quick "dee-dl-ee" for each correct answer: three short square-wave
  // notes, up a step, down, then up to the top.
  function scheduleChime(ctx, t0) {
    const master = ctx.createGain();
    master.gain.value = 0.14;
    master.connect(ctx.destination);
    const notes = [
      [1318.5, 0.07],
      [1174.66, 0.05],
      [1567.98, 0.16],
    ];
    let t = t0;
    for (const [freq, dur] of notes) {
      const osc = ctx.createOscillator();
      osc.type = "square";
      osc.frequency.value = freq;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.45, t + 0.008);
      env.gain.setValueAtTime(0.45, t + dur * 0.6);
      env.gain.linearRampToValueAtTime(0, t + dur);
      osc.connect(env);
      env.connect(master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
      t += dur;
    }
  }

  let audioCtx = null;

  function getAudio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!audioCtx) audioCtx = new AC();
    return audioCtx;
  }

  // Browsers only let audio start from a user gesture, and phones pause the
  // audio context whenever the page is backgrounded or interrupted (iOS
  // marks it "interrupted", not "suspended"), after which it stays silent
  // until resumed from another gesture. So every tap/keypress on the page
  // wakes it up ahead of time, and a sound requested while it isn't running
  // waits for the resume instead of being scheduled on a stopped clock.
  function wakeAudio() {
    const ctx = getAudio();
    if (ctx && ctx.state !== "running") ctx.resume().catch(() => {});
  }
  ["pointerdown", "touchend", "keydown"].forEach((type) =>
    window.addEventListener(type, wakeAudio, { capture: true, passive: true })
  );

  function play(schedule) {
    const ctx = getAudio();
    if (!ctx) return;
    if (ctx.state === "running") {
      schedule(ctx, ctx.currentTime + 0.02);
      return;
    }
    ctx
      .resume()
      .then(() => schedule(ctx, ctx.currentTime + 0.02))
      .catch(() => {});
  }

  function celebrate(phone) {
    play(scheduleSound);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    buzzPhone(phone);
    launchFlyers(phone);
  }

  function chime() {
    play(scheduleChime);
  }

  function buzzer() {
    play(scheduleBuzzer);
  }

  window.T9Celebrate = { celebrate, chime, buzzer, clear, scheduleSound, scheduleChime, scheduleBuzzer };
})();
