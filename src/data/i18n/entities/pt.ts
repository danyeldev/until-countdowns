/**
 * Brazilian Portuguese entity names. Keys come from `keys.ts`; see `src/lib/i18n/content.ts`.
 *
 * Omitted where Brazil uses the English name itself (Halloween, Black Friday, Super Bowl, Boxing
 * Day, Coachella, Wimbledon): a translation nobody types would only bury the page.
 */
import type { EntityNames } from "./index";

export const pt: EntityNames = {
  // Calendar turn
  "new-year-s-day": "Ano Novo",
  "new-year-s-eve": "Réveillon", // what Brazilians call 31 December; "véspera de Ano Novo" is not the query
  "leap-day": "Dia bissexto",
  "friday-the-13th": "Sexta-feira 13",
  "public-domain-day": "Dia do Domínio Público",

  // Christian year
  "christmas-day": "Natal",
  "christmas-eve": "Véspera de Natal",
  epiphany: "Dia de Reis", // Brazil's name for Epiphany
  "ash-wednesday": "Quarta-feira de Cinzas",
  lent: "Quaresma",
  "palm-sunday": "Domingo de Ramos",
  "maundy-thursday": "Quinta-feira Santa",
  "good-friday": "Sexta-feira Santa",
  "easter-sunday": "Páscoa", // never "Domingo de Páscoa" in a search box
  "easter-monday": "Segunda-feira de Páscoa",
  "orthodox-easter": "Páscoa Ortodoxa",
  "ascension-day": "Dia da Ascensão",
  pentecost: "Pentecostes",
  "whit-monday": "Segunda-feira de Pentecostes",
  "assumption-of-mary": "Assunção de Nossa Senhora",
  "all-saints-day": "Dia de Todos os Santos",
  "all-souls-day": "Dia de Finados", // the Brazilian holiday name, not "Dia das Almas"
  advent: "Advento",
  "immaculate-conception": "Imaculada Conceição",
  "saint-nicholas-day": "Dia de São Nicolau",
  "saint-patrick-s-day": "Dia de São Patrício",
  "saint-stephen-s-day": "Dia de Santo Estêvão",

  // Family and affection
  "mother-s-day": "Dia das Mães",
  "father-s-day": "Dia dos Pais",
  "valentine-s-day": "Dia de São Valentim", // 14 Feb; Brazil's Dia dos Namorados is 12 June, a different date
  "singles-day": "Dia dos Solteiros",

  // Carnival and festivals
  carnival: "Carnaval",
  "mardi-gras": "Terça-feira de Carnaval", // Fat Tuesday, as Brazil names it

  // Civic and national
  "labour-day": "Dia do Trabalho",
  "labor-day": "Dia do Trabalho (EUA)", // the September US holiday, kept apart from 1 May
  "may-day": "Primeiro de Maio",
  "independence-day": "Dia da Independência",
  "republic-day": "Dia da República",
  "national-day": "Dia Nacional",
  "constitution-day": "Dia da Constituição",
  "liberation-day": "Dia da Libertação",
  "veterans-day": "Dia dos Veteranos",
  "presidents-day": "Dia dos Presidentes",
  "martin-luther-king-jr-day": "Dia de Martin Luther King Jr.",
  "columbus-day": "Dia de Colombo",
  "canada-day": "Dia do Canadá",
  "australia-day": "Dia da Austrália",
  "bastille-day": "Queda da Bastilha", // how the Brazilian press names 14 July
  "german-unity-day": "Dia da Unidade Alemã",
  "thanksgiving-day": "Dia de Ação de Graças",
  "human-rights-day": "Dia dos Direitos Humanos",

  // Clocks
  "daylight-saving-time-begins": "Início do horário de verão",
  "daylight-saving-time-ends": "Fim do horário de verão",
  "daylight-saving-time-begins-us": "Início do horário de verão (EUA)",
  "daylight-saving-time-ends-us": "Fim do horário de verão (EUA)",
  "summer-time-begins-europe": "Início do horário de verão (Europa)",
  "summer-time-ends-europe": "Fim do horário de verão (Europa)",
  "leap-second": "Segundo bissexto",
  "year-2038-problem": "Problema do ano 2038",

  // Islamic and Jewish calendars
  ramadan: "Ramadã",
  "islamic-new-year": "Ano Novo Islâmico",
  "rosh-hashanah": "Rosh Hashaná",
  "yom-kippur": "Yom Kipur",
  sukkot: "Sucot",
  hanukkah: "Hanucá",
  passover: "Pessach",

  // East Asian calendar
  "chinese-new-year": "Ano Novo Chinês",
  "lunar-new-year": "Ano Novo Lunar",
  "mid-autumn-festival": "Festival do Meio do Outono",
  "dragon-boat-festival": "Festival do Barco-Dragão",
  "qingming-festival": "Festival Qingming",

  // Sky
  "total-solar-eclipse": "Eclipse solar total",
  "annular-solar-eclipse": "Eclipse solar anular",
  "partial-solar-eclipse": "Eclipse solar parcial",
  "total-lunar-eclipse": "Eclipse lunar total",
  supermoon: "Superlua",
  "blue-moon": "Lua azul",
  "harvest-moon": "Lua da colheita",
  "march-equinox": "Equinócio de março",
  "september-equinox": "Equinócio de setembro",
  "northern-hemisphere-summer-solstice": "Solstício de verão no Hemisfério Norte",
  "northern-hemisphere-winter-solstice": "Solstício de inverno no Hemisfério Norte",
  "perseid-meteor-shower-peak": "Pico da chuva de meteoros Perseidas",
  "geminid-meteor-shower-peak": "Pico da chuva de meteoros Gemínidas",
  "quadrantid-meteor-shower-peak": "Pico da chuva de meteoros Quadrântidas",
  "lyrid-meteor-shower-peak": "Pico da chuva de meteoros Líridas",
  "orionid-meteor-shower-peak": "Pico da chuva de meteoros Oriônidas",
  "leonid-meteor-shower-peak": "Pico da chuva de meteoros Leônidas",
  "ursid-meteor-shower-peak": "Pico da chuva de meteoros Ursídeas",
  "eta-aquariid-meteor-shower-peak": "Pico da chuva de meteoros Eta Aquáridas",
  "world-space-week-begins": "Início da Semana Mundial do Espaço",

  // Sport
  "summer-olympics": "Olimpíadas", // in Brazil the bare word means the summer games
  "winter-olympics": "Olimpíadas de Inverno",
  "paralympic-games": "Paralimpíadas",
  "fifa-world-cup": "Copa do Mundo",
  "uefa-european-championship": "Eurocopa", // Brazil's name for the Euro
  "uefa-champions-league-final": "Final da Champions League",
  "africa-cup-of-nations": "Copa Africana de Nações",
  "rugby-world-cup": "Copa do Mundo de Rugby",
  "cricket-world-cup": "Copa do Mundo de Críquete",
  "formula-one-season-start": "Início da temporada de Fórmula 1",
  "monaco-grand-prix": "GP de Mônaco",
  "nba-finals": "Finais da NBA",
  "stanley-cup-finals": "Final da Stanley Cup",
  "roland-garros": "Roland Garros",
  "us-open-tennis": "US Open",
  "the-masters": "Masters de Augusta",
  "boston-marathon": "Maratona de Boston",
  "new-york-city-marathon": "Maratona de Nova York",
  "berlin-marathon": "Maratona de Berlim",
  "chicago-marathon": "Maratona de Chicago",
  "tokyo-marathon": "Maratona de Tóquio",

  // Screen, stage and stadium
  "academy-awards": "Oscar", // "Prêmio da Academia" is nobody's search
  "golden-globe-awards": "Globo de Ouro",
  "grammy-awards": "Grammy",
  "cannes-film-festival": "Festival de Cannes",
  "eurovision-song-contest": "Eurovision",
  "vienna-new-year-s-concert": "Concerto de Ano Novo de Viena",
  "nobel-prize-ceremony": "Cerimônia do Prêmio Nobel",
  "doomsday-clock-announcement": "Anúncio do Relógio do Juízo Final",

  // International observances
  "international-women-s-day": "Dia Internacional da Mulher",
  "international-day-of-peace": "Dia Internacional da Paz",
  "international-friendship-day": "Dia Internacional da Amizade",
  "international-literacy-day": "Dia Internacional da Alfabetização",
  "international-day-of-happiness": "Dia Internacional da Felicidade",
  "international-jazz-day": "Dia Internacional do Jazz",
  "international-coffee-day": "Dia Internacional do Café",
  "international-yoga-day": "Dia Internacional do Yoga",
  "world-health-day": "Dia Mundial da Saúde",
  "world-water-day": "Dia Mundial da Água",
  "world-book-day": "Dia Mundial do Livro",
  "world-sleep-day": "Dia Mundial do Sono",
  "world-food-day": "Dia Mundial da Alimentação",
  "world-oceans-day": "Dia Mundial dos Oceanos",
  "world-environment-day": "Dia Mundial do Meio Ambiente",
  "world-emoji-day": "Dia Mundial do Emoji",
  "world-photography-day": "Dia Mundial da Fotografia",
  "world-ufo-day": "Dia Mundial do OVNI",
  "earth-day": "Dia da Terra",
  "earth-hour": "Hora do Planeta", // the WWF campaign is known by this name in Brazil

  // Geek and internet
  "pi-day": "Dia do Pi",
  "pi-approximation-day": "Dia da Aproximação de Pi",
  "star-wars-day": "Dia de Star Wars",
  "may-the-fourth-star-wars-day": "May the 4th (Dia de Star Wars)",
  "towel-day": "Dia da Toalha",
  "talk-like-a-pirate-day": "Dia de Falar como Pirata",
  "programmers-day": "Dia do Programador",
  "ada-lovelace-day": "Dia de Ada Lovelace",
  "carl-sagan-day": "Dia de Carl Sagan",
  "darwin-day": "Dia de Darwin",
};
