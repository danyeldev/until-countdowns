/**
 * Arabic messages. See `en/` for what each key is for.
 *
 * Four decisions a maintainer should not undo:
 * - The money phrase is "كم باقي على {title}؟". "كم باقي على رمضان" is what people type; a literal
 *   "كم يومًا حتى…" is grammar nobody searches with. The same wording carries the `<h1>`, the
 *   series title and the share sheet, so the page reads back the query it was found by.
 * - No clitic (لـ، بـ، الـ) is ever attached to a `{placeholder}`: a title can arrive in Arabic or
 *   in Latin script, and "لـSuper Bowl" is the Arabic equivalent of Turkish's vowel-harmony trap.
 *   Every template uses a free preposition (على، حتى، في، من) or an iḍāfa where our own word takes
 *   the definite article — "مواعيد {category} القادمة", "العد التنازلي حتى {title}". That is also
 *   why the category labels are definite ("العطلات الرسمية", "الفضاء"): they sit in an iḍāfa.
 * - All six ICU categories are written out, with the real counted-noun grammar behind them:
 *   dual for 2 (يومان), plural for 3-10 (3 أيام), accusative singular tamyīz for 11-99 (11 يومًا),
 *   bare singular for 100+ (100 يوم). The zero form is the negative sentence Arabic actually uses
 *   ("لا مواعيد قادمة") rather than a "0 يوم" nobody would write.
 * - Digits stay Latin. CLDR's default numbering system for the bare `ar` tag is `latn`, so
 *   `Intl` renders "1,234" and "25 ديسمبر 2026" on the page; hand-written prose matches it. If the
 *   locale tag is ever regionalised (ar-EG), these should become Arabic-Indic in the same commit.
 *
 * The page is `dir="rtl"`, so arrows are written the way they must render: → points back (previous,
 * "all →" becomes "الكل ←"). The only directional mark in the file is the U+200E before ".ics",
 * which keeps the dot from drifting to the wrong side of the extension.
 */
import type { Messages } from "./en";
import type { PluralForms } from "./types";

