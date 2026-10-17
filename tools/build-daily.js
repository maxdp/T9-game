#!/usr/bin/env node
// Builds js/daily.js: the fixed Daily schedule (one Easy, one Medium and
// one Hard puzzle per date), so every player everywhere gets the same three
// puzzles each day, no matter which version of the word list their browser
// has cached. Each puzzle is stored with its full answer list, so later
// word-list changes never alter a scheduled puzzle either.
//
//   node tools/build-daily.js [--days 365] [--keep-through YYYY-MM-DD]
//
// Days up to and including --keep-through (default: today, US Central
// time) are copied unchanged from the existing js/daily.js -- players may
// already have seen them. Every later day is (re)drawn: each difficulty
// walks a seeded shuffle of its puzzle pool, skipping puzzles already
// used, and starts a fresh shuffle once the pool runs out. Re-run it after
// changing the word list or the puzzle blockers to refresh future days.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
global.window = {};
for (const f of ["js/t9-logic.js", "js/words.js", "js/inappropriate-words.js", "js/puzzles.js"]) {
  new Function("window", fs.readFileSync(path.join(ROOT, f), "utf8"))(window);
}
const P = window.T9_PUZZLES;

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const totalDays = Number(arg("--days", 365));
const keepThrough = arg("--keep-through", P.centralDateKey());
const keepCount = Math.max(0, P.dailyNumber(keepThrough));

const OUT = path.join(ROOT, "js/daily.js");
let existing = [];
if (fs.existsSync(OUT)) {
  const w = {};
  new Function("window", fs.readFileSync(OUT, "utf8"))(w);
  existing = w.T9_DAILY.days;
}
const days = existing.slice(0, keepCount);

const pools = P.buildPools();
const byPattern = new Map();
P.DIFFICULTY_LABELS.forEach((label) => pools[label].forEach((p) => byPattern.set(p.pattern, p)));

// Each difficulty deals from a shuffled deck of its pool; a puzzle already
// used (in a kept day or earlier in this run) is skipped until the deck
// has been through every puzzle once. A new round then still skips the
// most recent half of the pool, so a repeat is never just days after its
// last showing.
const decks = P.DIFFICULTY_LABELS.map((label, li) => {
  const pool = pools[label].map((p) => p.pattern);
  const inPool = new Set(pool);
  const history = days.map((d) => d[li].split(" ")[0]);
  let used = new Set(history.filter((x) => inPool.has(x)));
  let cycle = 0;
  let order = [];
  return () => {
    for (;;) {
      if (order.length === 0) {
        if (used.size >= pool.length) used = new Set(history.slice(-Math.floor(pool.length / 2)));
        order = P.seededShuffle(pool, `t9-tangle-daily:${label}:${cycle++}`);
      }
      const pattern = order.shift();
      if (used.has(pattern)) continue;
      used.add(pattern);
      history.push(pattern);
      return pattern;
    }
  };
});

while (days.length < totalDays) {
  days.push(
    decks.map((deal) => {
      const p = byPattern.get(deal());
      return [p.pattern, ...p.answers].join(" ");
    })
  );
}

const lines = days.map(
  (d, i) => `    ${JSON.stringify(d)}, // #${i + 1} ${P.dateKeyForNumber(i + 1)}`
);
fs.writeFileSync(
  OUT,
  `// The Daily schedule: built by tools/build-daily.js -- edit by re-running
// it, not by hand. Each day is [Easy, Medium, Hard]; each puzzle is its
// pattern ("_" for a blank) followed by every answer.
window.T9_DAILY = {
  days: [
${lines.join("\n")}
  ],
};
`
);
console.log(
  `js/daily.js: ${days.length} days (#1 ${P.dateKeyForNumber(1)} to #${days.length} ${P.dateKeyForNumber(days.length)}), ` +
    `kept ${Math.min(keepCount, existing.length)} existing day(s).`
);
