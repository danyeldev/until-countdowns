/**
 * Polish messages. See `en/` for what each key is for.
 *
 * Five decisions a maintainer should not undo:
 * - The ranking phrase is "Ile dni do: {title}?" — heading, title, nav and share sheet all carry
 *   it. The colon is deliberate: `{title}` always arrives in the nominative ("Boże Narodzenie",
 *   "Wielkanoc") and Polish "do" governs the genitive, so a bare "Ile dni do {title}?" would print
 *   "Ile dni do Boże Narodzenie?". The colon licenses the uninflected name and keeps the query
 *   prefix "ile dni do" intact, which is the whole point of the page.
 * - No preposition ever stands in front of a placeholder. `{date}`, `{month}`, `{country}` and
 *   `{period}` come out of `Intl` in the nominative ("piątek, 25 grudnia 2026", "grudzień 2026",
 *   "Polska"), and "w"/"do" would need the locative, accusative or genitive. Hence "{title} —
 *   {date}.", "{month}: …", "w kategorii {category}", "oznaczone tagiem {country}" — a colon, a
 *   dash or a generic noun in front of the value, never a bare preposition.
 * - No adjective agrees with a placeholder either: "Nadchodzące {category}" would be right for
 *   "Święta" and wrong for "Sport" and "Muzyka", so every such template is turned around
 *   ("{category} — nadchodzące daty").
 * - `lowercaseCategory` is false. The label opens the hub title and heading, and mid-sentence it
 *   always sits after "w kategorii", where a capitalised label reads as the name of a section.
 * - Every plural carries one/few/many/other: Polish selects `few` for 2–4 (and 22–24, …), `many`
 *   for 5+ and 0, and `other` only for fractions ("1,5 dnia") — which still has to be grammatical.
 */
import type { Messages } from "./en";
import type { PluralForms } from "./types";

