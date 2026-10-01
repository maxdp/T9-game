(() => {
  const { wordToDigits, findSequentialGrouping } = window.T9;
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
  // Yes/No quiz mode
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
    const formEl = document.getElementById("hang-form");
    const inputEl = document.getElementById("hang-input");
    const submitBtn = document.getElementById("hang-submit");
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
    const MAX_VALID_ANSWERS = 10;

    let hiddenWord = "";
    let blanks = new Set();
    let validAnswers = [];
    let found = new Set();
    let complete = false;
    let attempts = 0;
    let solvedCount = 0;
    const seen = new Set();
    let started = false;

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

    function renderTiles() {
      tilesEl.innerHTML = "";
      hiddenWord.split("").forEach((letter, i) => {
        const tile = document.createElement("div");
        tile.className = "hang-tile";
        if (blanks.has(i)) {
          tile.classList.add("blank");
          tile.textContent = "";
        } else {
          tile.textContent = letter.toUpperCase();
        }
        tilesEl.appendChild(tile);
      });
    }

    function updateCounter() {
      counterEl.textContent = `${found.size} / ${validAnswers.length} found`;
    }

    function renderFoundList() {
      foundListEl.textContent = [...found].map((w) => w.toUpperCase()).join(", ");
    }

    function normalize(raw) {
      return raw.trim().toLowerCase().replace(/[^a-z]/g, "");
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
      inputEl.disabled = false;
      submitBtn.disabled = false;
      inputEl.value = "";
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

      inputEl.maxLength = hiddenWord.length;
      renderTiles();
      updateCounter();
      renderDifficulty();
      inputEl.focus();
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
      inputEl.disabled = true;
      submitBtn.disabled = true;
      giveUpBtn.hidden = true;
      nextBtn.hidden = false;
    }

    function submitGuess() {
      if (complete) return;
      const guess = normalize(inputEl.value);
      inputEl.value = "";
      inputEl.focus();

      if (guess.length !== hiddenWord.length) {
        feedbackEl.textContent = `Enter a ${hiddenWord.length}-letter word.`;
        feedbackEl.className = "wrong";
        return;
      }

      for (let i = 0; i < hiddenWord.length; i++) {
        if (!blanks.has(i) && guess[i] !== hiddenWord[i]) {
          feedbackEl.textContent = "Doesn't match the revealed letters.";
          feedbackEl.className = "wrong";
          return;
        }
      }

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

    formEl.addEventListener("submit", (e) => {
      e.preventDefault();
      submitGuess();
    });
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

  let mode = "yesno";

  function renderModeToggle() {
    modeToggleBtn.textContent =
      mode === "yesno"
        ? "Mode: Yes/No Quiz  (switch to Hangman)"
        : "Mode: Hangman  (switch to Yes/No Quiz)";
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

  renderModeToggle();
})();
