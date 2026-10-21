#!/usr/bin/env node
// Builds the word lists in js/words.js (DICTIONARY, WORDS_GOOD and
// WORDS_GOOD_RANK) from the downloaded sources plus our own edits:
//
//   sh tools/wordlist/fetch-sources.sh     # once: downloads tools/wordlist/sources/
//   node tools/wordlist/build-words.js     # rebuilds js/words.js
//   node tools/wordlist/build-words.js --check   # just reports differences
//
// How a word gets into DICTIONARY (every real word the game accepts, 4-8
// letters):
//   1. It's in words_alpha (a big list of English letter-only words).
//   2. It's real per WordNet: either a WordNet lemma itself (but not one
//      that only names a specific person/place/thing), or a regular
//      inflection (-s, -es, -ies, -ed, -ing, -er, -est) of a lemma of the
//      matching part of speech -- and then it must also be in ENABLE (the
//      Scrabble-style list), which rejects made-up inflections.
//   3. It's common enough: the word itself, or for an inflection its base
//      word, ranks in the top 100,000 of the FrequencyWords English list
//      (counts from movie/TV subtitles).
//   4. It isn't in exclude.txt or js/inappropriate-words.js.
//   Plus everything in include.txt, unconditionally (function words and
//   irregular forms WordNet doesn't list, and hand-picked additions).
// WORDS_GOOD is every DICTIONARY word that follows the game's rules (see
// js/t9-logic.js); WORDS_GOOD_RANK is each one's frequency rank (an
// inflection uses its base word's rank), which drives puzzle difficulty.
//
// After changing the word list, run tools/build-daily.js to refresh the
// future Daily days.
const fs = require("fs");
const path = require("path");

const HERE = __dirname;
const ROOT = path.join(HERE, "..", "..");
const SRC = path.join(HERE, "sources");
const WORDS_JS = path.join(ROOT, "js", "words.js");
const FREQ_CUTOFF = 100000;
const MIN_LEN = 4;
const MAX_LEN = 8;

