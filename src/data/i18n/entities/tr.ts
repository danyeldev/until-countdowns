/**
 * Turkish entity names.
 *
 * Bare names, no possessive or case suffix: each string is an `<h1>`, a breadcrumb crumb and the
 * `{title}` inside "… için kaç gün kaldı?", so it has to stand on its own in all three places.
 * Religious holidays take their Turkish names rather than a translation of the English one — Eid
 * al-Fitr is "Ramazan Bayramı", Nowruz is "Nevruz", the Academy Awards are "Oscar Ödülleri".
 * Anything with no settled Turkish name — Super Bowl, Wimbledon, Black Friday, Coachella, Diwali,
 * the Hindu and Southeast Asian festivals — is left out so it keeps the catalog's own title.
 */
import type { EntityNames } from "./index";

export const tr: EntityNames = {
  // Calendar turns
  "new-year-s-day": "Yılbaşı",
  "new-year-s-eve": "Yılbaşı gecesi",
  "leap-day": "Artık gün",
  "friday-the-13th": "13. Cuma",
  "public-domain-day": "Kamu Malı Günü",
  "daylight-saving-time-begins": "Yaz saati başlangıcı",
  "daylight-saving-time-ends": "Yaz saati bitişi",
  "daylight-saving-time-begins-us": "Yaz saati başlangıcı (ABD)",
  "daylight-saving-time-ends-us": "Yaz saati bitişi (ABD)",
  "summer-time-begins-europe": "Yaz saati başlangıcı (Avrupa)",
  "summer-time-ends-europe": "Yaz saati bitişi (Avrupa)",
  "leap-second": "Artık saniye",
  "year-2038-problem": "2038 yılı problemi",

  // Christmas and the Christian year
  "christmas-day": "Noel",
  "christmas-eve": "Noel arifesi",
  epiphany: "Epifani",
  lent: "Büyük Perhiz",
  carnival: "Karnaval",
  "ash-wednesday": "Kül Çarşambası",
  "palm-sunday": "Palmiye Pazarı",
  "maundy-thursday": "Kutsal Perşembe",
  "good-friday": "Kutsal Cuma",
  "easter-sunday": "Paskalya",
  "easter-monday": "Paskalya Pazartesisi",
  "orthodox-easter": "Ortodoks Paskalyası",
  "ascension-day": "Göğe Yükseliş Yortusu",
  pentecost: "Pentikost",
  "whit-monday": "Pentikost Pazartesisi",
  "assumption-of-mary": "Meryem Ana'nın Göğe Kabulü",
  "all-saints-day": "Tüm Azizler Günü",
  "all-souls-day": "Ölüler Günü",
  "saint-nicholas-day": "Aziz Nikolaos Günü",
  "saint-patrick-s-day": "Aziz Patrick Günü",
  "saint-stephen-s-day": "Aziz Stefanos Günü",

  // The Islamic year — the names Turkey actually uses, not translations of the Arabic
  ramadan: "Ramazan",
  "eid-al-fitr": "Ramazan Bayramı",
  "eid-al-adha": "Kurban Bayramı",
  "islamic-new-year": "Hicri Yılbaşı",
  ashura: "Aşure Günü",
  mawlid: "Mevlid Kandili",
  "laylat-al-qadr": "Kadir Gecesi",
  "isra-and-mi-raj": "Miraç Kandili",

  // The Jewish year, in the spelling Turkey's Jewish community uses
  "rosh-hashanah": "Roş Aşana",
  "yom-kippur": "Yom Kipur",
  sukkot: "Sukot",
  hanukkah: "Hanuka",
  passover: "Pesah",
  shavuot: "Şavuot",

  // East Asian and Persian calendars
  "chinese-new-year": "Çin Yeni Yılı",
  "lunar-new-year": "Ay Yeni Yılı",
  "mid-autumn-festival": "Sonbahar Ortası Festivali",
  "dragon-boat-festival": "Ejderha Teknesi Festivali",
  "qingming-festival": "Qingming Festivali",
  nowruz: "Nevruz", // the Turkish name for the day; "Nevruz Bayramı" in official use

  // Days people keep
  "valentine-s-day": "Sevgililer Günü",
  "mother-s-day": "Anneler Günü",
  "father-s-day": "Babalar Günü",
  halloween: "Cadılar Bayramı", // the established Turkish name, not a transliteration
  "thanksgiving-day": "Şükran Günü",
  "singles-day": "Bekârlar Günü",

  // National and civic days
  "labour-day": "İşçi Bayramı",
  "labor-day": "İşçi Bayramı (ABD)", // the September one; the May date is "1 Mayıs" below
  "may-day": "1 Mayıs",
  "independence-day": "Bağımsızlık Günü",
  "republic-day": "Cumhuriyet Bayramı",
  "national-day": "Ulusal Gün",
  "constitution-day": "Anayasa Günü",
  "liberation-day": "Kurtuluş Günü",
  "memorial-day": "Anma Günü (ABD)",
  "veterans-day": "Gaziler Günü (ABD)", // qualified: Turkey keeps its own Gaziler Günü in September
  "presidents-day": "Başkanlar Günü (ABD)",
  "columbus-day": "Kolomb Günü",
  "canada-day": "Kanada Günü",
  "bastille-day": "Bastille Günü",
  "german-unity-day": "Almanya Birlik Günü",
  "anzac-day": "Anzak Günü",
  "australia-day": "Avustralya Günü",
  "waitangi-day": "Waitangi Günü",

  // Awareness and international days
  "international-women-s-day": "Dünya Kadınlar Günü",
  "human-rights-day": "İnsan Hakları Günü",
  "international-day-of-peace": "Dünya Barış Günü",
  "earth-day": "Dünya Günü",
  "earth-hour": "Dünya Saati",
  "world-environment-day": "Dünya Çevre Günü",
  "world-oceans-day": "Dünya Okyanuslar Günü",
  "world-water-day": "Dünya Su Günü",
  "world-health-day": "Dünya Sağlık Günü",
  "world-food-day": "Dünya Gıda Günü",
  "world-book-day": "Dünya Kitap Günü",
  "world-sleep-day": "Dünya Uyku Günü",
  "world-photography-day": "Dünya Fotoğrafçılık Günü",
  "world-emoji-day": "Dünya Emoji Günü",
  "international-coffee-day": "Dünya Kahve Günü",
  "international-yoga-day": "Uluslararası Yoga Günü",
  "international-day-of-happiness": "Dünya Mutluluk Günü",
  "international-friendship-day": "Dünya Arkadaşlar Günü",
  "international-literacy-day": "Dünya Okuryazarlık Günü",
  "international-jazz-day": "Uluslararası Caz Günü",

  // Science, tech and the calendar's oddities
  "pi-day": "Pi Günü",
  "pi-approximation-day": "Pi Yaklaşım Günü",
  "darwin-day": "Darwin Günü",
  "ada-lovelace-day": "Ada Lovelace Günü",
  "programmers-day": "Programcılar Günü",
  "carl-sagan-day": "Carl Sagan Günü",
  "world-space-week-begins": "Dünya Uzay Haftası başlangıcı",
  "doomsday-clock-announcement": "Kıyamet Saati açıklaması",
  "world-ufo-day": "Dünya UFO Günü",
  "towel-day": "Havlu Günü",
  "talk-like-a-pirate-day": "Korsan Gibi Konuş Günü",
  "star-wars-day": "Star Wars Günü",
  "may-the-fourth-star-wars-day": "4 Mayıs Star Wars Günü",

  // The sky
  "total-solar-eclipse": "Tam güneş tutulması",
  "annular-solar-eclipse": "Halkalı güneş tutulması",
  "partial-solar-eclipse": "Parçalı güneş tutulması",
  "total-lunar-eclipse": "Tam ay tutulması",
  supermoon: "Süper Ay",
  "blue-moon": "Mavi Ay",
  "harvest-moon": "Hasat Ayı",
  "northern-hemisphere-summer-solstice": "Yaz gündönümü (Kuzey Yarımküre)",
  "northern-hemisphere-winter-solstice": "Kış gündönümü (Kuzey Yarımküre)",
  "march-equinox": "Mart ekinoksu",
  "september-equinox": "Eylül ekinoksu",
  "perseid-meteor-shower-peak": "Perseid meteor yağmuru zirvesi",
  "geminid-meteor-shower-peak": "Geminid meteor yağmuru zirvesi",
  "quadrantid-meteor-shower-peak": "Quadrantid meteor yağmuru zirvesi",
  "lyrid-meteor-shower-peak": "Lyrid meteor yağmuru zirvesi",
  "orionid-meteor-shower-peak": "Orionid meteor yağmuru zirvesi",
  "leonid-meteor-shower-peak": "Leonid meteor yağmuru zirvesi",
  "ursid-meteor-shower-peak": "Ursid meteor yağmuru zirvesi",
  "eta-aquariid-meteor-shower-peak": "Eta Aquariid meteor yağmuru zirvesi",

  // Sport
  "summer-olympics": "Yaz Olimpiyatları",
  "winter-olympics": "Kış Olimpiyatları",
  "paralympic-games": "Paralimpik Oyunları",
  "fifa-world-cup": "FIFA Dünya Kupası",
  "uefa-champions-league-final": "UEFA Şampiyonlar Ligi finali",
  "uefa-european-championship": "UEFA Avrupa Şampiyonası",
  "africa-cup-of-nations": "Afrika Uluslar Kupası",
  "rugby-world-cup": "Rugby Dünya Kupası",
  "cricket-world-cup": "Kriket Dünya Kupası",
  "formula-one-season-start": "Formula 1 sezon başlangıcı",
  "monaco-grand-prix": "Monako Grand Prix",
  "nba-finals": "NBA Finalleri",
  "stanley-cup-finals": "Stanley Kupası finalleri",
  "us-open-tennis": "ABD Açık",
  "australian-open": "Avustralya Açık",
  "boston-marathon": "Boston Maratonu",
  "new-york-city-marathon": "New York Maratonu",
  "berlin-marathon": "Berlin Maratonu",
  "chicago-marathon": "Chicago Maratonu",
  "tokyo-marathon": "Tokyo Maratonu",

  // Culture and awards
  "academy-awards": "Oscar Ödülleri", // what Turkish readers search; "Akademi Ödülleri" is rare
  "golden-globe-awards": "Altın Küre Ödülleri",
  "grammy-awards": "Grammy Ödülleri",
  "cannes-film-festival": "Cannes Film Festivali",
  "eurovision-song-contest": "Eurovision Şarkı Yarışması",
  "vienna-new-year-s-concert": "Viyana Yeni Yıl Konseri",
  "nobel-prize-ceremony": "Nobel Ödülü töreni",
};
