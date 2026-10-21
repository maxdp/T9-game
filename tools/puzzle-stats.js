#!/usr/bin/env node
// Reports on the puzzle pools, using the game's own rules (js/puzzles.js):
//
//   node tools/puzzle-stats.js                 # pool sizes + points spread
//   node tools/puzzle-stats.js --samples 13    # sample puzzles at 13 points
//   node tools/puzzle-stats.js --score t_n_____  # one puzzle's breakdown
//   node tools/puzzle-stats.js --daily 10      # Daily #10's puzzles, scored
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
global.window = {};
for (const f of ["js/t9-logic.js", "js/words.js", "js/inappropriate-words.js", "js/puzzles.js", "js/daily.js"]) {
  new Function("window", fs.readFileSync(path.join(ROOT, f), "utf8"))(window);
}
const P = window.T9_PUZZLES;
const { WORDS_GOOD } = window.T9_WORDS;
const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};

const blanksIn = (pattern) => [...pattern].filter((c) => c === "_").length;
function describe(pattern, answers) {
  const pts = P.difficultyPoints(answers, blanksIn(pattern));
  const label = P.puzzleLabel(pattern, answers, blanksIn(pattern)) || "not allowed";
  const words = answers.map((w) => w + (window.T9.findLinearGrouping(window.T9.wordToDigits(w)) ? "" : "*") + `(${P.WORD_RANK.get(w)})`);
  return `${pattern.toUpperCase().padEnd(9)} ${label.padEnd(11)} ${pts.total} pts = rarity ${pts.rarity} + blanks ${pts.blanks} + answers ${pts.answers} + length ${pts.length} + split ${pts.split}\n          ${words.join(", ")}`;
}

if (arg("--score")) {
  const pattern = arg("--score").toLowerCase();
  const answers = WORDS_GOOD.filter((w) => P.fitsPattern(pattern, w));
  console.log(answers.length ? describe(pattern, answers) : "No answers fit " + pattern);
  console.log("(* = needs a sum split across the ends of the word; numbers are frequency ranks)");
  process.exit(0);
}
if (arg("--daily")) {
  const n = Number(arg("--daily"));
  const day = window.T9_DAILY.days[n - 1];
  console.log(`Daily #${n} (${P.dateKeyForNumber(n)}) slots: ${P.dailyLabels(P.dateKeyForNumber(n)).join(", ")}`);
  day.forEach((e) => {
    const [pattern, ...answers] = e.split(" ");
    console.log(describe(pattern, answers));
  });
  process.exit(0);
}

const pools = P.buildPools();
const byPoints = {};
const all = [];
P.ALL_LABELS.forEach((label) =>
  pools[label].forEach((p) => {
    const t = P.difficultyPoints(p.answers, blanksIn(p.pattern)).total;
    byPoints[t] = (byPoints[t] || 0) + 1;
    all.push([t, p]);
  })
);
if (arg("--samples")) {
  const t = Number(arg("--samples"));
  const list = all.filter(([x]) => x === t).map(([, p]) => p);
  const step = Math.max(1, Math.floor(list.length / 8));
  console.log(`${list.length} puzzles at ${t} points; a spread of 8:`);
  for (let i = 0; i < list.length && i < step * 8; i += step) console.log(describe(list[i].pattern, list[i].answers));
  process.exit(0);
}
console.log("Pools:", P.ALL_LABELS.map((l) => `${l} ${pools[l].length}`).join(", "));
console.log("By points:", Object.keys(byPoints).sort((a, b) => a - b).map((k) => `${k}: ${byPoints[k]}`).join(", "));
console.log(`Answer words: ${WORDS_GOOD.length}`);