export const pl: Messages = {
  common: {
    siteName: "Until",
    tagline: "katalog rzeczy, które jeszcze się nie wydarzyły.",
    wordmarkLine: "Until — katalog rzeczy, które jeszcze się nie wydarzyły.",

    nav: {
      categories: "Kategorie",
      countries: "Kraje",
      daysUntil: "Ile dni do…",
      create: "Utwórz",
      about: "O serwisie",
    },

    search: {
      label: "Szukaj",
      navLabel: "Szukaj odliczań",
      placeholder: "Szukaj w katalogu…",
      navPlaceholder: "Zaćmienia, mistrzostwa świata, święta…",
      submit: "Szukaj",
    },

    breadcrumb: {
      home: "Strona główna",
    },

    footer: {
      datesCount: {
        one: "{n} data",
        few: "{n} daty",
        many: "{n} dat",
        other: "{n} daty",
      } as PluralForms,
      aboutTheData: "o danych",
      attributions: "źródła",
      categories: "Kategorie",
      browse: "Przeglądaj",
      all: "wszystkie →",
      makeYourOwn: "Stwórz własne",
      language: "Język",
    },

    actions: {
      share: "Udostępnij",
      shareCopied: "Skopiowano link",
      save: "Zapisz",
      saved: "Zapisano",
      addToCalendar: "Dodaj do kalendarza",
      google: "Google Calendar",
      outlook: "Outlook",
      downloadIcs: "Pobierz .ics",
      embed: "Osadź na swojej stronie",
      stream: "Dodaj do streama",
      copy: "Kopiuj",
      copied: "Skopiowano",
    },

    labels: {
      worldwide: "Na całym świecie",
      countriesCount: {
        one: "{n} kraj",
        few: "{n} kraje",
        many: "{n} krajów",
        other: "{n} kraju",
      } as PluralForms,
      recurring: "Cykliczne",
      series: "Seria",
      today: "Dzisiaj",
      tba: "Do ustalenia",
      dateToBeAnnounced: "data zostanie ogłoszona",
      nothingHereYet: "Jeszcze nic tu nie ma",
      more: "Więcej",
      seeAll: "Zobacz wszystkie →",
      loading: "Ładowanie…",
      source: "Źródło",
      sources: "Źródła",
      lastVerified: "Ostatnia weryfikacja",
    },

    status: {
      scheduled: "Zaplanowane",
      tentative: "Wstępne",
      postponed: "Przełożone",
      cancelled: "Odwołane",
      done: "Zakończone",
      retired: "Nieaktualne",
    },

    units: {
      days: "dni",
      hours: "godziny",
      minutes: "minuty",
      seconds: "sekundy",
      daysShort: "d",
      hoursShort: "g",
      minutesShort: "m",
      secondsShort: "s",
    },

    pagination: {
      previous: "Poprzednia",
      next: "Następna",
      page: "Strona {n}",
      pageOf: "Strona {n} z {total}",
    },

    languageSwitcher: {
      label: "Język",
      description: "Czytaj Until w innym języku",
    },
  },

  categories: {
    labels: {
      holidays: "Święta",
      national: "Dni narodowe",
      religion: "Religia",
      awareness: "Dni międzynarodowe",
      fun: "Nietypowe święta",
      culture: "Kultura",
      festivals: "Festiwale",
      sports: "Sport",
      esports: "E-sport",
      games: "Gry",
      film: "Film",
      tv: "Telewizja",
      anime: "Anime",
      music: "Muzyka",
      entertainment: "Rozrywka",
      politics: "Polityka",
      tech: "Technologie",
      science: "Nauka",
      space: "Kosmos",
      astronomy: "Astronomia",
      nature: "Przyroda",
      history: "Historia",
      curiosities: "Ciekawostki",
    },

    blurbs: {
      holidays: "Święta państwowe i rytuały, których się trzymamy.",
      national: "Dni niepodległości, święta republiki, obchody narodowe.",
      religion: "Święta, posty i dni święte różnych wyznań.",
      awareness: "Obchody ONZ i dni międzynarodowe.",
      fun: "Dzień Pizzy, Dzień Mówienia jak Pirat i inne preteksty.",
      culture: "Festiwale, święta i kalendarz obywatelski.",
      festivals: "Karnawały, jarmarki i zloty.",
      sports: "Finały, ceremonie otwarcia i najbliższe mistrzostwa świata.",
      esports: "Worlds, Majors i The International.",
      games: "Daty premier i pokazy.",
      film: "Premiery i gale rozdania nagród.",
      tv: "Premiery i finały sezonów.",
      anime: "Starty sezonów i premiery filmów.",
      music: "Konkursy, trasy koncertowe i rocznice.",
      entertainment: "Daty dla fanów i święta popkultury.",
      politics: "Wybory i daty, które wyznaczają kierunek państw.",
      tech: "Konferencje, koniec wsparcia i zegary, które odmierzają komputery.",
      science: "Daty dla ciekawych świata.",
      space: "Starty, lądowania i długa droga powrotna na Księżyc.",
      astronomy: "Zaćmienia, roje meteorów, przesilenia — spotkania z niebem.",
      nature: "Ziemia, oceany i żywy rok.",
      history: "Rocznice tego, co już się wydarzyło — wciąż tykają.",
      curiosities: "Kamienie milowe Uniksa, daty palindromy, piątki trzynastego.",
    },

    groups: {
      celebrate: { label: "Świętuj", tagline: "Święta, dni wolne i preteksty, których się trzymamy." },
      watch: { label: "Oglądaj", tagline: "Finały, premiery, trasy i najbliższe wielkie wydarzenia." },
      play: { label: "Graj", tagline: "Daty premier i pokazy." },
      "look-up": { label: "Spójrz w górę", tagline: "Starty rakiet, zaćmienia i żywy rok." },
      vote: { label: "Głosuj", tagline: "Wybory, konferencje i zegary, które odmierzają komputery." },
      wonder: { label: "Zadziw się", tagline: "Rocznice i kalendarzowe osobliwości." },
    },
  },

  seo: {
    homeTitle: "Until — odliczanie do wszystkiego, co nadchodzi",
    siteDescription:
      "Tysiące przyszłych dat, otagowanych i tykających. Święta, zaćmienia, mistrzostwa świata, wybory — plus te, które stworzysz sam.",
    titleTemplate: "%s · Until",

    event: {
      whenIs: "Kiedy wypada {title}? {when}",
      whenIsCoarse: "Kiedy wypada {title}? Przewidywany termin: {period}",
      countdownColon: "{title} — odliczanie: {when}",
      countdownDash: "{title}: ile dni zostało? {when}",
      countdownDashCoarse: "{title} — {when}",
      description: "{title}{status} — {date}. {days} Odliczanie na żywo, dodaj do kalendarza.",
      descriptionCoarse:
        "{title} — przewidywany termin: {period}. Brak dokładnego dnia; odliczanie ruszy po jego ogłoszeniu.",
      statusCancelled: " (odwołane)",
      statusPostponed: " (przełożone)",
      fallbackTitle: "Odliczanie",
      mineTitle: "Twoje odliczanie",
      sharedTitle: "Udostępnione odliczanie",
      sharedMetaTitle: "{title} — odliczanie: {date}",
      sharedMetaDescription: "{title} — {date}. Odliczanie stworzone w serwisie Until.",
    },

    series: {
      title: "Ile dni do: {title}? — {when}",
      titleNoDate: "Ile dni do: {title}?",
      heading: "Ile dni do: {title}?",
      description: "{title} — {date}. {days} Odliczanie na żywo, daty na kolejne lata, kalendarz.",
      descriptionCoarse:
        "{title} — przewidywany termin: {period}. Daty na kolejne lata, odliczanie na żywo, dodaj do kalendarza.",
      descriptionNoDate: "{title}: nadchodzące terminy, odliczanie do najbliższego i linki do kalendarza.",
      fallbackTitle: "Ile dni do…",
    },

    hub: {
      category: "{category} — nadchodzące daty i odliczanie",
      country: "{country}: nadchodzące święta i wydarzenia",
      month: "{month} — co nas czeka",
      tag: "{tag} — nadchodzące daty i odliczanie",
      lowercaseCategory: false,
    },

    days: {
      today: "To dzisiaj.",
      tomorrow: "To jutro.",
      yesterday: "To było wczoraj.",
      away: {
        one: "Został {n} dzień.",
        few: "Zostały {n} dni.",
        many: "Zostało {n} dni.",
        other: "Zostało {n} dnia.",
      } as PluralForms,
      ago: {
        one: "To było {n} dzień temu.",
        few: "To było {n} dni temu.",
        many: "To było {n} dni temu.",
        other: "To było {n} dnia temu.",
      } as PluralForms,
    },

    period: {
      month: "{month} {year}",
      quarter: "{q}. kwartał {year}",
      year: "{year}",
      expected: "przewidywany termin: {period}",
      unknown: "termin do ustalenia",
    },

    jsonLd: {
      siteDescription:
        "Odliczanie na żywo i daty tysięcy nadchodzących wydarzeń, świąt i kamieni milowych.",
      seriesDescription: "Nadchodzące terminy: {title}.",
    },
  },

  home: {
    loading: "Ładowanie katalogu",

    hero: {
      eyebrow: "Wyróżnione odliczanie",
      meta: "{category} · {when}",
      open: "Otwórz to odliczanie",
    },

    hub: {
      alsoOnTheHorizon: "Także na horyzoncie",
      next7Days: "Najbliższe 7 dni",
      wholeMonth: "Cały miesiąc →",
      browseByCategory: "Przeglądaj według kategorii",
      allCategories: "Wszystkie kategorie →",
      popularCountdowns: "Popularne odliczania",
      everyRecurringDate: "Wszystkie cykliczne daty →",
      byCountry: "Według kraju",
      allCountries: "Wszystkie kraje →",
      noCountries: "Dane o krajach są uzupełniane.",
      byMonth: "Według miesiąca",
      thisMonth: "Ten miesiąc — {month}",
      nextMonth: "Następny miesiąc — {month}",
    },

    explorer: {
      heading: "Katalog",
      count: {
        one: "{n} nadchodząca data.",
        few: "{n} nadchodzące daty.",
        many: "{n} nadchodzących dat.",
        other: "{n} nadchodzącej daty.",
      } as PluralForms,
      countMatching: {
        one: "{n} nadchodząca data pasująca do zapytania „{q}”.",
        few: "{n} nadchodzące daty pasujące do zapytania „{q}”.",
        many: "{n} nadchodzących dat pasujących do zapytania „{q}”.",
        other: "{n} nadchodzącej daty pasującej do zapytania „{q}”.",
      } as PluralForms,
      countInCategory: {
        one: "{n} nadchodząca data w kategorii {category}.",
        few: "{n} nadchodzące daty w kategorii {category}.",
        many: "{n} nadchodzących dat w kategorii {category}.",
        other: "{n} nadchodzącej daty w kategorii {category}.",
      } as PluralForms,
      countMatchingInCategory: {
        one: "{n} nadchodząca data pasująca do „{q}” w kategorii {category}.",
        few: "{n} nadchodzące daty pasujące do „{q}” w kategorii {category}.",
        many: "{n} nadchodzących dat pasujących do „{q}” w kategorii {category}.",
        other: "{n} nadchodzącej daty pasującej do „{q}” w kategorii {category}.",
      } as PluralForms,
      sort: {
        soonest: "Najbliższe",
        popular: "Popularne",
        latest: "Najdalsze",
      },
    },

    filters: {
      all: "Wszystkie",
    },

    empty: {
      noMatch: "Nic w katalogu nie pasuje do „{q}”.",
      nothing: "Jeszcze nic tu nie ma.",
      hint: "Literówki nie przeszkadzają, inicjały też działają — jeśli nic nie wyszło, tej daty raczej nie ma w katalogu.",
      busiest: "Najbogatsze kategorie",
      everyRecurringDate: "Wszystkie cykliczne daty",
      startOver: "Zacznij od nowa",
    },

    table: {
      date: "Data",
      event: "Wydarzenie",
      within: "Za",
      category: "Kategoria",
      empty: "Nic tu jeszcze nie zaplanowano.",
    },

    pagination: "Paginacja",
  },

  event: {
    answer: {
      today: "{title} — to dzisiaj, {date}.",
      tomorrow: "{title} — to jutro, {date}. Został {n} dzień.",
      days: {
        one: "{title} — {date}. Został {n} dzień.",
        few: "{title} — {date}. Zostały {n} dni.",
        many: "{title} — {date}. Zostało {n} dni.",
        other: "{title} — {date}. Zostało {n} dnia.",
      } as PluralForms,
      past: {
        one: "{title} — {date}. Minął {n} dzień.",
        few: "{title} — {date}. Minęły {n} dni.",
        many: "{title} — {date}. Minęło {n} dni.",
        other: "{title} — {date}. Minęło {n} dnia.",
      } as PluralForms,
      cancelled: "{title} — planowany termin: {date}. Wydarzenie zostało odwołane.",
      coarse: "{title} — przewidywany termin: {period}. Dokładna data nie została jeszcze ogłoszona.",
      plain: "{title} — {date}.",
    },

    statusHappened: "Już było",

    dateRange: "{start} – {end}",

    coarseNote:
      "Dokładna data nie została jeszcze ogłoszona. Odliczanie ruszy, gdy źródło ją poda.",
    dateChanged: "Zmiana daty: wcześniej {date}.",
    partOfSeries: "Część serii: {series} — wszystkie lata, z najbliższym terminem na górze.",
    everyUpcomingDate: "Wszystkie nadchodzące daty",
    otherYears: "Inne lata",
    alsoComing: "Także wkrótce",

    fields: {
      where: "Gdzie",
      tags: "Tagi",
    },

    provenance: {
      source: "Źródło:",
      lastVerified: "ostatnia weryfikacja: {date}",
      summary: "Źródło streszczenia: {source} ({license})",
    },

    image: {
      photo: "Zdjęcie",
      photoBy: "Zdjęcie:",
      via: "źródło: {provider}",
    },

    mine: {
      missingTitle: "To odliczanie jest na innym urządzeniu",
      missingBody:
        "Własne odliczania zapisują się w przeglądarce, w której powstały. Jeśli ktoś przysłał Ci link, poproś go o adres do udostępniania ze strony tworzenia odliczania.",
      makeNew: "Utwórz nowe",
      onThisDevice: "Na tym urządzeniu",
      remove: "Usuń",
      savedCount: {
        one: "{n} data z katalogu zapisana w tej przeglądarce.",
        few: "{n} daty z katalogu zapisane w tej przeglądarce.",
        many: "{n} dat z katalogu zapisanych w tej przeglądarce.",
        other: "{n} daty z katalogu zapisanej w tej przeglądarce.",
      } as PluralForms,
    },
  },

  series: {
    index: {
      title: "Ile dni do… — wszystkie cykliczne odliczania",
      description:
        "Boże Narodzenie, ramadan, Super Bowl, Perseidy: każda cykliczna data w katalogu, z najbliższym terminem na górze i tabelą kolejnych lat.",
      heading: "Ile dni do…",
      intro: {
        one: "{n} data, która wraca co roku. Na każdej stronie najbliższy termin jest na górze, a pod nim lista kolejnych lat.",
        few: "{n} daty, które wracają co roku. Na każdej stronie najbliższy termin jest na górze, a pod nim lista kolejnych lat.",
        many: "{n} dat, które wracają co roku. Na każdej stronie najbliższy termin jest na górze, a pod nim lista kolejnych lat.",
        other:
          "{n} daty, która wraca co roku. Na każdej stronie najbliższy termin jest na górze, a pod nim lista kolejnych lat.",
      } as PluralForms,
      empty: "Katalog jest uzupełniany — zajrzyj wkrótce.",
      jsonLdDescription: "Cykliczne daty z najbliższym terminem i tabelą kolejnych lat.",
    },

    noUpcoming: "{title}: w katalogu nie ma jeszcze kolejnego terminu.",

    thisYearsPage: "Strona tegorocznej daty",

    shareTitle: "Ile dni do: {title}",

    upcoming: {
      heading: "Nadchodzące terminy",
      note: "{title} w katalogu — wszystkie terminy od dziś, począwszy od najbliższego.",
      empty: "Brak przyszłych dat — zajrzyj po kolejnym odświeżeniu.",
    },

    variants: {
      heading: "Inne daty powiązane z tą serią",
      note: "W kilku krajach obchodzone pod tą samą nazwą innego dnia — wypisane osobno, żeby odliczanie powyżej trzymało się głównego terminu.",
    },

    faqHeading: "Częste pytania",

    tagsLabel: "Tagi:",

    related: {
      heading: "Więcej cyklicznych dat w kategorii {category}",
      all: "Wszystkie cykliczne odliczania",
    },
  },

  hubs: {
    label: {
      browse: "Przeglądaj",
      category: "Kategoria",
      country: "Kraj",
      calendar: "Kalendarz",
      tag: "Tag",
    },

    breadcrumbLabel: "Ścieżka nawigacji",

    paged: {
      title: "{name} (strona {n})",
      headingSuffix: "— strona {n}",
      backToFirst: "Wróć na pierwszą stronę.",
    },

    categoryIndex: {
      title: "Kategorie — wszystkie rodzaje dat, które jeszcze nie nadeszły",
      description:
        "Przeglądaj nadchodzące daty według kategorii: święta, sport, film i telewizja, gry, kosmos, wybory, rocznice i więcej — każda z odliczaniem na żywo.",
      heading: "Wszystkie rodzaje dat",
      intro: "Dwadzieścia trzy kategorie, pogrupowane według tego, co chcesz z nimi zrobić.",
      collectionDescription: "Nadchodzące daty według kategorii.",
    },

    category: {
      description: {
        one: "{blurb} {n} nadchodząca data z odliczaniem na żywo i linkami do kalendarza.",
        few: "{blurb} {n} nadchodzące daty z odliczaniem na żywo i linkami do kalendarza.",
        many: "{blurb} {n} nadchodzących dat z odliczaniem na żywo i linkami do kalendarza.",
        other: "{blurb} {n} nadchodzącej daty z odliczaniem na żywo i linkami do kalendarza.",
      } as PluralForms,
      descriptionEmpty: "{blurb} Nadchodzące daty z odliczaniem na żywo i linkami do kalendarza.",
      descriptionPaged:
        "{blurb} Strona {n} nadchodzących dat, od najbliższej, z odliczaniem na żywo i linkami do kalendarza.",
      heading: "{category} — nadchodzące daty",
      count: {
        one: "{n} nadchodząca data.",
        few: "{n} nadchodzące daty.",
        many: "{n} nadchodzących dat.",
        other: "{n} nadchodzącej daty.",
      } as PluralForms,
      countPaged: {
        one: "{n} nadchodząca data, od najbliższej.",
        few: "{n} nadchodzące daty, od najbliższej.",
        many: "{n} nadchodzących dat, od najbliższej.",
        other: "{n} nadchodzącej daty, od najbliższej.",
      } as PluralForms,
      soon: "Najbliższe 30 dni",
      everyYear: "Co roku",
      all: "Wszystko w kategorii {category}",
      empty: "W tej kategorii nic jeszcze nie ma.",
    },

    countryIndex: {
      title: "Kraje — nadchodzące święta i wydarzenia według kraju",
      description:
        "Święta państwowe, dni narodowe i wydarzenia lokalne z ponad 200 krajów i terytoriów, każde z odliczaniem na żywo i linkami do kalendarza.",
      heading: "Według kraju",
      intro: {
        one: "{n} kraj i terytorium z nadchodzącymi świętami i wydarzeniami w katalogu.",
        few: "{n} kraje i terytoria z nadchodzącymi świętami i wydarzeniami w katalogu.",
        many: "{n} krajów i terytoriów z nadchodzącymi świętami i wydarzeniami w katalogu.",
        other: "{n} kraju i terytorium z nadchodzącymi świętami i wydarzeniami w katalogu.",
      } as PluralForms,
      empty: "Katalog jest uzupełniany — zajrzyj wkrótce.",
      collectionDescription: "Nadchodzące święta i wydarzenia według kraju.",
    },

    country: {
      description: {
        one: "{country}: święta państwowe, dni narodowe i wydarzenia — {n} nadchodząca data, miesiąc po miesiącu, z odliczaniem i kalendarzem.",
        few: "{country}: święta państwowe, dni narodowe i wydarzenia — {n} nadchodzące daty, miesiąc po miesiącu, z odliczaniem i kalendarzem.",
        many: "{country}: święta państwowe, dni narodowe i wydarzenia — {n} nadchodzących dat, miesiąc po miesiącu, z odliczaniem i kalendarzem.",
        other:
          "{country}: święta państwowe, dni narodowe i wydarzenia — {n} nadchodzącej daty, miesiąc po miesiącu, z odliczaniem i kalendarzem.",
      } as PluralForms,
      descriptionEmpty:
        "{country}: święta państwowe, dni narodowe i wydarzenia, miesiąc po miesiącu, z odliczaniem i kalendarzem.",
      intro:
        "Nadchodzące święta i wydarzenia oznaczone tagiem {country}, miesiąc po miesiącu. Daty ogólnoświatowe — zaćmienia, premiery, dni międzynarodowe — są wypisane osobno poniżej.",
      count: {
        one: "{n} nadchodząca data.",
        few: "{n} nadchodzące daty.",
        many: "{n} nadchodzących dat.",
        other: "{n} nadchodzącej daty.",
      } as PluralForms,
      countCapped: {
        one: "{n}+ nadchodząca data.",
        few: "{n}+ nadchodzące daty.",
        many: "{n}+ nadchodzących dat.",
        other: "{n}+ nadchodzącej daty.",
      } as PluralForms,
      empty: "Brak dat oznaczonych tagiem {country}.",
      worldwide: "Na całym świecie, wkrótce",
      collectionDescription: "Święta i wydarzenia — {country}.",
    },

    calendar: {
      description:
        "{month} — wszystko, co jest w katalogu: święta, starty rakiet, finały, premiery i rocznice, dzień po dniu, z odliczaniem na żywo.",
      count: {
        one: "{month}: {n} nadchodząca data, dzień po dniu.",
        few: "{month}: {n} nadchodzące daty, dzień po dniu.",
        many: "{month}: {n} nadchodzących dat, dzień po dniu.",
        other: "{month}: {n} nadchodzącej daty, dzień po dniu.",
      } as PluralForms,
      empty: "{month}: nic jeszcze nie zaplanowano.",
      months: "Miesiące",
      previous: "← {month}",
      next: "{month} →",
      collectionDescription: "Nadchodzące daty — {month}.",
    },

    tag: {
      description: {
        one: "{n} nadchodząca data z tagiem „{tag}”, od najbliższej, z odliczaniem na żywo i linkami do kalendarza.",
        few: "{n} nadchodzące daty z tagiem „{tag}”, od najbliższej, z odliczaniem na żywo i linkami do kalendarza.",
        many: "{n} nadchodzących dat z tagiem „{tag}”, od najbliższej, z odliczaniem na żywo i linkami do kalendarza.",
        other:
          "{n} nadchodzącej daty z tagiem „{tag}”, od najbliższej, z odliczaniem na żywo i linkami do kalendarza.",
      } as PluralForms,
      descriptionPaged:
        "Strona {n} nadchodzących dat z tagiem „{tag}”, od najbliższej, z odliczaniem na żywo i linkami do kalendarza.",
      crumb: "#{tag}",
      count: {
        one: "{n} nadchodząca data z tagiem „{tag}”, od najbliższej.",
        few: "{n} nadchodzące daty z tagiem „{tag}”, od najbliższej.",
        many: "{n} nadchodzących dat z tagiem „{tag}”, od najbliższej.",
        other: "{n} nadchodzącej daty z tagiem „{tag}”, od najbliższej.",
      } as PluralForms,
      searchPrompt: "Szukasz czegoś innego?",
      searchLink: "Przeszukaj cały katalog: „{tag}”.",
      collectionDescription: "Nadchodzące daty z tagiem {tag}.",
    },
  },

  pages: {
    about: {
      title: "O serwisie",
      description: "Jak Until zbiera, taguje i klasyfikuje tysiące przyszłych dat.",
      eyebrow: "Projekt",
      heading: "Gazeta przyszłości",

      intro:
        "Until to katalog dat, które jeszcze nie nadeszły. Święta państwowe z niemal każdego kraju, wydarzenia zebrane z rocznych stron Wikipedii i z Wikidata, plus warstwa kuratorska tego, na co ludzie naprawdę czekają — zaćmienia, mistrzostwa świata, igrzyska, wybory, kometa Halleya.",
      categories:
        "Każdy wpis jest otagowany i sklasyfikowany w {n} kategoriach — święta, dni narodowe, sport, astronomia, kosmos, technologie, polityka, historia i inne. Przeszukaj całość, zawęź do kategorii, otwórz odliczanie na żywo i dodaj je do kalendarza.",
      sources:
        "Podstawą świąt jest offline'owy zbiór {dateHolidays}, uzupełniony o {wikidata} i {wikipedia}. Powtórzone nazwy tego samego dnia (Boże Narodzenie w 140 krajach) łączymy w jedno odliczanie. Gdy źródła się nie zgadzają, wygrywają dane kuratorskie. Na stronie każdego wydarzenia podajemy źródło i datę ostatniej weryfikacji.",
      expected:
        "Daty bez potwierdzonego dnia są oznaczone jako „przewidywane”, z miesiącem, kwartałem lub rokiem, który podaje źródło, i nie odliczają, dopóki nie pojawi się konkretny termin. Katalog odświeża się codziennie ze swoich źródeł.",
      yourOwn:
        "Możesz stworzyć własne. Zostaje w przeglądarce — bez konta — a link do udostępnienia niesie tytuł i datę w adresie, więc każdy otworzy ten sam tykający zegar.",

      stats: {
        dates: "Daty",
        featured: "Wyróżnione",
        updated: "Aktualizacja",
      },

      byCategory: {
        heading: "Według kategorii",
        empty: "Katalog jest uzupełniany — zajrzyj wkrótce.",
      },

      bySource: {
        heading: "Według źródła",
        empty: "Nie zgłoszono jeszcze żadnych źródeł.",
      },
    },

    attributions: {
      title: "Źródła — skąd pochodzą daty",
      description:
        "Wszystkie źródła katalogu Until, z licencją i wymaganą atrybucją: date-holidays, Wikipedia, Wikidata, Hebcal, Launch Library i inne.",
      eyebrow: "Źródła",
      heading: "Źródła i licencje",
      intro:
        "Until korzysta wyłącznie ze źródeł, których warunki pozwalają przechowywać i ponownie publikować dane. Źródła na licencjach share-alike (teksty z Wikipedii, TVMaze, dane date-holidays) są podpisane na każdej stronie, która ich używa; zdjęcia hostujemy u siebie tylko na licencjach CC0, w domenie publicznej, CC BY lub CC BY-SA, z nazwiskiem autora. Każda strona wydarzenia linkuje do rekordu, z którego powstała.",
      sourcesEmpty: "Lista źródeł jest chwilowo niedostępna.",

      images: {
        heading: "Zdjęcia",
        policy:
          "Zdjęcia to kopie hostowane u nas: przeskalowane i serwowane z własnego magazynu, żeby nigdy nie obciążać oryginalnych serwerów. Przyjmujemy tylko pliki na wolnych licencjach — CC0, domena publiczna, CC BY, CC BY-SA i kilka krajowych licencji otwartych danych publicznych, a także zdjęcia NASA na jej zasadach dla mediów. Pliki na zasadach dozwolonego użytku oraz licencje niekomercyjne (NC) i bez utworów zależnych (ND) odrzucamy od razu, tak samo jak pliki z zastrzeżeniem znaku towarowego lub wizerunku. Każdy zapisany plik zachowuje autora, licencję i link do strony pliku. Wydarzenia bez wolnego zdjęcia dostają wygenerowaną kartę.",
        shareAlike:
          "Zdjęcia na licencji share-alike (CC BY-SA) publikujemy bez zmian, w oryginalnych proporcjach, z podpisem pod spodem. Nigdy nie kadrujemy ich do karty społecznościowej: taki kolaż byłby utworem zależnym i musiałby nieść tę samą licencję share-alike, więc te karty mają wygenerowany projekt. Zapisane pliki co miesiąc weryfikujemy ze źródłem; plik usunięty u źródła albo taki, który przestał być wolny, znika z naszego magazynu, a jego strony wracają do wygenerowanej karty.",
        empty: "Nie ma jeszcze przeniesionych zdjęć.",
        count: {
          one: "{n} zdjęcie w bibliotece:",
          few: "{n} zdjęcia w bibliotece:",
          many: "{n} zdjęć w bibliotece:",
          other: "{n} zdjęcia w bibliotece:",
        } as PluralForms,
      },

      fonts:
        "Kroje pisma: Fraunces (SIL Open Font License) i Geist (SIL Open Font License). Obliczenia astronomiczne: astronomy-engine (MIT).",
    },

    create: {
      title: "Utwórz odliczanie",
      description: "Stwórz własne odliczanie i dodaj je do kalendarza.",
      eyebrow: "Twoje daty",
      heading: "Stwórz odliczanie",
      intro:
        "Urodziny, premiera, wyjazd, rozprawa, zjazd rodzinny. Tyka tak samo jak katalog — i wrzucisz je prosto do Google Calendar, Outlooka albo pliku .ics.",

      form: {
        draftTitle: "Coś, na co czekam",
        draftNote: "Twoje własne odliczanie.",
        titleLabel: "Tytuł",
        dateLabel: "Data",
        categoryLabel: "Kategoria",
        noteLabel: "Notatka",
        notePlaceholder: "Dlaczego ta data jest dla Ciebie ważna.",
        save: "Zapisz na tym urządzeniu",
        openShareable: "Otwórz stronę do udostępnienia",
        saved: "Zapisano. {link} — zostaje w tej przeglądarce, dopóki nie wyczyścisz jej danych.",
        savedLink: "Zobacz",
        privacy:
          "Własne odliczania zostają na Twoim urządzeniu (bez konta). Link do udostępnienia koduje tytuł i datę w adresie.",
        previewLabel: "Podgląd na żywo",
        chooseDate: "Wybierz datę, żeby uruchomić zegar.",
      },
    },

    notFound: {
      heading: "Tej daty nie ma w katalogu",
      body: "Mogła zostać połączona z inną, zmienić nazwę albo nigdy nie istnieć.",
      backHome: "Wróć do tego, co nadchodzi",
    },
  },

  embed: {
    countdown: {
      units: {
        days: {
          one: "dzień",
          few: "dni",
          many: "dni",
          other: "dnia",
        } as PluralForms,
        hours: "godz.",
        minutes: "min",
        seconds: "sek.",
      },
      today: "To dzisiaj.",
      past: "To już się wydarzyło.",
    },

    studio: {
      heading: "Weź to ze sobą",

      controls: {
        preset: "Styl",
        digits: "Cyfry",
        type: "Tekst",
        background: "Tło",
        transparent: "Przezroczyste — przepuszcza scenę albo stronę",
        font: "Krój pisma",
        size: "Rozmiar",
        layout: "Układ",
        units: "Jednostki",
        separator: "Separator",
        frame: "Ramka",
        radius: "Zaokrąglenie rogów",
        inset: "Odstęp od krawędzi",
        position: "Pozycja",
        done: "Komunikat po zakończeniu",
        reset: "Resetuj",
        colourPicker: "{label} — wybór koloru",
      },

      toggles: {
        unitLabels: "Nazwy jednostek",
        title: "Tytuł",
        date: "Data",
        note: "Notatka",
        wordmark: "Logo",
        glow: "Poświata",
        trim: "Bez zer wiodących",
      },

      presets: {
        dark: "Until ciemny",
        light: "Jasny",
        amber: "Bursztyn",
        mono: "Mono",
        neon: "Neon",
        clear: "Przezroczysty",
      },

      fonts: {
        serif: "Szeryfowy",
        sans: "Bezszeryfowy",
        mono: "Maszynowy",
      },

      layouts: {
        row: "Rząd",
        stack: "Kolumna",
        compact: "Kompaktowy",
        big: "Jedna duża liczba",
      },

      separators: {
        colon: "Dwukropek",
        dot: "Kropka",
        space: "Spacja",
        none: "Brak",
      },

      frames: {
        card: "Karta",
        outline: "Obrys",
        none: "Brak",
      },

      units: {
        dhms: "Dni · godziny · minuty · sekundy",
        dhm: "Dni · godziny · minuty",
        dh: "Dni · godziny",
        d: "Dni",
        hms: "Godziny · minuty · sekundy",
        hm: "Godziny · minuty",
        ms: "Minuty · sekundy",
      },

      positions: {
        "top-left": "Lewy górny róg",
        top: "Góra",
        "top-right": "Prawy górny róg",
        left: "Lewa strona",
        center: "Środek",
        right: "Prawa strona",
        "bottom-left": "Lewy dolny róg",
        bottom: "Dół",
        "bottom-right": "Prawy dolny róg",
      },

      copy: {
        code: "Kopiuj kod",
        url: "Kopiuj adres",
      },

      embed: {
        previewTitle: "Podgląd osadzenia",
        paste: "Wklej to na swojej stronie",
        codeLabel: "Kod do osadzenia",
        note: "Wchodzi na pełną szerokość i {height} px wysokości. WordPress, Ghost i Notion przyjmą też sam link odliczania i same znajdą osadzenie — ale wtedy rozwiną standardową kartę, więc wklej powyższy kod, żeby zachować to, co tu ustawiono.",
      },

      stream: {
        previewTitle: "Podgląd nakładki na stream",
        canvasNote: "Płótno {width} × {height}, pomniejszone — szachownica to obszar, który OBS wycina.",
        urlLabel: "Adres źródła przeglądarki",
        source: "Źródło przeglądarki · {width} × {height}",
        steps: [
          "W OBS lub Streamlabs dodaj źródło typu Przeglądarka.",
          "Wklej powyższy adres.",
          "Ustaw rozmiar {width} × {height} — to płótno, względem którego liczona jest pozycja.",
          "Zostaw przezroczyste tło; nakładka ma własne.",
          "Zaznacz „Odśwież przeglądarkę, gdy scena stanie się aktywna”, żeby zegar startował od nowa.",
        ],
      },
    },
  },
};
