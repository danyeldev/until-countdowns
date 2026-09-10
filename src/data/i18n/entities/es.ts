/**
 * Spanish entity names.
 *
 * Bare names, no leading article: these strings are the `<h1>` of an event page and a breadcrumb
 * crumb as well as the `{title}` inside "¿Cuántos días faltan para …?", and "el Día de la Madre"
 * reads wrong in the first two positions. Anything with no settled Spanish name — Super Bowl,
 * Wimbledon, Halloween, Black Friday, Coachella, Juneteenth, the Hindu festivals — is left out on
 * purpose so it keeps the catalog's own title.
 */
import type { EntityNames } from "./index";

export const es: EntityNames = {
  // Calendar turns
  "new-year-s-day": "Año Nuevo",
  "new-year-s-eve": "Nochevieja", // peninsular; "Fin de Año" in much of Latin America
  "leap-day": "Día bisiesto",
  "friday-the-13th": "Viernes 13",
  "public-domain-day": "Día del Dominio Público",

  // Christmas and the Christian year
  "christmas-day": "Navidad",
  "christmas-eve": "Nochebuena",
  epiphany: "Día de Reyes", // the searched name; "Epifanía" is the liturgical one
  advent: "Adviento",
  lent: "Cuaresma",
  carnival: "Carnaval",
  "mardi-gras": "Martes de Carnaval",
  "ash-wednesday": "Miércoles de Ceniza",
  "palm-sunday": "Domingo de Ramos",
  "maundy-thursday": "Jueves Santo",
  "good-friday": "Viernes Santo",
  "easter-sunday": "Domingo de Resurrección",
  "easter-monday": "Lunes de Pascua",
  "orthodox-easter": "Pascua ortodoxa",
  "ascension-day": "Ascensión",
  pentecost: "Pentecostés",
  "whit-monday": "Lunes de Pentecostés",
  "assumption-of-mary": "Asunción de la Virgen",
  "all-saints-day": "Día de Todos los Santos",
  "all-souls-day": "Día de los Fieles Difuntos",
  "immaculate-conception": "Inmaculada Concepción",
  "saint-nicholas-day": "Día de San Nicolás",
  "saint-patrick-s-day": "Día de San Patricio",
  "saint-stephen-s-day": "Día de San Esteban",

  // Family and civic days
  "mother-s-day": "Día de la Madre",
  "father-s-day": "Día del Padre",
  "valentine-s-day": "San Valentín",
  "thanksgiving-day": "Día de Acción de Gracias",
  "labour-day": "Día del Trabajo",
  "labor-day": "Día del Trabajo (EE. UU.)", // kept apart from the 1 May holiday above
  "may-day": "Primero de Mayo",
  "independence-day": "Día de la Independencia",
  "veterans-day": "Día de los Veteranos",
  "presidents-day": "Día de los Presidentes",
  "martin-luther-king-jr-day": "Día de Martin Luther King",
  "columbus-day": "Día de Colón", // the US holiday; Spain's own 12 October is the Día de la Hispanidad
  "canada-day": "Día de Canadá",
  "bastille-day": "Día de la Bastilla",
  "german-unity-day": "Día de la Unidad Alemana",
  "australia-day": "Día de Australia",
  "republic-day": "Día de la República",
  "national-day": "Fiesta Nacional",
  "constitution-day": "Día de la Constitución",
  "liberation-day": "Día de la Liberación",

  // Islamic calendar
  ramadan: "Ramadán",
  "eid-al-fitr": "Fiesta del Fin del Ramadán", // how Eid al-Fitr is named in Spanish media
  "eid-al-adha": "Fiesta del Cordero", // the usual Spanish name for Eid al-Adha
  "islamic-new-year": "Año Nuevo islámico",
  "laylat-al-qadr": "Noche del Destino",

  // Jewish calendar
  "rosh-hashanah": "Rosh Hashaná",
  "yom-kippur": "Yom Kipur",
  sukkot: "Sucot",
  hanukkah: "Janucá",
  passover: "Pésaj",

  // East and Central Asia
  "chinese-new-year": "Año Nuevo Chino",
  "lunar-new-year": "Año Nuevo Lunar",
  "mid-autumn-festival": "Fiesta del Medio Otoño",
  "dragon-boat-festival": "Festival del Bote del Dragón",
  "qingming-festival": "Festival de Qingming",
  nowruz: "Año Nuevo persa", // what Spanish readers search for Nowruz

  // Spain's own
  "san-fermin": "Sanfermines",
  "fete-de-la-musique": "Fiesta de la Música",

  // Sport
  "summer-olympics": "Juegos Olímpicos de Verano",
  "winter-olympics": "Juegos Olímpicos de Invierno",
  "paralympic-games": "Juegos Paralímpicos",
  "fifa-world-cup": "Mundial de Fútbol", // "Mundial" is the query; "Copa Mundial de la FIFA" is not
  "uefa-champions-league-final": "Final de la Champions League",
  "uefa-european-championship": "Eurocopa",
  "africa-cup-of-nations": "Copa Africana de Naciones",
  "rugby-world-cup": "Mundial de Rugby",
  "cricket-world-cup": "Mundial de Críquet",
  "tour-de-france": "Tour de Francia",
  "formula-one-season-start": "Arranque de la temporada de Fórmula 1",
  "monaco-grand-prix": "Gran Premio de Mónaco",
  "nba-finals": "Finales de la NBA",
  "world-series": "Serie Mundial",
  "stanley-cup-finals": "Finales de la Copa Stanley",
  "australian-open": "Abierto de Australia",
  "the-masters": "Masters de Augusta",
  "boston-marathon": "Maratón de Boston",
  "new-york-city-marathon": "Maratón de Nueva York",
  "berlin-marathon": "Maratón de Berlín",
  "chicago-marathon": "Maratón de Chicago",
  "tokyo-marathon": "Maratón de Tokio",

  // Culture and awards
  "eurovision-song-contest": "Festival de Eurovisión",
  "academy-awards": "Premios Óscar",
  "golden-globe-awards": "Globos de Oro",
  "grammy-awards": "Premios Grammy",
  "cannes-film-festival": "Festival de Cannes",
  "vienna-new-year-s-concert": "Concierto de Año Nuevo de Viena",
  "nobel-prize-ceremony": "Ceremonia de los Premios Nobel",

  // Sky
  "total-solar-eclipse": "Eclipse solar total",
  "annular-solar-eclipse": "Eclipse solar anular",
  "partial-solar-eclipse": "Eclipse solar parcial",
  "total-lunar-eclipse": "Eclipse lunar total",
  supermoon: "Superluna",
  "blue-moon": "Luna azul",
  "harvest-moon": "Luna de la cosecha",
  "perseid-meteor-shower-peak": "Máximo de las Perseidas",
  "geminid-meteor-shower-peak": "Máximo de las Gemínidas",
  "quadrantid-meteor-shower-peak": "Máximo de las Cuadrántidas",
  "lyrid-meteor-shower-peak": "Máximo de las Líridas",
  "orionid-meteor-shower-peak": "Máximo de las Oriónidas",
  "leonid-meteor-shower-peak": "Máximo de las Leónidas",
  "ursid-meteor-shower-peak": "Máximo de las Úrsidas",
  "eta-aquariid-meteor-shower-peak": "Máximo de las Eta Acuáridas",
  "northern-hemisphere-summer-solstice": "Solsticio de verano (hemisferio norte)",
  "northern-hemisphere-winter-solstice": "Solsticio de invierno (hemisferio norte)",
  "march-equinox": "Equinoccio de marzo",
  "september-equinox": "Equinoccio de septiembre",
  "world-space-week-begins": "Comienzo de la Semana Mundial del Espacio",

  // Clocks
  "daylight-saving-time-begins": "Comienzo del horario de verano",
  "daylight-saving-time-ends": "Fin del horario de verano",
  "daylight-saving-time-begins-us": "Comienzo del horario de verano (EE. UU.)",
  "daylight-saving-time-ends-us": "Fin del horario de verano (EE. UU.)",
  "summer-time-begins-europe": "Comienzo del horario de verano (Europa)",
  "summer-time-ends-europe": "Fin del horario de verano (Europa)",
  "leap-second": "Segundo intercalar",
  "year-2038-problem": "Problema del año 2038",

  // International days and observances
  "international-women-s-day": "Día Internacional de la Mujer",
  "earth-day": "Día de la Tierra",
  "earth-hour": "La Hora del Planeta", // WWF's own Spanish name
  "world-environment-day": "Día Mundial del Medio Ambiente",
  "world-oceans-day": "Día Mundial de los Océanos",
  "world-health-day": "Día Mundial de la Salud",
  "world-water-day": "Día Mundial del Agua",
  "world-book-day": "Día Mundial del Libro",
  "world-sleep-day": "Día Mundial del Sueño",
  "world-food-day": "Día Mundial de la Alimentación",
  "international-day-of-happiness": "Día Internacional de la Felicidad",
  "international-day-of-peace": "Día Internacional de la Paz",
  "international-friendship-day": "Día Internacional de la Amistad",
  "international-literacy-day": "Día Internacional de la Alfabetización",
  "international-jazz-day": "Día Internacional del Jazz",
  "international-coffee-day": "Día Internacional del Café",
  "international-yoga-day": "Día Internacional del Yoga",
  "human-rights-day": "Día de los Derechos Humanos",
  "world-photography-day": "Día Mundial de la Fotografía",
  "world-emoji-day": "Día Mundial del Emoji",

  // Science, tech and the merely fun
  "pi-day": "Día de Pi",
  "pi-approximation-day": "Día de la Aproximación de Pi",
  "darwin-day": "Día de Darwin",
  "carl-sagan-day": "Día de Carl Sagan",
  "ada-lovelace-day": "Día de Ada Lovelace",
  "programmers-day": "Día del Programador",
  "doomsday-clock-announcement": "Anuncio del Reloj del Juicio Final",
  "star-wars-day": "Día de Star Wars",
  "may-the-fourth-star-wars-day": "Día de Star Wars",
  "towel-day": "Día de la Toalla",
  "talk-like-a-pirate-day": "Día de Hablar como un Pirata",
  "world-ufo-day": "Día Mundial del OVNI",
  "singles-day": "Día del Soltero",
};
