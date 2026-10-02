(() => {
  const { wordToDigits, findSequentialGrouping, PRESS_COUNTS } = window.T9;
  const { DICTIONARY, WORDS_GOOD, WORDS_GOOD_RANK } = window.T9_WORDS;

  // DICTIONARY lets hangman mode check whether a typed guess is a real word
  // at all. WORDS_GOOD is precomputed (see words.js) rather than classified
  // here at startup — deriving WORDS_BAD from it is just a set difference,
  // no rule-checking needed, so it stays cheap.
  const DICTIONARY_SET = new Set(DICTIONARY);
  const WORDS_GOOD_SET = new Set(WORDS_GOOD);
  const WORDS_BAD = DICTIONARY.filter((w) => !WORDS_GOOD_SET.has(w));

  // Word -> frequency rank (1 = most common, higher = rarer), for gauging
  // hangman puzzle difficulty from its rarest valid answer.
  const WORD_RANK = new Map(WORDS_GOOD.map((w, i) => [w, WORDS_GOOD_RANK[i]]));

  // Thresholds picked by simulating 20,000 random puzzles (same word-pick +
  // blank-pick algorithm as below) and taking roughly the 33rd/66th
  // percentiles of each puzzle's rarest-valid-answer rank, so the three
  // labels come up about equally often in practice.
  function difficultyForRank(rarestRank) {
    if (rarestRank <= 10000) return "Easy";
    if (rarestRank <= 21500) return "Medium";
    return "Hard";
  }

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

  function groupingNotes(grouping) {
    const notes = [];
    if (grouping.direction === "decreasing") notes.push("counting down");
    if (grouping.wrapped) notes.push("wraps around");
    return notes.join(", ");
  }

  // Colors a word's letters by merged group. In tile mode, each letter is
  // rendered as its own box (matching the hangman blank tiles); otherwise
  // as plain inline spans (matching the big yes/no word display).
  function renderColoredWord(container, word, grouping, tileMode) {
    container.innerHTML = "";
    word.split("").forEach((letter, i) => {
      const color = GROUP_COLORS[groupIndexForLetter(grouping, i) % GROUP_COLORS.length];
      const el = document.createElement(tileMode ? "div" : "span");
      if (tileMode) el.className = "hang-tile revealed";
      el.textContent = letter.toUpperCase();
      el.style.color = color;
      if (tileMode) el.style.borderBottomColor = color;
      container.appendChild(el);
    });
  }

  // Lays out a word's digits by merged group, e.g. SPENT -> 4 1 2 (2 1),
  // colored to match renderColoredWord's letter colors.
  // Walks the digits left to right (not grouping.groups in whatever order
  // they were built) so a group that wraps around the ends of the word —
  // e.g. hindu's first and last digits merging into one group — renders as
  // two separate parenthesized pieces in their actual positions, sharing
  // one color, rather than one piece jumping out of position.
  function renderDigitLine(container, digits, grouping) {
    container.innerHTML = "";
    const n = digits.length;
    let i = 0;
    while (i < n) {
      const gi = groupIndexForLetter(grouping, i);
      const groupSize = grouping.groups[gi].indices.length;
      let j = i;
      while (j < n && groupIndexForLetter(grouping, j) === gi) j++;

      const runDigits = digits.slice(i, j);
      const span = document.createElement("span");
      span.style.color = GROUP_COLORS[gi % GROUP_COLORS.length];
      span.textContent =
        groupSize > 1 ? `(${runDigits.join(" ")})` : `${runDigits[0]}`;
      container.appendChild(span);
      container.appendChild(document.createTextNode(" "));
      i = j;
    }
  }

  // ---------------------------------------------------------------------
  // Practice mode (yes/no quiz)
  // ---------------------------------------------------------------------
  (() => {
    const wordEl = document.getElementById("word");
    const goodBtn = document.getElementById("guess-good");
    const badBtn = document.getElementById("guess-bad");
    const resultEl = document.getElementById("result");
    const explanationEl = document.getElementById("explanation");
    const solutionEl = document.getElementById("solution");
    const nextBtn = document.getElementById("next");
    const scoreEl = document.getElementById("score");
    const streakEl = document.getElementById("streak");

    let currentWord = "";
    let currentDigits = [];
    let answered = false;
    let correct = 0;
    let total = 0;
    let streak = 0;
    const seen = new Set();

    function pickWord() {
      const pool = Math.random() < 0.5 ? WORDS_GOOD : WORDS_BAD;
      let word;
      let attempts = 0;
      do {
        word = pool[Math.floor(Math.random() * pool.length)];
        attempts++;
      } while (seen.has(word) && attempts < 20);
      seen.add(word);
      if (seen.size > (WORDS_GOOD.length + WORDS_BAD.length) * 0.9) {
        seen.clear();
      }
      return word;
    }

    function newRound() {
      answered = false;
      resultEl.textContent = "";
      resultEl.className = "result";
      explanationEl.textContent = "";
      solutionEl.textContent = "";
      nextBtn.hidden = true;
      goodBtn.disabled = false;
      badBtn.disabled = false;

      currentWord = pickWord();
      currentDigits = wordToDigits(currentWord);
      wordEl.textContent = currentWord.toUpperCase();
    }

    function submitGuess(guessGood) {
      if (answered) return;
      answered = true;
      goodBtn.disabled = true;
      badBtn.disabled = true;
      nextBtn.hidden = false;

      const grouping = findSequentialGrouping(currentDigits);
      const actuallyGood = grouping !== null;
      const wasRight = guessGood === actuallyGood;

      total++;
      if (wasRight) {
        correct++;
        streak++;
      } else {
        streak = 0;
      }
      scoreEl.textContent = `${correct} / ${total}`;
      streakEl.textContent = streak;

      resultEl.textContent = wasRight ? "✅ Correct!" : "❌ Not quite";
      resultEl.className = "result " + (wasRight ? "right" : "wrong");

      if (actuallyGood) {
        const notes = groupingNotes(grouping);
        explanationEl.textContent = "GOOD" + (notes ? " — " + notes : "");
        renderColoredWord(wordEl, currentWord, grouping, false);
        renderDigitLine(solutionEl, currentDigits, grouping);
      } else {
        explanationEl.textContent =
          "NOT GOOD — no way to merge neighboring digits into a sequential run.";
      }
    }

    goodBtn.addEventListener("click", () => submitGuess(true));
    badBtn.addEventListener("click", () => submitGuess(false));
    nextBtn.addEventListener("click", newRound);

    newRound();
  })();

  // ---------------------------------------------------------------------
  // Hangman mode
  // ---------------------------------------------------------------------
  const hangman = (() => {
    const tilesEl = document.getElementById("hang-tiles");
    const tapKeypadEl = document.getElementById("keypad");
    const backspaceBtn = document.getElementById("tap-backspace");
    const giveUpBtn = document.getElementById("hang-give-up");
    const feedbackEl = document.getElementById("hang-feedback");
    const solutionEl = document.getElementById("hang-solution");
    const counterEl = document.getElementById("hang-counter");
    const foundListEl = document.getElementById("hang-found-list");
    const difficultyEl = document.getElementById("hang-difficulty");
    const nextBtn = document.getElementById("hang-next");
    const solvedEl = document.getElementById("hang-solved");
    const attemptsEl = document.getElementById("hang-attempts");

    const MIN_VALID_ANSWERS = 3;
    const MAX_VALID_ANSWERS = 8;

    let hiddenWord = "";
    let blanks = new Set();
    let validAnswers = [];
    let found = new Set();
    let complete = false;
    let attempts = 0;
    let solvedCount = 0;
    const seen = new Set();
    let started = false;

    // Tap-input state: which blank (in left-to-right order) is next to
    // fill, what's been filled so far, and the in-progress multi-tap cycle
    // (which key is held and how many times it's been tapped) on the key
    // that hasn't committed a letter yet.
    let activeBlankPositions = [];
    let filledMap = new Map();
    let activePos = 0;
    let pendingKey = null;
    let pendingCount = 0;
    let pendingTimer = null;

    function pickGoodWord() {
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

    // Renders each tile's letter (revealed, already tap-filled, or a dimmed
    // preview of the in-progress multi-tap cycle) plus the small press-count
    // digit underneath it, and boxes whichever blank is next to fill.
    function renderTiles() {
      tilesEl.innerHTML = "";
      const activeTarget = activeBlankPositions[activePos];
      hiddenWord.split("").forEach((letter, i) => {
        const tile = document.createElement("div");
        tile.className = "hang-tile";
        const isBlank = blanks.has(i);
        if (isBlank) tile.classList.add("blank");
        if (i === activeTarget) tile.classList.add("active");

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

        if (shown) {
          const letterSpan = document.createElement("span");
          letterSpan.className = "hang-letter" + (isPreview ? " pending-letter" : "");
          letterSpan.textContent = shown.toUpperCase();
          tile.appendChild(letterSpan);

          const numSpan = document.createElement("span");
          numSpan.className = "hang-pressnum";
          numSpan.textContent = String(PRESS_COUNTS[shown]);
          tile.appendChild(numSpan);
        }

        tilesEl.appendChild(tile);
      });
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

    function groupLetterAt(group, count) {
      return group[(count - 1) % group.length];
    }

    function clearPendingTimer() {
      if (pendingTimer) {
        clearTimeout(pendingTimer);
        pendingTimer = null;
      }
    }

    function setKeypadDisabled(disabled) {
      tapKeypadEl.querySelectorAll("button").forEach((b) => {
        b.disabled = disabled;
      });
    }

    // Commits whichever letter the pending key's cycle is currently on into
    // the active blank (called after a 1s pause or when a different key is
    // tapped), then advances to the next blank — or, if that was the last
    // one, submits the assembled word as a guess.
    function commitPending() {
      clearPendingTimer();
      if (!pendingKey || complete) {
        pendingKey = null;
        pendingCount = 0;
        return;
      }
      const letter = groupLetterAt(pendingKey, pendingCount);
      const pos = activeBlankPositions[activePos];
      filledMap.set(pos, letter);
      pendingKey = null;
      pendingCount = 0;
      activePos++;
      render();
      if (activePos === activeBlankPositions.length) {
        submitGuess();
      }
    }

    function handleKeyClick(group) {
      if (complete || activePos >= activeBlankPositions.length) return;

      if (pendingKey && pendingKey !== group) {
        commitPending();
      }
      if (complete || activePos >= activeBlankPositions.length) return;

      pendingCount = pendingKey === group ? pendingCount + 1 : 1;
      pendingKey = group;
      clearPendingTimer();
      render();
      pendingTimer = setTimeout(commitPending, 1000);
    }

    function handleBackspace() {
      if (complete) return;
      if (pendingKey) {
        // Cancel the in-progress cycle rather than committing then
        // immediately deleting it.
        clearPendingTimer();
        pendingKey = null;
        pendingCount = 0;
        render();
        return;
      }
      if (activePos > 0) {
        activePos--;
        filledMap.delete(activeBlankPositions[activePos]);
        render();
      }
    }

    function assembleGuess() {
      return hiddenWord
        .split("")
        .map((ch, i) => (blanks.has(i) ? filledMap.get(i) : ch))
        .join("");
    }

    function resetGuessInProgress() {
      filledMap = new Map();
      activePos = 0;
      pendingKey = null;
      pendingCount = 0;
      clearPendingTimer();
      render();
    }

    function updateCounter() {
      counterEl.textContent = `${found.size} / ${validAnswers.length} found`;
    }

    function renderFoundList() {
      foundListEl.textContent = [...found].map((w) => w.toUpperCase()).join(", ");
    }

    function newPuzzle() {
      complete = false;
      attempts = 0;
      attemptsEl.textContent = "0";
      feedbackEl.textContent = "";
      feedbackEl.className = "";
      solutionEl.textContent = "";
      solutionEl.classList.remove("reveal-list");
      nextBtn.hidden = true;
      giveUpBtn.hidden = false;
      setKeypadDisabled(false);
      found = new Set();
      renderFoundList();

      // Only offer puzzles with MIN_VALID_ANSWERS..MAX_VALID_ANSWERS valid
      // answers — about 24% of random word+blank combinations qualify, so
      // this usually takes a few tries, capped so it can't loop forever.
      let tries = 0;
      do {
        hiddenWord = pickGoodWord();
        blanks = pickBlanks(hiddenWord);
        validAnswers = computeValidAnswers(hiddenWord, blanks);
        tries++;
      } while (
        (validAnswers.length < MIN_VALID_ANSWERS ||
          validAnswers.length > MAX_VALID_ANSWERS) &&
        tries < 200
      );

      activeBlankPositions = [...blanks].sort((a, b) => a - b);
      resetGuessInProgress();
      updateCounter();
      renderDifficulty();
    }

    function renderDifficulty() {
      const rarestRank = Math.max(...validAnswers.map((w) => WORD_RANK.get(w)));
      const difficulty = difficultyForRank(rarestRank);
      difficultyEl.textContent = difficulty;
      difficultyEl.className = "difficulty-" + difficulty.toLowerCase();
    }

    // Shows every valid answer as plain text (used on give-up and on
    // finding them all) rather than a per-word colored breakdown, since
    // there can be many of them.
    function revealAllAnswers() {
      solutionEl.classList.add("reveal-list");
      solutionEl.textContent =
        "Valid answers: " + validAnswers.map((w) => w.toUpperCase()).join(", ");
    }

    function completePuzzle() {
      complete = true;
      clearPendingTimer();
      pendingKey = null;
      pendingCount = 0;
      setKeypadDisabled(true);
      giveUpBtn.hidden = true;
      nextBtn.hidden = false;
      renderKeypadHighlight();
    }

    // Every blank is filled by construction (tap input can't produce a
    // wrong-length guess or one that disagrees with a revealed letter), so
    // there's nothing to validate before checking realness/goodness below.
    function submitGuess() {
      if (complete) return;
      const guess = assembleGuess();
      resetGuessInProgress();

      attempts++;
      attemptsEl.textContent = String(attempts);

      if (!DICTIONARY_SET.has(guess)) {
        feedbackEl.textContent = `"${guess.toUpperCase()}" is not a real word.`;
        feedbackEl.className = "wrong";
        return;
      }

      const grouping = findSequentialGrouping(wordToDigits(guess));
      if (!grouping) {
        feedbackEl.textContent = `"${guess.toUpperCase()}" is a real word, but not good.`;
        feedbackEl.className = "wrong";
        return;
      }

      if (found.has(guess)) {
        feedbackEl.textContent = `You already found "${guess.toUpperCase()}".`;
        feedbackEl.className = "";
        return;
      }

      found.add(guess);
      updateCounter();
      renderFoundList();
      feedbackEl.textContent = `✅ "${guess.toUpperCase()}" is good!`;
      feedbackEl.className = "right";
      solutionEl.classList.remove("reveal-list");
      renderDigitLine(solutionEl, wordToDigits(guess), grouping);

      if (found.size === validAnswers.length) {
        solvedCount++;
        solvedEl.textContent = String(solvedCount);
        feedbackEl.textContent = `🎉 Found all ${validAnswers.length}!`;
        completePuzzle();
      }
    }

    function giveUp() {
      if (complete) return;
      feedbackEl.textContent =
        found.size > 0
          ? `Found ${found.size} of ${validAnswers.length}.`
          : "No answers found.";
      feedbackEl.className = "";
      revealAllAnswers();
      completePuzzle();
    }

    tapKeypadEl.querySelectorAll(".tap-key[data-letters]").forEach((btn) => {
      btn.addEventListener("click", () => handleKeyClick(btn.dataset.letters));
    });
    backspaceBtn.addEventListener("click", handleBackspace);
    giveUpBtn.addEventListener("click", giveUp);
    nextBtn.addEventListener("click", newPuzzle);

    return {
      startIfNeeded() {
        if (!started) {
          started = true;
          newPuzzle();
        }
      },
    };
  })();

  // ---------------------------------------------------------------------
  // Mode toggle
  // ---------------------------------------------------------------------
  const yesnoSection = document.getElementById("yesno-mode");
  const hangmanSection = document.getElementById("hangman-mode");
  const modeToggleBtn = document.getElementById("mode-toggle");

  let mode = "hangman";

  function renderModeToggle() {
    modeToggleBtn.textContent =
      mode === "yesno"
        ? "Mode: Practice  (switch to Hangman)"
        : "Mode: Hangman  (switch to Practice)";
  }

  function setMode(newMode) {
    mode = newMode;
    yesnoSection.hidden = mode !== "yesno";
    hangmanSection.hidden = mode !== "hangman";
    renderModeToggle();
    if (mode === "hangman") hangman.startIfNeeded();
  }

  modeToggleBtn.addEventListener("click", () => {
    setMode(mode === "yesno" ? "hangman" : "yesno");
  });

  setMode(mode);
})();
