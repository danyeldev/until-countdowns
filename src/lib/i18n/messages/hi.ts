/**
 * Hindi messages. See `en/` for what each key is for.
 *
 * Five decisions a maintainer should not undo:
 * - The money phrase is "{title} में कितने दिन बाकी हैं?" — the string Hindi speakers actually type
 *   ("दिवाली में कितने दिन बाकी हैं"). It carries the series `<h1>`, the series title and
 *   `common.nav.daysUntil`, and the answer sentence under it echoes it word for word
 *   ("{title} में {n} दिन बाकी हैं"). Dated occurrences in the "when is" categories take the other
 *   huge Hindi query, "{title} कब है?" ("होली कब है", "दिवाली कब है 2026").
 * - **No gendered verb ever agrees with `{title}`.** Hindi past and future verbs inflect for gender
 *   and `{title}` arrives with none known ("क्रिसमस था" but "दिवाली थी"). Every template therefore
 *   either stays in the present ("है"/"हैं", which do not inflect) or hangs the past tense on a
 *   noun the template itself supplies — "{title} की तारीख … थी", "यह आयोजन रद्द कर दिया गया है".
 *   Rewriting these into the direct English shape reintroduces the agreement bug.
 * - The hub titles read "{category}: आने वाली तारीखें …" rather than English's "Upcoming
 *   {category}", for the same reason: "आने वाले/आने वाली" would have to agree with a category label
 *   whose gender varies (खेल masc., छुट्टियाँ fem.). Making the label a topic prefix sidesteps it.
 * - `seo.hub.lowercaseCategory` is false. Devanagari has no letter case; lower-casing would only
 *   reach the Latin inside a label and buys nothing.
 * - Hindi has two ICU plural categories, `one` (0 and 1) and `other`. दिन and देश do not inflect, so
 *   some pairs are deliberately identical — the number, not the noun, is what changes.
 *
 * "कल" is both yesterday and tomorrow in Hindi; the tense of the verb is what separates them, which
 * is why `seo.days.tomorrow` and `seo.days.yesterday` differ only in है/थी. That is correct Hindi.
 * Spelling follows the Wikipedia/official standard "अंतरराष्ट्रीय" (not "अंतर्राष्ट्रीय") and ends
 * sentences with the danda "।", as Hindi prose does.
 */
import type { Messages } from "./en";
import type { PluralForms } from "./types";

