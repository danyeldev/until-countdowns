/**
 * German entity names. Keys come from `keys.ts`.
 *
 * Bare names without an article: each string is an `<h1>`, a breadcrumb and the `{title}` inside
 * "Wie viele Tage bis …?", and "der Muttertag" only reads in the last of those. Anything German
 * uses under its English name — Halloween, Black Friday, Super Bowl, Oktoberfest, Thanksgiving's
 * neighbours, Coachella, Wimbledon, the Hindu festivals, most US holidays — is left out so the
 * page keeps the catalog title people actually type.
 */
import type { EntityNames } from "./index";

export const de: EntityNames = {
  // Turn of the year
  "new-year-s-day": "Neujahr",
  "new-year-s-eve": "Silvester", // never "Neujahrsabend"
  "leap-day": "Schalttag",
  "friday-the-13th": "Freitag, der 13.",

  // The Christian year
  "christmas-day": "Weihnachten", // the query; 25 December is formally the 1. Weihnachtsfeiertag
  "christmas-eve": "Heiligabend",
  "boxing-day": "2. Weihnachtsfeiertag", // Germany's own 26 December, not a translation of Boxing Day
  epiphany: "Heilige Drei Könige",
  lent: "Fastenzeit",
  carnival: "Karneval", // Fasching in Bavaria, Fastnacht in the south-west — Karneval is the national word
  "mardi-gras": "Faschingsdienstag",
  "ash-wednesday": "Aschermittwoch",
  "palm-sunday": "Palmsonntag",
  "maundy-thursday": "Gründonnerstag",
  "good-friday": "Karfreitag",
  "easter-sunday": "Ostersonntag",
  "easter-monday": "Ostermontag",
  "orthodox-easter": "Orthodoxes Ostern",
  "ascension-day": "Christi Himmelfahrt",
  pentecost: "Pfingsten",
  "whit-monday": "Pfingstmontag",
  "corpus-christi": "Fronleichnam",
  "assumption-of-mary": "Mariä Himmelfahrt",
  "all-saints-day": "Allerheiligen",
  "all-souls-day": "Allerseelen",
  "immaculate-conception": "Mariä Empfängnis",
  "saint-nicholas-day": "Nikolaustag",
  "saint-stephen-s-day": "Stephanstag",

  // Family and civic days
  "mother-s-day": "Muttertag",
  "father-s-day": "Vatertag",
  "valentine-s-day": "Valentinstag",
  "thanksgiving-day": "Thanksgiving", // the US holiday under its English name; Erntedankfest is a different German feast
  "labour-day": "Tag der Arbeit",
  "labor-day": "Labor Day (USA)", // kept apart from the 1 May holiday above
  "may-day": "Erster Mai",
  "independence-day": "Unabhängigkeitstag",
  "national-day": "Nationalfeiertag",
  "republic-day": "Tag der Republik",
  "constitution-day": "Tag der Verfassung",
  "liberation-day": "Tag der Befreiung",
  "german-unity-day": "Tag der Deutschen Einheit",
  "bastille-day": "Französischer Nationalfeiertag", // what German media call 14 July
  "columbus-day": "Kolumbus-Tag",
  "human-rights-day": "Tag der Menschenrechte",
  "international-women-s-day": "Internationaler Frauentag", // also Weltfrauentag
  "international-day-of-peace": "Internationaler Tag des Friedens", // not Weltfriedenstag, which in Germany is 1 September

  // Clocks
  "summer-time-begins-europe": "Zeitumstellung auf Sommerzeit (Europa)", // "Zeitumstellung" is the query, not "Sommerzeit"
  "summer-time-ends-europe": "Zeitumstellung auf Winterzeit (Europa)",
  "daylight-saving-time-begins": "Beginn der Sommerzeit",
  "daylight-saving-time-ends": "Ende der Sommerzeit",
  "daylight-saving-time-begins-us": "Beginn der Sommerzeit (USA)",
  "daylight-saving-time-ends-us": "Ende der Sommerzeit (USA)",
  "leap-second": "Schaltsekunde",
  "year-2038-problem": "Jahr-2038-Problem",

  // Islam
  "eid-al-fitr": "Zuckerfest", // what German speakers say; "Ramadanfest" second, the transliteration third
  "eid-al-adha": "Opferfest",
  "islamic-new-year": "Islamisches Neujahr",
  ashura: "Aschura",
  "laylat-al-qadr": "Nacht der Bestimmung",

  // Judaism
  "rosh-hashanah": "Rosch ha-Schana",
  "yom-kippur": "Jom Kippur",
  sukkot: "Laubhüttenfest",
  hanukkah: "Chanukka",
  passover: "Pessach",
  shavuot: "Schawuot",

  // East and South-East Asia
  "chinese-new-year": "Chinesisches Neujahr",
  "lunar-new-year": "Mondneujahr", // the pan-Asian name, kept distinct from the Chinese one above
  "mid-autumn-festival": "Mondfest",
  "dragon-boat-festival": "Drachenbootfest",
  "qingming-festival": "Qingming-Fest",
  vesak: "Vesakh",

  // Sport
  "summer-olympics": "Olympische Sommerspiele",
  "winter-olympics": "Olympische Winterspiele",
  "paralympic-games": "Paralympics",
  "fifa-world-cup": "Fußball-Weltmeisterschaft",
  "uefa-european-championship": "Fußball-Europameisterschaft",
  "uefa-champions-league-final": "Champions-League-Finale",
  "africa-cup-of-nations": "Afrika-Cup",
  "rugby-world-cup": "Rugby-Weltmeisterschaft",
  "cricket-world-cup": "Cricket-Weltmeisterschaft",
  "formula-one-season-start": "Start der Formel-1-Saison",
  "monaco-grand-prix": "Großer Preis von Monaco",
  "stanley-cup-finals": "Stanley-Cup-Finale",
  "roland-garros": "French Open", // German sport media never say Roland-Garros
  "the-masters": "US Masters", // the German press name for the golf major
  "berlin-marathon": "Berlin-Marathon",

  // Screen, stage and awards
  "academy-awards": "Oscarverleihung",
  "golden-globe-awards": "Golden Globes",
  "cannes-film-festival": "Filmfestspiele von Cannes",
  "vienna-new-year-s-concert": "Neujahrskonzert der Wiener Philharmoniker",
  "nobel-prize-ceremony": "Nobelpreisverleihung",
  "international-jazz-day": "Internationaler Tag des Jazz",

  // Sky
  "total-solar-eclipse": "Totale Sonnenfinsternis",
  "annular-solar-eclipse": "Ringförmige Sonnenfinsternis",
  "partial-solar-eclipse": "Partielle Sonnenfinsternis",
  "total-lunar-eclipse": "Totale Mondfinsternis",
  supermoon: "Supermond",
  "blue-moon": "Blauer Mond",
  "harvest-moon": "Erntemond",
  "northern-hemisphere-summer-solstice": "Sommersonnenwende",
  "northern-hemisphere-winter-solstice": "Wintersonnenwende",
  "march-equinox": "Frühlingsanfang", // the searched word; astronomically the Tagundnachtgleiche im März
  "september-equinox": "Herbstanfang",
  "perseid-meteor-shower-peak": "Perseiden-Maximum",
  "geminid-meteor-shower-peak": "Geminiden-Maximum",
  "quadrantid-meteor-shower-peak": "Quadrantiden-Maximum",
  "lyrid-meteor-shower-peak": "Lyriden-Maximum",
  "orionid-meteor-shower-peak": "Orioniden-Maximum",
  "leonid-meteor-shower-peak": "Leoniden-Maximum",
  "ursid-meteor-shower-peak": "Ursiden-Maximum",
  "eta-aquariid-meteor-shower-peak": "Eta-Aquariiden-Maximum",
  "world-space-week-begins": "Beginn der Weltraumwoche",
  "doomsday-clock-announcement": "Weltuntergangsuhr", // the searched name; the event is its yearly re-setting

  // International days
  "earth-day": "Tag der Erde",
  "world-environment-day": "Weltumwelttag",
  "world-oceans-day": "Weltozeantag",
  "world-water-day": "Weltwassertag",
  "world-health-day": "Weltgesundheitstag",
  "world-food-day": "Welternährungstag",
  "world-book-day": "Welttag des Buches",
  "world-sleep-day": "Weltschlaftag",
  "world-photography-day": "Welttag der Fotografie",
  "world-emoji-day": "Welt-Emoji-Tag",
  "world-ufo-day": "Welt-UFO-Tag",
  "international-day-of-happiness": "Internationaler Tag des Glücks",
  "international-friendship-day": "Internationaler Tag der Freundschaft",
  "international-literacy-day": "Weltalphabetisierungstag",
  "international-coffee-day": "Internationaler Tag des Kaffees",
  "international-yoga-day": "Internationaler Tag des Yoga",
  "programmers-day": "Tag des Programmierers",
  "pi-day": "Pi-Tag",
  "pi-approximation-day": "Pi-Näherungstag",
};
