/**
 * Polish entity names. Keys come from `keys.ts`.
 *
 * Bare nominative names, no articles and no declension: each string is an `<h1>`, a breadcrumb and
 * the `{title}` inside "Ile dni do: …?", where the catalogue can only ever hand over the base form.
 * Anything Poles call by its English name — Halloween, Black Friday, Super Bowl, Oktoberfest,
 * Wimbledon, Roland Garros, Coachella, Met Gala, the marathons, the Hindu festivals, most US-only
 * holidays — is left out on purpose, so those pages keep the title people actually type.
 */
import type { EntityNames } from "./index";

export const pl: EntityNames = {
  // Przełom roku
  "new-year-s-day": "Nowy Rok",
  "new-year-s-eve": "Sylwester", // 31 grudnia; "Nowy Rok" to już 1 stycznia
  "leap-day": "Dzień przestępny",
  "friday-the-13th": "Piątek trzynastego",

  // Rok kościelny
  "christmas-day": "Boże Narodzenie",
  "christmas-eve": "Wigilia",
  "boxing-day": "Drugi dzień świąt Bożego Narodzenia", // polskie 26 grudnia, nie kalka z Boxing Day
  epiphany: "Trzech Króli", // formalnie Objawienie Pańskie, ale szuka się "Trzech Króli"
  advent: "Adwent",
  lent: "Wielki Post",
  carnival: "Karnawał",
  "mardi-gras": "Ostatki", // wtorek kończący karnawał; polskim odpowiednikiem obchodów jest tłusty czwartek
  "ash-wednesday": "Środa Popielcowa",
  "palm-sunday": "Niedziela Palmowa",
  "maundy-thursday": "Wielki Czwartek",
  "good-friday": "Wielki Piątek",
  "easter-sunday": "Wielkanoc", // zapytanie; formalna nazwa to Niedziela Wielkanocna
  "easter-monday": "Poniedziałek Wielkanocny", // lany poniedziałek, śmigus-dyngus
  "orthodox-easter": "Wielkanoc prawosławna",
  "ascension-day": "Wniebowstąpienie Pańskie",
  pentecost: "Zielone Świątki", // potoczna nazwa Zesłania Ducha Świętego i ta wyszukiwana
  "whit-monday": "Poniedziałek Zielonych Świątek",
  "corpus-christi": "Boże Ciało",
  "assumption-of-mary": "Wniebowzięcie Najświętszej Maryi Panny",
  "all-saints-day": "Wszystkich Świętych",
  "all-souls-day": "Zaduszki",
  "immaculate-conception": "Niepokalane Poczęcie",
  "saint-nicholas-day": "Mikołajki",
  "saint-stephen-s-day": "Dzień Świętego Szczepana",
  "saint-patrick-s-day": "Dzień Świętego Patryka",

  // Dni rodzinne i państwowe
  "mother-s-day": "Dzień Matki",
  "father-s-day": "Dzień Ojca",
  "valentine-s-day": "Walentynki",
  "thanksgiving-day": "Święto Dziękczynienia",
  "international-women-s-day": "Dzień Kobiet",
  "labour-day": "Święto Pracy", // 1 maja
  "labor-day": "Święto Pracy (USA)", // wrześniowe święto amerykańskie, trzymane osobno
  "may-day": "Pierwszy Maja",
  "independence-day": "Dzień Niepodległości",
  "national-day": "Święto Narodowe",
  "republic-day": "Święto Republiki",
  "constitution-day": "Święto Konstytucji",
  "liberation-day": "Dzień Wyzwolenia",
  "german-unity-day": "Dzień Jedności Niemiec",
  "bastille-day": "Dzień Bastylii", // potocznie; formalnie Święto Narodowe Francji
  "canada-day": "Dzień Kanady",
  "australia-day": "Dzień Australii",
  "columbus-day": "Dzień Kolumba",
  "veterans-day": "Dzień Weteranów",
  "martin-luther-king-jr-day": "Dzień Martina Luthera Kinga",
  "human-rights-day": "Dzień Praw Człowieka",

  // Zegary
  "summer-time-begins-europe": "Zmiana czasu na letni (Europa)", // "zmiana czasu" jest zapytaniem, nie "czas letni"
  "summer-time-ends-europe": "Zmiana czasu na zimowy (Europa)",
  "daylight-saving-time-begins": "Zmiana czasu na letni",
  "daylight-saving-time-ends": "Zmiana czasu na zimowy",
  "daylight-saving-time-begins-us": "Zmiana czasu na letni (USA)",
  "daylight-saving-time-ends-us": "Zmiana czasu na zimowy (USA)",
  "leap-second": "Sekunda przestępna",
  "year-2038-problem": "Problem roku 2038",

  // Islam
  ramadan: "Ramadan",
  "eid-al-fitr": "Id al-Fitr", // po polsku także Ramadan Bajram
  "eid-al-adha": "Id al-Adha", // Kurban Bajram, Święto Ofiarowania
  "islamic-new-year": "Muzułmański Nowy Rok",
  ashura: "Aszura",
  "laylat-al-qadr": "Noc Przeznaczenia",

  // Judaizm
  "rosh-hashanah": "Rosz ha-Szana",
  "yom-kippur": "Jom Kipur",
  sukkot: "Sukot",
  hanukkah: "Chanuka",
  purim: "Purim",
  passover: "Pesach",
  shavuot: "Szawuot",

  // Azja
  "chinese-new-year": "Chiński Nowy Rok",
  "lunar-new-year": "Księżycowy Nowy Rok", // nazwa ogólnoazjatycka, trzymana osobno od chińskiej
  "mid-autumn-festival": "Święto Środka Jesieni",
  "dragon-boat-festival": "Święto Smoczych Łodzi",
  "qingming-festival": "Święto Qingming",
  vesak: "Wesak",
  nowruz: "Nouruz",

  // Sport
  "summer-olympics": "Letnie Igrzyska Olimpijskie",
  "winter-olympics": "Zimowe Igrzyska Olimpijskie",
  "paralympic-games": "Igrzyska Paraolimpijskie",
  "fifa-world-cup": "Mistrzostwa Świata w Piłce Nożnej",
  "uefa-european-championship": "Mistrzostwa Europy w Piłce Nożnej",
  "uefa-champions-league-final": "Finał Ligi Mistrzów",
  "africa-cup-of-nations": "Puchar Narodów Afryki",
  "rugby-world-cup": "Puchar Świata w Rugby",
  "cricket-world-cup": "Puchar Świata w Krykiecie",
  "formula-one-season-start": "Początek sezonu Formuły 1",
  "monaco-grand-prix": "Grand Prix Monako",
  "nba-finals": "Finały NBA",
  "stanley-cup-finals": "Finały o Puchar Stanleya",

  // Ekran, scena i nagrody
  "academy-awards": "Oscary", // gala rozdania Oscarów; nikt nie szuka "Nagród Akademii"
  "golden-globe-awards": "Złote Globy",
  "grammy-awards": "Nagrody Grammy",
  "cannes-film-festival": "Festiwal Filmowy w Cannes",
  "eurovision-song-contest": "Eurowizja", // formalnie Konkurs Piosenki Eurowizji
  "vienna-new-year-s-concert": "Koncert Noworoczny w Wiedniu",
  "nobel-prize-ceremony": "Wręczenie Nagród Nobla",
  "fete-de-la-musique": "Święto Muzyki",
  "international-jazz-day": "Międzynarodowy Dzień Jazzu",

  // Niebo
  "total-solar-eclipse": "Całkowite zaćmienie Słońca",
  "annular-solar-eclipse": "Obrączkowe zaćmienie Słońca",
  "partial-solar-eclipse": "Częściowe zaćmienie Słońca",
  "total-lunar-eclipse": "Całkowite zaćmienie Księżyca",
  supermoon: "Superksiężyc",
  "blue-moon": "Błękitny Księżyc",
  "harvest-moon": "Księżyc Żniwiarzy", // wrześniowa pełnia, tak nazywana w polskich mediach
  "northern-hemisphere-summer-solstice": "Przesilenie letnie",
  "northern-hemisphere-winter-solstice": "Przesilenie zimowe",
  "march-equinox": "Równonoc wiosenna", // wyszukiwana nazwa; astronomicznie równonoc marcowa
  "september-equinox": "Równonoc jesienna",
  "perseid-meteor-shower-peak": "Maksimum Perseidów",
  "geminid-meteor-shower-peak": "Maksimum Geminidów",
  "quadrantid-meteor-shower-peak": "Maksimum Kwadrantydów",
  "lyrid-meteor-shower-peak": "Maksimum Lirydów",
  "orionid-meteor-shower-peak": "Maksimum Orionidów",
  "leonid-meteor-shower-peak": "Maksimum Leonidów",
  "ursid-meteor-shower-peak": "Maksimum Ursydów",
  "eta-aquariid-meteor-shower-peak": "Maksimum Eta Akwarydów",
  "world-space-week-begins": "Światowy Tydzień Przestrzeni Kosmicznej", // wydarzeniem jest początek tygodnia
  "doomsday-clock-announcement": "Zegar Zagłady", // wyszukiwana nazwa; wydarzeniem jest doroczne ustawienie wskazówek

  // Dni międzynarodowe i tematyczne
  "earth-day": "Dzień Ziemi",
  "earth-hour": "Godzina dla Ziemi",
  "world-environment-day": "Światowy Dzień Środowiska",
  "world-oceans-day": "Światowy Dzień Oceanów",
  "world-water-day": "Światowy Dzień Wody",
  "world-health-day": "Światowy Dzień Zdrowia",
  "world-food-day": "Światowy Dzień Żywności",
  "world-book-day": "Światowy Dzień Książki",
  "world-sleep-day": "Światowy Dzień Snu",
  "world-photography-day": "Światowy Dzień Fotografii",
  "world-emoji-day": "Światowy Dzień Emoji",
  "world-ufo-day": "Światowy Dzień UFO",
  "international-day-of-happiness": "Międzynarodowy Dzień Szczęścia",
  "international-day-of-peace": "Międzynarodowy Dzień Pokoju",
  "international-friendship-day": "Międzynarodowy Dzień Przyjaźni",
  "international-literacy-day": "Międzynarodowy Dzień Alfabetyzacji",
  "international-coffee-day": "Międzynarodowy Dzień Kawy",
  "international-yoga-day": "Międzynarodowy Dzień Jogi",
  "public-domain-day": "Dzień Domeny Publicznej",
  "programmers-day": "Dzień Programisty",
  "ada-lovelace-day": "Dzień Ady Lovelace",
  "darwin-day": "Dzień Darwina",
  "pi-day": "Dzień Liczby Pi",
  "pi-approximation-day": "Dzień Przybliżenia Liczby Pi",
  "towel-day": "Dzień Ręcznika",
  "talk-like-a-pirate-day": "Dzień Mówienia jak Pirat",
  "singles-day": "Dzień Singla",
  "star-wars-day": "Dzień Gwiezdnych Wojen",
  "may-the-fourth-star-wars-day": "Dzień Gwiezdnych Wojen (May the 4th)",
};
