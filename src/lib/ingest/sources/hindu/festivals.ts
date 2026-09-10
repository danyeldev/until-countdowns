import type { TithiRule } from "./tithi";

/**
 * Marquee whitelist for the `hindu` adapter: panchang-ts festival `key` → catalog presentation.
 * Keys were read from a 2026–2040 `buildFestivalsTable` run (Ujjain, Lahiri, purnimanta).
 * Absent from the table and therefore NOT emitted here (they stay in src/data/curated.ts):
 * Guru Nanak Jayanti (only Kartik Purnima exists), Mahavir Jayanti, Buddha/Vesak Purnima.
 *
 * Descriptions are written here (MIT engine, no upstream prose is copied); the adapter appends
 * the "computed for Ujjain" sentence so nothing reads as an official date.
 */

export type HinduFestival = {
  title: string;
  popularity: number;
  regions: string[];
  /** Extra tags on top of `hindu`, `panchang`, `india` and the key itself. */
  tags?: string[];
  featured?: boolean;
  description: string;
};

export const HINDU_FESTIVALS: Record<string, HinduFestival> = {
  diwali: {
    title: "Diwali",
    popularity: 70,
    featured: true,
    regions: ["IN", "NP", "GLOBAL"],
    tags: ["diwali", "festival-of-lights"],
    description:
      "The festival of lights: oil lamps, fireworks, sweets and Lakshmi Puja on the new-moon night of Kartika. India's biggest celebration, also marked by Jains and Sikhs and by the diaspora worldwide.",
  },
  holi: {
    title: "Holi",
    popularity: 65,
    featured: true,
    regions: ["IN", "NP", "GLOBAL"],
    tags: ["holi", "spring"],
    description:
      "The festival of colours on the day after the Phalguna full moon, when the Holika Dahan bonfires of the previous evening give way to coloured powder and water. Celebrated across North India and Nepal and by Hindu communities worldwide.",
  },
  navaratri: {
    title: "Navratri begins",
    popularity: 45,
    regions: ["IN", "NP", "GLOBAL"],
    tags: ["navratri", "durga"],
    description:
      "Sharad Navaratri opens nine nights of worship of the goddess Durga, with garba and dandiya dances in Gujarat and pandals across Bengal. It ends with Vijayadashami on the tenth day.",
  },
  dussehra: {
    title: "Dussehra (Vijayadashami)",
    popularity: 45,
    regions: ["IN", "NP"],
    tags: ["dussehra", "vijayadashami", "dashain"],
    description:
      "Vijayadashami closes Navaratri with the burning of Ravana effigies in the north and Durga idol immersions in the east. In Nepal it is the main day of Dashain.",
  },
  ganesh_chaturthi: {
    title: "Ganesh Chaturthi",
    popularity: 45,
    regions: ["IN"],
    tags: ["ganesha"],
    description:
      "The birthday of the elephant-headed god Ganesha begins ten days of pandals, modak sweets and processions, biggest in Mumbai and across Maharashtra. The festival ends with idol immersion on Anant Chaturdashi.",
  },
  durga_ashtami: {
    title: "Durga Ashtami (Durga Puja)",
    popularity: 45,
    regions: ["IN"],
    tags: ["durga-puja", "durga"],
    description:
      "Maha Ashtami is the central day of Durga Puja, with kumari puja and sandhi puja in the pandals of Kolkata and across Bengal. It falls on the eighth day of Sharad Navaratri.",
  },
  maha_navami: {
    title: "Maha Navami",
    popularity: 35,
    regions: ["IN", "NP"],
    tags: ["durga-puja", "navratri"],
    description:
      "The ninth day of Navaratri brings Ayudha Puja of tools and vehicles in the south and the last rituals of Durga Puja in Bengal. In Nepal it is the Maha Navami of Dashain.",
  },
  maha_shivaratri: {
    title: "Maha Shivaratri",
    popularity: 40,
    regions: ["IN", "NP"],
    tags: ["shiva"],
    description:
      "The great night of Shiva: an all-night vigil of fasting, chanting and abhishekam at Shiva temples across India and Nepal. Observed on the fourteenth night of the dark fortnight before the Phalguna new moon.",
  },
  raksha_bandhan: {
    title: "Raksha Bandhan",
    popularity: 40,
    regions: ["IN"],
    tags: ["rakhi", "family"],
    description:
      "Sisters tie a rakhi thread on their brothers' wrists in exchange for a promise of protection, on the full moon of Shravana. The timing traditionally avoids the inauspicious Bhadra period, which can push the rite to the next morning.",
  },
  krishna_janmashtami: {
    title: "Krishna Janmashtami",
    popularity: 40,
    regions: ["IN"],
    tags: ["krishna"],
    description:
      "The birth of Krishna is celebrated at midnight with fasting, bhajans and dahi handi human pyramids in Maharashtra. Mathura and Vrindavan draw the largest crowds.",
  },
  kartika_purnima: {
    title: "Kartik Purnima",
    popularity: 30,
    regions: ["IN", "NP"],
    tags: ["full-moon", "dev-deepawali"],
    description:
      "The full moon of Kartika: Dev Deepawali lamps on the ghats of Varanasi and the climax of the Pushkar camel fair. Sikhs celebrate Guru Nanak's birth anniversary (Gurpurab) on this full moon.",
  },
  makar_sankranti: {
    title: "Makar Sankranti",
    popularity: 40,
    regions: ["IN"],
    tags: ["harvest", "sankranti"],
    description:
      "The Sun's entry into Capricorn marks the harvest festival celebrated as Makar Sankranti in the north, Uttarayan kite flying in Gujarat and Magh Bihu in Assam. One of the few Hindu festivals fixed by the solar calendar, so it falls on almost the same date every year.",
  },
  pongal: {
    title: "Pongal",
    popularity: 35,
    regions: ["IN"],
    tags: ["harvest", "tamil"],
    description:
      "Tamil Nadu's four-day harvest festival, when a pot of rice and milk is boiled until it spills over as an offering to the Sun god. Thai Pongal falls on the first day of the Tamil month of Thai.",
  },
  onam: {
    title: "Onam",
    popularity: 40,
    regions: ["IN"],
    tags: ["harvest", "kerala"],
    description:
      "Kerala's harvest festival celebrates the homecoming of the mythical king Mahabali with flower carpets, snake-boat races and the Onam sadya feast. Thiruvonam, the main day, is the one counted down here.",
  },
  rama_navami: {
    title: "Rama Navami",
    popularity: 35,
    regions: ["IN"],
    tags: ["rama"],
    description:
      "The birthday of Rama, hero of the Ramayana, is celebrated with readings, processions and fasting, above all in Ayodhya. It falls on the ninth day of the Chaitra Navaratri.",
  },
  hanuman_jayanti: {
    title: "Hanuman Jayanti",
    popularity: 30,
    regions: ["IN"],
    tags: ["hanuman"],
    description:
      "The birth anniversary of the monkey god Hanuman, marked by temple visits, recitations of the Hanuman Chalisa and processions. Observed on the full moon of Chaitra across most of North India.",
  },
  akshaya_tritiya: {
    title: "Akshaya Tritiya",
    popularity: 30,
    regions: ["IN"],
    tags: ["auspicious", "gold"],
    description:
      "An auspicious day for new beginnings, weddings and buying gold, believed to bring prosperity that never diminishes. It falls on the third day of the bright fortnight of Vaishakha and is observed by Jains as well.",
  },
  karva_chauth: {
    title: "Karva Chauth",
    popularity: 35,
    regions: ["IN"],
    tags: ["fast", "family"],
    description:
      "Married women across North India fast from sunrise until they sight the moon, praying for their husbands' well-being. It falls on the fourth day after the Sharad Purnima full moon.",
  },
  chhath_sandhya_arghya: {
    title: "Chhath Puja",
    popularity: 40,
    regions: ["IN", "NP"],
    tags: ["chhath", "surya"],
    description:
      "The main evening of Chhath, when devotees in Bihar, Jharkhand, eastern Uttar Pradesh and Nepal's Terai stand in rivers to offer arghya to the setting Sun. The four-day festival honours Surya and Chhathi Maiya.",
  },
  baisakhi: {
    title: "Vaisakhi",
    popularity: 40,
    regions: ["IN"],
    tags: ["sikh", "harvest", "new-year"],
    description:
      "The Punjabi harvest festival and Sikh New Year, also the anniversary of the founding of the Khalsa in 1699. As Mesha Sankranti it opens the solar new year in several Indian calendars.",
  },
  ugadi: {
    title: "Ugadi",
    popularity: 35,
    regions: ["IN"],
    tags: ["new-year", "telugu", "kannada"],
    description:
      "New Year's Day for Telugu and Kannada speakers, welcomed with the six-flavoured ugadi pachadi and a reading of the year's almanac. It falls on the first day of the bright fortnight of Chaitra.",
  },
  gudi_padwa: {
    title: "Gudi Padwa",
    popularity: 35,
    regions: ["IN"],
    tags: ["new-year", "marathi"],
    description:
      "Maharashtra's New Year, marked by raising a decorated gudi flag outside homes and eating neem leaves with jaggery. It shares its day with Ugadi and the start of Chaitra Navaratri.",
  },
  jagannath_rath_yatra: {
    title: "Rath Yatra",
    popularity: 35,
    regions: ["IN"],
    tags: ["jagannath", "puri"],
    description:
      "Giant wooden chariots carry Jagannath, Balabhadra and Subhadra from their temple in Puri to the Gundicha temple, pulled by enormous crowds. Replica processions run in cities across India and abroad.",
  },
  dhanteras: {
    title: "Dhanteras",
    popularity: 35,
    regions: ["IN"],
    tags: ["diwali", "gold"],
    description:
      "The first day of the Diwali festivities, when households buy gold, silver or new utensils and worship Dhanvantari and Lakshmi. It falls two days before Diwali.",
  },
  narak_chaturdashi: {
    title: "Naraka Chaturdashi (Choti Diwali)",
    popularity: 30,
    regions: ["IN"],
    tags: ["diwali"],
    description:
      "Choti Diwali commemorates Krishna's victory over the demon Narakasura with a pre-dawn oil bath and evening lamps. It falls the day before Diwali, or on the same day in some years.",
  },
  govardhan_puja: {
    title: "Govardhan Puja",
    popularity: 30,
    regions: ["IN"],
    tags: ["diwali", "krishna"],
    description:
      "The day after Diwali commemorates Krishna lifting Govardhan hill; households build mounds of food (Annakut) as offerings. It is also celebrated as the Gujarati New Year.",
  },
  bhai_dooj: {
    title: "Bhai Dooj",
    popularity: 30,
    regions: ["IN", "NP"],
    tags: ["diwali", "family"],
    description:
      "Sisters mark their brothers' foreheads with tika and pray for their long life, two days after Diwali. In Nepal the equivalent Bhai Tika closes the Tihar festival.",
  },
  vasant_panchami: {
    title: "Vasant Panchami",
    popularity: 30,
    regions: ["IN"],
    tags: ["saraswati", "spring"],
    description:
      "The arrival of spring is welcomed by wearing yellow and worshipping Saraswati, goddess of learning; children are often initiated into writing on this day. It falls on the fifth day of the bright fortnight of Magha.",
  },
  guru_purnima: {
    title: "Guru Purnima",
    popularity: 30,
    regions: ["IN", "NP"],
    tags: ["full-moon", "teachers"],
    description:
      "A day to honour teachers and spiritual guides, on the full moon of Ashadha, traditionally the birthday of the sage Vyasa. Buddhists in India and Nepal mark it as the day of the Buddha's first sermon.",
  },
  lohri: {
    title: "Lohri",
    popularity: 30,
    regions: ["IN"],
    tags: ["punjab", "harvest", "bonfire"],
    description:
      "Punjab's bonfire festival on the eve of Makar Sankranti marks the end of winter with popcorn, sesame sweets and folk songs. Fixed by the solar calendar, it falls on 13 January in most years.",
  },
};

