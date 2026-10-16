(() => {
  const { wordToDigits, findSequentialGrouping, PRESS_COUNTS } = window.T9;
  const { DICTIONARY, WORDS_GOOD, WORDS_GOOD_RANK } = window.T9_WORDS;

  // DICTIONARY lets the game check whether a typed guess is a real word at
  // all. WORDS_GOOD is precomputed (see words.js) rather than classified
  // here at startup.
  const DICTIONARY_SET = new Set(DICTIONARY);
  const INAPPROPRIATE_SET = new Set(window.T9_INAPPROPRIATE);

  // Word -> frequency rank (1 = most common, higher = rarer), for gauging
  // hangman puzzle difficulty from its rarest valid answer.
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
  // 3. Number of valid answers (3-8, the MIN/MAX_VALID_ANSWERS range
  //    below): 3-4 is worth 1 point, 5-6 worth 2, 7-8 worth 3.
  //
  // Summing gives 3-9 points, classified 3-4 Easy / 5-6 Medium / 7-9 Hard.
  // Random word+blank draws skew heavily away from Easy (about 4/37/59%
  // Easy/Medium/Hard against the current 1,773-word pool), so
  // generatePuzzle() doesn't just accept a random draw: it is given a
  // target label (Easy or Medium at even odds in Practice; Easy, Medium,
  // then Hard in Daily) and retries until a draw actually lands on it.
  // Simulating that retry loop found a worst case of 812 tries, under half
  // its 2000-try cap.
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
  const DIFFICULTY_LABELS = ["Easy", "Medium", "Hard"];

  // One color per merged group in a solution, so a letter/digit's color
  // shows at a glance which final counting number it contributes to.
  const GROUP_COLORS = [
    "#7ea0ff",
    "#6ee0a0",
    "#ffcf6e",
    "#ff8a8a",
    "#c792ea",
    "#6edede",
    "#ff9f6e",
    "#e06ec0",
  ];

  function groupIndexForLetter(grouping, letterIndex) {
    return grouping.groups.findIndex((g) => g.indices.includes(letterIndex));
  }

  // ---------------------------------------------------------------------
  // Top-of-page rule examples
  // ---------------------------------------------------------------------

  // Renders a word as one column per letter (its letter colored by merged
  // group, with its press-count digit small and gray underneath). A
  // multi-letter group's digits get split parentheses around the first/last
  // letter of each contiguous run it occupies — e.g. PUNTS's merged N+T
  // shows "(2" / "1)" — so a wraparound merge shows as two separate "(x)"
  // pieces in their actual positions.
  function renderExampleWord(container, word, grouping) {
    container.innerHTML = "";
    const n = word.length;
    const marks = Array.from({ length: n }, () => ({ open: false, close: false }));
    let i = 0;
    while (i < n) {
      const gi = groupIndexForLetter(grouping, i);
      let j = i;
      while (j < n && groupIndexForLetter(grouping, j) === gi) j++;
      if (grouping.groups[gi].indices.length > 1) {
        marks[i].open = true;
        marks[j - 1].close = true;
      }
      i = j;
    }

    word.split("").forEach((letter, idx) => {
      const wrap = document.createElement("span");
      wrap.className = "word-letter";

      const letterSpan = document.createElement("span");
      letterSpan.className = "word-letter-text";
      letterSpan.textContent = letter.toUpperCase();
      letterSpan.style.color =
        GROUP_COLORS[groupIndexForLetter(grouping, idx) % GROUP_COLORS.length];
      wrap.appendChild(letterSpan);

      const numSpan = document.createElement("span");
      numSpan.className = "word-letter-num";
      let numText = String(PRESS_COUNTS[letter]);
      if (marks[idx].open) numText = "(" + numText;
      if (marks[idx].close) numText = numText + ")";
      numSpan.textContent = numText;
      wrap.appendChild(numSpan);

      container.appendChild(wrap);
    });
  }

  // PUNTS's own findSequentialGrouping result merges P+U (1+2=3) instead
  // of N+T — just as valid, but it wouldn't match the "2+1=3" explanation
  // text, so that grouping is specified directly rather than computed.
  const PUNTS_GROUPING = {
    groups: [
      { indices: [0], sum: 1 },
      { indices: [1], sum: 2 },
      { indices: [2, 3], sum: 3 },
      { indices: [4], sum: 4 },
    ],
    sums: [1, 2, 3, 4],
    direction: "increasing",
    wrapped: false,
  };

  [
    { id: "ex-this", word: "this" },
    { id: "ex-spur", word: "spur" },
    { id: "ex-punts", word: "punts", grouping: PUNTS_GROUPING },
    { id: "ex-song", word: "song" },
    { id: "ex-whiskies", word: "whiskies" },
  ].forEach(({ id, word, grouping }) => {
    const container = document.getElementById(id);
    if (!container) return;
    renderExampleWord(container, word, grouping || findSequentialGrouping(wordToDigits(word)));
  });

  // Colors the title's "TANGLE" letter-for-letter by its own merge
  // grouping, the same convention the examples above use.
  (function colorTitle() {
    const el = document.getElementById("title-tangle");
    if (!el) return;
    const displayText = el.textContent;
    const grouping = findSequentialGrouping(wordToDigits(displayText));
    el.innerHTML = "";
    displayText.split("").forEach((ch, i) => {
      const span = document.createElement("span");
      span.textContent = ch;
      span.style.color = GROUP_COLORS[groupIndexForLetter(grouping, i) % GROUP_COLORS.length];
      el.appendChild(span);
    });
  })();


  // ---------------------------------------------------------------------
  // Seeded randomness for the Daily puzzles
  // ---------------------------------------------------------------------

  // FNV-1a string hash -> 32-bit seed.
  function hashString(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // mulberry32: a small, fast PRNG that gives every player the same
  // sequence for the same seed (Math.random can't be seeded).
  function seededRandom(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Today's date in US Central time (CST or CDT, whichever is in effect),
  // as "YYYY-MM-DD", so the Daily changes at Central midnight for everyone.
  const CENTRAL_DATE = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  function centralDateKey() {
    return CENTRAL_DATE.format(new Date());
  }

  // Daily #1 is 2026-10-16; each Central-time day after that is one more.
  const DAILY_EPOCH = Date.UTC(2026, 9, 16);
  function dailyNumber(dateKey) {
    const [y, m, d] = dateKey.split("-").map(Number);
    return Math.round((Date.UTC(y, m - 1, d) - DAILY_EPOCH) / 86400000) + 1;
  }

  // ---------------------------------------------------------------------
  // The game (Practice and Daily modes share the phone)
  // ---------------------------------------------------------------------
  (() => {
    const screenBodyEl = document.querySelector(".phone-screen-body");
    const tilesEl = document.getElementById("hang-tiles");
    const tapKeypadEl = document.getElementById("keypad");
    const backspaceBtn = document.getElementById("tap-backspace");
    const enterBtn = document.getElementById("hang-enter");
    const giveUpBtn = document.getElementById("hang-give-up");
    const counterEl = document.getElementById("hang-counter");
    const foundListEl = document.getElementById("hang-found-list");
    const difficultyEl = document.getElementById("hang-difficulty");
    const missedEl = document.getElementById("hang-missed");
    const solvedEl = document.getElementById("hang-solved");
    const attemptsEl = document.getElementById("hang-attempts");
    const dailyLabelEl = document.getElementById("daily-label");
    const dailyResultsEl = document.getElementById("daily-results");
    const dailyRowsEl = document.getElementById("daily-rows");
    const modeToggleBtn = document.getElementById("mode-toggle");

    const MIN_VALID_ANSWERS = 3;
    const MAX_VALID_ANSWERS = 8;
    const DAILY_STORAGE_KEY = "t9tangle-daily";

    let mode = "practice";
    let solvedCount = 0;

    // A puzzle: the hidden word, which positions are blank, every valid
    // answer, plus the player's progress on it. Practice keeps one current
    // puzzle and Daily keeps its three, so switching modes never loses
    // either one's progress.
    //   { word, blanks: Set, answers: [], difficulty, found: Set,
    //     complete, attempts, message: { text, kind } | null }
    const practice = { puzzle: null, seen: new Set(), isFirst: true };
    let daily = null; // { dateKey, number, puzzles: [3], index } (index 3 = all done)

    // Tap-input state: every blank position in the puzzle, which one (if
    // any) is active, what's been filled so far, and the in-progress
    // multi-tap cycle (which key is held and how many times it's been
    // tapped) on the key that hasn't committed a letter yet. activeTarget
    // is a word-position index (not an index into activeBlankPositions),
    // since tapping a blank directly can jump it anywhere; it's null once
    // every blank is filled and nothing new has been tapped. fillHistory
    // is a stack of filled positions in commit order, so backspace always
    // undoes whatever was typed most recently, even if blanks were filled
    // out of left-to-right order.
    let activeBlankPositions = [];
    let filledMap = new Map();
    let fillHistory = [];
    let activeTarget = null;
    let pendingKey = null;
    let pendingCount = 0;
    let pendingTimer = null;

    function currentPuzzle() {
      if (mode === "practice") return practice.puzzle;
      return daily.index < daily.puzzles.length ? daily.puzzles[daily.index] : null;
    }

    // ---- Puzzle generation ----------------------------------------------

    function pickGoodWord() {
      const seen = practice.seen;
      let word;
      let tries = 0;
      do {
        word = WORDS_GOOD[Math.floor(Math.random() * WORDS_GOOD.length)];
        tries++;
      } while (seen.has(word) && tries < 20);
      seen.add(word);
      if (seen.size > WORDS_GOOD.length * 0.9) seen.clear();
      return word;
    }

    // At least 2 letters blanked, and at least 2 letters left revealed.
    function pickBlanks(word) {
      const n = word.length;
      const minBlanks = 2;
      const maxBlanks = n - 2;
      const count = minBlanks + Math.floor(Math.random() * (maxBlanks - minBlanks + 1));
      const positions = [...Array(n).keys()];
      for (let i = positions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [positions[i], positions[j]] = [positions[j], positions[i]];
      }
      return new Set(positions.slice(0, count));
    }

    // Every good, dictionary word of the same length that matches the
    // revealed letters — the full set the player is trying to find.
    function computeValidAnswers(word, blankSet) {
      return WORDS_GOOD.filter(
        (w) =>
          w.length === word.length &&
          [...w].every((ch, i) => blankSet.has(i) || ch === word[i])
      );
    }

    function rarestRankOf(answers) {
      return Math.max(...answers.map((w) => WORD_RANK.get(w)));
    }

    // Only offers puzzles with MIN_VALID_ANSWERS..MAX_VALID_ANSWERS valid
    // answers AND the requested difficulty, retrying draws until one lands
    // on it (see the difficulty notes at the top).
    function generatePuzzle(targetDifficulty) {
      let word;
      let blanks;
      let answers;
      let difficulty;
      let tries = 0;
      do {
        word = pickGoodWord();
        blanks = pickBlanks(word);
        answers = computeValidAnswers(word, blanks);
        difficulty =
          answers.length >= MIN_VALID_ANSWERS && answers.length <= MAX_VALID_ANSWERS
            ? difficultyForPuzzle(rarestRankOf(answers), blanks.size, answers.length)
            : null;
        tries++;
      } while (difficulty !== targetDifficulty && tries < 2000);
      return {
        word,
        blanks,
        answers,
        difficulty: difficultyForPuzzle(rarestRankOf(answers), blanks.size, answers.length),
        found: new Set(),
        complete: false,
        attempts: 0,
        message: null,
      };
    }

    // Every distinct puzzle the rules allow, grouped by difficulty, for the
    // Daily. A puzzle is identified by its pattern (revealed letters plus
    // blanks, e.g. "l__s"), since two hidden words with the same pattern
    // make the very same puzzle. Built once, on first opening Daily (about
    // 130k patterns, roughly a tenth of a second).
    let dailyPools = null;
    function buildDailyPools() {
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
        const label = difficultyForPuzzle(rarestRankOf(entry.answers), entry.blankCount, count);
        pools[label].push({ pattern, answers: entry.answers, difficulty: label });
      });
      return pools;
    }

    // Day n's puzzle of a difficulty is entry n of a fixed shuffled order
    // of that difficulty's pool, so no Daily puzzle repeats until the whole
    // pool has been used (only ~130 Easy puzzles exist, which random draws
    // were repeating within days); after that a fresh shuffle starts. The
    // date alone decides everything, so every player gets the same three.
    function dailyPuzzle(label, number) {
      const pool = dailyPools[label];
      const day = number - 1;
      const cycle = Math.floor(day / pool.length);
      const pos = day - cycle * pool.length;
      const random = seededRandom(hashString(`t9-tangle-daily:${label}:${cycle}`));
      const order = [...pool.keys()];
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      const { pattern, answers, difficulty } = pool[order[pos]];
      // The answer shown as "the" word (in the Daily results) is the most
      // common one.
      const word = answers.reduce((a, b) => (WORD_RANK.get(b) < WORD_RANK.get(a) ? b : a));
      return {
        word,
        blanks: new Set([...pattern].flatMap((ch, i) => (ch === "_" ? [i] : []))),
        answers,
        difficulty,
        found: new Set(),
        complete: false,
        attempts: 0,
        message: null,
      };
    }

    // Practice: Easy or Medium at even odds, except that the very first
    // puzzle a page load shows is always Easy.
    function newPracticePuzzle() {
      const target = practice.isFirst ? "Easy" : Math.random() < 0.5 ? "Easy" : "Medium";
      practice.isFirst = false;
      practice.puzzle = generatePuzzle(target);
    }

    // Daily: one Easy, one Medium and one Hard, in that order, set by
    // today's Central-time date.
    function loadDaily() {
      const dateKey = centralDateKey();
      if (daily && daily.dateKey === dateKey) return;
      if (!dailyPools) dailyPools = buildDailyPools();
      const number = dailyNumber(dateKey);
      daily = {
        dateKey,
        number,
        puzzles: DIFFICULTY_LABELS.map((label) => dailyPuzzle(label, number)),
        index: 0,
      };
      restoreDaily();
    }

    // Daily progress is kept in this browser so a reload doesn't reset it
    // (or let today's puzzles be replayed); it's ignored once the date
    // moves on. Storage can be unavailable (private windows, blocked site
    // data), in which case Daily still works, just without remembering.
    function saveDaily() {
      try {
        localStorage.setItem(
          DAILY_STORAGE_KEY,
          JSON.stringify({
            dateKey: daily.dateKey,
            index: daily.index,
            puzzles: daily.puzzles.map((p) => ({
              found: [...p.found],
              complete: p.complete,
              attempts: p.attempts,
            })),
          })
        );
      } catch (e) {
        // Not remembered; nothing else to do.
      }
    }

    function restoreDaily() {
      let saved = null;
      try {
        saved = JSON.parse(localStorage.getItem(DAILY_STORAGE_KEY));
      } catch (e) {
        saved = null;
      }
      if (!saved || saved.dateKey !== daily.dateKey || !Array.isArray(saved.puzzles)) return;
      daily.index = Math.min(Math.max(0, saved.index | 0), daily.puzzles.length);
      daily.puzzles.forEach((p, i) => {
        const s = saved.puzzles[i];
        if (!s) return;
        p.found = new Set((s.found || []).filter((w) => p.answers.includes(w)));
        p.complete = !!s.complete;
        p.attempts = s.attempts | 0;
        if (p.complete) p.message = endMessage(p);
      });
    }

    // The screen message a finished puzzle shows.
    function endMessage(p) {
      const missed = p.answers.filter((w) => !p.found.has(w));
      if (missed.length === 0) return { text: "Got 'em all!", kind: "success" };
      return { text: "Missed: " + missed.map((w) => w.toUpperCase()).join(", "), kind: "missed" };
    }

    // ---- Rendering ------------------------------------------------------

    // Renders each tile's letter (revealed, already tap-filled, or a dimmed
    // preview of the in-progress multi-tap cycle) plus the small press-count
    // digit underneath it, and boxes whichever blank is next to fill.
    function renderTiles() {
      const p = currentPuzzle();
      tilesEl.innerHTML = "";
      if (!p) return;
      p.word.split("").forEach((letter, i) => {
        const isBlank = p.blanks.has(i);
        let shown = null;
        let isPreview = false;
        if (!isBlank) {
          shown = letter;
        } else if (filledMap.has(i)) {
          shown = filledMap.get(i);
        } else if (i === activeTarget && pendingKey) {
          shown = groupLetterAt(pendingKey, pendingCount);
          isPreview = true;
        }
        const tile = makeTile(shown, isBlank, isPreview);
        if (isBlank) tile.addEventListener("click", () => handleTileClick(i));
        if (i === activeTarget) tile.classList.add("active");
        tilesEl.appendChild(tile);
      });
    }

    function makeTile(letter, isBlank, isPreview) {
      const tile = document.createElement("div");
      tile.className = "hang-tile" + (isBlank ? " blank" : "");
      if (letter) {
        const letterSpan = document.createElement("span");
        letterSpan.className = "hang-letter" + (isPreview ? " pending-letter" : "");
        letterSpan.textContent = letter.toUpperCase();
        tile.appendChild(letterSpan);

        const numSpan = document.createElement("span");
        numSpan.className = "hang-pressnum";
        numSpan.textContent = String(PRESS_COUNTS[letter]);
        tile.appendChild(numSpan);
      }
      return tile;
    }

    // Highlights which letter a mid-cycle key is currently on, dimming the
    // rest of that key's letters; every other key shows its letters plainly.
    function renderKeypadHighlight() {
      tapKeypadEl.querySelectorAll(".tap-key[data-letters]").forEach((btn) => {
        const group = btn.dataset.letters;
        const isPending = pendingKey === group;
        btn.classList.toggle("pending", isPending);
        btn.querySelectorAll(".letter-opt").forEach((span, idx) => {
          span.classList.toggle(
            "active-letter",
            isPending && idx === (pendingCount - 1) % group.length
          );
        });
      });
    }

    function render() {
      renderTiles();
      renderKeypadHighlight();
    }

    function setKeypadDisabled(disabled) {
      tapKeypadEl.querySelectorAll("button").forEach((b) => {
        b.disabled = disabled;
      });
      // Lets the decorative keys (blank, *, nav pad) grey out too.
      tapKeypadEl.classList.toggle("keypad-off", disabled);
    }

    function renderScreenMessage(message) {
      missedEl.textContent = message ? message.text : "";
      missedEl.className = message ? message.kind : "";
    }

    // The three Daily answers, top to bottom, tiled like the puzzles.
    function renderDailyResults() {
      dailyRowsEl.innerHTML = "";
      daily.puzzles.forEach((p) => {
        const row = document.createElement("div");
        row.className = "hang-tiles";
        p.word.split("").forEach((letter, i) => row.appendChild(makeTile(letter, p.blanks.has(i), false)));
        dailyRowsEl.appendChild(row);
      });
    }

    // Redraws everything about the current puzzle (or the Daily results),
    // e.g. after switching modes or moving on to another puzzle.
    function renderAll() {
      dailyLabelEl.hidden = mode !== "daily";
      if (mode === "daily") dailyLabelEl.textContent = `Daily #${daily.number}`;

      const p = currentPuzzle();
      const showResults = !p;
      screenBodyEl.classList.toggle("show-results", showResults);
      dailyResultsEl.hidden = !showResults;

      giveUpBtn.textContent = "Give up";
      giveUpBtn.classList.remove("next-key");

      if (showResults) {
        renderDailyResults();
        renderTiles();
        setKeypadDisabled(true);
        renderKeypadHighlight();
        return;
      }

      difficultyEl.textContent = p.difficulty;
      difficultyEl.className = "difficulty-" + p.difficulty.toLowerCase();
      updateCounter();
      renderFoundList();
      renderScreenMessage(p.message);
      attemptsEl.textContent = String(p.attempts);

      setKeypadDisabled(p.complete);
      if (p.complete) {
        // The whole keypad switches off except the Give up key, which turns
        // into the way on to the next puzzle.
        giveUpBtn.disabled = false;
        giveUpBtn.textContent =
          mode === "practice" ? "New puzzle" : daily.index < daily.puzzles.length - 1 ? "Next puzzle" : "See results";
        giveUpBtn.classList.add("next-key");
      }
      render();
    }

    // ---- Tap input ------------------------------------------------------

    function groupLetterAt(group, count) {
      return group[(count - 1) % group.length];
    }

    function clearPendingTimer() {
      if (pendingTimer) {
        clearTimeout(pendingTimer);
        pendingTimer = null;
      }
    }

    function isPlayable() {
      const p = currentPuzzle();
      return p && !p.complete;
    }

    // The blank to land on after filling `pos`: the next still-empty blank
    // to its right, or — if there is none — the leftmost still-empty
    // blank (wrapping around), or null if every blank is now filled.
    function nextTargetAfter(pos) {
      const idx = activeBlankPositions.indexOf(pos);
      for (let i = idx + 1; i < activeBlankPositions.length; i++) {
        if (!filledMap.has(activeBlankPositions[i])) return activeBlankPositions[i];
      }
      for (let i = 0; i < activeBlankPositions.length; i++) {
        if (!filledMap.has(activeBlankPositions[i])) return activeBlankPositions[i];
      }
      return null;
    }

    // Commits whichever letter the pending key's cycle is currently on
    // into the active blank (called after a 1s pause, when a different
    // key is tapped, or when the player taps a different blank or Enter),
    // then advances to the next blank per nextTargetAfter. Submission is
    // never automatic — the player taps Send when ready.
    function commitPending() {
      clearPendingTimer();
      if (!pendingKey || !isPlayable() || activeTarget === null) {
        pendingKey = null;
        pendingCount = 0;
        return;
      }
      const letter = groupLetterAt(pendingKey, pendingCount);
      const pos = activeTarget;
      filledMap.set(pos, letter);
      fillHistory.push(pos);
      pendingKey = null;
      pendingCount = 0;
      activeTarget = nextTargetAfter(pos);
      render();
    }

    function handleKeyClick(group) {
      if (!isPlayable() || activeTarget === null) return;

      if (pendingKey && pendingKey !== group) {
        commitPending();
      }
      if (!isPlayable() || activeTarget === null) return;

      pendingCount = pendingKey === group ? pendingCount + 1 : 1;
      pendingKey = group;
      clearPendingTimer();
      render();
      pendingTimer = setTimeout(commitPending, 1000);
    }

    // Jumping to a blank commits whatever was mid-cycle first (same as
    // switching to a different letter key), so a tap elsewhere never
    // silently drops an in-progress letter.
    function handleTileClick(pos) {
      const p = currentPuzzle();
      if (!isPlayable() || !p.blanks.has(pos)) return;
      if (pendingKey) commitPending();
      activeTarget = pos;
      render();
    }

    // Always undoes whatever was filled most recently (by commit order,
    // not position), so it stays correct even after jumping around with
    // tile clicks.
    function handleBackspace() {
      if (!isPlayable()) return;
      if (pendingKey) {
        // Cancel the in-progress cycle rather than committing then
        // immediately deleting it.
        clearPendingTimer();
        pendingKey = null;
        pendingCount = 0;
        render();
        return;
      }
      if (fillHistory.length === 0) return;
      const pos = fillHistory.pop();
      filledMap.delete(pos);
      activeTarget = pos;
      render();
    }

    function handleEnter() {
      if (!isPlayable()) return;
      if (pendingKey) commitPending();

      const allFilled = activeBlankPositions.every((pos) => filledMap.has(pos));
      if (!allFilled) {
        showScreenMessage("Fill in all blanks", "note");
        return;
      }
      submitGuess();
    }

    function assembleGuess() {
      const p = currentPuzzle();
      return p.word
        .split("")
        .map((ch, i) => (p.blanks.has(i) ? filledMap.get(i) : ch))
        .join("");
    }

    // Clears any half-typed guess and points input at the first blank of
    // whatever puzzle is current.
    function resetGuessInProgress() {
      const p = currentPuzzle();
      activeBlankPositions = p ? [...p.blanks].sort((a, b) => a - b) : [];
      filledMap = new Map();
      fillHistory = [];
      activeTarget = activeBlankPositions.length > 0 ? activeBlankPositions[0] : null;
      pendingKey = null;
      pendingCount = 0;
      clearPendingTimer();
    }

    // ---- Guessing and finishing puzzles -------------------------------

    function updateCounter() {
      const p = currentPuzzle();
      counterEl.textContent = `${p.found.size} / ${p.answers.length} found`;
    }

    function renderFoundList() {
      const p = currentPuzzle();
      foundListEl.textContent = [...p.found].map((w) => w.toUpperCase()).join(", ");
    }

    // The screen line under the found words is the game's only message
    // area: "Incorrect", "Already found" or "Fill in all blanks" during
    // play, the missed answers after giving up, or "Got 'em all!".
    function showScreenMessage(text, kind) {
      const p = currentPuzzle();
      p.message = { text, kind };
      renderScreenMessage(p.message);
    }

    // Every blank is filled by construction (tap input can't produce a
    // wrong-length guess or one that disagrees with a revealed letter), so
    // there's nothing to validate before checking realness/goodness below.
    function submitGuess() {
      const p = currentPuzzle();
      const guess = assembleGuess();
      resetGuessInProgress();
      render();

      p.attempts++;
      attemptsEl.textContent = String(p.attempts);
      if (mode === "daily") saveDaily();

      if (INAPPROPRIATE_SET.has(guess)) {
        showScreenMessage("See me after class", "scold");
        return;
      }

      const grouping = DICTIONARY_SET.has(guess)
        ? findSequentialGrouping(wordToDigits(guess))
        : null;
      if (!grouping) {
        showScreenMessage("Incorrect", "incorrect");
        return;
      }

      if (p.found.has(guess)) {
        showScreenMessage("Already found", "note");
        return;
      }

      p.found.add(guess);
      p.message = null;
      renderScreenMessage(null);
      updateCounter();
      renderFoundList();

      if (p.found.size === p.answers.length) {
        winPuzzle();
      } else if (mode === "daily") {
        saveDaily();
      }
    }

    function finishPuzzle() {
      const p = currentPuzzle();
      p.complete = true;
      p.message = endMessage(p);
      if (mode === "daily") saveDaily();
      resetGuessInProgress();
      renderAll();
    }

    function winPuzzle() {
      solvedCount++;
      solvedEl.textContent = String(solvedCount);
      finishPuzzle();
      window.T9Celebrate.celebrate(document.querySelector(".phone"));
    }

    // Lists on the phone's screen only the answers the player didn't find.
    function giveUp() {
      if (!isPlayable()) return;
      finishPuzzle();
    }

    // TESTING ONLY: the 0 key wins the current puzzle on the spot (every
    // answer counted as found), to try out the win celebration quickly.
    function debugWin() {
      if (!isPlayable()) return;
      const p = currentPuzzle();
      p.found = new Set(p.answers);
      winPuzzle();
    }

    // Once a puzzle is over, the Give up key moves on: a fresh puzzle in
    // Practice, the next of the three in Daily, then the Daily results.
    function nextPuzzle() {
      if (mode === "practice") {
        newPracticePuzzle();
      } else {
        daily.index++;
        saveDaily();
      }
      resetGuessInProgress();
      renderAll();
    }

    // ---- Mode toggle ----------------------------------------------------

    function setMode(newMode) {
      if (newMode === mode) return;
      mode = newMode;
      if (mode === "daily") loadDaily();
      modeToggleBtn.setAttribute("aria-checked", String(mode === "daily"));
      document.querySelectorAll(".mode-label").forEach((el) => {
        el.classList.toggle("active", el.dataset.mode === mode);
      });
      resetGuessInProgress();
      renderAll();
    }

    tapKeypadEl.querySelectorAll(".tap-key[data-letters]").forEach((btn) => {
      btn.addEventListener("click", () => handleKeyClick(btn.dataset.letters));
    });
    backspaceBtn.addEventListener("click", handleBackspace);
    enterBtn.addEventListener("click", handleEnter);
    giveUpBtn.addEventListener("click", () => {
      const p = currentPuzzle();
      if (!p) return;
      if (p.complete) nextPuzzle();
      else giveUp();
    });
    document.getElementById("debug-win").addEventListener("click", debugWin);
    modeToggleBtn.addEventListener("click", () => setMode(mode === "practice" ? "daily" : "practice"));
    document.querySelectorAll(".mode-label").forEach((el) => {
      el.addEventListener("click", () => setMode(el.dataset.mode));
    });

    newPracticePuzzle();
    resetGuessInProgress();
    renderAll();
  })();
})();
