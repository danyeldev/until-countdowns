/**
 * Italian entity names.
 *
 * Written bare, with no definite article ("Natale", not "Il Natale"), because the templates in
 * `src/lib/i18n/messages/it.ts` put these behind "a" / "da" or at the head of a clause, where an
 * article would have to agree with a gender this file cannot pass along.
 *
 * Anything Italians say in English is left out on purpose — Halloween, Black Friday, Super Bowl,
 * Wimbledon, Eurovision, Ramadan, Diwali all keep the catalog's own title, which is what an Italian
 * reader types anyway. Padding those in would only add rows nobody searches for.
 */
import type { EntityNames } from "./index";

export const it: EntityNames = {
  // Calendar and civil year
  "new-year-s-day": "Capodanno",
  "new-year-s-eve": "San Silvestro", // the night of 31 December; "Capodanno" is taken by 1 January
  "leap-day": "Giorno bisestile",
  "public-domain-day": "Giornata del pubblico dominio",
  "friday-the-13th": "Venerdì 13", // the Italian unlucky day is Friday the 17th, but the date here is the 13th
  "daylight-saving-time-begins": "Inizio dell’ora legale",
  "daylight-saving-time-ends": "Fine dell’ora legale",
  "daylight-saving-time-begins-us": "Inizio dell’ora legale (USA)",
  "daylight-saving-time-ends-us": "Fine dell’ora legale (USA)",
  "summer-time-begins-europe": "Inizio dell’ora legale (Europa)",
  "summer-time-ends-europe": "Fine dell’ora legale (Europa)",

  // Christian year
  "christmas-day": "Natale",
  "christmas-eve": "Vigilia di Natale",
  "saint-stephen-s-day": "Santo Stefano", // 26 December is Santo Stefano in Italy; Boxing Day stays English
  epiphany: "Epifania", // popularly "la Befana"
  advent: "Avvento",
  lent: "Quaresima",
  "ash-wednesday": "Mercoledì delle Ceneri",
  "palm-sunday": "Domenica delle Palme",
  "maundy-thursday": "Giovedì Santo",
  "good-friday": "Venerdì Santo",
  "easter-sunday": "Pasqua",
  "easter-monday": "Pasquetta", // formally "Lunedì dell’Angelo"; nobody searches for that
  "orthodox-easter": "Pasqua ortodossa",
  "ascension-day": "Ascensione",
  pentecost: "Pentecoste",
  "whit-monday": "Lunedì di Pentecoste",
  "corpus-christi": "Corpus Domini",
  "assumption-of-mary": "Ferragosto", // 15 August is Ferragosto in Italy, far ahead of "Assunzione di Maria"
  "all-saints-day": "Ognissanti",
  "all-souls-day": "Commemorazione dei defunti",
  "immaculate-conception": "Immacolata Concezione",
  "saint-nicholas-day": "San Nicola",
  "saint-patrick-s-day": "San Patrizio",

  // Other religious calendars
  "islamic-new-year": "Capodanno islamico",
  passover: "Pasqua ebraica",

  // Festivals and folk dates
  carnival: "Carnevale",
  "mardi-gras": "Martedì grasso",
  "chinese-new-year": "Capodanno cinese",
  "lunar-new-year": "Capodanno lunare",
  "mid-autumn-festival": "Festa di metà autunno",
  "dragon-boat-festival": "Festa delle barche drago",
  "qingming-festival": "Festa di Qingming",
  "fete-de-la-musique": "Festa della Musica",
  "valentine-s-day": "San Valentino",
  "mother-s-day": "Festa della mamma",
  "father-s-day": "Festa del papà",
  "thanksgiving-day": "Giorno del Ringraziamento",

  // National and civic days
  "labour-day": "Festa del Lavoro",
  "may-day": "Primo Maggio",
  "republic-day": "Festa della Repubblica",
  "liberation-day": "Festa della Liberazione",
  "national-day": "Festa nazionale",
  "constitution-day": "Giorno della Costituzione",
  "independence-day": "Giorno dell’indipendenza",
  "bastille-day": "Presa della Bastiglia",
  "german-unity-day": "Giorno dell’Unità tedesca",

  // Observances
  "international-women-s-day": "Festa della donna", // what Italians search; "Giornata internazionale della donna" is the formal name
  "earth-day": "Giornata della Terra",
  "earth-hour": "Ora della Terra",
  "world-environment-day": "Giornata mondiale dell’ambiente",
  "world-oceans-day": "Giornata mondiale degli oceani",
  "world-health-day": "Giornata mondiale della salute",
  "world-water-day": "Giornata mondiale dell’acqua",
  "world-book-day": "Giornata mondiale del libro",
  "world-sleep-day": "Giornata mondiale del sonno",
  "world-food-day": "Giornata mondiale dell’alimentazione",
  "world-photography-day": "Giornata mondiale della fotografia",
  "world-emoji-day": "Giornata mondiale delle emoji",
  "world-ufo-day": "Giornata mondiale degli UFO",
  "international-coffee-day": "Giornata internazionale del caffè",
  "international-yoga-day": "Giornata internazionale dello yoga",
  "international-day-of-happiness": "Giornata internazionale della felicità",
  "international-day-of-peace": "Giornata internazionale della pace",
  "international-friendship-day": "Giornata internazionale dell’amicizia",
  "international-literacy-day": "Giornata internazionale dell’alfabetizzazione",
  "international-jazz-day": "Giornata internazionale del jazz",
  "human-rights-day": "Giornata dei diritti umani",
  "programmers-day": "Giornata del programmatore",
  "pi-day": "Giornata del pi greco",
  "pi-approximation-day": "Giornata dell’approssimazione del pi greco",
  "talk-like-a-pirate-day": "Giornata del parlare come un pirata",
  "world-space-week-begins": "Inizio della Settimana mondiale dello spazio",

  // Sky
  "northern-hemisphere-summer-solstice": "Solstizio d’estate", // Italy reads the northern sky, so no hemisphere in the name
  "northern-hemisphere-winter-solstice": "Solstizio d’inverno",
  "march-equinox": "Equinozio di primavera",
  "september-equinox": "Equinozio d’autunno",
  "total-solar-eclipse": "Eclissi solare totale",
  "annular-solar-eclipse": "Eclissi solare anulare",
  "partial-solar-eclipse": "Eclissi solare parziale",
  "total-lunar-eclipse": "Eclissi lunare totale",
  supermoon: "Superluna",
  "blue-moon": "Luna blu",
  "harvest-moon": "Luna del raccolto",
  "perseid-meteor-shower-peak": "Picco delle Perseidi", // popularly "le lacrime di San Lorenzo"
  "geminid-meteor-shower-peak": "Picco delle Geminidi",
  "quadrantid-meteor-shower-peak": "Picco delle Quadrantidi",
  "lyrid-meteor-shower-peak": "Picco delle Liridi",
  "orionid-meteor-shower-peak": "Picco delle Orionidi",
  "leonid-meteor-shower-peak": "Picco delle Leonidi",
  "ursid-meteor-shower-peak": "Picco delle Ursidi",
  "eta-aquariid-meteor-shower-peak": "Picco delle Eta Aquaridi",

  // Sport
  "summer-olympics": "Olimpiadi estive",
  "winter-olympics": "Olimpiadi invernali",
  "paralympic-games": "Giochi paralimpici",
  "fifa-world-cup": "Mondiali di calcio",
  "uefa-european-championship": "Europei di calcio",
  "uefa-champions-league-final": "Finale di Champions League",
  "copa-america": "Copa América", // kept in Spanish: in Italian "Coppa America" is the sailing trophy
  "africa-cup-of-nations": "Coppa d’Africa",
  "rugby-world-cup": "Coppa del Mondo di rugby",
  "cricket-world-cup": "Coppa del Mondo di cricket",
  "formula-one-season-start": "Inizio della stagione di Formula 1",
  "monaco-grand-prix": "Gran Premio di Monaco",
  "nba-finals": "Finali NBA",
  "stanley-cup-finals": "Finali della Stanley Cup",
  "boston-marathon": "Maratona di Boston",
  "new-york-city-marathon": "Maratona di New York",
  "berlin-marathon": "Maratona di Berlino",
  "chicago-marathon": "Maratona di Chicago",
  "tokyo-marathon": "Maratona di Tokyo",

  // Culture and awards
  "academy-awards": "Premi Oscar",
  "golden-globe-awards": "Golden Globe", // Italian drops the plural s
  "cannes-film-festival": "Festival di Cannes",
  "nobel-prize-ceremony": "Cerimonia dei premi Nobel",
  "vienna-new-year-s-concert": "Concerto di Capodanno di Vienna",
  "doomsday-clock-announcement": "Annuncio dell’Orologio dell’Apocalisse",

  // Tech curiosities
  "year-2038-problem": "Problema dell’anno 2038",
  "leap-second": "Secondo intercalare",
};
