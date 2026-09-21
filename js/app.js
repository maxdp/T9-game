(() => {
  const { wordToDigits, findSequentialGrouping } = window.T9;
  const { WORDS_GOOD, WORDS_BAD } = window.T9_WORDS;

  const wordEl = document.getElementById("word");
  const goodBtn = document.getElementById("guess-good");
  const badBtn = document.getElementById("guess-bad");
  const resultEl = document.getElementById("result");
  const explanationEl = document.getElementById("explanation");
  const solutionEl = document.getElementById("solution");
  const nextBtn = document.getElementById("next");
  const scoreEl = document.getElementById("score");
  const streakEl = document.getElementById("streak");

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

  function groupingNotes(grouping) {
    const notes = [];
    if (grouping.direction === "decreasing") notes.push("counting down");
    if (grouping.wrapped) notes.push("wraps around");
    return notes.join(", ");
  }

  // Colors the word's letters, and lays out its digits below them, by
  // merged group — e.g. SPENT -> S P E (N T), with each token/letter tinted
  // by which final counting number it contributes to.
  function renderSolution(word, digits, grouping) {
    wordEl.innerHTML = "";
    word.split("").forEach((letter, i) => {
      const groupIdx = grouping.groups.findIndex((g) =>
        g.indices.includes(i)
      );
      const span = document.createElement("span");
      span.textContent = letter.toUpperCase();
      span.style.color = GROUP_COLORS[groupIdx % GROUP_COLORS.length];
      wordEl.appendChild(span);
    });

    solutionEl.innerHTML = "";
    grouping.groups.forEach((g, i) => {
      const vals = g.indices.map((idx) => digits[idx]);
      const span = document.createElement("span");
      span.style.color = GROUP_COLORS[i % GROUP_COLORS.length];
      span.textContent = vals.length > 1 ? `(${vals.join(" ")})` : `${vals[0]}`;
      solutionEl.appendChild(span);
      solutionEl.appendChild(document.createTextNode(" "));
    });
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
      renderSolution(currentWord, currentDigits, grouping);
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
