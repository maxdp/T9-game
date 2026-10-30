#!/usr/bin/env python3
"""Builds the phone screen's bitmap fonts from tools/lcd-font/glyphs.txt:

  pip install fonttools
  python3 tools/lcd-font/build.py

writes testing/fonts/<font>.ttf for each font (the page lays out its screen
text with these, so text wraps and lines up exactly as the bitmaps do) and
testing/js/lcd-font.js (the same bitmaps, which js/lcd.js draws onto the
screen's pixel grid).

In each .ttf, one bitmap pixel is a square of PIXEL font units, and the em
is the font's full height (ascent + descent pixels), so at font-size
(ascent + descent) * g every pixel is exactly g CSS pixels.
"""
import json
import os
import sys

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..", "..")
PIXEL = 100


def parse(path):
    fonts = []
    font = None
    glyph = None
    for raw in open(path, encoding="utf-8").read().splitlines():
        line = raw.rstrip()
        if not line or line.startswith("//"):
            glyph = None
            continue
        if line.startswith("font "):
            words = line[5:].split()
            opts = dict(w.split("=") for w in words if "=" in w)
            name = " ".join(w for w in words if "=" not in w)
            font = {
                "name": name,
                "ascent": int(opts["ascent"]),
                "descent": int(opts["descent"]),
                "space": int(opts["space"]),
                "glyphs": {},
            }
            fonts.append(font)
            glyph = None
        elif line.startswith("= "):
            char = line[2:]
            if len(char) != 1:
                sys.exit(f"bad glyph line: {raw!r}")
            glyph = font["glyphs"][char] = []
        else:
            if glyph is None or set(line) - set("#."):
                sys.exit(f"stray line: {raw!r}")
            glyph.append(line)
    for font in fonts:
        height = font["ascent"] + font["descent"]
        for char, rows in font["glyphs"].items():
            widths = {len(r) for r in rows}
            if len(widths) != 1 or len(rows) > height:
                sys.exit(f"{font['name']} {char!r}: rows must be equal width, at most {height} of them")
    return fonts


def build_ttf(font, out_path):
    asc, desc = font["ascent"], font["descent"]
    upm = (asc + desc) * PIXEL
    chars = sorted(font["glyphs"])
    names = [".notdef", "space"] + [f"uni{ord(c):04X}" for c in chars]
    fb = FontBuilder(upm, isTTF=True)
    fb.setupGlyphOrder(names)
    cmap = {32: "space", 0xA0: "space"}
    cmap.update({ord(c): f"uni{ord(c):04X}" for c in chars})
    fb.setupCharacterMap(cmap)

    glyphs = {}
    metrics = {}
    empty = TTGlyphPen(None).glyph()
    glyphs[".notdef"] = empty
    metrics[".notdef"] = (font["space"] * PIXEL, 0)
    glyphs["space"] = empty
    metrics["space"] = (font["space"] * PIXEL, 0)
    for c in chars:
        rows = font["glyphs"][c]
        width = len(rows[0])
        pen = TTGlyphPen(None)
        for r, row in enumerate(rows):
            top = (asc - r) * PIXEL
            bottom = top - PIXEL
            # One rectangle per run of lit pixels in the row (clockwise).
            x = 0
            while x < width:
                if row[x] != "#":
                    x += 1
                    continue
                start = x
                while x < width and row[x] == "#":
                    x += 1
                pen.moveTo((start * PIXEL, bottom))
                pen.lineTo((start * PIXEL, top))
                pen.lineTo((x * PIXEL, top))
                pen.lineTo((x * PIXEL, bottom))
                pen.closePath()
        name = f"uni{ord(c):04X}"
        glyphs[name] = pen.glyph()
        metrics[name] = ((width + 1) * PIXEL, 0)
    fb.setupGlyf(glyphs)
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=asc * PIXEL, descent=-desc * PIXEL, lineGap=0)
    fb.setupNameTable({"familyName": font["name"], "styleName": "Regular"})
    fb.setupOS2(
        sTypoAscender=asc * PIXEL,
        sTypoDescender=-desc * PIXEL,
        sTypoLineGap=0,
        usWinAscent=asc * PIXEL,
        usWinDescent=desc * PIXEL,
        fsSelection=0x40 | 0x80,  # regular; use the typo metrics
        version=4,
    )
    fb.setupPost()
    fb.save(out_path)


def main():
    fonts = parse(os.path.join(HERE, "glyphs.txt"))
    os.makedirs(os.path.join(ROOT, "testing", "fonts"), exist_ok=True)
    data = {}
    for font in fonts:
        slug = font["name"].lower().replace(" ", "-")
        build_ttf(font, os.path.join(ROOT, "testing", "fonts", f"{slug}.ttf"))
        data[font["name"]] = {
            "ascent": font["ascent"],
            "descent": font["descent"],
            "space": font["space"],
            "glyphs": {c: "/".join(rows) for c, rows in font["glyphs"].items()},
        }
        print(f"{font['name']}: {len(font['glyphs'])} glyphs -> testing/fonts/{slug}.ttf")
    with open(os.path.join(ROOT, "testing", "js", "lcd-font.js"), "w", encoding="utf-8") as f:
        f.write("// Generated by tools/lcd-font/build.py from tools/lcd-font/glyphs.txt -- edit those, not this.\n")
        f.write("window.T9_LCD_FONTS = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n")
    print("wrote testing/js/lcd-font.js")


if __name__ == "__main__":
    main()