/**
 * Kshaya fallbacks (see tithi.ts) for whitelist keys whose tithi is known and whose absence
 * from the table would be conspicuous. Purnimanta months: 7 = Kartika, 11 = Phalguna.
 * Validated 2026–2040: the scan lands within one day of the table wherever the table has the
 * festival, and fills Holi 2028/2037, Diwali 2036/2037, Dhanteras 2028/2029/2038/2039,
 * Naraka Chaturdashi 2030 and Chhath 2039.
 */
export const TITHI_FALLBACKS: Record<string, TithiRule> = {
  holi: { month: 11, paksha: "Shukla", number: 15, from: "02-10", to: "04-15" },
  diwali: { month: 7, paksha: "Krishna", number: 15, from: "10-01", to: "11-25" },
  dhanteras: { month: 7, paksha: "Krishna", number: 13, from: "10-01", to: "11-25" },
  narak_chaturdashi: { month: 7, paksha: "Krishna", number: 14, from: "10-01", to: "11-25" },
  chhath_sandhya_arghya: { month: 7, paksha: "Shukla", number: 6, from: "10-15", to: "12-05" },
};

/** Table entry types eligible for the long tail (`HINDU_INCLUDE_ALL=true`); recurring fasts and eclipses are never emitted. */
export const LONG_TAIL_TYPES = new Set(["major", "minor", "sankranti"]);
/** Long-tail keys that recur monthly or are a bare solar-transit marker: noise, never emitted. */
export const LONG_TAIL_EXCLUDED = new Set(["sankranti", "masik_shivaratri", "masik_karthigai", "vinayaka_chaturthi", "sankashti_chaturthi", "kartik_somvar", "shravan_somvar", "mangala_gauri", "magha_shanivar", "guru_pushya", "ravi_pushya", "bonalu"]);
