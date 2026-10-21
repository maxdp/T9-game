#!/usr/bin/env node
// Quick end-to-end check of the live page (/) and the testing page
// (/testing/) in a headless browser:
//
//   node tools/smoke-test.js
//
// Serves the repo itself on a local port, then for each page checks it
// loads without errors, Practice opens on an Easy puzzle, solving a puzzle
// by typing its answers triggers the celebration, Daily shows today's
// scheduled puzzles, and the testing-only extras (0 key, Sunday preview)
// exist only on the testing page. Needs Playwright with a Chromium build
// (set CHROMIUM_PATH if it isn't found on its own).
const http = require("http");
const fs = require("fs");
const path = require("path");

let playwright;
for (const name of ["playwright", "/opt/node-tools/node_modules/playwright"]) {
  try {
    playwright = require(name);
    break;
  } catch (e) {
    // try the next location
  }
}
if (!playwright) {
  console.error("Playwright not found (npm install playwright).");
  process.exit(1);
}

const ROOT = path.join(__dirname, "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png" };
const server = http.createServer((req, res) => {
  let file = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
  if (!file.startsWith(ROOT)) return res.writeHead(403).end();
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!fs.existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});

let failures = 0;
function check(name, ok, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  (" + detail + ")" : ""}`);
}

async function typeWord(page, word) {
  const groups = await page.$$eval("#keypad .tap-key[data-letters]", (bs) => bs.map((b) => b.dataset.letters));
  const blanks = await page.$$eval(".hang-tile", (ts) => ts.map((t) => t.classList.contains("blank")));
  for (let pos = 0; pos < blanks.length; pos++) {
    if (!blanks[pos]) continue;
    await (await page.$$(".hang-tile"))[pos].click();
    const g = groups.findIndex((x) => x.includes(word[pos]));
    for (let t = 0; t <= groups[g].indexOf(word[pos]); t++) {
      await (await page.$$("#keypad .tap-key[data-letters]"))[g].click();
    }
  }
}
// Switch modes with whichever control the page has: the Tutorial / Daily /
// Practice selector, or the older Practice/Daily slider.
async function switchTo(page, mode) {
  if (await page.$(".mode-option")) return page.click(`.mode-option[data-mode="${mode}"]`);
  const isDaily = (await page.getAttribute("#mode-toggle", "aria-checked")) === "true";
  if ((mode === "daily") !== isDaily) await page.click("#mode-toggle");
}

const pattern = (page) =>
  page.$$eval("#hang-tiles .hang-tile", (ts) =>
    ts.map((t) => (t.classList.contains("blank") ? "_" : t.querySelector(".hang-letter").textContent.toLowerCase())).join("")
  );

async function checkPage(browser, base, url, isTesting) {
  console.log(`\n${url}`);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + url);
  check("version label shown", /^v\d+\.\d+/.test(await page.textContent("#version-label")), await page.textContent("#version-label"));
  if (await page.$(".mode-option")) {
    check("new visitors open in the Tutorial", (await page.textContent("#screen-mode-label")) === "Tutorial (1/5)");
    await typeWord(page, "thas");
    await page.click("#hang-enter");
    check("Tutorial explains a non-word", (await page.textContent("#hang-missed")) === "Incorrect: THAS is not a word");
    await typeWord(page, "this");
    await page.click("#hang-enter");
    await page.waitForTimeout(100);
    check("Tutorial lesson 1 solves without the celebration", (await page.textContent("#hang-missed")) === "Got it!" && (await page.$$(".celebrate-flyer")).length === 0);
  }
  await switchTo(page, "practice");
  check("first Practice puzzle is Easy", (await page.textContent("#hang-difficulty")) === "Easy");

  const answers = await page.evaluate(
    (pat) => window.T9_WORDS.WORDS_GOOD.filter((w) => window.T9_PUZZLES.fitsPattern(pat, w)),
    await pattern(page)
  );
  for (const w of answers) {
    await typeWord(page, w);
    await page.click("#hang-enter");
    await page.waitForTimeout(50);
  }
  await page.waitForTimeout(300);
  check("solving by typing celebrates", (await page.textContent("#hang-missed")) === "Got 'em all!" && (await page.$$(".celebrate-flyer")).length > 0);
  await page.click("#hang-give-up");

  await switchTo(page, "daily");
  const scheduled = await page.evaluate(() => {
    const P = window.T9_PUZZLES;
    return window.T9_DAILY.days[P.dailyNumber(P.centralDateKey()) - 1][0].split(" ")[0];
  });
  check("Daily shows today's scheduled Easy", (await pattern(page)) === scheduled, scheduled);
  check("Daily header", /^Daily #\d+ \(1\/3\)$/.test(await page.textContent("#screen-mode-label")), await page.textContent("#screen-mode-label"));

  const hasDebug = !!(await page.$("#debug-win"));
  const hasSunday = !!(await page.$("#sunday-toggle"));
  check(isTesting ? "testing-only 0 key and Sunday switch present" : "no testing-only extras", hasDebug === isTesting && hasSunday === isTesting);
  if (isTesting) {
    await page.click("#sunday-toggle");
    await page.evaluate(() => {
      for (let i = 0; i < 4; i++) document.getElementById("hang-give-up").click();
    });
    check("Sunday preview ends on Evil", (await page.textContent("#hang-difficulty")).includes("Evil"));
  }
  check("no page errors", errors.length === 0, errors.join("; "));
  await context.close();
}

server.listen(0, async () => {
  const base = `http://localhost:${server.address().port}`;
  const launch = {};
  for (const p of [process.env.CHROMIUM_PATH, "/opt/pw-browsers/chromium"]) {
    if (p && fs.existsSync(p)) {
      launch.executablePath = p;
      break;
    }
  }
  const browser = await playwright.chromium.launch(launch);
  try {
    await checkPage(browser, base, "/", false);
    await checkPage(browser, base, "/testing/", true);
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
  process.exit(failures ? 1 : 0);
});
