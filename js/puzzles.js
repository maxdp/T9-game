// Puzzle building blocks shared by the game (js/app.js) and the Daily
// schedule builder (tools/build-daily.js), so the two always agree on what
// a puzzle is, how hard it is, and which ones are off limits.
//
// A puzzle is a pattern: the hidden word with its blanked letters as "_"
// (e.g. "l__s"). Its answers are every good word that fits the pattern;
// two hidden words with the same pattern make the very same puzzle.
(() => {
  const { WORDS_GOOD, WORDS_GOOD_RANK } = window.T9_WORDS;

  const MIN_VALID_ANSWERS = 2;
  const MAX_VALID_ANSWERS = 8;
  // The three Daily slots, in order. (A fourth label, Evil, only ever
  // replaces Hard in the Daily's last slot on Sundays -- see dailyLabels.)
  const DIFFICULTY_LABELS = ["Easy", "Medium", "Hard"];
  const ALL_LABELS = ["Easy", "Medium", "Hard", "Evil"];

  // Word -> frequency rank (1 = most common, higher = rarer).
  const WORD_RANK = new Map(WORDS_GOOD.map((w, i) => [w, WORDS_GOOD_RANK[i]]));

  // Difficulty adds up five factors into a 4-14 point score:
  //
  // 1. Rarity of the rarest valid answer — WORDS_GOOD split into rarity
  //    quartiles by rank (cutoffs are the actual 25th/50th/75th percentile
  //    rank values of the current WORDS_GOOD pool, recomputed here rather
  //    than hardcoded so they stay correct whenever the word list
  //    changes); the bottom (most-common) quartile is worth 1 point, the
  //    2nd 2, the 3rd and 4th (rarest half) 3.
  // 2. Number of blanks (2-6): 2 is worth 1 point, 3 worth 2, 4-6 worth 3.
  // 3. Number of valid answers (2-8): 2-4 is worth 1 point, 5-6 worth 2,
  //    7-8 worth 3.
  // 4. Word length (4-8): 4-5 is worth 1 point, 6 worth 2, 7-8 worth 3.
  // 5. Wraparound split: 2 points if at least one answer *requires* a sum
  //    that straddles the end and start of the word (e.g. almonds, which
  //    only works as [LM][O][N][D][SA]); 0 otherwise. An answer that merely
  //    reads around the end, like spur (4,1,2,3), doesn't count.
  //
  // Totals are labeled 4-6 Easy / 7-9 Medium / 10-11 Hard / 12+ Evil.
  // Evil puzzles never appear in Practice; they're the Sunday Daily's last
  // puzzle in place of Hard.
  const RARITY_QUARTILES = (() => {
    const sortedRanks = [...WORDS_GOOD_RANK].sort((a, b) => a - b);
    const n = sortedRanks.length;
    const pct = (p) => sortedRanks[Math.min(n - 1, Math.floor(p * n))];
    return { q1: pct(0.25), q2: pct(0.5), q3: pct(0.75) };
  })();

  function rarityPoints(rarestRank) {
    if (rarestRank <= RARITY_QUARTILES.q1) return 1;
    if (rarestRank <= RARITY_QUARTILES.q2) return 2;
    return 3;
  }
  function blankPoints(blankCount) {
    if (blankCount <= 2) return 1;
    if (blankCount <= 3) return 2;
    return 3;
  }
  function answerPoints(answerCount) {
    if (answerCount <= 4) return 1;
    if (answerCount <= 6) return 2;
    return 3;
  }
  function lengthPoints(length) {
    if (length <= 5) return 1;
    if (length <= 6) return 2;
    return 3;
  }

  // Whether a word only works with a sum split across its ends: it has a
  // circular grouping (it's a good word) but no plain left-to-right one.
  const REQUIRES_SPLIT = new Map();
  function requiresSplit(word) {
    if (!REQUIRES_SPLIT.has(word)) {
      REQUIRES_SPLIT.set(word, window.T9.findLinearGrouping(window.T9.wordToDigits(word)) === null);
    }
    return REQUIRES_SPLIT.get(word);
  }
  function splitPoints(answers) {
    return answers.some(requiresSplit) ? 2 : 0;
  }

  // Each factor's points for a puzzle, plus the total.
  function difficultyPoints(answers, blankCount) {
    const parts = {
      rarity: rarityPoints(rarestRankOf(answers)),
      blanks: blankPoints(blankCount),
      answers: answerPoints(answers.length),
      length: lengthPoints(answers[0].length),
      split: splitPoints(answers),
    };
    parts.total = parts.rarity + parts.blanks + parts.answers + parts.length + parts.split;
    return parts;
  }

  function difficultyForPuzzle(answers, blankCount) {
    const points = difficultyPoints(answers, blankCount).total;
    if (points <= 6) return "Easy";
    if (points <= 9) return "Medium";
    if (points <= 11) return "Hard";
    return "Evil";
  }

  function rarestRankOf(answers) {
    return Math.max(...answers.map((w) => WORD_RANK.get(w)));
  }

  function fitsPattern(pattern, word) {
    if (word.length !== pattern.length) return false;
    for (let i = 0; i < pattern.length; i++) {
      if (pattern[i] !== "_" && pattern[i] !== word[i]) return false;
    }
    return true;
  }

  // Whether a puzzle could be filled in to spell a puzzle blocker (see
  // js/inappropriate-words.js); such puzzles are never offered.
  const BLOCKERS = window.T9_PUZZLE_BLOCKERS || [];
  function isBlocked(pattern) {
    return BLOCKERS.some((w) => fitsPattern(pattern, w));
  }

  // The single gatekeeper for which puzzles the game may use, shared by
  // Practice and the Daily pools: returns the puzzle's label, or null if it
  // isn't allowed. The 2-answer rule must stay the LAST step, after the
  // label is worked out, since it depends on how labels are defined:
  // 2-answer puzzles are only there to widen the Easy pool, so any that
  // would rate Medium or Hard are dropped rather than watering those down.
  function puzzleLabel(pattern, answers, blankCount) {
    if (answers.length < MIN_VALID_ANSWERS || answers.length > MAX_VALID_ANSWERS) return null;
    if (isBlocked(pattern)) return null;
    const label = difficultyForPuzzle(answers, blankCount);
    if (answers.length === 2 && label !== "Easy") return null;
    return label;
  }

  // Every distinct puzzle the rules allow, grouped by difficulty, with
  // blocked ones left out (about 130k patterns; roughly a tenth of a
  // second to build).
  function buildPools() {
    const byPattern = new Map();
    WORDS_GOOD.forEach((w) => {
      const n = w.length;
      for (let mask = 0; mask < 1 << n; mask++) {
        let blankCount = 0;
        for (let m = mask; m; m &= m - 1) blankCount++;
        if (blankCount < 2 || blankCount > n - 2) continue;
        let pattern = "";
        for (let i = 0; i < n; i++) pattern += (mask >> i) & 1 ? "_" : w[i];
        let entry = byPattern.get(pattern);
        if (!entry) byPattern.set(pattern, (entry = { blankCount, answers: [] }));
        entry.answers.push(w);
      }
    });
    const pools = { Easy: [], Medium: [], Hard: [], Evil: [] };
    byPattern.forEach((entry, pattern) => {
      const label = puzzleLabel(pattern, entry.answers, entry.blankCount);
      if (label) pools[label].push({ pattern, answers: entry.answers, difficulty: label });
    });
    return pools;
  }

  // FNV-1a string hash -> 32-bit seed.
  function hashString(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // mulberry32: a small, fast PRNG that gives the same sequence for the
  // same seed everywhere (Math.random can't be seeded).
  function seededRandom(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function seededShuffle(items, seedText) {
    const random = seededRandom(hashString(seedText));
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  // Today's date in US Central time (CST or CDT, whichever is in effect),
  // as "YYYY-MM-DD", so the Daily changes at Central midnight for everyone.
  const CENTRAL_DATE = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  function centralDateKey(date = new Date()) {
    return CENTRAL_DATE.format(date);
  }

  // Daily #1 is 2026-10-16; each Central-time day after that is one more.
  const DAILY_EPOCH = Date.UTC(2026, 9, 16);
  function dailyNumber(dateKey) {
    const [y, m, d] = dateKey.split("-").map(Number);
    return Math.round((Date.UTC(y, m - 1, d) - DAILY_EPOCH) / 86400000) + 1;
  }
  // The labels of a day's three Daily puzzles: Easy, Medium, then Hard --
  // or Evil on Sundays (by the Daily's own Central-time date).
  function isSunday(dateKey) {
    const [y, m, d] = dateKey.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 0;
  }
  function dailyLabels(dateKey) {
    return isSunday(dateKey) ? ["Easy", "Medium", "Evil"] : DIFFICULTY_LABELS;
  }

  function dateKeyForNumber(number) {
    return new Date(DAILY_EPOCH + (number - 1) * 86400000).toISOString().slice(0, 10);
  }

  window.T9_PUZZLES = {
    MIN_VALID_ANSWERS,
    MAX_VALID_ANSWERS,
    DIFFICULTY_LABELS,
    ALL_LABELS,
    isSunday,
    dailyLabels,
    WORD_RANK,
    difficultyPoints,
    difficultyForPuzzle,
    puzzleLabel,
    rarestRankOf,
    fitsPattern,
    isBlocked,
    buildPools,
    seededShuffle,
    centralDateKey,
    dailyNumber,
    dateKeyForNumber,
  };
})();
