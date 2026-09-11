/**
 * Hindi entity names.
 *
 * A name here has to survive the **oblique case**: every template puts a postposition after
 * `{title}` — "{title} में कितने दिन बाकी हैं?", "{title} का काउंटडाउन", "{title} की आने वाली
 * तारीखें" — and Hindi inflects the noun before one. "नया साल" would render "नया साल में", which
 * reads as machine output; "नववर्ष" ends in a consonant and is correct in every slot. Prefer a name
 * that is oblique-invariant, or write it already oblique where that is the natural form.
 *
 * Two more rules decided most of this file. First, Hindi is a non-Latin script, so a *transliteration*
 * is a real name here in a way it is not in Spanish or German: "विंबलडन" and "ग्रैमी अवॉर्ड्स" are
 * what Hindi readers write and search, and leaving them in Latin inside a Devanagari sentence is
 * the wrong answer. Second, where India has its own name for a thing, that name wins over the
 * dictionary translation — Vesak is बुद्ध पूर्णिमा, Eid al-Adha is बकरीद, the Academy Awards are
 * ऑस्कर, Roland-Garros is फ्रेंच ओपन.
 *
 * 159 of the 208 are named here. The other 49 are left out on purpose, in two groups: entities with
 * no Hindi footprint at all (the Boston/Berlin/Chicago/Tokyo/New York marathons, Mardi Gras, San
 * Fermín, Fête de la Musique, Last Night of the Proms, Coachella, Glastonbury, Burning Man,
 * Tomorrowland, Juneteenth, Anzac/Waitangi/Victoria Day, Obon, Chuseok, Qingming, Tax Day, Towel
 * Day, Talk Like a Pirate Day, Unix billennium among them), and the minor Christian and Jewish
 * feasts whose Hindi renderings are not settled enough to publish (Ash Wednesday, Pentecost,
 * Epiphany, Maundy Thursday, Ascension, Whit Monday, Corpus Christi, Assumption, All Saints'/Souls',
 * Immaculate Conception, Saint Nicholas/Stephen, Advent, Lent, Orthodox Easter, Sukkot, Purim,
 * Shavuot). Those keep their English titles, which is the honest answer.
 */
import type { EntityNames } from "./index";

