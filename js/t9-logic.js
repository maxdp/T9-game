// Core T9 game rules — no DOM code here, so this can be unit-tested on its own.

// Old-phone multi-tap press count for each letter (not the keypad digit —
// how many times you'd tap the key to land on that letter).
const PRESS_COUNTS = {};
["abc", "def", "ghi", "jkl", "mno", "pqrs", "tuv", "wxyz"].forEach((group) => {
  group.split("").forEach((letter, i) => {
    PRESS_COUNTS[letter] = i + 1;
  });
});

function wordToDigits(word) {
  return word
    .toLowerCase()
    .split("")
    .map((letter) => PRESS_COUNTS[letter]);
}

// Tries every way of merging adjacent digits (by summing) and checks whether
// any resulting sequence is a run of consecutive integers 1..k, allowing the
// run to "wrap around" (e.g. 4,1,2,3 counts, since it's 1,2,3,4 rotated).
// Returns the first working grouping it finds, or null if none works.
function findSequentialGrouping(digits) {
  const n = digits.length;

  for (let mask = 0; mask < 1 << (n - 1); mask++) {
    const groups = [];
    let indices = [0];
    let sum = digits[0];

    for (let i = 1; i < n; i++) {
      if (mask & (1 << (i - 1))) {
        indices.push(i);
        sum += digits[i];
      } else {
        groups.push({ indices, sum });
        indices = [i];
        sum = digits[i];
      }
    }
    groups.push({ indices, sum });

    const sums = groups.map((g) => g.sum);
    const k = sums.length;

    const sorted = [...sums].sort((a, b) => a - b);
    const isPermutationOf1ToK = sorted.every((v, i) => v === i + 1);
    if (!isPermutationOf1ToK) continue;

    const startIdx = sums.indexOf(1);
    const isSequentialRotation = sums.every(
      (_, i) => sums[(startIdx + i) % k] === i + 1
    );

    if (isSequentialRotation) {
      return { groups, sums, wrapped: startIdx !== 0 };
    }
  }

  return null;
}

function isGoodWord(word) {
  return findSequentialGrouping(wordToDigits(word)) !== null;
}

window.T9 = { PRESS_COUNTS, wordToDigits, findSequentialGrouping, isGoodWord };