export const hi: Messages = {
  common: {
    siteName: "Until",
    tagline: "उन चीज़ों का कैटलॉग जो अभी हुई नहीं हैं।",
    wordmarkLine: "Until — उन चीज़ों का कैटलॉग जो अभी हुई नहीं हैं।",

    nav: {
      categories: "श्रेणियाँ",
      countries: "देश",
      daysUntil: "कितने दिन बाकी",
      create: "बनाएँ",
      about: "परिचय",
    },

    search: {
      label: "खोज",
      navLabel: "काउंटडाउन खोजें",
      placeholder: "कैटलॉग में खोजें…",
      navPlaceholder: "ग्रहण, वर्ल्ड कप, छुट्टियाँ खोजें…",
      submit: "खोजें",
    },

    breadcrumb: {
      home: "होम",
    },

    footer: {
      datesCount: { one: "{n} तारीख", other: "{n} तारीखें" } as PluralForms,
      aboutTheData: "डेटा के बारे में",
      attributions: "स्रोत और श्रेय",
      categories: "श्रेणियाँ",
      browse: "ब्राउज़ करें",
      all: "सभी →",
      makeYourOwn: "अपना बनाएँ",
      language: "भाषा",
    },

    actions: {
      share: "शेयर करें",
      shareCopied: "लिंक कॉपी हो गया",
      save: "सेव करें",
      saved: "सेव हो गया",
      addToCalendar: "कैलेंडर में जोड़ें",
      google: "Google Calendar",
      outlook: "Outlook",
      downloadIcs: ".ics डाउनलोड करें",
      embed: "अपनी साइट पर लगाएँ",
      stream: "अपनी स्ट्रीम में जोड़ें",
      copy: "कॉपी करें",
      copied: "कॉपी हो गया",
    },

    labels: {
      worldwide: "दुनिया भर में",
      countriesCount: { one: "{n} देश", other: "{n} देश" } as PluralForms,
      recurring: "हर साल",
      series: "सीरीज़",
      today: "आज",
      tba: "तय नहीं",
      dateToBeAnnounced: "तारीख की घोषणा बाकी है",
      nothingHereYet: "यहाँ अभी कुछ नहीं है",
      more: "अधिक",
      seeAll: "सभी देखें →",
      loading: "लोड हो रहा है…",
      source: "स्रोत",
      sources: "स्रोत",
      lastVerified: "आखिरी बार जाँचा गया",
    },

    status: {
      scheduled: "तय",
      tentative: "संभावित",
      postponed: "स्थगित",
      cancelled: "रद्द",
      done: "हो चुका",
      retired: "बंद",
    },

    units: {
      days: "दिन",
      hours: "घंटे",
      minutes: "मिनट",
      seconds: "सेकंड",
      daysShort: "दि",
      hoursShort: "घं",
      minutesShort: "मि",
      secondsShort: "से",
    },

    pagination: {
      previous: "पिछला",
      next: "अगला",
      page: "पेज {n}",
      pageOf: "पेज {n} / {total}",
    },

    languageSwitcher: {
      label: "भाषा",
      description: "Until को दूसरी भाषा में पढ़ें",
    },
  },

  categories: {
    labels: {
      holidays: "छुट्टियाँ",
      national: "राष्ट्रीय दिवस",
      religion: "धार्मिक",
      awareness: "जागरूकता दिवस",
      fun: "मज़ेदार दिन",
      culture: "संस्कृति",
      festivals: "त्योहार",
      sports: "खेल",
      esports: "ई-स्पोर्ट्स",
      games: "गेम्स",
      film: "फ़िल्म",
      tv: "टीवी",
      anime: "एनिमे",
      music: "संगीत",
      entertainment: "मनोरंजन",
      politics: "राजनीति",
      tech: "तकनीक",
      science: "विज्ञान",
      space: "अंतरिक्ष",
      astronomy: "खगोल",
      nature: "प्रकृति",
      history: "इतिहास",
      curiosities: "अजब-गजब",
    },

    blurbs: {
      holidays: "सार्वजनिक छुट्टियाँ और उनसे जुड़ी रस्में।",
      national: "स्वतंत्रता दिवस, गणतंत्र दिवस, राष्ट्रीय पर्व।",
      religion: "हर धर्म के पर्व, व्रत और पवित्र दिन।",
      awareness: "संयुक्त राष्ट्र के और अंतरराष्ट्रीय दिवस।",
      fun: "पिज़्ज़ा डे, टॉक लाइक अ पाइरेट डे और ऐसे ही बहाने।",
      culture: "उत्सव, पर्व और नागरिक कैलेंडर।",
      festivals: "कार्निवल, मेले और जमावड़े।",
      sports: "फ़ाइनल, उद्घाटन समारोह और अगला वर्ल्ड कप।",
      esports: "Worlds, Majors और The International।",
      games: "रिलीज़ की तारीखें और शोकेस।",
      film: "प्रीमियर और अवॉर्ड की रातें।",
      tv: "सीज़न के प्रीमियर और फ़िनाले।",
      anime: "सीज़न की शुरुआत और फ़िल्म रिलीज़।",
      music: "प्रतियोगिताएँ, टूर और सालगिरहें।",
      entertainment: "फ़ैनडम की तारीखें और पॉप-कल्चर के खास दिन।",
      politics: "चुनाव और वे तारीखें जो देशों की दिशा तय करती हैं।",
      tech: "कॉन्फ़्रेंस, सपोर्ट खत्म होने की तारीखें और कंप्यूटर की घड़ियाँ।",
      science: "जिज्ञासु लोगों के लिए तारीखें।",
      space: "लॉन्च, लैंडिंग और चाँद तक का लंबा सफ़र।",
      astronomy: "ग्रहण, उल्कावर्षा, संक्रांति — आसमान से तय मुलाकातें।",
      nature: "धरती, महासागर और बदलता मौसम-चक्र।",
      history: "बीत चुकी घटनाओं की सालगिरहें — घड़ी अब भी चल रही है।",
      curiosities: "Unix के पड़ाव, पैलिंड्रोम तारीखें, शुक्रवार 13 तारीख।",
    },

    groups: {
      celebrate: { label: "मनाएँ", tagline: "छुट्टियाँ, पर्व और जश्न के बहाने।" },
      watch: { label: "देखें", tagline: "फ़ाइनल, प्रीमियर, टूर और अगली बड़ी रिलीज़।" },
      play: { label: "खेलें", tagline: "रिलीज़ की तारीखें और शोकेस।" },
      "look-up": { label: "ऊपर देखें", tagline: "लॉन्च, ग्रहण और बदलता मौसम-चक्र।" },
      vote: { label: "वोट दें", tagline: "चुनाव, कॉन्फ़्रेंस और कंप्यूटर की घड़ियाँ।" },
      wonder: { label: "अचरज करें", tagline: "सालगिरहें और कैलेंडर की अजीब तारीखें।" },
    },
  },

  seo: {
    homeTitle: "Until — हर आने वाली तारीख का काउंटडाउन",
    siteDescription:
      "हज़ारों आने वाली तारीखें, टैग के साथ और चलती घड़ी के साथ। छुट्टियाँ, ग्रहण, वर्ल्ड कप, चुनाव — और वे भी जो आप खुद बनाते हैं।",
    titleTemplate: "%s · Until",

    event: {
      whenIs: "{title} कब है? {when}",
      whenIsCoarse: "{title} कब है? {period} में संभावित",
      countdownColon: "{title} काउंटडाउन: {when}",
      countdownDash: "{title} का काउंटडाउन — {when}",
      countdownDashCoarse: "{title} — {when}",
      description: "{title}{status} {date} को है। {days} लाइव काउंटडाउन, कैलेंडर में जोड़ें।",
      descriptionCoarse:
        "{title} {period} में संभावित है। सटीक दिन अभी तय नहीं। तय होते ही काउंटडाउन शुरू, कैलेंडर में जोड़ें।",
      statusCancelled: " (रद्द)",
      statusPostponed: " (स्थगित)",
      fallbackTitle: "काउंटडाउन",
      mineTitle: "आपका काउंटडाउन",
      sharedTitle: "शेयर किया गया काउंटडाउन",
      sharedMetaTitle: "{title} — {date} का काउंटडाउन",
      sharedMetaDescription: "{title} {date} को है। यह काउंटडाउन किसी ने Until पर बनाया है।",
    },

    series: {
      title: "{title} में कितने दिन बाकी हैं? — {when}",
      titleNoDate: "{title} में कितने दिन बाकी हैं?",
      heading: "{title} में कितने दिन बाकी हैं?",
      description: "{title} {date} को है। {days} लाइव काउंटडाउन, हर साल की तारीखें, कैलेंडर में जोड़ें।",
      descriptionCoarse:
        "अगला {title} {period} में संभावित है। हर साल की तारीखें, लाइव काउंटडाउन, कैलेंडर में जोड़ें।",
      descriptionNoDate: "{title}: आने वाली तारीखें, अगली तारीख का लाइव काउंटडाउन और कैलेंडर लिंक।",
      fallbackTitle: "कितने दिन बाकी",
    },

    hub: {
      category: "{category}: आने वाली तारीखें और काउंटडाउन",
      country: "{country}: आने वाली छुट्टियाँ और इवेंट",
      month: "{month} — आगे क्या है",
      tag: "{tag} — आने वाले इवेंट और काउंटडाउन",
      lowercaseCategory: false,
    },

    days: {
      today: "यह आज ही है।",
      tomorrow: "यह कल ही है।",
      yesterday: "यह तारीख कल थी।",
      away: { one: "इसमें {n} दिन बाकी है।", other: "इसमें {n} दिन बाकी हैं।" } as PluralForms,
      ago: { one: "यह तारीख {n} दिन पहले थी।", other: "यह तारीख {n} दिन पहले थी।" } as PluralForms,
    },

    period: {
      month: "{month} {year}",
      quarter: "{year} की तिमाही {q}",
      year: "{year}",
      expected: "{period} में संभावित",
      unknown: "तारीख की घोषणा बाकी",
    },

    jsonLd: {
      siteDescription: "हज़ारों आने वाले इवेंट, छुट्टियों और पड़ावों की तारीखें और लाइव काउंटडाउन।",
      seriesDescription: "{title} की आने वाली तारीखें।",
    },
  },

  home: {
    loading: "कैटलॉग लोड हो रहा है",

    hero: {
      eyebrow: "खास काउंटडाउन",
      meta: "{category} · {when}",
      open: "यह काउंटडाउन खोलें",
    },

    hub: {
      alsoOnTheHorizon: "ये भी आ रहे हैं",
      next7Days: "अगले 7 दिन",
      wholeMonth: "पूरा महीना →",
      browseByCategory: "श्रेणी से देखें",
      allCategories: "सभी श्रेणियाँ →",
      popularCountdowns: "लोकप्रिय काउंटडाउन",
      everyRecurringDate: "हर साल आने वाली सभी तारीखें →",
      byCountry: "देश से देखें",
      allCountries: "सभी देश →",
      noCountries: "देशों का डेटा भरा जा रहा है।",
      byMonth: "महीने से देखें",
      thisMonth: "इस महीने — {month}",
      nextMonth: "अगले महीने — {month}",
    },

    explorer: {
      heading: "कैटलॉग",
      count: { one: "{n} आने वाली तारीख।", other: "{n} आने वाली तारीखें।" } as PluralForms,
      countMatching: {
        one: "“{q}” से मिलती {n} आने वाली तारीख।",
        other: "“{q}” से मिलती {n} आने वाली तारीखें।",
      } as PluralForms,
      countInCategory: {
        one: "{category} — {n} आने वाली तारीख।",
        other: "{category} — {n} आने वाली तारीखें।",
      } as PluralForms,
      countMatchingInCategory: {
        one: "{category} — “{q}” से मिलती {n} आने वाली तारीख।",
        other: "{category} — “{q}” से मिलती {n} आने वाली तारीखें।",
      } as PluralForms,
      sort: {
        soonest: "सबसे पहले",
        popular: "लोकप्रिय",
        latest: "सबसे बाद में",
      },
    },

    filters: {
      all: "सभी",
    },

    empty: {
      noMatch: "कैटलॉग में “{q}” से मिलता कुछ नहीं है।",
      nothing: "यहाँ अभी कुछ नहीं है।",
      hint: "वर्तनी की गलती चल जाती है और शुरुआती अक्षर भी काम करते हैं, इसलिए मिलती-जुलती खोज भी पहुँच जाती है — लगता है यह तारीख कैटलॉग में है ही नहीं।",
      busiest: "सबसे भरी श्रेणियाँ",
      everyRecurringDate: "हर साल आने वाली सभी तारीखें",
      startOver: "फिर से शुरू करें",
    },

    table: {
      date: "तारीख",
      event: "इवेंट",
      within: "बाकी",
      category: "श्रेणी",
      empty: "यहाँ अभी कुछ तय नहीं है।",
    },

    pagination: "पेज नेविगेशन",
  },

  event: {
    answer: {
      today: "{title} आज है, {date}।",
      tomorrow: "{title} में {n} दिन बाकी है — कल, {date}।",
      days: {
        one: "{title} में {n} दिन बाकी है, {date} को।",
        other: "{title} में {n} दिन बाकी हैं, {date} को।",
      } as PluralForms,
      past: {
        one: "{title} की तारीख {n} दिन पहले थी — {date}।",
        other: "{title} की तारीख {n} दिन पहले थी — {date}।",
      } as PluralForms,
      cancelled: "{title} {date} को होना था; यह आयोजन रद्द कर दिया गया है।",
      coarse: "{title} {period} में संभावित है। सटीक दिन की घोषणा अभी नहीं हुई है।",
      plain: "{title} {date} को है।",
    },

    statusHappened: "हो चुका",

    dateRange: "{start} – {end}",

    coarseNote:
      "सटीक दिन की घोषणा अभी नहीं हुई है। स्रोत के घोषित करते ही यह पेज गिनती शुरू कर देगा।",
    dateChanged: "तारीख बदली: पहले {date} थी।",
    partOfSeries: "यह {series} सीरीज़ का हिस्सा है — हर साल, और अगली तारीख हमेशा सबसे ऊपर।",
    everyUpcomingDate: "आने वाली सभी तारीखें",
    otherYears: "दूसरे साल",
    alsoComing: "ये भी आ रहे हैं",

    fields: {
      where: "कहाँ",
      tags: "टैग",
    },

    provenance: {
      source: "स्रोत:",
      lastVerified: "आखिरी बार {date} को जाँचा गया",
      summary: "सारांश {source} से ({license})",
    },

    image: {
      photo: "फ़ोटो",
      photoBy: "फ़ोटो:",
      via: "{provider} के ज़रिए",
    },

    mine: {
      missingTitle: "यह काउंटडाउन किसी दूसरे डिवाइस पर है",
      missingBody:
        "अपने बनाए काउंटडाउन उसी ब्राउज़र में रहते हैं जिसमें वे बने थे। अगर किसी ने आपको लिंक भेजा है, तो उनसे “बनाएँ” पेज वाला शेयर करने लायक URL माँगें।",
      makeNew: "नया बनाएँ",
      onThisDevice: "इस डिवाइस पर",
      remove: "हटाएँ",
      savedCount: {
        one: "इस ब्राउज़र में कैटलॉग की {n} तारीख सेव है।",
        other: "इस ब्राउज़र में कैटलॉग की {n} तारीखें सेव हैं।",
      } as PluralForms,
    },
  },

  series: {
    index: {
      title: "कितने दिन बाकी — हर साल लौटने वाला हर काउंटडाउन",
      description:
        "क्रिसमस, रमज़ान, सुपर बाउल, पर्सीड उल्कावर्षा: कैटलॉग की हर लौटने वाली तारीख, अगली तारीख सबसे ऊपर और आगे के सालों की सूची के साथ।",
      heading: "कितने दिन बाकी हैं…",
      intro: {
        one: "{n} तारीख जो हर साल लौटती है। हर पेज पर अगली तारीख सबसे ऊपर रहती है और आगे के साल सूची में।",
        other:
          "{n} तारीखें जो हर साल लौटती हैं। हर पेज पर अगली तारीख सबसे ऊपर रहती है और आगे के साल सूची में।",
      } as PluralForms,
      empty: "कैटलॉग भरा जा रहा है — जल्द फिर देखें।",
      jsonLdDescription: "हर साल लौटने वाली तारीखें, अगली तारीख और कई साल की सूची के साथ।",
    },

    noUpcoming: "{title} की कोई आने वाली तारीख अभी कैटलॉग में नहीं है।",

    thisYearsPage: "इस साल का पेज",

    shareTitle: "{title} में कितने दिन बाकी",

    upcoming: {
      heading: "आने वाली तारीखें",
      note: "कैटलॉग में {title} की आज के बाद की हर तारीख, सबसे पहले वाली ऊपर।",
      empty: "अभी आगे की कोई तारीख नहीं — अगले अपडेट के बाद देखें।",
    },

    variants: {
      heading: "इस सीरीज़ से जुड़ी दूसरी तारीखें",
      note: "कुछ देशों में यही पर्व इसी नाम से दूसरे दिन मनाया जाता है — इन्हें अलग रखा गया है ताकि ऊपर का काउंटडाउन मुख्य तारीख पर टिका रहे।",
    },

    faqHeading: "लोग क्या पूछते हैं",

    tagsLabel: "टैग:",

    related: {
      heading: "{category} — हर साल लौटने वाली और तारीखें",
      all: "हर साल लौटने वाले सभी काउंटडाउन",
    },
  },

  hubs: {
    label: {
      browse: "ब्राउज़",
      category: "श्रेणी",
      country: "देश",
      calendar: "कैलेंडर",
      tag: "टैग",
    },

    breadcrumbLabel: "ब्रेडक्रंब",

    paged: {
      title: "{name} (पेज {n})",
      headingSuffix: "— पेज {n}",
      backToFirst: "पहले पेज पर लौटें।",
    },

    categoryIndex: {
      title: "श्रेणियाँ — हर तरह की तारीख जो अभी आनी बाकी है",
      description:
        "श्रेणी से आने वाली तारीखें देखें: छुट्टियाँ, खेल, फ़िल्म और टीवी, गेम्स, अंतरिक्ष, चुनाव, सालगिरहें और भी बहुत कुछ, हर एक लाइव काउंटडाउन के साथ।",
      heading: "हर तरह की तारीख",
      intro: "तेईस श्रेणियाँ, इस हिसाब से बँटी हुई कि आप उनका करेंगे क्या।",
      collectionDescription: "श्रेणी के हिसाब से आने वाली तारीखें।",
    },

    category: {
      description: {
        one: "{blurb} {n} आने वाली तारीख, लाइव काउंटडाउन और कैलेंडर लिंक के साथ।",
        other: "{blurb} {n} आने वाली तारीखें, लाइव काउंटडाउन और कैलेंडर लिंक के साथ।",
      } as PluralForms,
      descriptionEmpty: "{blurb} आने वाली तारीखें, लाइव काउंटडाउन और कैलेंडर लिंक के साथ।",
      descriptionPaged:
        "{blurb} आने वाली तारीखों का पेज {n}, सबसे पहले वाली ऊपर, लाइव काउंटडाउन और कैलेंडर लिंक के साथ।",
      heading: "{category}: आने वाली तारीखें",
      count: { one: "{n} आने वाली तारीख।", other: "{n} आने वाली तारीखें।" } as PluralForms,
      countPaged: {
        one: "{n} आने वाली तारीख, सबसे पहले वाली ऊपर।",
        other: "{n} आने वाली तारीखें, सबसे पहले वाली ऊपर।",
      } as PluralForms,
      soon: "अगले 30 दिन",
      everyYear: "हर साल",
      all: "{category} — सभी आने वाली तारीखें",
      empty: "इस श्रेणी में अभी कुछ नहीं है।",
    },

    countryIndex: {
      title: "देश — देश के हिसाब से आने वाली छुट्टियाँ और इवेंट",
      description:
        "200 से ज़्यादा देशों और क्षेत्रों की सार्वजनिक छुट्टियाँ, राष्ट्रीय दिवस और स्थानीय इवेंट, हर एक लाइव काउंटडाउन और कैलेंडर लिंक के साथ।",
      heading: "देश से",
      intro: {
        one: "कैटलॉग में {n} देश और क्षेत्र, जिनकी आने वाली छुट्टियाँ और इवेंट यहाँ हैं।",
        other: "कैटलॉग में {n} देश और क्षेत्र, जिनकी आने वाली छुट्टियाँ और इवेंट यहाँ हैं।",
      } as PluralForms,
      empty: "कैटलॉग भरा जा रहा है — जल्द फिर देखें।",
      collectionDescription: "देश के हिसाब से आने वाली छुट्टियाँ और इवेंट।",
    },

    country: {
      description: {
        one: "{country} की छुट्टियाँ, राष्ट्रीय दिवस और इवेंट — {n} आने वाली तारीख, महीने के हिसाब से, लाइव काउंटडाउन और कैलेंडर लिंक के साथ।",
        other:
          "{country} की छुट्टियाँ, राष्ट्रीय दिवस और इवेंट — {n} आने वाली तारीखें, महीने के हिसाब से, लाइव काउंटडाउन और कैलेंडर लिंक के साथ।",
      } as PluralForms,
      descriptionEmpty:
        "{country} की सार्वजनिक छुट्टियाँ, राष्ट्रीय दिवस और इवेंट, महीने के हिसाब से, लाइव काउंटडाउन और कैलेंडर लिंक के साथ।",
      intro:
        "{country} से टैग की गई आने वाली छुट्टियाँ और इवेंट, महीने दर महीने। दुनिया भर की तारीखें — ग्रहण, रिलीज़, अंतरराष्ट्रीय दिवस — नीचे अलग से दी गई हैं।",
      count: { one: "{n} आने वाली तारीख।", other: "{n} आने वाली तारीखें।" } as PluralForms,
      countCapped: { one: "{n}+ आने वाली तारीख।", other: "{n}+ आने वाली तारीखें।" } as PluralForms,
      empty: "{country} से टैग की गई अभी कोई तारीख नहीं है।",
      worldwide: "दुनिया भर में, आगे आने वाले",
      collectionDescription: "{country} की छुट्टियाँ और इवेंट।",
    },

    calendar: {
      description:
        "{month} में कैटलॉग का सब कुछ: छुट्टियाँ, लॉन्च, फ़ाइनल, प्रीमियर और सालगिरहें, दिन दर दिन, लाइव काउंटडाउन के साथ।",
      count: {
        one: "{month} में {n} आने वाली तारीख, दिन दर दिन।",
        other: "{month} में {n} आने वाली तारीखें, दिन दर दिन।",
      } as PluralForms,
      empty: "{month} में अभी कुछ आने वाला नहीं है।",
      months: "महीने",
      previous: "← {month}",
      next: "{month} →",
      collectionDescription: "{month} में आने वाली तारीखें।",
    },

    tag: {
      description: {
        one: "“{tag}” टैग वाली {n} आने वाली तारीख, सबसे पहले वाली ऊपर, लाइव काउंटडाउन और कैलेंडर लिंक के साथ।",
        other:
          "“{tag}” टैग वाली {n} आने वाली तारीखें, सबसे पहले वाली ऊपर, हर एक लाइव काउंटडाउन और कैलेंडर लिंक के साथ।",
      } as PluralForms,
      descriptionPaged:
        "“{tag}” टैग वाली आने वाली तारीखों का पेज {n}, सबसे पहले वाली ऊपर, हर एक लाइव काउंटडाउन और कैलेंडर लिंक के साथ।",
      crumb: "#{tag}",
      count: {
        one: "“{tag}” टैग वाली {n} आने वाली तारीख, सबसे पहले वाली ऊपर।",
        other: "“{tag}” टैग वाली {n} आने वाली तारीखें, सबसे पहले वाली ऊपर।",
      } as PluralForms,
      searchPrompt: "कुछ और ढूँढ रहे हैं?",
      searchLink: "पूरे कैटलॉग में “{tag}” खोजें।",
      collectionDescription: "{tag} टैग वाली आने वाली तारीखें।",
    },
  },

  pages: {
    about: {
      title: "परिचय",
      description: "Until हज़ारों आने वाली तारीखों को कैसे जुटाता, टैग करता और वर्गीकृत करता है।",
      eyebrow: "यह प्रोजेक्ट",
      heading: "आने वाले कल का अख़बार",

      intro:
        "Until उन तारीखों का कैटलॉग है जो अभी आई नहीं हैं। लगभग हर देश की सार्वजनिक छुट्टियाँ, Wikipedia के साल-वार पन्नों और Wikidata से लिए गए तय इवेंट, और ऊपर से उन तारीखों की चुनी हुई परत जिनका लोग सचमुच इंतज़ार करते हैं — ग्रहण, वर्ल्ड कप, ओलंपिक, चुनाव, हैली धूमकेतु।",
      categories:
        "हर पंक्ति को {n} श्रेणियों में टैग और वर्गीकृत किया जाता है — छुट्टियाँ, राष्ट्रीय दिवस, खेल, खगोल, अंतरिक्ष, तकनीक, राजनीति, इतिहास और भी बहुत कुछ। पूरे सेट में खोजें, कोई एक श्रेणी छाँटें, लाइव काउंटडाउन खोलें और उसे कैलेंडर में जोड़ लें।",
      sources:
        "छुट्टियों की रीढ़ ऑफ़लाइन {dateHolidays} डेटासेट है, जिसे {wikidata} और {wikipedia} से बढ़ाया गया है। एक ही दिन पड़ने वाले एक जैसे नाम (140 देशों का क्रिसमस) एक ही काउंटडाउन में मिला दिए जाते हैं। जहाँ स्रोत आपस में भिड़ते हैं, वहाँ चुने हुए रिकॉर्ड जीतते हैं। हर इवेंट पेज अपना स्रोत बताता है और यह भी कि तारीख आखिरी बार कब जाँची गई थी।",
      expected:
        "जिन तारीखों का दिन पक्का नहीं है, उन पर स्रोत के मुताबिक महीना, तिमाही या साल के साथ “संभावित” लिखा जाता है, और असली तारीख छपने तक उनकी घड़ी नहीं चलती। कैटलॉग रोज़ अपने स्रोतों से ताज़ा होता है।",
      yourOwn:
        "आप अपना भी बना सकते हैं। वे ब्राउज़र में ही रहते हैं — कोई अकाउंट नहीं — और शेयर लिंक शीर्षक और तारीख को URL में लेकर चलता है, ताकि कोई भी वही चलती घड़ी खोल सके।",

      stats: {
        dates: "तारीखें",
        featured: "खास",
        updated: "अपडेट",
      },

      byCategory: {
        heading: "श्रेणी के हिसाब से",
        empty: "कैटलॉग भरा जा रहा है — जल्द फिर देखें।",
      },

      bySource: {
        heading: "स्रोत के हिसाब से",
        empty: "अभी कोई स्रोत दर्ज नहीं है।",
      },
    },

    attributions: {
      title: "स्रोत और श्रेय — तारीखें कहाँ से आती हैं",
      description:
        "Until कैटलॉग के पीछे का हर स्रोत, उसके लाइसेंस और माँगे गए श्रेय के साथ: date-holidays, Wikipedia, Wikidata, Hebcal, Launch Library और बाकी।",
      eyebrow: "स्रोत",
      heading: "स्रोत और श्रेय",
      intro:
        "Until सिर्फ़ वही स्रोत लेता है जिनकी शर्तें डेटा सहेजने और दोबारा प्रकाशित करने की इजाज़त देती हैं। शेयर-अलाइक स्रोतों (Wikipedia का पाठ, TVMaze, date-holidays का डेटा) को हर उस पेज पर श्रेय दिया जाता है जो उन्हें इस्तेमाल करता है; तस्वीरें सिर्फ़ CC0, पब्लिक डोमेन, CC BY या CC BY-SA लाइसेंस के तहत, लेखक के नाम के साथ, दोबारा होस्ट की जाती हैं। हर इवेंट पेज उस रिकॉर्ड से जुड़ा रहता है जिससे वह बना है।",
      sourcesEmpty: "स्रोतों की सूची अभी उपलब्ध नहीं है।",

      images: {
        heading: "तस्वीरें",
        policy:
          "तस्वीरें दोबारा होस्ट की गई प्रतियाँ हैं, जिन्हें आकार बदलकर हमारे अपने स्टोरेज से परोसा जाता है, ताकि मूल होस्ट से कभी हॉटलिंक न हो। सिर्फ़ स्वतंत्र लाइसेंस वाली फ़ाइलें ली जाती हैं — CC0, पब्लिक डोमेन, CC BY, CC BY-SA और कुछ राष्ट्रीय ओपन-गवर्नमेंट लाइसेंस, साथ में NASA की तस्वीरें उसके मीडिया दिशानिर्देशों के तहत। फ़ेयर-यूज़ फ़ाइलें, गैर-व्यावसायिक (NC) और नो-डेरिवेटिव्स (ND) लाइसेंस सीधे नकार दिए जाते हैं, और वही हाल ट्रेडमार्क या व्यक्तित्व पाबंदी वाली फ़ाइलों का है; सहेजी गई हर फ़ाइल अपने लेखक, लाइसेंस और फ़ाइल पेज का लिंक साथ रखती है। जिन इवेंट के लिए कोई मुफ़्त तस्वीर नहीं मिलती, उन्हें बनाया हुआ कार्ड मिलता है।",
        shareAlike:
          "शेयर-अलाइक तस्वीरें (CC BY-SA) बिना बदलाव, अपने ही अनुपात में और नीचे श्रेय के साथ छापी जाती हैं। इन्हें कभी काटकर सोशल कार्ड नहीं बनाया जाता: वह जोड़-तोड़ व्युत्पन्न कृति होती और उसे भी वही शेयर-अलाइक लाइसेंस ढोना पड़ता, इसलिए वे कार्ड बनी हुई डिज़ाइन इस्तेमाल करते हैं। सहेजी गई फ़ाइलें हर महीने अपने स्रोत के सामने दोबारा जाँची जाती हैं; जो हटा दी गई हो या अब स्वतंत्र न रह गई हो, उसे हमारे स्टोरेज से हटा दिया जाता है और उसके पेज बनाए हुए कार्ड पर लौट आते हैं।",
        empty: "अभी कोई तस्वीर दोबारा होस्ट नहीं की गई है।",
        count: {
          one: "आज लाइब्रेरी में {n} तस्वीर:",
          other: "आज लाइब्रेरी में {n} तस्वीरें:",
        } as PluralForms,
      },

      fonts:
        "फ़ॉन्ट: Fraunces (SIL Open Font License) और Geist (SIL Open Font License)। खगोलीय गणना astronomy-engine (MIT) से।",
    },

    create: {
      title: "काउंटडाउन बनाएँ",
      description: "अपना निजी काउंटडाउन बनाएँ और उसे कैलेंडर में जोड़ें।",
      eyebrow: "आपकी तारीखें",
      heading: "काउंटडाउन बनाएँ",
      intro:
        "जन्मदिन, लॉन्च, कोई सफ़र, अदालत की तारीख, कोई पुनर्मिलन। यह कैटलॉग की तरह ही चलता है — और आप इसे सीधे Google Calendar, Outlook या .ics फ़ाइल में डाल सकते हैं।",

      form: {
        draftTitle: "कोई चीज़ जिसका मुझे इंतज़ार है",
        draftNote: "आपका बनाया हुआ काउंटडाउन।",
        titleLabel: "शीर्षक",
        dateLabel: "तारीख",
        categoryLabel: "श्रेणी",
        noteLabel: "नोट",
        notePlaceholder: "यह तारीख आपके लिए क्यों मायने रखती है।",
        save: "इस डिवाइस पर सेव करें",
        openShareable: "शेयर करने लायक पेज खोलें",
        saved: "सेव हो गया। {link} — यह इस ब्राउज़र में तब तक रहेगा जब तक आप स्टोरेज साफ़ नहीं करते।",
        savedLink: "इसे देखें",
        privacy:
          "अपने बनाए काउंटडाउन आपके डिवाइस पर ही रहते हैं (कोई अकाउंट नहीं)। शेयर लिंक शीर्षक और तारीख को URL में एनकोड करता है।",
        previewLabel: "लाइव झलक",
        chooseDate: "घड़ी शुरू करने के लिए तारीख चुनें।",
      },
    },

    notFound: {
      heading: "यह तारीख कैटलॉग में नहीं है",
      body: "हो सकता है इसे किसी और में मिला दिया गया हो, इसका नाम बदल गया हो, या यह कभी रही ही न हो।",
      backHome: "आने वाली हर चीज़ पर लौटें",
    },
  },

  embed: {
    countdown: {
      units: {
        days: { one: "दिन", other: "दिन" } as PluralForms,
        hours: "घं",
        minutes: "मिन",
        seconds: "सेक",
      },
      today: "यह आज ही है।",
      past: "यह हो चुका है।",
    },

    studio: {
      heading: "इसे साथ ले जाएँ",

      controls: {
        preset: "प्रीसेट",
        digits: "अंक",
        type: "अक्षर",
        background: "बैकग्राउंड",
        transparent: "पारदर्शी — दृश्य या पेज को आर-पार दिखने देता है",
        font: "फ़ॉन्ट",
        size: "आकार",
        layout: "लेआउट",
        units: "इकाइयाँ",
        separator: "विभाजक",
        frame: "फ़्रेम",
        radius: "कोनों की गोलाई",
        inset: "किनारे से दूरी",
        position: "जगह",
        done: "खत्म होने पर संदेश",
        reset: "रीसेट",
        colourPicker: "{label} — रंग चुनें",
      },

      toggles: {
        unitLabels: "इकाइयों के नाम",
        title: "शीर्षक",
        date: "तारीख",
        note: "नोट",
        wordmark: "वर्डमार्क",
        glow: "चमक",
        trim: "शुरुआती शून्य हटाएँ",
      },

      presets: {
        dark: "Until डार्क",
        light: "लाइट",
        amber: "एम्बर",
        mono: "मोनो",
        neon: "नियॉन",
        clear: "पारदर्शी",
      },

      fonts: {
        serif: "सेरिफ़",
        sans: "सैन्स",
        mono: "मोनो",
      },

      layouts: {
        row: "एक पंक्ति",
        stack: "ऊपर-नीचे",
        compact: "कॉम्पैक्ट",
        big: "एक बड़ा अंक",
      },

      separators: {
        colon: "कोलन",
        dot: "बिंदु",
        space: "खाली जगह",
        none: "कुछ नहीं",
      },

      frames: {
        card: "कार्ड",
        outline: "आउटलाइन",
        none: "कुछ नहीं",
      },

      units: {
        dhms: "दिन · घंटे · मिनट · सेकंड",
        dhm: "दिन · घंटे · मिनट",
        dh: "दिन · घंटे",
        d: "दिन",
        hms: "घंटे · मिनट · सेकंड",
        hm: "घंटे · मिनट",
        ms: "मिनट · सेकंड",
      },

      positions: {
        "top-left": "ऊपर बाएँ",
        top: "ऊपर",
        "top-right": "ऊपर दाएँ",
        left: "बाएँ",
        center: "बीच में",
        right: "दाएँ",
        "bottom-left": "नीचे बाएँ",
        bottom: "नीचे",
        "bottom-right": "नीचे दाएँ",
      },

      copy: {
        code: "कोड कॉपी करें",
        url: "URL कॉपी करें",
      },

      embed: {
        previewTitle: "एम्बेड की झलक",
        paste: "इसे अपने पेज में पेस्ट करें",
        codeLabel: "एम्बेड कोड",
        note: "यह पूरी चौड़ाई में और {height}px ऊँचा बैठता है। WordPress, Ghost और Notion काउंटडाउन का अपना लिंक भी स्वीकार करते हैं और एम्बेड खुद ढूँढ लेते हैं — पर उससे मानक कार्ड खुलता है, इसलिए यहाँ बनाई गई डिज़ाइन बनाए रखने के लिए ऊपर वाला कोड ही पेस्ट करें।",
      },

      stream: {
        previewTitle: "स्ट्रीम ओवरले की झलक",
        canvasNote: "{width} × {height} का कैनवस, छोटा करके — शतरंज जैसे खाने वही हैं जिन्हें OBS पारदर्शी कर देता है।",
        urlLabel: "ब्राउज़र सोर्स URL",
        source: "ब्राउज़र सोर्स · {width} × {height}",
        steps: [
          "OBS या Streamlabs में एक Browser source जोड़ें।",
          "ऊपर वाला URL पेस्ट करें।",
          "आकार {width} × {height} रखें — जगह इसी कैनवस के हिसाब से नापी जाती है।",
          "बैकग्राउंड पारदर्शी रहने दें; ओवरले अपना बैकग्राउंड खुद लाता है।",
          "“सीन एक्टिव होने पर ब्राउज़र रिफ़्रेश करें” पर टिक लगाएँ ताकि घड़ी नए सिरे से शुरू हो।",
        ],
      },
    },
  },
};
