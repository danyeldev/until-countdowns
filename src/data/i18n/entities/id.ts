/**
 * Indonesian entity names.
 *
 * Kept out on purpose: anything Indonesian readers search for in English anyway (Halloween, Black
 * Friday, Super Bowl, Wimbledon, Coachella, the marathons, Diwali, Nowruz, Chuseok), and the Jewish
 * feasts, which have no Indonesian name in common use beyond their own.
 *
 * Where the state holiday calendar and everyday speech disagree, the searched name wins: Good
 * Friday is "Jumat Agung" in church and in search even though the national calendar prints "Wafat
 * Isa Almasih"; Ascension Day is the calendar's own "Kenaikan Isa Almasih", which is also what
 * people type.
 */
import type { EntityNames } from "./index";

export const id: EntityNames = {
  // --- The turn of the year -------------------------------------------------
  "new-year-s-day": "Tahun Baru",
  "new-year-s-eve": "Malam Tahun Baru",
  // Both keys are the same festival to an Indonesian reader: Imlek.
  "chinese-new-year": "Tahun Baru Imlek",
  "lunar-new-year": "Tahun Baru Imlek",
  "leap-day": "Hari Kabisat",
  // Not an Indonesian holiday; readers type the bare loanword, not "Hari Pengucapan Syukur".
  "thanksgiving-day": "Thanksgiving",

  // --- Christian year -------------------------------------------------------
  "christmas-day": "Natal",
  "christmas-eve": "Malam Natal",
  "easter-sunday": "Paskah",
  "orthodox-easter": "Paskah Ortodoks",
  "good-friday": "Jumat Agung", // state calendar: "Wafat Isa Almasih"
  "ash-wednesday": "Rabu Abu",
  "palm-sunday": "Minggu Palma",
  "maundy-thursday": "Kamis Putih",
  "easter-monday": "Senin Paskah",
  "ascension-day": "Kenaikan Isa Almasih",
  pentecost: "Pentakosta",
  "whit-monday": "Senin Pentakosta",
  "corpus-christi": "Hari Raya Tubuh dan Darah Kristus",
  "assumption-of-mary": "Maria Diangkat ke Surga",
  "all-saints-day": "Hari Raya Semua Orang Kudus",
  "all-souls-day": "Peringatan Arwah Semua Orang Beriman",
  "immaculate-conception": "Maria Dikandung Tanpa Noda",
  epiphany: "Epifani",
  advent: "Adven",
  lent: "Masa Prapaskah",
  "saint-nicholas-day": "Hari Santo Nikolas",
  "saint-patrick-s-day": "Hari Santo Patrick",
  "saint-stephen-s-day": "Hari Santo Stefanus",

  // --- Islamic year ---------------------------------------------------------
  "eid-al-fitr": "Idul Fitri", // also searched as "Lebaran"
  "eid-al-adha": "Idul Adha",
  "islamic-new-year": "Tahun Baru Islam",
  ashura: "Asyura",
  mawlid: "Maulid Nabi",
  "laylat-al-qadr": "Lailatul Qadar",
  "isra-and-mi-raj": "Isra Mikraj",

  // --- Other faiths ---------------------------------------------------------
  vesak: "Waisak",
  passover: "Paskah Yahudi",
  "maha-shivaratri": "Maha Siwaratri", // Balinese Hindus keep it as Siwaratri
  "mid-autumn-festival": "Festival Kue Bulan",
  "dragon-boat-festival": "Festival Perahu Naga", // Peh Cun to Chinese Indonesians
  "qingming-festival": "Cheng Beng", // the Hokkien name is the one used in Indonesia

  // --- Civic and national ---------------------------------------------------
  "independence-day": "Hari Kemerdekaan",
  "national-day": "Hari Nasional",
  "republic-day": "Hari Republik",
  "constitution-day": "Hari Konstitusi",
  "liberation-day": "Hari Pembebasan",
  "labour-day": "Hari Buruh",
  "labor-day": "Hari Buruh (AS)", // the September one, kept apart from 1 Mei
  "veterans-day": "Hari Veteran",
  "columbus-day": "Hari Columbus",
  "canada-day": "Hari Kanada",
  "bastille-day": "Hari Bastille",
  "german-unity-day": "Hari Persatuan Jerman",
  "australia-day": "Hari Australia",
  "human-rights-day": "Hari Hak Asasi Manusia",

  // --- Observances ----------------------------------------------------------
  "valentine-s-day": "Hari Valentine",
  "mother-s-day": "Hari Ibu", // Indonesia keeps its own on 22 December
  "father-s-day": "Hari Ayah",
  "international-women-s-day": "Hari Perempuan Internasional",
  "earth-day": "Hari Bumi",
  "world-environment-day": "Hari Lingkungan Hidup Sedunia",
  "world-oceans-day": "Hari Laut Sedunia",
  "world-health-day": "Hari Kesehatan Sedunia",
  "world-water-day": "Hari Air Sedunia",
  "world-book-day": "Hari Buku Sedunia",
  "world-sleep-day": "Hari Tidur Sedunia",
  "world-food-day": "Hari Pangan Sedunia",
  "world-emoji-day": "Hari Emoji Sedunia",
  "world-photography-day": "Hari Fotografi Sedunia",
  "world-ufo-day": "Hari UFO Sedunia",
  "international-day-of-peace": "Hari Perdamaian Internasional",
  "international-day-of-happiness": "Hari Kebahagiaan Internasional",
  "international-friendship-day": "Hari Persahabatan Internasional",
  "international-literacy-day": "Hari Aksara Internasional",
  "international-coffee-day": "Hari Kopi Internasional",
  "international-yoga-day": "Hari Yoga Internasional",
  "international-jazz-day": "Hari Jazz Internasional",
  "public-domain-day": "Hari Domain Publik",
  "programmers-day": "Hari Programmer",
  "ada-lovelace-day": "Hari Ada Lovelace",
  "carl-sagan-day": "Hari Carl Sagan",
  "darwin-day": "Hari Darwin",
  "pi-day": "Hari Pi",
  "pi-approximation-day": "Hari Pendekatan Pi",
  "star-wars-day": "Hari Star Wars",
  "may-the-fourth-star-wars-day": "Hari Star Wars (May the Fourth)",
  "talk-like-a-pirate-day": "Hari Bicara Seperti Bajak Laut",
  "friday-the-13th": "Jumat tanggal 13",
  carnival: "Karnaval",

  // --- Sky ------------------------------------------------------------------
  "total-solar-eclipse": "Gerhana matahari total",
  "annular-solar-eclipse": "Gerhana matahari cincin",
  "partial-solar-eclipse": "Gerhana matahari sebagian",
  "total-lunar-eclipse": "Gerhana bulan total",
  "perseid-meteor-shower-peak": "Puncak hujan meteor Perseid",
  "geminid-meteor-shower-peak": "Puncak hujan meteor Geminid",
  "quadrantid-meteor-shower-peak": "Puncak hujan meteor Quadrantid",
  "lyrid-meteor-shower-peak": "Puncak hujan meteor Lyrid",
  "orionid-meteor-shower-peak": "Puncak hujan meteor Orionid",
  "leonid-meteor-shower-peak": "Puncak hujan meteor Leonid",
  "ursid-meteor-shower-peak": "Puncak hujan meteor Ursid",
  "eta-aquariid-meteor-shower-peak": "Puncak hujan meteor Eta Aquariid",
  "northern-hemisphere-summer-solstice": "Titik balik matahari musim panas belahan bumi utara",
  "northern-hemisphere-winter-solstice": "Titik balik matahari musim dingin belahan bumi utara",
  "march-equinox": "Ekuinoks Maret",
  "september-equinox": "Ekuinoks September",
  "world-space-week-begins": "Pekan Antariksa Dunia dimulai",

  // --- Sport ----------------------------------------------------------------
  "summer-olympics": "Olimpiade Musim Panas",
  "winter-olympics": "Olimpiade Musim Dingin",
  "paralympic-games": "Paralimpiade",
  "fifa-world-cup": "Piala Dunia FIFA",
  "uefa-champions-league-final": "Final Liga Champions UEFA",
  "uefa-european-championship": "Piala Eropa UEFA",
  "africa-cup-of-nations": "Piala Afrika",
  "rugby-world-cup": "Piala Dunia Rugbi",
  "cricket-world-cup": "Piala Dunia Kriket",
  "formula-one-season-start": "Awal musim Formula 1",
  "monaco-grand-prix": "Grand Prix Monako",
  "nba-finals": "Final NBA",
  "stanley-cup-finals": "Final Piala Stanley",

  // --- Culture --------------------------------------------------------------
  "academy-awards": "Piala Oscar", // Indonesian media almost never writes "Academy Awards"
  "golden-globe-awards": "Penghargaan Golden Globe",
  "cannes-film-festival": "Festival Film Cannes",
  "eurovision-song-contest": "Kontes Lagu Eurovision",
  "vienna-new-year-s-concert": "Konser Tahun Baru Wina",
  "nobel-prize-ceremony": "Upacara Penghargaan Nobel",
  "doomsday-clock-announcement": "Pengumuman Jam Kiamat",

  // --- Clocks and calendars -------------------------------------------------
  // Indonesia has no DST; "waktu musim panas" is the term Indonesian reference works use for it.
  "daylight-saving-time-begins": "Waktu musim panas dimulai",
  "daylight-saving-time-ends": "Waktu musim panas berakhir",
  "daylight-saving-time-begins-us": "Waktu musim panas dimulai (AS)",
  "daylight-saving-time-ends-us": "Waktu musim panas berakhir (AS)",
  "summer-time-begins-europe": "Waktu musim panas dimulai (Eropa)",
  "summer-time-ends-europe": "Waktu musim panas berakhir (Eropa)",
  "year-2038-problem": "Masalah tahun 2038",
  "leap-second": "Detik kabisat",
};