export const ar: Messages = {
  common: {
    siteName: "Until",
    tagline: "فهرس لكل ما لم يحدث بعد.",
    wordmarkLine: "Until — فهرس لكل ما لم يحدث بعد.",

    nav: {
      categories: "التصنيفات",
      countries: "الدول",
      daysUntil: "كم باقي",
      create: "إنشاء",
      about: "عن الموقع",
    },

    search: {
      label: "بحث",
      navLabel: "ابحث عن عد تنازلي",
      placeholder: "ابحث في الفهرس…",
      navPlaceholder: "ابحث عن كسوف أو كأس عالم أو عيد…",
      submit: "بحث",
    },

    breadcrumb: {
      home: "الرئيسية",
    },

    footer: {
      datesCount: {
        zero: "لا مواعيد",
        one: "موعد واحد",
        two: "موعدان",
        few: "{n} مواعيد",
        many: "{n} موعدًا",
        other: "{n} موعد",
      } as PluralForms,
      aboutTheData: "عن البيانات",
      attributions: "المصادر",
      categories: "التصنيفات",
      browse: "تصفح",
      all: "الكل ←",
      makeYourOwn: "أنشئ عدك الخاص",
      language: "اللغة",
    },

    actions: {
      share: "مشاركة",
      shareCopied: "تم نسخ الرابط",
      save: "حفظ",
      saved: "تم الحفظ",
      addToCalendar: "أضف إلى التقويم",
      google: "Google Calendar",
      outlook: "Outlook",
      downloadIcs: "تنزيل ملف ‎.ics",
      embed: "ضعه في موقعك",
      stream: "أضفه إلى بثك",
      copy: "نسخ",
      copied: "تم النسخ",
    },

    labels: {
      worldwide: "حول العالم",
      countriesCount: {
        zero: "لا دول",
        one: "دولة واحدة",
        two: "دولتان",
        few: "{n} دول",
        many: "{n} دولة",
        other: "{n} دولة",
      } as PluralForms,
      recurring: "متكرر",
      series: "سلسلة",
      today: "اليوم",
      tba: "لم يُعلن",
      dateToBeAnnounced: "موعد سيُعلن لاحقًا",
      nothingHereYet: "لا شيء هنا بعد",
      more: "المزيد",
      seeAll: "عرض الكل ←",
      loading: "جارٍ التحميل…",
      source: "المصدر",
      sources: "المصادر",
      lastVerified: "آخر تحقق",
    },

    status: {
      scheduled: "مُقرر",
      tentative: "غير مؤكد",
      postponed: "مؤجل",
      cancelled: "ملغى",
      done: "انتهى",
      retired: "متوقف",
    },

    units: {
      days: "أيام",
      hours: "ساعات",
      minutes: "دقائق",
      seconds: "ثوانٍ",
      daysShort: "ي",
      hoursShort: "س",
      minutesShort: "د",
      secondsShort: "ث",
    },

    pagination: {
      previous: "السابق",
      next: "التالي",
      page: "صفحة {n}",
      pageOf: "صفحة {n} من {total}",
    },

    languageSwitcher: {
      label: "اللغة",
      description: "اقرأ Until بلغة أخرى",
    },
  },

  categories: {
    labels: {
      holidays: "العطلات الرسمية",
      national: "الأعياد الوطنية",
      religion: "المناسبات الدينية",
      awareness: "أيام التوعية",
      fun: "الأيام الطريفة",
      culture: "الثقافة",
      festivals: "المهرجانات",
      sports: "الرياضة",
      esports: "الرياضات الإلكترونية",
      games: "الألعاب",
      film: "السينما",
      tv: "المسلسلات",
      anime: "الأنمي",
      music: "الموسيقى",
      entertainment: "الترفيه",
      politics: "السياسة",
      tech: "التقنية",
      science: "العلوم",
      space: "الفضاء",
      astronomy: "الفلك",
      nature: "الطبيعة",
      history: "التاريخ",
      curiosities: "طرائف التقويم",
    },

    blurbs: {
      holidays: "العطلات الرسمية والطقوس التي نحافظ عليها.",
      national: "أعياد الاستقلال والجمهورية والاحتفالات الوطنية.",
      religion: "أعياد وصيام وأيام مقدسة في مختلف الأديان.",
      awareness: "المناسبات الأممية والأيام الدولية.",
      fun: "يوم البيتزا ويوم الكلام كالقراصنة وغيرها من الذرائع.",
      culture: "مهرجانات وأعياد وتقويم المدينة الرسمي.",
      festivals: "كرنفالات ومعارض وتجمعات.",
      sports: "النهائيات وحفلات الافتتاح وكأس العالم القادمة.",
      esports: "Worlds وبطولات Majors وThe International.",
      games: "مواعيد الإصدار وعروض الألعاب.",
      film: "العروض الأولى وليالي الجوائز.",
      tv: "بدايات المواسم ونهاياتها.",
      anime: "انطلاق المواسم وإصدارات الأفلام.",
      music: "مسابقات وجولات وذكريات.",
      entertainment: "مواعيد المعجبين وأعياد الثقافة الشعبية.",
      politics: "الانتخابات والمواعيد التي توجّه الدول.",
      tech: "المؤتمرات ومواعيد انتهاء الدعم والساعات التي تحفظها الحواسيب.",
      science: "مواعيد لمن يهوى المعرفة.",
      space: "إطلاقات وعمليات هبوط والطريق الطويل إلى القمر.",
      astronomy: "كسوف وزخات شهب وانقلابات — مواعيد مع السماء.",
      nature: "الأرض والمحيطات والسنة الحية.",
      history: "ذكريات أحداث وقعت بالفعل — وعدّادها ما زال يعمل.",
      curiosities: "محطات Unix والتواريخ المتناظرة والجُمَع الموافقة للـ13.",
    },

    groups: {
      celebrate: { label: "احتفل", tagline: "أعياد ومناسبات وذرائع نحافظ عليها." },
      watch: { label: "شاهد", tagline: "نهائيات وعروض أولى وجولات وأقرب إصدار كبير." },
      play: { label: "العب", tagline: "مواعيد الإصدار وعروض الألعاب." },
      "look-up": { label: "ارفع نظرك", tagline: "إطلاقات وكسوف والسنة الحية." },
      vote: { label: "صوّت", tagline: "انتخابات ومؤتمرات وساعات الحواسيب." },
      wonder: { label: "تأمل", tagline: "ذكريات وطرائف التقويم." },
    },
  },

  seo: {
    homeTitle: "Until — عد تنازلي لكل ما هو قادم",
    siteDescription:
      "آلاف المواعيد القادمة، مصنفة وعدّادها يعمل. أعياد وكسوف وكؤوس عالم وانتخابات — إضافة إلى ما تنشئه بنفسك.",
    titleTemplate: "%s · Until",

    event: {
      whenIs: "متى {title}؟ {when}",
      whenIsCoarse: "متى {title}؟ المتوقع {period}",
      countdownColon: "العد التنازلي حتى {title}: {when}",
      countdownDash: "{title} — العد التنازلي حتى {when}",
      countdownDashCoarse: "{title} — {when}",
      description: "{title}{status} يوافق {date}. {days} عد تنازلي مباشر وإضافة إلى التقويم.",
      descriptionCoarse:
        "{title} متوقع {period}، واليوم المحدد لم يُعلن بعد. العد يبدأ فور إعلانه، مع إضافة إلى التقويم.",
      statusCancelled: " (ملغى)",
      statusPostponed: " (مؤجل)",
      fallbackTitle: "عد تنازلي",
      mineTitle: "عدك التنازلي",
      sharedTitle: "عد تنازلي مُشارك",
      sharedMetaTitle: "{title} — العد التنازلي حتى {date}",
      sharedMetaDescription: "{title} يوافق {date}. عد تنازلي أنشأه أحدهم على Until.",
    },

    series: {
      title: "كم باقي على {title}؟ — {when}",
      titleNoDate: "كم باقي على {title}؟",
      heading: "كم باقي على {title}؟",
      description: "{title} يوافق {date}. {days} عد تنازلي مباشر، وتواريخ كل عام، وإضافة إلى التقويم.",
      descriptionCoarse:
        "{title}: الموعد القادم متوقع {period}. تواريخ كل عام، وعد تنازلي مباشر، وإضافة إلى التقويم.",
      descriptionNoDate: "{title}: المواعيد القادمة، وعد تنازلي مباشر إلى أقربها، وروابط التقويم.",
      fallbackTitle: "كم باقي",
    },

    hub: {
      category: "مواعيد {category} القادمة — عد تنازلي وتواريخ",
      country: "{country}: العطلات والفعاليات القادمة",
      month: "{month} — أبرز ما هو قادم",
      tag: "{tag} — مواعيد قادمة وعد تنازلي",
      // Arabic has no letter case, so this flag changes nothing; kept false so a Latin word inside
      // a label would not be lower-cased for no reason.
      lowercaseCategory: false,
    },

    days: {
      today: "الموعد اليوم.",
      tomorrow: "الموعد غدًا.",
      yesterday: "كان الموعد أمس.",
      away: {
        zero: "باقي أقل من يوم.",
        one: "باقي يوم واحد.",
        two: "باقي يومان.",
        few: "باقي {n} أيام.",
        many: "باقي {n} يومًا.",
        other: "باقي {n} يوم.",
      } as PluralForms,
      ago: {
        zero: "مضى أقل من يوم.",
        one: "مضى يوم واحد.",
        two: "مضى يومان.",
        few: "مضت {n} أيام.",
        many: "مضى {n} يومًا.",
        other: "مضى {n} يوم.",
      } as PluralForms,
    },

    period: {
      month: "{month} {year}",
      quarter: "الربع {q} من {year}",
      year: "{year}",
      expected: "متوقع {period}",
      unknown: "موعد سيُعلن لاحقًا",
    },

    jsonLd: {
      siteDescription: "عد تنازلي مباشر وتواريخ لآلاف الفعاليات والأعياد والمحطات القادمة.",
      seriesDescription: "مواعيد {title} القادمة.",
    },
  },

  home: {
    loading: "جارٍ تحميل الفهرس",

    hero: {
      eyebrow: "عد تنازلي مختار",
      meta: "{category} · {when}",
      open: "افتح هذا العد التنازلي",
    },

    hub: {
      alsoOnTheHorizon: "في الأفق أيضًا",
      next7Days: "الأيام السبعة القادمة",
      wholeMonth: "الشهر كاملًا ←",
      browseByCategory: "تصفح حسب التصنيف",
      allCategories: "كل التصنيفات ←",
      popularCountdowns: "الأكثر متابعة",
      everyRecurringDate: "كل المواعيد المتكررة ←",
      byCountry: "حسب الدولة",
      allCountries: "كل الدول ←",
      noCountries: "بيانات الدول قيد الإضافة.",
      byMonth: "حسب الشهر",
      thisMonth: "هذا الشهر — {month}",
      nextMonth: "الشهر القادم — {month}",
    },

    explorer: {
      heading: "الفهرس",
      count: {
        zero: "لا مواعيد قادمة.",
        one: "موعد قادم واحد.",
        two: "موعدان قادمان.",
        few: "{n} مواعيد قادمة.",
        many: "{n} موعدًا قادمًا.",
        other: "{n} موعد قادم.",
      } as PluralForms,
      countMatching: {
        zero: "لا مواعيد قادمة تطابق “{q}”.",
        one: "موعد قادم واحد يطابق “{q}”.",
        two: "موعدان قادمان يطابقان “{q}”.",
        few: "{n} مواعيد قادمة تطابق “{q}”.",
        many: "{n} موعدًا قادمًا يطابق “{q}”.",
        other: "{n} موعد قادم يطابق “{q}”.",
      } as PluralForms,
      countInCategory: {
        zero: "لا مواعيد قادمة في {category}.",
        one: "موعد قادم واحد في {category}.",
        two: "موعدان قادمان في {category}.",
        few: "{n} مواعيد قادمة في {category}.",
        many: "{n} موعدًا قادمًا في {category}.",
        other: "{n} موعد قادم في {category}.",
      } as PluralForms,
      countMatchingInCategory: {
        zero: "لا مواعيد قادمة في {category} تطابق “{q}”.",
        one: "موعد قادم واحد في {category} يطابق “{q}”.",
        two: "موعدان قادمان في {category} يطابقان “{q}”.",
        few: "{n} مواعيد قادمة في {category} تطابق “{q}”.",
        many: "{n} موعدًا قادمًا في {category} يطابق “{q}”.",
        other: "{n} موعد قادم في {category} يطابق “{q}”.",
      } as PluralForms,
      sort: {
        soonest: "الأقرب",
        popular: "الأكثر متابعة",
        latest: "الأبعد",
      },
    },

    filters: {
      all: "الكل",
    },

    empty: {
      noMatch: "لا شيء في الفهرس يطابق “{q}”.",
      nothing: "لا شيء هنا بعد.",
      hint: "الإملاء متسامح والأحرف الأولى تكفي عادةً، فأي تقارب يصيب — لكن هذا يبدو موعدًا لا يحمله الفهرس.",
      busiest: "أكثر التصنيفات ازدحامًا",
      everyRecurringDate: "كل المواعيد المتكررة",
      startOver: "ابدأ من جديد",
    },

    table: {
      date: "التاريخ",
      event: "الحدث",
      within: "خلال",
      category: "التصنيف",
      empty: "لا شيء مُقرر هنا بعد.",
    },

    pagination: "ترقيم الصفحات",
  },

  event: {
    answer: {
      today: "{title} اليوم، {date}.",
      tomorrow: "باقي على {title} {n} يوم — غدًا، {date}.",
      days: {
        zero: "{title} اليوم، {date}.",
        one: "باقي على {title} يوم واحد، في {date}.",
        two: "باقي على {title} يومان، في {date}.",
        few: "باقي على {title} {n} أيام، في {date}.",
        many: "باقي على {title} {n} يومًا، في {date}.",
        other: "باقي على {title} {n} يوم، في {date}.",
      } as PluralForms,
      past: {
        zero: "كان {title} اليوم، {date}.",
        one: "كان {title} قبل يوم واحد، في {date}.",
        two: "كان {title} قبل يومين، في {date}.",
        few: "كان {title} قبل {n} أيام، في {date}.",
        many: "كان {title} قبل {n} يومًا، في {date}.",
        other: "كان {title} قبل {n} يوم، في {date}.",
      } as PluralForms,
      cancelled: "كان {title} مُقررًا في {date} ثم أُلغي.",
      coarse: "{title} متوقع {period}. اليوم المحدد لم يُعلن بعد.",
      plain: "{title} يوافق {date}.",
    },

    statusHappened: "حدث بالفعل",

    dateRange: "{start} – {end}",

    coarseNote: "اليوم المحدد لم يُعلن بعد. سيبدأ العد في هذه الصفحة فور نشر المصدر موعدًا.",
    dateChanged: "تغيّر الموعد: كان سابقًا {date}.",
    partOfSeries: "جزء من سلسلة {series} — تتكرر كل عام، والموعد القادم دائمًا في الأعلى.",
    everyUpcomingDate: "كل المواعيد القادمة",
    otherYears: "أعوام أخرى",
    alsoComing: "قادم أيضًا",

    fields: {
      where: "المكان",
      tags: "الوسوم",
    },

    provenance: {
      source: "المصدر:",
      lastVerified: "آخر تحقق {date}",
      summary: "ملخص من {source} ({license})",
    },

    image: {
      photo: "صورة",
      photoBy: "الصورة:",
      via: "عبر {provider}",
    },

    mine: {
      missingTitle: "هذا العد التنازلي محفوظ على جهاز آخر",
      missingBody:
        "تُحفظ العدادات الشخصية في المتصفح الذي أنشأها. إذا شارك أحدهم رابطًا معك، فاطلب منه الرابط القابل للمشاركة من صفحة الإنشاء.",
      makeNew: "أنشئ واحدًا جديدًا",
      onThisDevice: "على هذا الجهاز",
      remove: "إزالة",
      savedCount: {
        zero: "لا مواعيد محفوظة في هذا المتصفح.",
        one: "موعد واحد من الفهرس محفوظ في هذا المتصفح.",
        two: "موعدان من الفهرس محفوظان في هذا المتصفح.",
        few: "{n} مواعيد من الفهرس محفوظة في هذا المتصفح.",
        many: "{n} موعدًا من الفهرس محفوظًا في هذا المتصفح.",
        other: "{n} موعد من الفهرس محفوظ في هذا المتصفح.",
      } as PluralForms,
    },
  },

  series: {
    index: {
      title: "كم باقي — كل العدادات المتكررة",
      description:
        "رمضان وعيد الفطر وعيد الميلاد وزخة شهب البرشاويات: كل موعد متكرر في الفهرس، مع أقرب موعد في الأعلى وجدول بالأعوام القادمة.",
      heading: "كم باقي على…",
      intro: {
        zero: "لا مواعيد متكررة في الفهرس بعد.",
        one: "موعد واحد يتكرر كل عام. تحتفظ صفحته بأقرب موعد في الأعلى وتسرد الأعوام القادمة.",
        two: "موعدان يتكرران كل عام. تحتفظ كل صفحة بأقرب موعد في الأعلى وتسرد الأعوام القادمة.",
        few: "{n} مواعيد تتكرر كل عام. تحتفظ كل صفحة بأقرب موعد في الأعلى وتسرد الأعوام القادمة.",
        many: "{n} موعدًا تتكرر كل عام. تحتفظ كل صفحة بأقرب موعد في الأعلى وتسرد الأعوام القادمة.",
        other: "{n} موعد تتكرر كل عام. تحتفظ كل صفحة بأقرب موعد في الأعلى وتسرد الأعوام القادمة.",
      } as PluralForms,
      empty: "الفهرس قيد الإضافة — عد قريبًا.",
      jsonLdDescription: "مواعيد متكررة، مع أقرب موعد وجدول يمتد لعدة أعوام.",
    },

    noUpcoming: "{title}: لا يوجد موعد قادم في الفهرس بعد.",

    thisYearsPage: "صفحة هذا العام",

    shareTitle: "كم باقي على {title}",

    upcoming: {
      heading: "المواعيد القادمة",
      note: "كل مواعيد {title} في الفهرس من اليوم فصاعدًا، الأقرب أولًا.",
      empty: "لا مواعيد مستقبلية بعد — عد بعد التحديث القادم.",
    },

    variants: {
      heading: "مواعيد أخرى مرتبطة بهذه السلسلة",
      note: "يُحتفل بها بالاسم نفسه في يوم مختلف في بعض الدول — وأُدرجت على حدة كي يبقى العد أعلاه على الموعد الرئيسي.",
    },

    faqHeading: "أسئلة يطرحها الناس",

    tagsLabel: "الوسوم:",

    related: {
      heading: "مواعيد {category} أخرى تتكرر كل عام",
      all: "كل العدادات المتكررة",
    },
  },

  hubs: {
    label: {
      browse: "تصفح",
      category: "تصنيف",
      country: "دولة",
      calendar: "تقويم",
      tag: "وسم",
    },

    breadcrumbLabel: "مسار التصفح",

    paged: {
      title: "{name} (صفحة {n})",
      headingSuffix: "— صفحة {n}",
      backToFirst: "العودة إلى الصفحة الأولى.",
    },

    categoryIndex: {
      title: "التصنيفات — كل أنواع المواعيد التي لم تحدث بعد",
      description:
        "تصفح المواعيد القادمة حسب التصنيف: أعياد ورياضة وسينما ومسلسلات وألعاب وفضاء وانتخابات وذكريات، لكل منها عد تنازلي مباشر.",
      heading: "كل أنواع المواعيد",
      intro: "ثلاثة وعشرون تصنيفًا، مرتبة حسب ما ستفعله بها.",
      collectionDescription: "المواعيد القادمة حسب التصنيف.",
    },

    category: {
      description: {
        zero: "{blurb} مواعيد قادمة مع عد تنازلي مباشر وروابط تقويم.",
        one: "{blurb} موعد قادم واحد مع عد تنازلي مباشر وروابط تقويم.",
        two: "{blurb} موعدان قادمان مع عد تنازلي مباشر وروابط تقويم.",
        few: "{blurb} {n} مواعيد قادمة مع عد تنازلي مباشر وروابط تقويم.",
        many: "{blurb} {n} موعدًا قادمًا مع عد تنازلي مباشر وروابط تقويم.",
        other: "{blurb} {n} موعد قادم مع عد تنازلي مباشر وروابط تقويم.",
      } as PluralForms,
      descriptionEmpty: "{blurb} مواعيد قادمة مع عد تنازلي مباشر وروابط تقويم.",
      descriptionPaged:
        "{blurb} الصفحة {n} من المواعيد القادمة، الأقرب أولًا، مع عد تنازلي مباشر وروابط تقويم.",
      heading: "مواعيد {category} القادمة",
      count: {
        zero: "لا مواعيد قادمة.",
        one: "موعد قادم واحد.",
        two: "موعدان قادمان.",
        few: "{n} مواعيد قادمة.",
        many: "{n} موعدًا قادمًا.",
        other: "{n} موعد قادم.",
      } as PluralForms,
      countPaged: {
        zero: "لا مواعيد قادمة.",
        one: "موعد قادم واحد، الأقرب أولًا.",
        two: "موعدان قادمان، الأقرب أولًا.",
        few: "{n} مواعيد قادمة، الأقرب أولًا.",
        many: "{n} موعدًا قادمًا، الأقرب أولًا.",
        other: "{n} موعد قادم، الأقرب أولًا.",
      } as PluralForms,
      soon: "الثلاثون يومًا القادمة",
      everyYear: "كل عام",
      all: "كل مواعيد {category} القادمة",
      empty: "لا شيء في هذا التصنيف بعد.",
    },

    countryIndex: {
      title: "الدول — العطلات والفعاليات القادمة حسب الدولة",
      description:
        "العطلات الرسمية والأعياد الوطنية والفعاليات المحلية في أكثر من 200 دولة وإقليم، لكل منها عد تنازلي مباشر وروابط تقويم.",
      heading: "حسب الدولة",
      intro: {
        zero: "لا دول في الفهرس بعد.",
        one: "دولة واحدة لها عطلات وفعاليات قادمة في الفهرس.",
        two: "دولتان لهما عطلات وفعاليات قادمة في الفهرس.",
        few: "{n} دول وأقاليم لها عطلات وفعاليات قادمة في الفهرس.",
        many: "{n} دولة وإقليمًا لها عطلات وفعاليات قادمة في الفهرس.",
        other: "{n} دولة وإقليم لها عطلات وفعاليات قادمة في الفهرس.",
      } as PluralForms,
      empty: "الفهرس قيد الإضافة — عد قريبًا.",
      collectionDescription: "العطلات والفعاليات القادمة حسب الدولة.",
    },

    country: {
      description: {
        zero: "عطلات وأعياد وفعاليات {country}، مرتبة حسب الشهر، مع عد تنازلي مباشر وروابط تقويم.",
        one: "عطلات وأعياد وفعاليات {country} — موعد قادم واحد، مع عد تنازلي مباشر وروابط تقويم.",
        two: "عطلات وأعياد وفعاليات {country} — موعدان قادمان، مع عد تنازلي مباشر وروابط تقويم.",
        few: "عطلات وأعياد وفعاليات {country} — {n} مواعيد قادمة مرتبة حسب الشهر، مع عد تنازلي مباشر وروابط تقويم.",
        many: "عطلات وأعياد وفعاليات {country} — {n} موعدًا قادمًا مرتبة حسب الشهر، مع عد تنازلي مباشر وروابط تقويم.",
        other:
          "عطلات وأعياد وفعاليات {country} — {n} موعد قادم مرتبة حسب الشهر، مع عد تنازلي مباشر وروابط تقويم.",
      } as PluralForms,
      descriptionEmpty:
        "عطلات وأعياد وفعاليات {country}، مرتبة حسب الشهر، مع عد تنازلي مباشر وروابط تقويم.",
      intro:
        "العطلات والفعاليات القادمة في {country}، شهرًا بشهر. أما المواعيد العالمية — الكسوف والإصدارات والأيام الدولية — فمُدرجة على حدة أدناه.",
      count: {
        zero: "لا مواعيد قادمة.",
        one: "موعد قادم واحد.",
        two: "موعدان قادمان.",
        few: "{n} مواعيد قادمة.",
        many: "{n} موعدًا قادمًا.",
        other: "{n} موعد قادم.",
      } as PluralForms,
      countCapped: {
        zero: "لا مواعيد قادمة.",
        one: "أكثر من موعد قادم واحد.",
        two: "أكثر من موعدين قادمين.",
        few: "أكثر من {n} مواعيد قادمة.",
        many: "أكثر من {n} موعدًا قادمًا.",
        other: "أكثر من {n} موعد قادم.",
      } as PluralForms,
      empty: "لا مواعيد في {country} بعد.",
      worldwide: "قادم حول العالم",
      collectionDescription: "العطلات والفعاليات في {country}.",
    },

    calendar: {
      description:
        "كل ما في الفهرس خلال {month}: أعياد وإطلاقات ونهائيات وعروض أولى وذكريات، يومًا بيوم، مع عد تنازلي مباشر.",
      count: {
        zero: "لا مواعيد قادمة في {month}.",
        one: "موعد قادم واحد في {month}.",
        two: "موعدان قادمان في {month}، يومًا بيوم.",
        few: "{n} مواعيد قادمة في {month}، يومًا بيوم.",
        many: "{n} موعدًا قادمًا في {month}، يومًا بيوم.",
        other: "{n} موعد قادم في {month}، يومًا بيوم.",
      } as PluralForms,
      empty: "لا مواعيد قادمة في {month} بعد.",
      months: "الأشهر",
      previous: "→ {month}",
      next: "{month} ←",
      collectionDescription: "المواعيد القادمة في {month}.",
    },

    tag: {
      description: {
        zero: "لا مواعيد قادمة موسومة “{tag}” بعد.",
        one: "موعد قادم واحد موسوم “{tag}”، مع عد تنازلي مباشر وروابط تقويم.",
        two: "موعدان قادمان موسومان “{tag}”، مع عد تنازلي مباشر وروابط تقويم.",
        few: "{n} مواعيد قادمة موسومة “{tag}”، الأقرب أولًا، مع عد تنازلي مباشر وروابط تقويم.",
        many: "{n} موعدًا قادمًا موسومًا “{tag}”، الأقرب أولًا، مع عد تنازلي مباشر وروابط تقويم.",
        other: "{n} موعد قادم موسوم “{tag}”، الأقرب أولًا، مع عد تنازلي مباشر وروابط تقويم.",
      } as PluralForms,
      descriptionPaged:
        "الصفحة {n} من المواعيد القادمة الموسومة “{tag}”، الأقرب أولًا، مع عد تنازلي مباشر وروابط تقويم.",
      crumb: "#{tag}",
      count: {
        zero: "لا مواعيد قادمة موسومة “{tag}”.",
        one: "موعد قادم واحد موسوم “{tag}”.",
        two: "موعدان قادمان موسومان “{tag}”.",
        few: "{n} مواعيد قادمة موسومة “{tag}”، الأقرب أولًا.",
        many: "{n} موعدًا قادمًا موسومًا “{tag}”، الأقرب أولًا.",
        other: "{n} موعد قادم موسوم “{tag}”، الأقرب أولًا.",
      } as PluralForms,
      searchPrompt: "تبحث عن شيء آخر؟",
      searchLink: "ابحث في الفهرس كله عن “{tag}”.",
      collectionDescription: "المواعيد القادمة الموسومة {tag}.",
    },
  },

  pages: {
    about: {
      title: "عن الموقع",
      description: "كيف يجمع Until آلاف المواعيد القادمة ويوسمها ويصنفها.",
      eyebrow: "المشروع",
      heading: "جريدة المستقبل",

      intro:
        "Until فهرس لمواعيد لم تحدث بعد. عطلات رسمية من معظم دول العالم، وفعاليات مُقررة مستخرجة من صفحات السنوات في Wikipedia ومن Wikidata، إضافة إلى طبقة منتقاة لما ينتظره الناس فعلًا — الكسوف وكؤوس العالم والأولمبياد والانتخابات ومذنب هالي.",
      categories:
        "كل سجل موسوم ومصنف ضمن {n} تصنيفًا — عطلات وأعياد وطنية ورياضة وفلك وفضاء وتقنية وسياسة وتاريخ وغيرها. ابحث في المجموعة كلها، أو صفِّ تصنيفًا، أو افتح عدًا تنازليًا مباشرًا وأضفه إلى تقويمك.",
      sources:
        "العمود الفقري للعطلات هو مجموعة البيانات المحلية {dateHolidays}، موسَّعة بمصدرَي {wikidata} و{wikipedia}. وتُدمج الأسماء المتكررة في اليوم نفسه (عيد الميلاد في 140 دولة) في عد تنازلي واحد. وعند اختلاف المصادر تُقدَّم السجلات المنتقاة. وتذكر كل صفحة حدث مصدرها وتاريخ آخر تحقق من الموعد.",
      expected:
        "المواعيد التي لا يوجد لها يوم مؤكد تُوسم بكلمة “متوقع” مع الشهر أو الربع أو العام الذي يذكره المصدر، ولا يبدأ عدّها حتى يُنشر موعد حقيقي. ويُحدَّث الفهرس يوميًا من مصادره.",
      yourOwn:
        "ويمكنك إنشاء عدّك الخاص. يبقى في المتصفح — بلا حساب — ويحمل رابط المشاركة العنوان والتاريخ داخل الرابط، فيفتح أي شخص الساعة نفسها وهي تعد.",

      stats: {
        dates: "المواعيد",
        featured: "المميزة",
        updated: "آخر تحديث",
      },

      byCategory: {
        heading: "حسب التصنيف",
        empty: "الفهرس قيد الإضافة — عد قريبًا.",
      },

      bySource: {
        heading: "حسب المصدر",
        empty: "لم تُسجَّل مصادر بعد.",
      },
    },

    attributions: {
      title: "المصادر — من أين تأتي المواعيد",
      description:
        "كل مصدر خلف فهرس Until، مع رخصته والإسناد الذي يطلبه: date-holidays، Wikipedia، Wikidata، Hebcal، Launch Library وغيرها.",
      eyebrow: "المصادر",
      heading: "المصادر والإسناد",
      intro:
        "لا يستورد Until إلا المصادر التي تسمح شروطها بتخزين البيانات وإعادة نشرها. والمصادر التي تشترط النشر بالمثل (نصوص Wikipedia، TVMaze، بيانات date-holidays) يُنسب إليها الفضل في كل صفحة تستخدمها؛ أما الصور فلا يُعاد استضافتها إلا برخص CC0 أو الملكية العامة أو CC BY أو CC BY-SA مع ذكر صاحبها. وكل صفحة حدث تعيد الرابط إلى السجل الذي بُنيت منه.",
      sourcesEmpty: "قائمة المصادر غير متاحة حاليًا.",

      images: {
        heading: "الصور",
        policy:
          "الصور نسخ معاد استضافتها، يُعاد تحجيمها وتُقدَّم من تخزيننا الخاص كي لا تُحمَّل من مواقعها الأصلية مباشرة. ولا تُقبل إلا الملفات ذات الرخص الحرة — CC0 والملكية العامة وCC BY وCC BY-SA وبعض رخص الحكومات المفتوحة، إضافة إلى صور NASA وفق إرشادها الإعلامي. أما ملفات الاستخدام العادل ورخص غير التجاري (NC) ومنع الاشتقاق (ND) فمرفوضة تمامًا، وكذلك الملفات التي تحمل قيد علامة تجارية أو حق شخصية. وكل ملف مخزَّن يحتفظ باسم صاحبه ورخصته ورابط صفحته. والفعاليات التي لا صورة حرة لها تحصل على بطاقة مولَّدة بدلًا من ذلك.",
        shareAlike:
          "الصور التي تشترط النشر بالمثل (CC BY-SA) تُنشر دون تعديل، بأبعادها الأصلية، مع الإسناد تحتها. ولا تُقتطع أبدًا داخل بطاقة للتواصل الاجتماعي: فذلك التركيب عمل مشتق يلزمه حمل الرخصة نفسها، ولذلك تستخدم تلك البطاقات التصميم المولَّد. ويُعاد التحقق من الملفات المخزنة مقابل مصدرها شهريًا؛ وما حُذف منها أو لم يعد حرًا يُزال من تخزيننا وتعود صفحاته إلى البطاقة المولَّدة.",
        empty: "لا صور معاد استضافتها بعد.",
        count: {
          zero: "لا صور في المكتبة اليوم:",
          one: "في المكتبة اليوم صورة واحدة:",
          two: "في المكتبة اليوم صورتان:",
          few: "في المكتبة اليوم {n} صور:",
          many: "في المكتبة اليوم {n} صورة:",
          other: "في المكتبة اليوم {n} صورة:",
        } as PluralForms,
      },

      fonts:
        "الخطوط: Fraunces (SIL Open Font License) وGeist (SIL Open Font License). وحسابات الفلك بواسطة astronomy-engine (MIT).",
    },

    create: {
      title: "أنشئ عدًا تنازليًا",
      description: "أنشئ عدًا تنازليًا شخصيًا وأضفه إلى تقويمك.",
      eyebrow: "مواعيدك",
      heading: "أنشئ عدًا تنازليًا",
      intro:
        "أعياد ميلاد، إطلاقات، رحلة، جلسة محكمة، لقاء. يعمل تمامًا كعدادات الفهرس — ويمكنك نقله مباشرة إلى Google Calendar أو Outlook أو ملف ‎.ics.",

      form: {
        draftTitle: "شيء أنتظره",
        draftNote: "عد تنازلي أنشأته بنفسك.",
        titleLabel: "العنوان",
        dateLabel: "التاريخ",
        categoryLabel: "التصنيف",
        noteLabel: "ملاحظة",
        notePlaceholder: "لماذا يهمك هذا الموعد؟",
        save: "احفظ على هذا الجهاز",
        openShareable: "افتح الصفحة القابلة للمشاركة",
        saved: "تم الحفظ. {link} — يبقى في هذا المتصفح حتى تمسح بيانات التخزين.",
        savedLink: "اعرضه",
        privacy:
          "تبقى العدادات المخصصة على جهازك (بلا حساب). ويُضمِّن رابط المشاركة العنوان والتاريخ داخل الرابط.",
        previewLabel: "معاينة مباشرة",
        chooseDate: "اختر تاريخًا ليبدأ العد.",
      },
    },

    notFound: {
      heading: "هذا الموعد ليس في الفهرس",
      body: "ربما دُمج أو أُعيدت تسميته أو لم يوجد أصلًا.",
      backHome: "العودة إلى كل ما هو قادم",
    },
  },

  embed: {
    countdown: {
      units: {
        days: {
          zero: "يوم",
          one: "يوم",
          two: "يومان",
          few: "أيام",
          many: "يومًا",
          other: "يوم",
        } as PluralForms,
        hours: "ساعة",
        minutes: "دقيقة",
        seconds: "ثانية",
      },
      today: "اليوم.",
      past: "لقد حدث هذا بالفعل.",
    },

    studio: {
      heading: "خذه معك",

      controls: {
        preset: "نمط جاهز",
        digits: "الأرقام",
        type: "النوع",
        background: "الخلفية",
        transparent: "شفاف — يُظهر المشهد أو الصفحة خلفه",
        font: "الخط",
        size: "الحجم",
        layout: "التخطيط",
        units: "الوحدات",
        separator: "الفاصل",
        frame: "الإطار",
        radius: "استدارة الزوايا",
        inset: "الهامش الداخلي",
        position: "الموضع",
        done: "رسالة الانتهاء",
        reset: "إعادة الضبط",
        colourPicker: "{label} — منتقي الألوان",
      },

      toggles: {
        unitLabels: "أسماء الوحدات",
        title: "العنوان",
        date: "التاريخ",
        note: "الملاحظة",
        wordmark: "شعار Until",
        glow: "التوهج",
        trim: "إخفاء الأصفار البادئة",
      },

      presets: {
        dark: "Until داكن",
        light: "فاتح",
        amber: "كهرماني",
        mono: "أحادي",
        neon: "نيون",
        clear: "شفاف",
      },

      fonts: {
        serif: "مذيّل",
        sans: "غير مذيّل",
        mono: "ثابت العرض",
      },

      layouts: {
        row: "صف",
        stack: "عمودي",
        compact: "مضغوط",
        big: "رقم واحد كبير",
      },

      separators: {
        colon: "نقطتان",
        dot: "نقطة",
        space: "مسافة",
        none: "بلا",
      },

      frames: {
        card: "بطاقة",
        outline: "إطار",
        none: "بلا",
      },

      units: {
        dhms: "أيام · ساعات · دقائق · ثوانٍ",
        dhm: "أيام · ساعات · دقائق",
        dh: "أيام · ساعات",
        d: "أيام",
        hms: "ساعات · دقائق · ثوانٍ",
        hm: "ساعات · دقائق",
        ms: "دقائق · ثوانٍ",
      },

      positions: {
        "top-left": "أعلى اليسار",
        top: "أعلى",
        "top-right": "أعلى اليمين",
        left: "يسار",
        center: "وسط",
        right: "يمين",
        "bottom-left": "أسفل اليسار",
        bottom: "أسفل",
        "bottom-right": "أسفل اليمين",
      },

      copy: {
        code: "انسخ الكود",
        url: "انسخ الرابط",
      },

      embed: {
        previewTitle: "معاينة التضمين",
        paste: "الصق هذا في صفحتك",
        codeLabel: "كود التضمين",
        note: "يُدرَج بعرض كامل وبارتفاع {height} بكسل. وتقبل WordPress وGhost وNotion رابط العد التنازلي نفسه وتجد التضمين تلقائيًا — لكن ذلك يفتح البطاقة القياسية، فالصق الكود أعلاه للحفاظ على ما صممته هنا.",
      },

      stream: {
        previewTitle: "معاينة طبقة البث",
        canvasNote: "لوحة {width} × {height} مصغَّرة — والمربعات الشطرنجية هي ما يزيله OBS.",
        urlLabel: "رابط مصدر المتصفح",
        source: "مصدر متصفح · {width} × {height}",
        steps: [
          "في OBS أو Streamlabs، أضف مصدر متصفح (Browser source).",
          "الصق الرابط أعلاه.",
          "اضبط المقاس على {width} × {height} — وهي اللوحة التي يُقاس عليها الموضع.",
          "اترك الخلفية شفافة؛ فالطبقة تأتي بخلفيتها.",
          "فعّل خيار “تحديث المتصفح عند تنشيط المشهد” كي يبدأ العد من جديد.",
        ],
      },
    },
  },
};
