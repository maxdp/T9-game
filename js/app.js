(() => {
  const { wordToDigits, findSequentialGrouping } = window.T9;
  const { WORDS_GOOD, WORDS_BAD } = window.T9_WORDS;

  const wordEl = document.getElementById("word");
  const digitsEl = document.getElementById("digits");
  const goodBtn = document.getElementById("guess-good");
  const badBtn = document.getElementById("guess-bad");
  const resultEl = document.getElementById("result");
  const explanationEl = document.getElementById("explanation");
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

  function renderDigits(word, digits) {
    digitsEl.innerHTML = "";
    word.split("").forEach((letter, i) => {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.innerHTML = `<span class="letter">${letter.toUpperCase()}</span><span class="digit">${digits[i]}</span>`;
      digitsEl.appendChild(cell);
    });
  }

  function describeGrouping(word, grouping) {
    const parts = grouping.groups.map((g) =>
      g.indices.map((i) => word[i].toUpperCase()).join("")
    );
    const sumParts = grouping.groups.map((g) => {
      if (g.indices.length === 1) return `${g.sum}`;
      const vals = g.indices.map((i) => wordToDigits(word)[i]);
      return `(${vals.join("+")}=${g.sum})`;
    });
    let text = `${parts.join("-")}  →  ${sumParts.join(", ")}`;
    if (grouping.wrapped) {
      text += " — sequential once you wrap around";
    }
    return text;
  }

  function newRound() {
    answered = false;
    resultEl.textContent = "";
    resultEl.className = "result";
    explanationEl.textContent = "";
    nextBtn.hidden = true;
    goodBtn.disabled = false;
    badBtn.disabled = false;

    currentWord = pickWord();
    currentDigits = wordToDigits(currentWord);
    wordEl.textContent = currentWord.toUpperCase();
    renderDigits(currentWord, currentDigits);
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
      explanationEl.textContent =
        "GOOD — " + describeGrouping(currentWord, grouping);
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
