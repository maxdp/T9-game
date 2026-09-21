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

// A permutation of 1..k is a rotation of the increasing run 1,2,...,k if,
// starting from wherever the 1 sits, reading forward (with wraparound) hits
// 1,2,3,...,k in order.
function isRotationOfIncreasing(sums) {
  const k = sums.length;
  const startIdx = sums.indexOf(1);
  return sums.every((_, i) => sums[(startIdx + i) % k] === i + 1);
}

// Same idea, but for the decreasing run k,k-1,...,1 — starting from wherever
// k sits, reading forward (with wraparound) hits k,k-1,...,1 in order.
function isRotationOfDecreasing(sums) {
  const k = sums.length;
  const startIdx = sums.indexOf(k);
  return sums.every((_, i) => sums[(startIdx + i) % k] === k - i);
}

// Tries every way of merging adjacent digits (by summing) and checks whether
// any resulting sequence is a run of consecutive integers, counting either up
// (1,2,3,...) or down (...,3,2,1), allowing the run to "wrap around" (e.g.
// 4,1,2,3 counts, since it's 1,2,3,4 rotated; 3,2,1,4 counts too, since it's
// 4,3,2,1 rotated). Returns the first working grouping it finds, or null.
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

    const increasing = isRotationOfIncreasing(sums);
    const decreasing = k > 1 && isRotationOfDecreasing(sums);

    if (increasing || decreasing) {
      const direction = increasing ? "increasing" : "decreasing";
      const startIdx = increasing ? sums.indexOf(1) : sums.indexOf(k);
      return { groups, sums, direction, wrapped: startIdx !== 0 };
    }
  }

  return null;
}

function isGoodWord(word) {
  return findSequentialGrouping(wordToDigits(word)) !== null;
}

window.T9 = { PRESS_COUNTS, wordToDigits, findSequentialGrouping, isGoodWord };