export const hi: EntityNames = {
  // Turn of the year, and the imported retail calendar Hindi media now covers in Devanagari.
  "new-year-s-day": "नववर्ष",
  "new-year-s-eve": "नए साल की पूर्व संध्या",
  "chinese-new-year": "चीनी नववर्ष",
  "lunar-new-year": "चंद्र नववर्ष",
  "black-friday": "ब्लैक फ्राइडे",
  "cyber-monday": "साइबर मंडे",
  "singles-day": "सिंगल्स डे",
  "amazon-prime-day": "अमेज़न प्राइम डे",
  "leap-day": "लीप डे",
  "friday-the-13th": "शुक्रवार 13 तारीख",

  // Hindu festivals — the largest block of real search volume in this language.
  diwali: "दिवाली",
  holi: "होली",
  navratri: "नवरात्रि",
  dussehra: "दशहरा",
  "raksha-bandhan": "रक्षाबंधन",
  janmashtami: "जन्माष्टमी",
  "ganesh-chaturthi": "गणेश चतुर्थी",
  "maha-shivaratri": "महाशिवरात्रि",
  "makar-sankranti": "मकर संक्रांति",
  "ram-navami": "राम नवमी",
  "guru-nanak-jayanti": "गुरु नानक जयंती",
  // Vesak is observed in India as Buddha Purnima; nobody searches "वेसाक".
  vesak: "बुद्ध पूर्णिमा",

  // Islamic calendar, in the Indian subcontinent's own names rather than the Arabic transcriptions.
  ramadan: "रमज़ान",
  "eid-al-fitr": "ईद-उल-फ़ितर",
  // Eid al-Adha is बकरीद in India — far and away the name people type.
  "eid-al-adha": "बकरीद",
  "islamic-new-year": "इस्लामी नववर्ष",
  ashura: "आशूरा",
  // Mawlid, Laylat al-Qadr and Isra & Mi'raj all go by their Urdu-derived Indian names.
  mawlid: "ईद मिलाद-उन-नबी",
  "laylat-al-qadr": "शब-ए-क़द्र",
  "isra-and-mi-raj": "शब-ए-मेराज",
  nowruz: "नवरोज़",

  // Christian dates that are gazetted holidays in India, plus the ones Hindi media names.
  "christmas-day": "क्रिसमस",
  "christmas-eve": "क्रिसमस ईव",
  "easter-sunday": "ईस्टर",
  "easter-monday": "ईस्टर सोमवार",
  "good-friday": "गुड फ्राइडे",
  "palm-sunday": "पाम संडे",
  "boxing-day": "बॉक्सिंग डे",
  "saint-patrick-s-day": "सेंट पैट्रिक डे",

  // Jewish dates with a settled Hindi rendering.
  "rosh-hashanah": "रोश हशाना",
  "yom-kippur": "योम किप्पुर",
  hanukkah: "हनुक्का",
  passover: "पासओवर",

  // Other traditions Hindi press covers.
  carnival: "कार्निवल",
  halloween: "हैलोवीन",
  "thanksgiving-day": "थैंक्सगिविंग",
  oktoberfest: "ऑक्टोबरफेस्ट",
  "la-tomatina": "ला टोमाटिना",
  songkran: "सोंगक्रान",
  "mid-autumn-festival": "मध्य शरद उत्सव",
  "dragon-boat-festival": "ड्रैगन बोट फेस्टिवल",

  // Civic and national days. India's own two are the highest-volume entries in the file.
  "republic-day": "गणतंत्र दिवस",
  "independence-day": "स्वतंत्रता दिवस",
  "national-day": "राष्ट्रीय दिवस",
  "constitution-day": "संविधान दिवस",
  "liberation-day": "मुक्ति दिवस",
  "labour-day": "मजदूर दिवस",
  // The American September holiday, kept apart from May Day's मजदूर दिवस.
  "labor-day": "लेबर डे",
  "may-day": "मई दिवस",
  "memorial-day": "मेमोरियल डे",
  "veterans-day": "वेटरन्स डे",
  "presidents-day": "प्रेसिडेंट्स डे",
  "martin-luther-king-jr-day": "मार्टिन लूथर किंग जूनियर दिवस",
  "columbus-day": "कोलंबस दिवस",
  "canada-day": "कनाडा दिवस",
  "bastille-day": "बैस्टिल दिवस",
  "german-unity-day": "जर्मन एकता दिवस",
  "australia-day": "ऑस्ट्रेलिया दिवस",

  // Observances. "अंतरराष्ट्रीय" throughout, per the Wikipedia/official spelling.
  "valentine-s-day": "वैलेंटाइन डे",
  "mother-s-day": "मदर्स डे",
  "father-s-day": "फादर्स डे",
  "international-women-s-day": "अंतरराष्ट्रीय महिला दिवस",
  "international-yoga-day": "अंतरराष्ट्रीय योग दिवस",
  "human-rights-day": "मानवाधिकार दिवस",
  "international-day-of-peace": "अंतरराष्ट्रीय शांति दिवस",
  "international-friendship-day": "अंतरराष्ट्रीय मित्रता दिवस",
  "international-literacy-day": "अंतरराष्ट्रीय साक्षरता दिवस",
  "international-day-of-happiness": "अंतरराष्ट्रीय खुशी दिवस",
  "international-jazz-day": "अंतरराष्ट्रीय जैज़ दिवस",
  "international-coffee-day": "अंतरराष्ट्रीय कॉफ़ी दिवस",
  "earth-day": "पृथ्वी दिवस",
  "earth-hour": "अर्थ आवर",
  "world-environment-day": "विश्व पर्यावरण दिवस",
  "world-oceans-day": "विश्व महासागर दिवस",
  "world-health-day": "विश्व स्वास्थ्य दिवस",
  "world-water-day": "विश्व जल दिवस",
  "world-book-day": "विश्व पुस्तक दिवस",
  "world-sleep-day": "विश्व निद्रा दिवस",
  "world-food-day": "विश्व खाद्य दिवस",
  "world-emoji-day": "विश्व इमोजी दिवस",
  "world-photography-day": "विश्व फोटोग्राफी दिवस",
  "world-ufo-day": "विश्व यूएफओ दिवस",
  "world-space-week-begins": "विश्व अंतरिक्ष सप्ताह की शुरुआत",
  "darwin-day": "डार्विन दिवस",
  "carl-sagan-day": "कार्ल सेगन दिवस",
  "ada-lovelace-day": "एडा लवलेस दिवस",
  "programmers-day": "प्रोग्रामर दिवस",
  "pi-day": "पाई दिवस",
  "nobel-prize-ceremony": "नोबेल पुरस्कार समारोह",
  "doomsday-clock-announcement": "डूम्सडे क्लॉक की घोषणा",
  "star-wars-day": "स्टार वॉर्स डे",
  "may-the-fourth-star-wars-day": "मे द फोर्थ (स्टार वॉर्स डे)",

  // Sport. Cricket and the IPL carry this section in Hindi.
  "cricket-world-cup": "क्रिकेट विश्व कप",
  // Written out with the abbreviation people actually type, because "आईपीएल" is the query.
  "indian-premier-league": "इंडियन प्रीमियर लीग (आईपीएल)",
  "fifa-world-cup": "फीफा विश्व कप",
  "uefa-champions-league-final": "यूईएफए चैंपियंस लीग फाइनल",
  "uefa-european-championship": "यूईएफए यूरोपियन चैंपियनशिप",
  "copa-america": "कोपा अमेरिका",
  "africa-cup-of-nations": "अफ्रीका कप ऑफ नेशंस",
  "rugby-world-cup": "रग्बी विश्व कप",
  "summer-olympics": "ग्रीष्मकालीन ओलंपिक",
  "winter-olympics": "शीतकालीन ओलंपिक",
  "paralympic-games": "पैरालंपिक खेल",
  "tour-de-france": "टूर डी फ्रांस",
  "formula-one-season-start": "फॉर्मूला वन सीज़न की शुरुआत",
  "monaco-grand-prix": "मोनाको ग्रांड प्री",
  wimbledon: "विंबलडन",
  "us-open-tennis": "यूएस ओपन",
  "australian-open": "ऑस्ट्रेलियन ओपन",
  // Hindi sports desks call Roland-Garros the French Open; the French name alone would miss.
  "roland-garros": "फ्रेंच ओपन (रोलां गैरो)",
  "super-bowl": "सुपर बाउल",
  "nba-finals": "एनबीए फाइनल्स",
  "world-series": "वर्ल्ड सीरीज़",
  "stanley-cup-finals": "स्टेनली कप फाइनल्स",
  "the-masters": "द मास्टर्स",
  "ryder-cup": "राइडर कप",

  // Screen and stage.
  // The Academy Awards are simply "ऑस्कर" in Hindi — the formal name is not the search term.
  "academy-awards": "ऑस्कर",
  "golden-globe-awards": "गोल्डन ग्लोब अवॉर्ड्स",
  "grammy-awards": "ग्रैमी अवॉर्ड्स",
  "cannes-film-festival": "कान फिल्म फेस्टिवल",
  "met-gala": "मेट गाला",
  "comic-con": "कॉमिक कॉन",
  "eurovision-song-contest": "यूरोविज़न सॉन्ग कॉन्टेस्ट",

  // Sky. Eclipses are among the biggest Hindi queries on the whole site.
  "total-solar-eclipse": "पूर्ण सूर्य ग्रहण",
  "total-lunar-eclipse": "पूर्ण चंद्र ग्रहण",
  "annular-solar-eclipse": "वलयाकार सूर्य ग्रहण",
  "partial-solar-eclipse": "आंशिक सूर्य ग्रहण",
  supermoon: "सुपरमून",
  "blue-moon": "ब्लू मून",
  "perseid-meteor-shower-peak": "पर्सीड उल्कावर्षा का चरम",
  "geminid-meteor-shower-peak": "जेमिनिड उल्कावर्षा का चरम",
  "quadrantid-meteor-shower-peak": "क्वाड्रांटिड उल्कावर्षा का चरम",
  "lyrid-meteor-shower-peak": "लिरिड उल्कावर्षा का चरम",
  "orionid-meteor-shower-peak": "ओरियोनिड उल्कावर्षा का चरम",
  "leonid-meteor-shower-peak": "लियोनिड उल्कावर्षा का चरम",
  "ursid-meteor-shower-peak": "अर्सिड उल्कावर्षा का चरम",
  "eta-aquariid-meteor-shower-peak": "एटा एक्वेरिड उल्कावर्षा का चरम",
  "northern-hemisphere-summer-solstice": "उत्तरी गोलार्ध की ग्रीष्म संक्रांति",
  "northern-hemisphere-winter-solstice": "उत्तरी गोलार्ध की शीत संक्रांति",
  "march-equinox": "मार्च विषुव",
  "september-equinox": "सितंबर विषुव",

  // Clocks.
  "daylight-saving-time-begins": "डेलाइट सेविंग टाइम शुरू",
  "daylight-saving-time-ends": "डेलाइट सेविंग टाइम खत्म",
  "daylight-saving-time-begins-us": "डेलाइट सेविंग टाइम शुरू (अमेरिका)",
  "daylight-saving-time-ends-us": "डेलाइट सेविंग टाइम खत्म (अमेरिका)",
  "summer-time-begins-europe": "समर टाइम शुरू (यूरोप)",
  "summer-time-ends-europe": "समर टाइम खत्म (यूरोप)",
  "year-2038-problem": "वर्ष 2038 समस्या",
  "leap-second": "लीप सेकंड",
};
