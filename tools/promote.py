#!/usr/bin/env python3
"""Promotes the testing page to the live page:

  python3 tools/promote.py

Writes index.html from testing/index.html minus its testing-only parts
(the debug 0 key, the Sunday preview switch, the testing notes), and
copies the testing copies of the page's own scripts, fonts and images to
the live site's folders. The shared scripts (../js/ on the testing page)
are already the live ones. The version label loses its " · testing".

Each testing-only part must be found exactly once, so if the testing page
changes around one of them this stops instead of shipping it to live.
"""
import os
import re
import shutil
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
COPY = [
    ("testing/js/app.js", "js/app.js"),
    ("testing/js/celebrate.js", "js/celebrate.js"),
    ("testing/js/background.js", "js/background.js"),
    ("testing/js/lcd.js", "js/lcd.js"),
    ("testing/js/lcd-font.js", "js/lcd-font.js"),
]
COPY_DIRS = [("testing/fonts", "fonts"), ("testing/img", "img")]

REPLACE = [
    ("<title>T9 Tangle (testing)</title>", "<title>T9 Tangle</title>"),
    (
        "  /* The Sunday preview switch (testing only) uses this on/off slider. */",
        "  /* The dark mode switch uses this on/off slider. */",
    ),
    (
        """  /* On/off switches below the phone (grey when off, purple when on): dark
     mode, and (TESTING ONLY) the Sunday preview. */
  .theme-switch,
  .sunday-switch { margin: 10px 0 0; }
  #dark-toggle,
  #sunday-toggle {""",
        """  /* The dark mode switch below the phone (grey when off, purple when
     on). */
  .theme-switch { margin: 10px 0 0; }
  #dark-toggle {""",
    ),
    (
        """  #dark-toggle:hover,
  #sunday-toggle:hover { background: #55557a; }
  #dark-toggle[aria-checked="true"],
  #sunday-toggle[aria-checked="true"] { background: #6c45c9; }
  #dark-toggle[aria-checked="true"]:hover,
  #sunday-toggle[aria-checked="true"]:hover { background: #7b54d8; }
  #dark-toggle[aria-checked="true"] .mode-knob,
  #sunday-toggle[aria-checked="true"] .mode-knob { transform: translateX(22px); }""",
        """  #dark-toggle:hover { background: #55557a; }
  #dark-toggle[aria-checked="true"] { background: #6c45c9; }
  #dark-toggle[aria-checked="true"]:hover { background: #7b54d8; }
  #dark-toggle[aria-checked="true"] .mode-knob { transform: translateX(22px); }""",
    ),
    (
        """          <!-- TESTING ONLY: 0 wins the current puzzle (see debugWin in app.js). -->
          <button type="button" id="debug-win" class="phone-key tap-key">0</button>""",
        """          <div class="phone-key phone-key-inert" aria-hidden="true">0</div>""",
    ),
    (
        """    <!-- TESTING ONLY: preview the coming Sunday's Daily (see sundayPreview
         in app.js). -->
    <div class="mode-switch sunday-switch">
      <button type="button" id="sunday-toggle" role="switch" aria-checked="false" aria-label="Preview Sunday's Daily"><span class="mode-knob"></span></button>
      <span class="mode-label-static">Sunday</span>
    </div>

""",
        "",
    ),
    (
        """  <!-- Testing build: rules and word list are shared with the live site one
       folder up; this page and its app.js are the testing copies. -->
""",
        "",
    ),
]


def main():
    src = open(os.path.join(ROOT, "testing", "index.html"), encoding="utf-8").read()
    for old, new in REPLACE:
        if src.count(old) != 1:
            sys.exit(f"testing/index.html: expected this exactly once:\n{old[:200]}")
        src = src.replace(old, new)
    src, n = re.subn(r'(<div id="version-label">v[\d.]+) · testing</div>', r"\1</div>", src)
    if n != 1:
        sys.exit("testing/index.html: version label not found")
    src = src.replace('src="../js/', 'src="js/')
    leftover = [w for w in ("testing", "debug-win", "sunday-toggle", "../") if w in src.lower()]
    if leftover:
        sys.exit(f"index.html would still mention: {', '.join(leftover)}")
    open(os.path.join(ROOT, "index.html"), "w", encoding="utf-8").write(src)
    for a, b in COPY:
        shutil.copyfile(os.path.join(ROOT, a), os.path.join(ROOT, b))
    for a, b in COPY_DIRS:
        shutil.copytree(os.path.join(ROOT, a), os.path.join(ROOT, b), dirs_exist_ok=True)
    print("index.html written from testing/index.html; scripts, fonts and images copied")


if __name__ == "__main__":
    main()
