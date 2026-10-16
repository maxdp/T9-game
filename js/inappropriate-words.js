// Inappropriate words: slurs, curse words and other content that doesn't
// belong in the game. Typing one as a guess gets "See me after class"
// instead of the usual verdict, and none of them can ever be a puzzle answer
// or count as a real word -- the word-list build (see words.js) excludes
// everything here from DICTIONARY and WORDS_GOOD.
//
// Only 4-8 letter words are listed, since puzzles never have fewer or more
// letters than that. Words whose everyday meaning is innocent (screw,
// crack, prick, dyke as in embankment, cracker, paddy, queer, ...) are
// deliberately left out so normal guesses never get scolded.
window.T9_INAPPROPRIATE = [
  "abos", "apeshit", "arse", "arsehole", "asshat", "asshats", "asshole", "assholes", "asswipe", "badass",
  "ballsack", "bastard", "bastards", "beaner", "beaners", "bimbo", "bimbos", "bitch", "bitched", "bitches",
  "bitchin", "bitching", "bitchy", "blowjob", "blowjobs", "bollock", "bollocks", "boobs", "boong", "boongs",
  "bugger", "buggered", "buggers", "buggery", "bullshit", "butthole", "chink", "chinks", "cock", "cocks",
  "cooch", "coochie", "coon", "coons", "crap", "crapped", "crapper", "crapping", "crappy", "cumming",
  "cunt", "cunts", "dammit", "damn", "damned", "damnit", "dick", "dickface", "dickhead", "dicks",
  "dickwad", "dildo", "dildoes", "dildos", "dipshit", "douche", "douches", "douchey", "dumbass", "fagged",
  "fagger", "fagging", "faggot", "faggoted", "faggots", "faggy", "fagot", "fagots", "fags", "fatass",
  "fatso", "fatsoes", "fatsos", "fuck", "fucked", "fucker", "fuckers", "fuckface", "fuckin", "fucking",
  "fuckoff", "fucks", "fuckup", "fuckups", "fuckwit", "goddam", "goddamn", "gook", "gooks", "gypped",
  "gypping", "gypsies", "gypsy", "handjob", "hell", "hooker", "hookers", "horny", "incest", "jackass",
  "jackoff", "jailbait", "japs", "jerkoff", "jewboy", "jewed", "jewing", "jizz", "jizzed", "kickass",
  "kike", "kikes", "lardass", "mick", "micks", "midget", "midgets", "molest", "molested", "molester",
  "molests", "mulatto", "mulattos", "nazi", "nazis", "negro", "negroes", "nigga", "niggas", "niggaz",
  "nigger", "niggered", "niggers", "nutsack", "paki", "pakis", "paleface", "papists", "pederast", "pedo",
  "pedos", "piss", "pissed", "pisser", "pisses", "pissing", "pissy", "polack", "polacks", "porn",
  "porno", "pornos", "pussies", "pussy", "queef", "queefs", "rape", "raped", "raper", "rapes",
  "raping", "rapist", "rapists", "retard", "retarded", "retards", "rimjob", "shit", "shithead", "shithole",
  "shitless", "shits", "shitted", "shitter", "shitting", "shitty", "skank", "skanks", "skanky", "slut",
  "sluts", "slutted", "slutter", "slutting", "sluttish", "slutty", "smartass", "spic", "spics", "spik",
  "spiks", "squaw", "squaws", "tard", "tards", "tits", "titties", "titty", "trannies", "tranny",
  "turd", "turds", "twat", "twats", "wank", "wanked", "wanker", "wankers", "wanking", "wanks",
  "wetback", "wetbacks", "whore", "whored", "whores", "whoring", "whorish", "wops",
];
