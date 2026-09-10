/**
 * French entity names.
 *
 * Bare names, no leading article: these strings are the `<h1>` of an event page, a breadcrumb crumb
 * and the `{title}` inside "Combien de jours avant … ?", and "la Fête des Mères" reads wrong in the
 * first two. The templates in `messages/fr.ts` are written so that no article is ever needed in
 * front of one — French would have to choose it by gender and elide it before a vowel, and neither
 * is knowable from a template.
 *
 * Anything with no settled French name — Super Bowl, Wimbledon, Halloween, Black Friday, Roland-
 * Garros, Coachella, Diwali, the Hindu festivals — is left out on purpose so it keeps the catalog's
 * own title, which is what a French reader types anyway.
 */
import type { EntityNames } from "./index";

export const fr: EntityNames = {
  // Turns of the calendar
  "new-year-s-day": "Jour de l’An",
  "new-year-s-eve": "Réveillon du Nouvel An", // also "Saint-Sylvestre"; the réveillon is the query
  "leap-day": "Jour bissextile",
  "friday-the-13th": "Vendredi 13",
  "public-domain-day": "Journée du domaine public",

  // Christmas and the Christian year
  "christmas-day": "Noël",
  "christmas-eve": "Réveillon de Noël",
  epiphany: "Épiphanie",
  advent: "Avent",
  lent: "Carême",
  carnival: "Carnaval",
  "mardi-gras": "Mardi gras",
  "ash-wednesday": "Mercredi des Cendres",
  "palm-sunday": "Dimanche des Rameaux",
  "maundy-thursday": "Jeudi saint",
  "good-friday": "Vendredi saint",
  "easter-sunday": "Pâques", // French names the day itself, not "dimanche de Pâques"
  "easter-monday": "Lundi de Pâques",
  "orthodox-easter": "Pâques orthodoxes",
  "ascension-day": "Ascension",
  pentecost: "Pentecôte",
  "whit-monday": "Lundi de Pentecôte",
  "corpus-christi": "Fête-Dieu",
  "assumption-of-mary": "Assomption",
  "all-saints-day": "Toussaint",
  "all-souls-day": "Jour des morts",
  "immaculate-conception": "Immaculée Conception",
  "saint-nicholas-day": "Saint-Nicolas",
  "saint-patrick-s-day": "Saint-Patrick",
  "saint-stephen-s-day": "Saint-Étienne",

  // Family and civic days
  "mother-s-day": "Fête des Mères",
  "father-s-day": "Fête des Pères",
  "valentine-s-day": "Saint-Valentin",
  "thanksgiving-day": "Thanksgiving", // no French name; the English one is what is searched
  "labour-day": "Fête du Travail",
  "labor-day": "Labor Day (États-Unis)", // kept apart from the 1 May holiday above
  "may-day": "Premier Mai",
  "independence-day": "Jour de l’Indépendance",
  "veterans-day": "Journée des anciens combattants",
  "presidents-day": "Journée des présidents",
  "martin-luther-king-jr-day": "Journée Martin Luther King",
  "columbus-day": "Jour de Christophe Colomb",
  "canada-day": "Fête du Canada",
  "bastille-day": "14 Juillet", // what France calls and searches for its own national day
  "german-unity-day": "Jour de l’Unité allemande",
  "republic-day": "Jour de la République",
  "national-day": "Fête nationale",
  "constitution-day": "Jour de la Constitution",
  "liberation-day": "Jour de la Libération",
  "victoria-day": "Fête de la Reine", // the Canadian holiday, under its French-Canadian name

  // Islamic calendar
  "eid-al-fitr": "Aïd el-Fitr",
  "eid-al-adha": "Aïd el-Kébir", // the usual French name for Eid al-Adha
  "islamic-new-year": "Nouvel An musulman",
  ashura: "Achoura",
  "laylat-al-qadr": "Nuit du Destin",
  "isra-and-mi-raj": "Isra et Miraj",

  // Jewish calendar
  "rosh-hashanah": "Roch Hachana",
  "yom-kippur": "Yom Kippour",
  sukkot: "Souccot",
  hanukkah: "Hanouka",
  purim: "Pourim",
  passover: "Pessah", // "Pâque juive" is the other French name
  shavuot: "Chavouot",

  // East and Central Asia
  "chinese-new-year": "Nouvel An chinois",
  "lunar-new-year": "Nouvel An lunaire",
  "mid-autumn-festival": "Fête de la mi-automne",
  "dragon-boat-festival": "Fête des bateaux-dragons",
  "qingming-festival": "Fête de Qingming",
  nowruz: "Norouz",

  // French and Spanish festivities
  "fete-de-la-musique": "Fête de la Musique",
  "san-fermin": "Fêtes de la San Fermín",

  // Sport
  "summer-olympics": "Jeux olympiques d’été",
  "winter-olympics": "Jeux olympiques d’hiver",
  "paralympic-games": "Jeux paralympiques",
  "fifa-world-cup": "Coupe du monde de football",
  "uefa-champions-league-final": "Finale de la Ligue des champions",
  "uefa-european-championship": "Euro de football", // "Euro" is the query; "Championnat d’Europe" is not
  "africa-cup-of-nations": "Coupe d’Afrique des nations",
  "rugby-world-cup": "Coupe du monde de rugby",
  "cricket-world-cup": "Coupe du monde de cricket",
  "formula-one-season-start": "Début de la saison de Formule 1",
  "monaco-grand-prix": "Grand Prix de Monaco",
  "nba-finals": "Finales NBA",
  "stanley-cup-finals": "Finale de la Coupe Stanley",
  "australian-open": "Open d’Australie",
  "us-open-tennis": "US Open de tennis", // the qualifier separates it from the golf major
  "the-masters": "Masters d’Augusta",
  "boston-marathon": "Marathon de Boston",
  "new-york-city-marathon": "Marathon de New York",
  "berlin-marathon": "Marathon de Berlin",
  "chicago-marathon": "Marathon de Chicago",
  "tokyo-marathon": "Marathon de Tokyo",

  // Culture and awards
  "eurovision-song-contest": "Concours Eurovision de la chanson",
  "academy-awards": "Cérémonie des Oscars",
  "golden-globe-awards": "Golden Globes",
  "cannes-film-festival": "Festival de Cannes",
  "vienna-new-year-s-concert": "Concert du Nouvel An de Vienne",
  "nobel-prize-ceremony": "Cérémonie des prix Nobel",

  // Sky
  "total-solar-eclipse": "Éclipse solaire totale",
  "annular-solar-eclipse": "Éclipse solaire annulaire",
  "partial-solar-eclipse": "Éclipse solaire partielle",
  "total-lunar-eclipse": "Éclipse lunaire totale",
  supermoon: "Superlune",
  "blue-moon": "Lune bleue",
  "harvest-moon": "Lune des moissons",
  "perseid-meteor-shower-peak": "Pic des Perséides",
  "geminid-meteor-shower-peak": "Pic des Géminides",
  "quadrantid-meteor-shower-peak": "Pic des Quadrantides",
  "lyrid-meteor-shower-peak": "Pic des Lyrides",
  "orionid-meteor-shower-peak": "Pic des Orionides",
  "leonid-meteor-shower-peak": "Pic des Léonides",
  "ursid-meteor-shower-peak": "Pic des Ursides",
  "eta-aquariid-meteor-shower-peak": "Pic des Eta Aquarides",
  "northern-hemisphere-summer-solstice": "Solstice d’été (hémisphère nord)",
  "northern-hemisphere-winter-solstice": "Solstice d’hiver (hémisphère nord)",
  "march-equinox": "Équinoxe de mars",
  "september-equinox": "Équinoxe de septembre",
  "world-space-week-begins": "Début de la Semaine mondiale de l’espace",

  // Clocks
  "daylight-saving-time-begins": "Passage à l’heure d’été",
  "daylight-saving-time-ends": "Passage à l’heure d’hiver",
  "daylight-saving-time-begins-us": "Passage à l’heure d’été (États-Unis)",
  "daylight-saving-time-ends-us": "Passage à l’heure d’hiver (États-Unis)",
  "summer-time-begins-europe": "Passage à l’heure d’été (Europe)",
  "summer-time-ends-europe": "Passage à l’heure d’hiver (Europe)",
  "leap-second": "Seconde intercalaire",
  "year-2038-problem": "Bug de l’an 2038",

  // International days and observances
  "international-women-s-day": "Journée internationale des droits des femmes", // the name used in France
  "earth-day": "Jour de la Terre",
  "earth-hour": "Une heure pour la planète", // WWF France's own name for Earth Hour
  "world-environment-day": "Journée mondiale de l’environnement",
  "world-oceans-day": "Journée mondiale de l’océan",
  "world-health-day": "Journée mondiale de la santé",
  "world-water-day": "Journée mondiale de l’eau",
  "world-book-day": "Journée mondiale du livre",
  "world-sleep-day": "Journée mondiale du sommeil",
  "world-food-day": "Journée mondiale de l’alimentation",
  "world-photography-day": "Journée mondiale de la photographie",
  "world-emoji-day": "Journée mondiale de l’emoji",
  "world-ufo-day": "Journée mondiale des ovnis",
  "international-day-of-happiness": "Journée internationale du bonheur",
  "international-day-of-peace": "Journée internationale de la paix",
  "international-friendship-day": "Journée internationale de l’amitié",
  "international-literacy-day": "Journée internationale de l’alphabétisation",
  "international-jazz-day": "Journée internationale du jazz",
  "international-coffee-day": "Journée internationale du café",
  "international-yoga-day": "Journée internationale du yoga",
  "human-rights-day": "Journée des droits de l’homme",
  "singles-day": "Journée des célibataires",
  "star-wars-day": "Journée Star Wars",
  "pi-day": "Journée de pi",
  "pi-approximation-day": "Journée de l’approximation de pi",
  "towel-day": "Journée de la serviette",
  "talk-like-a-pirate-day": "Journée internationale du parler pirate",
  "ada-lovelace-day": "Journée Ada Lovelace",
  "programmers-day": "Journée du programmeur",
  "carl-sagan-day": "Journée Carl Sagan",
  "darwin-day": "Journée Darwin",
  "doomsday-clock-announcement": "Annonce de l’horloge de l’Apocalypse", // French media name it that
};
