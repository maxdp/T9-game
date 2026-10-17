// Puzzle building blocks shared by the game (js/app.js) and the Daily
// schedule builder (tools/build-daily.js), so the two always agree on what
// a puzzle is, how hard it is, and which ones are off limits.
//
// A puzzle is a pattern: the hidden word with its blanked letters as "_"
// (e.g. "l__s"). Its answers are every good word that fits the pattern;
// two hidden words with the same pattern make the very same puzzle.
(() => {
  const { WORDS_GOOD, WORDS_GOOD_RANK } = window.T9_WORDS;

  const MIN_VALID_ANSWERS = 3;
  const MAX_VALID_ANSWERS = 8;
  const DIFFICULTY_LABELS = ["Easy", "Medium", "Hard"];

  // Word -> frequency rank (1 = most common, higher = rarer).
  const WORD_RANK = new Map(WORDS_GOOD.map((w, i) => [w, WORDS_GOOD_RANK[i]]));

  // Difficulty combines three metrics into a 3-9 point score:
  //
  // 1. Rarity of the rarest valid answer — WORDS_GOOD split into rarity
  //    quartiles by rank (cutoffs are the actual 25th/50th/75th percentile
  //    rank values of the current WORDS_GOOD pool, recomputed here rather
  //    than hardcoded so they stay correct whenever the word list
  //    changes); the bottom (most-common) quartile is worth 1 point, the
  //    2nd 2, the 3rd and 4th (rarest half) 3.
  // 2. Number of blanks (2-6): 2 is worth 1 point, 3 worth 2, 4-6 worth 3.
  // 3. Number of valid answers (3-8): 3-4 is worth 1 point, 5-6 worth 2,
  //    7-8 worth 3.
  //
  // Summing gives 3-9 points, classified 3-4 Easy / 5-6 Medium / 7-9 Hard.
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
  function difficultyForPuzzle(rarestRank, blankCount, answerCount) {
    const points =
      rarityPoints(rarestRank) + blankPoints(blankCount) + answerPoints(answerCount);
    if (points <= 4) return "Easy";
    if (points <= 6) return "Medium";
    return "Hard";
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
    const pools = { Easy: [], Medium: [], Hard: [] };
    byPattern.forEach((entry, pattern) => {
      const count = entry.answers.length;
      if (count < MIN_VALID_ANSWERS || count > MAX_VALID_ANSWERS) return;
      if (isBlocked(pattern)) return;
      const label = difficultyForPuzzle(rarestRankOf(entry.answers), entry.blankCount, count);
      pools[label].push({ pattern, answers: entry.answers, difficulty: label });
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
  function dateKeyForNumber(number) {
    return new Date(DAILY_EPOCH + (number - 1) * 86400000).toISOString().slice(0, 10);
  }

  window.T9_PUZZLES = {
    MIN_VALID_ANSWERS,
    MAX_VALID_ANSWERS,
    DIFFICULTY_LABELS,
    WORD_RANK,
    difficultyForPuzzle,
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