const loadLines = (file) => fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean);
// Our own edit lists: one word per line; "#" starts a comment.
const loadList = (file) =>
  loadLines(file)
    .map((l) => l.replace(/#.*/, "").trim().toLowerCase())
    .filter(Boolean);

if (!fs.existsSync(path.join(SRC, "en_full.txt"))) {
  console.error("Sources missing: run  sh tools/wordlist/fetch-sources.sh  first.");
  process.exit(1);
}

global.window = {};
new Function("window", fs.readFileSync(path.join(ROOT, "js", "t9-logic.js"), "utf8"))(window);
new Function("window", fs.readFileSync(path.join(ROOT, "js", "inappropriate-words.js"), "utf8"))(window);
const { isGoodWord } = window.T9;

const wordsAlpha = new Set(loadLines(path.join(SRC, "words_alpha.txt")));
const enable = new Set(loadLines(path.join(SRC, "enable1.txt")));
const exclude = new Set([...loadList(path.join(HERE, "exclude.txt")), ...window.T9_INAPPROPRIATE]);
const include = loadList(path.join(HERE, "include.txt"));

// ---- WordNet ------------------------------------------------------------
const WN = path.join(SRC, "wordnet");
const byPos = { noun: new Set(), verb: new Set(), adj: new Set(), adv: new Set() };
Object.keys(byPos).forEach((pos) => {
  loadLines(path.join(WN, "index." + pos)).forEach((line) => {
    if (line.startsWith(" ")) return;
    const lemma = line.split(" ")[0];
    if (lemma && !lemma.includes("_")) byPos[pos].add(lemma);
  });
});

// Nouns whose every sense names one specific thing (WordNet "instance"
// senses, e.g. a person, city or holiday) aren't ordinary words. A synset
// with any instance pointer counts as instance-type, even if it also has a
// plain "is a kind of" pointer.
const classSynsets = new Set();
const instanceSynsets = new Set();
loadLines(path.join(WN, "data.noun")).forEach((line) => {
  if (line.startsWith(" ")) return;
  const offset = line.slice(0, 8);
  const parts = line.split("| ")[0].split(" ").filter(Boolean);
  if (parts.includes("@i")) instanceSynsets.add(offset);
  else if (parts.includes("@")) classSynsets.add(offset);
});
const instanceOnly = new Set();
loadLines(path.join(WN, "index.noun")).forEach((line) => {
  if (line.startsWith(" ")) return;
  const cols = line.split(" ").filter(Boolean);
  const lemma = cols[0];
  if (lemma.includes("_")) return;
  const offsets = cols.slice(cols.length - parseInt(cols[2], 10));
  if (offsets.length > 0 && offsets.every((o) => instanceSynsets.has(o) && !classSynsets.has(o))) {
    instanceOnly.add(lemma);
  }
});

function isLemma(word) {
  if (instanceOnly.has(word) && !byPos.verb.has(word) && !byPos.adj.has(word) && !byPos.adv.has(word)) {
    return false;
  }
  return byPos.noun.has(word) || byPos.verb.has(word) || byPos.adj.has(word) || byPos.adv.has(word);
}

// Candidate base words for a regular inflection. A one-syllable base
// ending consonant-vowel-consonant doubles its last consonant before these
// endings (swag -> swagged), so e.g. "swaged" can only come from "swage",
// never "swag": the bare base isn't offered then. (Syllables ~ vowel
// groups, y counting as a vowel unless a vowel follows it.)
function baseCandidates(word) {
  const stems = new Set();
  const dropDoubled = (b) => {
    const n = b.length;
    if (n >= 2 && b[n - 1] === b[n - 2] && !"aeiou".includes(b[n - 1])) stems.add(b.slice(0, -1));
  };
  const bareOk = (b) =>
    !(/[^aeiou][aeiou][^aeiouwxy]$/.test(b) && (b.match(/[aeiou]+|y(?![aeiou])/g) || []).length === 1);
  if (word.endsWith("ies")) stems.add(word.slice(0, -3) + "y");
  if (word.endsWith("es")) stems.add(word.slice(0, -2));
  if (word.endsWith("s") && !word.endsWith("ss")) stems.add(word.slice(0, -1));
  for (const [suffix, doubles] of [["ing", true], ["ed", true], ["est", false], ["er", false]]) {
    if (!word.endsWith(suffix)) continue;
    const b = word.slice(0, -suffix.length);
    if (bareOk(b)) stems.add(b);
    stems.add(b + "e");
    if (doubles) dropDoubled(b);
  }
  return [...stems];
}
// Which parts of speech each ending can inflect.
function endingPos(word) {
  const pos = new Set();
  if (word.endsWith("ies")) pos.add("noun");
  if (word.endsWith("es") || (word.endsWith("s") && !word.endsWith("ss"))) {
    pos.add("noun");
    pos.add("verb");
  }
  if (word.endsWith("ing") || word.endsWith("ed")) pos.add("verb");
  if (word.endsWith("er")) ["adj", "adv", "verb"].forEach((p) => pos.add(p));
  if (word.endsWith("est")) ["adj", "adv"].forEach((p) => pos.add(p));
  return pos;
}
// { stem, direct } when the word is real: direct = a lemma itself.
function realness(word) {
  if (isLemma(word)) return { stem: word, direct: true };
  const pos = endingPos(word);
  for (const s of baseCandidates(word)) {
    if ([...pos].some((p) => byPos[p].has(s)) && isLemma(s)) return { stem: s, direct: false };
  }
  return null;
}

// ---- Frequency ranks ----------------------------------------------------
const rankOf = new Map();
loadLines(path.join(SRC, "en_full.txt")).forEach((line, i) => {
  const w = line.split(" ")[0];
  if (!rankOf.has(w)) rankOf.set(w, i + 1);
});
const UNRANKED = rankOf.size + 1;

// ---- Build ----------------------------------------------------------------
const rankFor = new Map();
for (const word of wordsAlpha) {
  if (word.length < MIN_LEN || word.length > MAX_LEN || exclude.has(word)) continue;
  const m = realness(word);
  if (!m) continue;
  if (!m.direct && !enable.has(word)) continue;
  const own = rankOf.get(word);
  const stem = rankOf.get(m.stem);
  if (!((own && own <= FREQ_CUTOFF) || (stem && stem <= FREQ_CUTOFF))) continue;
  rankFor.set(word, m.direct ? own || stem || UNRANKED : stem || UNRANKED);
}
// Included words always count, ranked by their own frequency (even when
// the rules above would also have let them in via a base word).
for (const word of include) {
  if (exclude.has(word)) continue;
  rankFor.set(word, rankOf.get(word) || UNRANKED);
}

const DICTIONARY = [...rankFor.keys()].sort();
const WORDS_GOOD = DICTIONARY.filter((w) => isGoodWord(w));
const WORDS_GOOD_RANK = WORDS_GOOD.map((w) => rankFor.get(w));

// ---- Report / write -----------------------------------------------------
const current = {};
new Function("window", fs.readFileSync(WORDS_JS, "utf8"))(current);
const old = current.T9_WORDS;
const diff = (a, b) => {
  const inB = new Set(b);
  return a.filter((x) => !inB.has(x));
};
const oldRank = new Map(old.WORDS_GOOD.map((w, i) => [w, old.WORDS_GOOD_RANK[i]]));
const rankChanged = WORDS_GOOD.filter((w, i) => oldRank.has(w) && oldRank.get(w) !== WORDS_GOOD_RANK[i]);
console.log(`DICTIONARY ${DICTIONARY.length} (was ${old.DICTIONARY.length}), WORDS_GOOD ${WORDS_GOOD.length} (was ${old.WORDS_GOOD.length})`);
const show = (label, list) => console.log(`${label} (${list.length}): ${list.slice(0, 60).join(" ")}${list.length > 60 ? " ..." : ""}`);
show("answers added", diff(WORDS_GOOD, old.WORDS_GOOD));
show("answers removed", diff(old.WORDS_GOOD, WORDS_GOOD));
show("dictionary-only added", diff(diff(DICTIONARY, old.DICTIONARY), WORDS_GOOD));
show("dictionary-only removed", diff(diff(old.DICTIONARY, DICTIONARY), old.WORDS_GOOD));
show("answer ranks changed", rankChanged);

if (process.argv.includes("--check")) process.exit(0);
let src = fs.readFileSync(WORDS_JS, "utf8");
for (const [name, value] of [["DICTIONARY", DICTIONARY], ["WORDS_GOOD", WORDS_GOOD], ["WORDS_GOOD_RANK", WORDS_GOOD_RANK]]) {
  const re = new RegExp("^const " + name + " = \\[.*\\];$", "m");
  if (!re.test(src)) throw new Error("couldn't find " + name + " in js/words.js");
  src = src.replace(re, () => "const " + name + " = " + JSON.stringify(value) + ";");
}
fs.writeFileSync(WORDS_JS, src);
console.log("Wrote js/words.js. Next: node tools/build-daily.js");
