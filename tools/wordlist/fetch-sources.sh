#!/bin/sh
# Downloads the word-list sources that tools/wordlist/build-words.js reads
# into tools/wordlist/sources/ (git-ignored; about 36MB), and checks each
# against the copy the current word list was built from. A checksum
# mismatch means the upstream file has changed since: the build still
# works, but review its --check report before writing js/words.js.
set -e
cd "$(dirname "$0")"
mkdir -p sources
cd sources

fetch() { # name url
  [ -f "$1" ] || { echo "downloading $1"; curl -sSfL -o "$1" "$2"; }
}
fetch words_alpha.txt https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt
fetch enable1.txt     https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt
fetch wordnet.zip     https://raw.githubusercontent.com/nltk/nltk_data/gh-pages/packages/corpora/wordnet.zip
fetch en_full.txt     https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/en/en_full.txt
[ -d wordnet ] || python3 -c "import zipfile; zipfile.ZipFile('wordnet.zip').extractall('.')"

sha256sum -c <<'SUMS' || echo "WARNING: a source differs from the one the current list was built from."
3ed0c94610d8bcf7c11bbb49c56aa49c7234d32b66824df91f554169e572da48  words_alpha.txt
3f16130220645692ed49c7134e24a18504c2ca55b3c012f7290e3e77c63b1a89  enable1.txt
cbda5ea6eef7f36a97a43d4a75f85e07fccbb4f23657d27b4ccbc93e2646ab59  wordnet.zip
7fea67ab954e2c01df6c608c9826e594cf36f8823b3243554f88245fb75dc506  en_full.txt
SUMS
