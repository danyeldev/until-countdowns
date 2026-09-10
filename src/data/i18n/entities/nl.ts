/**
 * Dutch entity names.
 *
 * Names people type, not glosses: Christmas Day is "Kerstmis" (nobody searches "eerste kerstdag"),
 * the FIFA World Cup is "WK voetbal", the Academy Awards are the "Oscars", and Eid is known in the
 * Netherlands and Flanders by its Dutch names — Suikerfeest and Offerfeest — far more than by
 * "Eid al-Fitr". Anything that is itself in Dutch (Halloween, Black Friday, Tour de France,
 * Wimbledon, the Super Bowl) is left out so it keeps the catalog's own title.
 */
import type { EntityNames } from "./index";

export const nl: EntityNames = {
  // Turn of the year
  "new-year-s-day": "Nieuwjaarsdag",
  "new-year-s-eve": "Oudejaarsavond",
  "thanksgiving-day": "Thanksgiving", // Dutch drops "Day"; the day itself is American
  "chinese-new-year": "Chinees Nieuwjaar",
  // "Chinees Nieuwjaar" is taken by the key above, so the generic series gets the literal name.
  "lunar-new-year": "Maannieuwjaar",
  "leap-day": "Schrikkeldag",
  "friday-the-13th": "Vrijdag de 13e",

  // Christian calendar
  "christmas-day": "Kerstmis", // the query is "kerst"/"kerstmis", not "eerste kerstdag"
  "christmas-eve": "Kerstavond",
  "boxing-day": "Tweede kerstdag", // 26 December is a full public holiday in NL and BE
  "saint-stephen-s-day": "Sint-Stefanusdag", // same day, kept apart from "Tweede kerstdag"
  epiphany: "Driekoningen",
  "ash-wednesday": "Aswoensdag",
  lent: "Vastentijd",
  "palm-sunday": "Palmzondag",
  "maundy-thursday": "Witte Donderdag",
  "good-friday": "Goede Vrijdag",
  "easter-sunday": "Pasen", // "eerste paasdag" is the calendar term; "Pasen" is what is searched
  "easter-monday": "Tweede paasdag",
  "orthodox-easter": "Orthodox Pasen",
  "ascension-day": "Hemelvaartsdag",
  pentecost: "Pinksteren",
  "whit-monday": "Tweede pinksterdag",
  "corpus-christi": "Sacramentsdag",
  "assumption-of-mary": "Maria-Tenhemelopneming",
  "all-saints-day": "Allerheiligen",
  "all-souls-day": "Allerzielen",
  "immaculate-conception": "Onbevlekte Ontvangenis",
  "saint-nicholas-day": "Sinterklaas",

  // Islamic calendar — the Dutch names, not the Arabic ones
  "eid-al-fitr": "Suikerfeest",
  "eid-al-adha": "Offerfeest",
  "islamic-new-year": "Islamitisch Nieuwjaar",
  ashura: "Asjoera",

  // Jewish calendar — Dutch transliterations
  "rosh-hashanah": "Rosj Hasjana",
  "yom-kippur": "Jom Kipoer",
  sukkot: "Loofhuttenfeest",
  hanukkah: "Chanoeka",
  purim: "Poerim",
  passover: "Pesach",
  shavuot: "Sjavoeot",

  // East Asian calendar
  "mid-autumn-festival": "Midherfstfeest",
  "dragon-boat-festival": "Drakenbootfestival",
  "qingming-festival": "Qingmingfestival",

  // Civic and national
  "labour-day": "Dag van de Arbeid",
  "independence-day": "Onafhankelijkheidsdag",
  "liberation-day": "Bevrijdingsdag", // 5 mei, one of the biggest Dutch date queries
  "german-unity-day": "Dag van de Duitse Eenheid",
  "bastille-day": "Quatorze Juillet", // Dutch keeps the French name for the French national day
  "republic-day": "Dag van de Republiek",
  "national-day": "Nationale feestdag",
  "constitution-day": "Dag van de Grondwet",
  "human-rights-day": "Dag van de Rechten van de Mens",

  // Family and commercial
  "mother-s-day": "Moederdag",
  "father-s-day": "Vaderdag",
  "valentine-s-day": "Valentijnsdag",
  carnival: "Carnaval",

  // Clocks
  "summer-time-begins-europe": "Zomertijd begint (Europa)",
  "summer-time-ends-europe": "Wintertijd begint (Europa)", // Dutch names the clock it moves to
  "daylight-saving-time-begins-us": "Zomertijd begint (VS)",
  "daylight-saving-time-ends-us": "Zomertijd eindigt (VS)",
  "daylight-saving-time-begins": "Zomertijd begint",
  "daylight-saving-time-ends": "Wintertijd begint",
  "leap-second": "Schrikkelseconde",
  "year-2038-problem": "Jaar 2038-probleem",

  // Sky
  "total-solar-eclipse": "Totale zonsverduistering",
  "total-lunar-eclipse": "Totale maansverduistering",
  "annular-solar-eclipse": "Ringvormige zonsverduistering",
  "partial-solar-eclipse": "Gedeeltelijke zonsverduistering",
  supermoon: "Supermaan",
  "blue-moon": "Blauwe maan",
  "harvest-moon": "Oogstmaan",
  "northern-hemisphere-summer-solstice": "Zomerzonnewende",
  "northern-hemisphere-winter-solstice": "Winterzonnewende",
  // Dutch readers are all on the northern hemisphere, so the seasons are named, not the months.
  "march-equinox": "Lente-equinox",
  "september-equinox": "Herfstequinox",
  "perseid-meteor-shower-peak": "Piek van de Perseïden",
  "geminid-meteor-shower-peak": "Piek van de Geminiden",
  "quadrantid-meteor-shower-peak": "Piek van de Quadrantiden",
  "lyrid-meteor-shower-peak": "Piek van de Lyriden",
  "orionid-meteor-shower-peak": "Piek van de Orioniden",
  "leonid-meteor-shower-peak": "Piek van de Leoniden",
  "ursid-meteor-shower-peak": "Piek van de Ursiden",
  "eta-aquariid-meteor-shower-peak": "Piek van de Eta-Aquariden",
  "world-space-week-begins": "Start van de Wereldruimtevaartweek",

  // Sport
  "summer-olympics": "Olympische Zomerspelen",
  "winter-olympics": "Olympische Winterspelen",
  "paralympic-games": "Paralympische Spelen",
  "fifa-world-cup": "WK voetbal", // "WK" is the query; "wereldkampioenschap" is written out far less
  "uefa-european-championship": "EK voetbal",
  "uefa-champions-league-final": "Champions League-finale",
  "africa-cup-of-nations": "Afrika Cup",
  "rugby-world-cup": "WK rugby",
  "cricket-world-cup": "WK cricket",
  "formula-one-season-start": "Start van het Formule 1-seizoen",
  "monaco-grand-prix": "Grand Prix van Monaco",
  "us-open-tennis": "US Open",
  "new-york-city-marathon": "Marathon van New York",
  "berlin-marathon": "Marathon van Berlijn",
  "chicago-marathon": "Marathon van Chicago",
  "tokyo-marathon": "Marathon van Tokio",

  // Culture
  "eurovision-song-contest": "Eurovisiesongfestival", // usually just "het Songfestival"
  "academy-awards": "Oscars",
  "golden-globe-awards": "Golden Globes",
  "cannes-film-festival": "Filmfestival van Cannes",
  "vienna-new-year-s-concert": "Nieuwjaarsconcert in Wenen",
  "nobel-prize-ceremony": "Nobelprijsuitreiking",

  // Observances
  "international-women-s-day": "Internationale Vrouwendag",
  "international-day-of-peace": "Internationale Dag van de Vrede",
  "international-friendship-day": "Internationale Dag van de Vriendschap",
  "international-literacy-day": "Internationale Dag van de Alfabetisering",
  "international-day-of-happiness": "Internationale Dag van het Geluk",
  "international-jazz-day": "Internationale Jazzdag",
  "international-coffee-day": "Internationale Koffiedag",
  "international-yoga-day": "Internationale Yogadag",
  "earth-day": "Dag van de Aarde",
  "world-environment-day": "Wereldmilieudag",
  "world-oceans-day": "Wereldoceanendag",
  "world-health-day": "Wereldgezondheidsdag",
  "world-water-day": "Wereldwaterdag",
  "world-book-day": "Wereldboekendag",
  "world-sleep-day": "Wereldslaapdag",
  "world-food-day": "Wereldvoedseldag",
  "world-photography-day": "Wereldfotografiedag",
  "world-emoji-day": "Wereld-emojidag",
  "world-ufo-day": "Wereld-ufodag",
  "public-domain-day": "Publiek Domein Dag",
  "darwin-day": "Darwindag",
  "programmers-day": "Dag van de Programmeur",
  "pi-day": "Pi-dag",
  "pi-approximation-day": "Pi-benaderingsdag",
};
