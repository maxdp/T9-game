(() => {
  const { wordToDigits, findSequentialGrouping, PRESS_COUNTS } = window.T9;
  const { DICTIONARY, WORDS_GOOD } = window.T9_WORDS;
  const {
    difficultyForPuzzle,
    puzzleLabel,
    buildPools,
    seededShuffle,
    centralDateKey,
    dailyNumber,
    dateKeyForNumber,
    dailyLabels,
    isSunday,
    fitsPattern,
    rarityPercent,
  } = window.T9_PUZZLES;

  // DICTIONARY lets the game check whether a typed guess is a real word at
  // all. WORDS_GOOD is precomputed (see words.js) rather than classified
  // here at startup.
  const DICTIONARY_SET = new Set(DICTIONARY);
  const INAPPROPRIATE_SET = new Set(window.T9_INAPPROPRIATE);

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

  // Where a word's merged groups get parentheses: around the first/last
  // letter of each contiguous run of a multi-letter group, e.g. MEANS's
  // merged A+N gives "(1" / "2)". A wraparound merge shows as two separate
  // "(x)" pieces in their actual positions.
  function groupMarks(word, grouping) {
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
    return marks;
  }

  // A word's press counts with its merges marked, e.g. "1 2 (1 2) 4".
  function sequenceText(word) {
    const marks = groupMarks(word, findSequentialGrouping(wordToDigits(word)));
    return word
      .split("")
      .map((letter, i) => (marks[i].open ? "(" : "") + PRESS_COUNTS[letter] + (marks[i].close ? ")" : ""))
      .join(" ");
  }

  // ---------------------------------------------------------------------
  // Rule examples
  // ---------------------------------------------------------------------

  // Renders a word as one column per letter (its letter colored by merged
  // group, with its press-count digit small and gray underneath), merged
  // groups' digits in parentheses (see groupMarks).
  function renderExampleWord(container, word, grouping) {
    container.innerHTML = "";
    const marks = groupMarks(word, grouping);

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

  [
    { id: "ex-this", word: "this" },
    { id: "ex-host", word: "host" },
    { id: "ex-means", word: "means" },
    { id: "ex-song", word: "song" },
    { id: "ex-jersey", word: "jersey" },
  ].forEach(({ id, word }) => {
    const container = document.getElementById(id);
    if (!container) return;
    renderExampleWord(container, word, findSequentialGrouping(wordToDigits(word)));
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
    const modeLabelEl = document.getElementById("screen-mode-label");
    const difficultyTaglineEl = document.getElementById("difficulty-tagline");
    const dailyResultsEl = document.getElementById("daily-results");
    const dailyRowsEl = document.getElementById("daily-rows");
    const modeSelectEl = document.getElementById("mode-select");
    const tutorialRuleEl = document.getElementById("tutorial-rule");
    const tutorialPrevBtn = document.getElementById("tutorial-prev");
    const tutorialNextBtn = document.getElementById("tutorial-next");

    const DAILY_STORAGE_KEY = "t9tangle-daily";
    const PRACTICE_STORAGE_KEY = "t9tangle-practice-solved";
    const DAILY_CHOSEN_KEY = "t9tangle-daily-chosen";
    const TUTORIAL_SEEN_KEY = "t9tangle-tutorial-seen";
    const MODES = ["tutorial", "daily", "practice"];

    let mode = "practice";

    // A puzzle: the hidden word, which positions are blank, every valid
    // answer, plus the player's progress on it. Practice keeps one current
    // puzzle and Daily keeps its three, so switching modes never loses
    // either one's progress.
    //   { word, blanks: Set, answers: [], difficulty, found: Set,
    //     complete, attempts, message: { text, kind } | null }
    const practice = { puzzle: null, seen: new Set(), isFirst: true };
    let daily = null; // { dateKey, number, puzzles: [3], index } (index 3 = all done)

    // Tutorial: one-blank puzzles that each teach a rule (shown on the
    // screen in place of the difficulty badge), each with exactly one
    // answer and, mostly, tempting wrong ones (THUS, HOSE, MEALS, LONG...).
    // After the last lesson comes one more screen, the send-off, with the
    // Start key that moves on to Daily.
    const TUTORIAL_LESSONS = [
      {
        pattern: "th_s",
        rule: "Each letter's value is its number of presses on a T9 keypad (below)\nThe goal is to find words that make a number sequence like 1 2 3 4",
      },
      { pattern: "hos_", rule: "The sequence can wrap around" },
      { pattern: "mea_s", rule: "Numbers can add together such as 1+2=3" },
      { pattern: "_ong", rule: "Backwards sequences are allowed" },
      { pattern: "jerse_", rule: "The sequence length can be 4 or longer (here 2+3=5)" },
    ];
    const TUTORIAL_DONE_TEXT = "Combine these rules and find all valid words!\nGood luck 🍀";
    let tutorial = null; // { puzzles, index } (index past the last lesson = the send-off)
    function tutorialPuzzle(lesson) {
      const answers = WORDS_GOOD.filter((w) => fitsPattern(lesson.pattern, w));
      return Object.assign(puzzleFromPattern(lesson.pattern, answers, "Tutorial"), { rule: lesson.rule });
    }
    function newTutorial() {
      tutorial = { index: 0, puzzles: TUTORIAL_LESSONS.map(tutorialPuzzle) };
    }
    function tutorialFinished() {
      return tutorial.index >= TUTORIAL_LESSONS.length;
    }

    // Tap-input state: every blank position in the puzzle, which one (if
    // any) is active, what's been filled so far, and the in-progress
    // multi-tap cycle (which key is held and how many times it's been
    // tapped) on the key that hasn't committed a letter yet. activeTarget
    // is a word-position index (not an index into activeBlankPositions),
    // since tapping a blank directly can jump it anywhere; it's null once
    // every blank is filled and nothing new has been tapped.
    let activeBlankPositions = [];
    let filledMap = new Map();
    let activeTarget = null;
    let pendingKey = null;
    let pendingCount = 0;
    let pendingTimer = null;

    function currentPuzzle() {
      if (mode === "practice") return practice.puzzle;
      if (mode === "tutorial") return tutorialFinished() ? null : tutorial.puzzles[tutorial.index];
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

    // Only offers puzzles the game allows (puzzleLabel in js/puzzles.js:
    // 2-8 answers, not blocked, 2-answer ones only if Easy) with the
    // requested difficulty, retrying draws until one lands. Only about 6%
    // of random word+blank draws come out Easy (6% Medium), so a target is
    // needed; simulating this loop 3,000 times per target took about 16
    // tries on average for Easy (worst 134) and 18 for Medium (worst 120),
    // far under the 2000-try cap.
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
        // null for any puzzle the game doesn't allow (see puzzleLabel).
        difficulty = puzzleLabel(patternOf(word, blanks), answers, blanks.size);
        tries++;
      } while (difficulty !== targetDifficulty && tries < 2000);
      return {
        word,
        blanks,
        answers,
        difficulty: difficultyForPuzzle(answers, blanks.size),
        found: new Set(),
        complete: false,
        attempts: 0,
        message: null,
      };
    }

    function patternOf(word, blanks) {
      return [...word].map((ch, i) => (blanks.has(i) ? "_" : ch)).join("");
    }

    function puzzleFromPattern(pattern, answers, difficulty) {
      return {
        word: answers[0],
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

    // Daily: one Easy, one Medium and one Hard (Evil on Sundays), in that
    // order, read from the fixed schedule in js/daily.js (built by
    // tools/build-daily.js), so every player everywhere gets the same three
    // puzzles each Central-time day -- each scheduled puzzle carries its own
    // answer list, so not even a word-list update can change it.
    function scheduledDay(number) {
      const days = (window.T9_DAILY && window.T9_DAILY.days) || [];
      const day = days[number - 1];
      if (!day) return null;
      const labels = dailyLabels(dateKeyForNumber(number));
      return day.map((entry, i) => {
        const [pattern, ...answers] = entry.split(" ");
        return puzzleFromPattern(pattern, answers, labels[i]);
      });
    }

    // Only if a date ever runs past the end of the schedule: day n takes
    // entry n of a seeded shuffle of each difficulty's pool (the same for
    // everyone on the same word list).
    let fallbackPools = null;
    function fallbackDay(number) {
      if (!fallbackPools) fallbackPools = buildPools();
      return dailyLabels(dateKeyForNumber(number)).map((label) => {
        const pool = fallbackPools[label];
        const day = number - 1;
        const cycle = Math.floor(day / pool.length);
        const p = seededShuffle(pool, `t9-tangle-daily:${label}:${cycle}`)[day - cycle * pool.length];
        return puzzleFromPattern(p.pattern, p.answers, label);
      });
    }

    // TESTING ONLY: with the Sunday switch on (testing page), Daily shows
    // the coming Sunday's puzzles (today's, if today is Sunday) instead of
    // today's, as a throwaway preview that never saves or touches the real
    // Daily progress.
    let sundayPreview = false;
    let realDaily = null; // the real Daily, set aside while previewing
    function upcomingSundayNumber() {
      let number = dailyNumber(centralDateKey());
      while (!isSunday(dateKeyForNumber(number))) number++;
      return number;
    }

    function loadDaily() {
      const dateKey = centralDateKey();
      const preview = sundayPreview;
      if (daily && daily.dateKey === dateKey && !!daily.preview === preview) return;
      const number = preview ? upcomingSundayNumber() : dailyNumber(dateKey);
      daily = {
        dateKey,
        number,
        preview,
        puzzles: scheduledDay(number) || fallbackDay(number),
        index: 0,
      };
      if (!preview) restoreDaily();
    }

    // Progress on today's Daily is kept in this browser, so after a reload
    // Daily comes back to the scores once all three are done, or to the
    // puzzle the player was on. It's ignored once the date moves on (or if
    // it doesn't match today's puzzles). Storage can be unavailable (private
    // windows, blocked site data), in which case Daily still works, just
    // without remembering.
    function saveDaily() {
      if (daily.preview) return;
      try {
        localStorage.setItem(
          DAILY_STORAGE_KEY,
          JSON.stringify({
            version: 3,
            dateKey: daily.dateKey,
            index: daily.index,
            puzzles: daily.puzzles.map((p) => ({
              pattern: patternOf(p.word, p.blanks),
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

    // Finished puzzles come back exactly as they ended; the one that was
    // still in progress comes back fresh (no answers found yet).
    function restoreDaily() {
      let saved = null;
      try {
        saved = JSON.parse(localStorage.getItem(DAILY_STORAGE_KEY));
      } catch (e) {
        saved = null;
      }
      const matches =
        saved &&
        saved.version === 3 &&
        saved.dateKey === daily.dateKey &&
        Array.isArray(saved.puzzles) &&
        saved.puzzles.length === daily.puzzles.length &&
        saved.puzzles.every((s, i) => s && s.pattern === patternOf(daily.puzzles[i].word, daily.puzzles[i].blanks));
      if (!matches) return;
      daily.index = Math.min(Math.max(0, saved.index | 0), daily.puzzles.length);
      daily.puzzles.forEach((p, i) => {
        const s = saved.puzzles[i];
        if (!s.complete) return;
        p.complete = true;
        p.found = new Set((s.found || []).filter((w) => p.answers.includes(w)));
        p.attempts = s.attempts | 0;
        p.message = endMessage(p);
      });
    }

    // The screen message a finished puzzle shows. A Tutorial lesson adds
    // a line showing why its answer works, e.g. "2 3 4 1 is a sequence"
    // (green when solved, red after giving up).
    function endMessage(p) {
      const missed = p.answers.filter((w) => !p.found.has(w));
      const message =
        missed.length === 0
          ? { text: p.difficulty === "Tutorial" ? "Got it!" : "Got 'em all!", kind: "success" }
          : { text: "Missed: " + missed.map((w) => w.toUpperCase()).join(", "), kind: "missed" };
      if (p.difficulty === "Tutorial") message.detail = `${sequenceText(p.answers[0])} is a sequence`;
      return message;
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
        } else if (mode === "tutorial" && p.found.has(p.word)) {
          // A solved lesson keeps its answer spelled out in the tiles (the
          // Tutorial has no found-words list).
          shown = letter;
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
      if (message && message.detail) {
        const detail = document.createElement("div");
        detail.textContent = message.detail;
        missedEl.appendChild(detail);
      }
    }

    // How a difficulty label reads on screen; the Sunday-only Evil gets
    // devils.
    function difficultyText(label) {
      return label === "Evil" ? "😈 Evil 😈" : label;
    }

    // The player's score on each Daily puzzle, e.g. "4/4 Easy".
    function renderDailyResults() {
      dailyRowsEl.innerHTML = "";
      daily.puzzles.forEach((p) => {
        const row = document.createElement("div");
        row.textContent = `${p.found.size}/${p.answers.length} `;
        const label = document.createElement("span");
        label.className = "difficulty-" + p.difficulty.toLowerCase();
        label.textContent = difficultyText(p.difficulty);
        row.appendChild(label);
        dailyRowsEl.appendChild(row);
      });
    }

    // Redraws everything about the current puzzle (or the Daily results),
    // e.g. after switching modes or moving on to another puzzle.
    function renderAll() {
      // In Practice the header also counts today's solved Practice puzzles
      // ("Practice (X solved)").
      // In Daily, "(n/3)" counts up through the Easy, Medium and Hard puzzles
      // so a newcomer can see there's more than one; the results screen
      // after all three shows just "Daily #X".
      // In Tutorial it counts through the lessons and the send-off after
      // them (its last screen).
      if (mode === "practice") {
        modeLabelEl.textContent = `Practice (${practiceSolvedToday()} solved)`;
      } else if (mode === "tutorial") {
        modeLabelEl.textContent = `Tutorial (${tutorial.index + 1}/${TUTORIAL_LESSONS.length + 1})`;
      } else {
        const total = daily.puzzles.length;
        modeLabelEl.textContent =
          `Daily #${daily.number}` + (daily.index < total ? ` (${daily.index + 1}/${total})` : "");
      }

      const p = currentPuzzle();
      const inTutorial = mode === "tutorial";
      const tutorialDone = inTutorial && tutorialFinished();
      const showResults = !p && !inTutorial;
      screenBodyEl.classList.toggle("tutorial-mode", inTutorial);
      screenBodyEl.parentElement.classList.toggle("tutorial-mode", inTutorial);
      screenBodyEl.classList.toggle("tutorial-done", tutorialDone);
      tutorialRuleEl.hidden = !inTutorial;
      if (inTutorial) {
        // Each line of the text is its own block, so they can be spaced
        // apart.
        tutorialRuleEl.replaceChildren(
          ...(tutorialDone ? TUTORIAL_DONE_TEXT : p.rule).split("\n").map((line) => {
            const el = document.createElement("div");
            el.textContent = line;
            return el;
          })
        );
      }
      // The header's arrows step through the lessons (and the send-off).
      tutorialPrevBtn.hidden = tutorialNextBtn.hidden = !inTutorial;
      if (inTutorial) {
        tutorialPrevBtn.disabled = tutorial.index === 0;
        tutorialNextBtn.disabled = tutorialDone;
      }
      screenBodyEl.classList.toggle("show-results", showResults);
      dailyResultsEl.hidden = !showResults;

      giveUpBtn.textContent = "Give up";
      giveUpBtn.classList.remove("next-key");

      if (tutorialDone) {
        // The send-off: just its text and the Start key.
        renderTiles();
        setKeypadDisabled(true);
        giveUpBtn.disabled = false;
        giveUpBtn.textContent = "Start";
        giveUpBtn.classList.add("next-key");
        renderKeypadHighlight();
        return;
      }

      if (showResults) {
        renderDailyResults();
        renderTiles();
        setKeypadDisabled(true);
        renderKeypadHighlight();
        return;
      }

      difficultyEl.textContent = difficultyText(p.difficulty);
      difficultyEl.className = "difficulty-" + p.difficulty.toLowerCase();
      difficultyTaglineEl.hidden = p.difficulty !== "Evil";
      updateCounter();
      renderFoundList();
      renderScreenMessage(p.message);

      setKeypadDisabled(p.complete);
      if (p.complete) {
        // The whole keypad switches off except the Give up key, which turns
        // into the way on to the next puzzle.
        giveUpBtn.disabled = false;
        if (mode === "practice") giveUpBtn.textContent = "New puzzle";
        else if (mode === "tutorial") giveUpBtn.textContent = "Next puzzle";
        else giveUpBtn.textContent = daily.index < daily.puzzles.length - 1 ? "Next puzzle" : "See results";
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
    // blank (wrapping around). Once every blank is filled, the next blank
    // to the right of `pos` (already filled) becomes active, so a run of
    // letters can be retyped in a row; after the last blank, none is.
    function nextTargetAfter(pos) {
      const idx = activeBlankPositions.indexOf(pos);
      for (let i = idx + 1; i < activeBlankPositions.length; i++) {
        if (!filledMap.has(activeBlankPositions[i])) return activeBlankPositions[i];
      }
      for (let i = 0; i < activeBlankPositions.length; i++) {
        if (!filledMap.has(activeBlankPositions[i])) return activeBlankPositions[i];
      }
      return idx + 1 < activeBlankPositions.length ? activeBlankPositions[idx + 1] : null;
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

      // Starting to type over a blank that already holds a letter clears
      // that letter right away, so the blank shows only the new letter
      // being cycled in.
      if (pendingKey !== group) filledMap.delete(activeTarget);
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

    // Deletes the letter in the active blank if it has one; otherwise the
    // nearest filled blank to its left (or the last filled blank, when
    // every blank is filled and none is active), which then becomes the
    // active blank -- like backspacing in a text field.
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
      let pos = null;
      if (activeTarget !== null && filledMap.has(activeTarget)) {
        pos = activeTarget;
      } else {
        const limit = activeTarget === null ? Infinity : activeTarget;
        for (const p of activeBlankPositions) {
          if (p < limit && filledMap.has(p)) pos = p;
        }
      }
      if (pos === null) return;
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
      // No blank is boxed once the puzzle is over.
      activeTarget = p && !p.complete && activeBlankPositions.length > 0 ? activeBlankPositions[0] : null;
      pendingKey = null;
      pendingCount = 0;
      clearPendingTimer();
    }

    // ---- Guessing and finishing puzzles -------------------------------

    // Also shows how rare the puzzle's rarest answer is.
    function updateCounter() {
      const p = currentPuzzle();
      counterEl.textContent = `${p.found.size} / ${p.answers.length} found, ${rarityPercent(p.answers)}% rarity`;
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
      if (mode === "daily") saveDaily();

      if (INAPPROPRIATE_SET.has(guess)) {
        showScreenMessage("See me after class", "scold");
        return;
      }

      const grouping = DICTIONARY_SET.has(guess)
        ? findSequentialGrouping(wordToDigits(guess))
        : null;
      if (!grouping) {
        // In the tutorial, a wrong guess says why: it isn't a word at all,
        // or (a real word) its numbers, e.g. "LONG = 3 3 2 1".
        let text = "Incorrect";
        if (mode === "tutorial") {
          text += DICTIONARY_SET.has(guess)
            ? `: ${guess.toUpperCase()} = ${wordToDigits(guess).join(" ")}`
            : `: ${guess.toUpperCase()} is not a word`;
        }
        showScreenMessage(text, "incorrect");
        window.T9Celebrate.buzzer();
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
      } else {
        // The last answer gets the full celebration instead.
        window.T9Celebrate.chime();
        if (mode === "daily") saveDaily();
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

    // Practice puzzles solved today (Central time), kept in this browser so
    // the header's count survives a reload and starts over at Central
    // midnight. Without storage it still counts, just for this page load.
    let practiceSolvedFallback = { dateKey: null, count: 0 };
    function practiceSolvedToday() {
      const dateKey = centralDateKey();
      let saved = practiceSolvedFallback;
      try {
        saved = JSON.parse(localStorage.getItem(PRACTICE_STORAGE_KEY)) || saved;
      } catch (e) {
        // Fall back to the in-memory count.
      }
      return saved.dateKey === dateKey ? saved.count | 0 : 0;
    }
    function countPracticeSolve() {
      const record = { dateKey: centralDateKey(), count: practiceSolvedToday() + 1 };
      practiceSolvedFallback = record;
      try {
        localStorage.setItem(PRACTICE_STORAGE_KEY, JSON.stringify(record));
      } catch (e) {
        // Counted in memory only.
      }
    }

    // Tutorial puzzles only get the correct-answer chime, never the full
    // celebration.
    function winPuzzle() {
      if (mode === "practice") countPracticeSolve();
      finishPuzzle();
      if (mode === "tutorial") window.T9Celebrate.chime();
      else window.T9Celebrate.celebrate(document.querySelector(".phone"));
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
    // Practice, the next of the three in Daily, then the Daily results;
    // the next lesson in Tutorial, then the send-off, whose Start key
    // moves on to Daily.
    function nextPuzzle() {
      if (mode === "tutorial") {
        if (tutorialFinished()) {
          // Start gets the correct-answer chime on its way to Daily.
          window.T9Celebrate.chime();
          setMode("daily");
        } else {
          goToLesson(tutorial.index + 1);
        }
        return;
      }
      window.T9Celebrate.clear();
      if (mode === "practice") {
        newPracticePuzzle();
      } else {
        daily.index++;
        saveDaily();
      }
      resetGuessInProgress();
      renderAll();
    }

    // Jumps to a Tutorial lesson (or, one past the last, the send-off).
    // A lesson always starts fresh, so going back to one replays it.
    function goToLesson(index) {
      if (index < 0 || index > TUTORIAL_LESSONS.length) return;
      window.T9Celebrate.clear();
      tutorial.index = index;
      if (index < TUTORIAL_LESSONS.length) tutorial.puzzles[index] = tutorialPuzzle(TUTORIAL_LESSONS[index]);
      resetGuessInProgress();
      renderAll();
    }

    // ---- Mode toggle ----------------------------------------------------

    // New players open in the Tutorial. Once a player has left it (or has
    // ever switched to Daily), every later visit opens in Daily.
    function remember(key) {
      try {
        localStorage.setItem(key, "1");
      } catch (e) {
        // Not remembered; the next visit just opens in the Tutorial again.
      }
    }
    function recalls(key) {
      try {
        return localStorage.getItem(key) === "1";
      } catch (e) {
        return false;
      }
    }
    function startingMode() {
      return recalls(DAILY_CHOSEN_KEY) || recalls(TUTORIAL_SEEN_KEY) ? "daily" : "tutorial";
    }

    function renderModeSelect() {
      modeSelectEl.dataset.active = String(MODES.indexOf(mode));
      modeSelectEl.querySelectorAll(".mode-option").forEach((el) => {
        el.setAttribute("aria-checked", String(el.dataset.mode === mode));
      });
    }

    function setMode(newMode) {
      if (newMode === mode) return;
      if (mode === "tutorial") remember(TUTORIAL_SEEN_KEY);
      mode = newMode;
      window.T9Celebrate.clear();
      if (mode === "daily") {
        loadDaily();
        remember(DAILY_CHOSEN_KEY);
      }
      // Coming back to a finished Tutorial starts it over.
      if (mode === "tutorial" && (!tutorial || tutorialFinished())) newTutorial();
      renderModeSelect();
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
      if (!p || p.complete) {
        // Daily's results screen has nothing next; the Tutorial's send-off
        // has Start.
        if (p || mode === "tutorial") nextPuzzle();
      } else {
        giveUp();
      }
    });
    tutorialPrevBtn.addEventListener("click", () => goToLesson(tutorial.index - 1));
    tutorialNextBtn.addEventListener("click", () => goToLesson(tutorial.index + 1));
    // Only the testing page has the debug 0 key; on live 0 is inert.
    const debugWinBtn = document.getElementById("debug-win");
    if (debugWinBtn) debugWinBtn.addEventListener("click", debugWin);
    modeSelectEl.querySelectorAll(".mode-option").forEach((el) => {
      el.addEventListener("click", () => setMode(el.dataset.mode));
    });
    // TESTING ONLY: the Sunday preview switch exists only on the testing page.
    const sundayToggleBtn = document.getElementById("sunday-toggle");
    if (sundayToggleBtn) {
      sundayToggleBtn.addEventListener("click", () => {
        sundayPreview = !sundayPreview;
        sundayToggleBtn.setAttribute("aria-checked", String(sundayPreview));
        window.T9Celebrate.clear();
        // Set the real Daily aside untouched while previewing, and put it
        // back exactly as it was (in-progress answers included) afterwards.
        if (sundayPreview) {
          realDaily = daily && !daily.preview ? daily : null;
          daily = null;
        } else {
          daily = realDaily;
          realDaily = null;
        }
        if (mode === "daily") {
          loadDaily();
          resetGuessInProgress();
          renderAll();
        } else {
          setMode("daily");
        }
      });
    }

    newPracticePuzzle();
    resetGuessInProgress();
    renderAll();
    // Place the selector's thumb on the starting mode without sliding it
    // there; only later switches animate.
    modeSelectEl.classList.add("instant");
    setMode(startingMode());
    renderModeSelect();
    requestAnimationFrame(() => requestAnimationFrame(() => modeSelectEl.classList.remove("instant")));
  })();
})();
