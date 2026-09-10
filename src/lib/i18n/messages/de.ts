/**
 * German messages. See `en/` for what each key is for.
 *
 * Four decisions a maintainer should not undo:
 * - The ranking phrase is "Wie viele Tage bis {title}?" — heading, title and nav all carry it, and
 *   the nav shortens it to "Tage bis …" rather than translating "Days until" as "Bis-Termine".
 * - Anything taking `{category}` or `{country}` is built so the placeholder never sits behind a
 *   preposition: German would need an article there ("in der Schweiz", "aus Feiertagen") and the
 *   values arrive bare from `Intl.DisplayNames` and the category labels. Hence "{country}: …" and
 *   "in der Kategorie {category}" everywhere instead of "in {country}" / "mehr {category}".
 * - `{period}` is always introduced with "für" ("für Juni 2027", "für 2027", "für 3. Quartal
 *   2027"): "im" would be wrong for a bare year, and the same template serves all three precisions.
 * - `lowercaseCategory` is false — German capitalises nouns, in a title as anywhere else.
 */
import type { Messages } from "./en";
import type { PluralForms } from "./types";

export const de: Messages = {
  common: {
    siteName: "Until",
    tagline: "ein Katalog der Dinge, die noch bevorstehen.",
    wordmarkLine: "Until — ein Katalog der Dinge, die noch bevorstehen.",

    nav: {
      categories: "Kategorien",
      countries: "Länder",
      daysUntil: "Tage bis …",
      create: "Erstellen",
      about: "Über Until",
    },

    search: {
      label: "Suche",
      navLabel: "Countdowns durchsuchen",
      placeholder: "Katalog durchsuchen…",
      navPlaceholder: "Finsternisse, WM, Feiertage suchen…",
      submit: "Suchen",
    },

    breadcrumb: {
      home: "Startseite",
    },

    footer: {
      datesCount: { one: "{n} Termin", other: "{n} Termine" } as PluralForms,
      aboutTheData: "über die Daten",
      attributions: "Quellen",
      categories: "Kategorien",
      browse: "Entdecken",
      all: "alle →",
      makeYourOwn: "Eigenen erstellen",
      language: "Sprache",
    },

    actions: {
      share: "Teilen",
      shareCopied: "Link kopiert",
      save: "Merken",
      saved: "Gemerkt",
      addToCalendar: "Zum Kalender hinzufügen",
      google: "Google Calendar",
      outlook: "Outlook",
      downloadIcs: ".ics herunterladen",
      embed: "Auf deiner Seite einbinden",
      stream: "In deinen Stream einbauen",
      copy: "Kopieren",
      copied: "Kopiert",
    },

    labels: {
      worldwide: "Weltweit",
      countriesCount: { one: "{n} Land", other: "{n} Länder" } as PluralForms,
      recurring: "Jedes Jahr",
      series: "Serie",
      today: "Heute",
      tba: "Offen",
      dateToBeAnnounced: "ein noch offener Termin",
      nothingHereYet: "Hier ist noch nichts",
      more: "Mehr",
      seeAll: "Alle ansehen →",
      loading: "Lädt…",
      source: "Quelle",
      sources: "Quellen",
      lastVerified: "Zuletzt geprüft",
    },

    status: {
      scheduled: "Geplant",
      tentative: "Unbestätigt",
      postponed: "Verschoben",
      cancelled: "Abgesagt",
      done: "Vorbei",
      retired: "Eingestellt",
    },

    units: {
      days: "Tage",
      hours: "Stunden",
      minutes: "Minuten",
      seconds: "Sekunden",
      daysShort: "T",
      hoursShort: "Std",
      minutesShort: "Min",
      secondsShort: "Sek",
    },

    pagination: {
      previous: "Zurück",
      next: "Weiter",
      page: "Seite {n}",
      pageOf: "Seite {n} von {total}",
    },

    languageSwitcher: {
      label: "Sprache",
      description: "Until in einer anderen Sprache lesen",
    },
  },

  categories: {
    labels: {
      holidays: "Feiertage",
      national: "Nationalfeiertage",
      religion: "Religion",
      awareness: "Aktionstage",
      fun: "Kuriose Feiertage",
      culture: "Kultur",
      festivals: "Festivals",
      sports: "Sport",
      esports: "E-Sport",
      games: "Games",
      film: "Film",
      tv: "Serien",
      anime: "Anime",
      music: "Musik",
      entertainment: "Popkultur",
      politics: "Politik",
      tech: "Technik",
      science: "Wissenschaft",
      space: "Raumfahrt",
      astronomy: "Astronomie",
      nature: "Natur",
      history: "Geschichte",
      curiosities: "Kuriositäten",
    },

    blurbs: {
      holidays: "Gesetzliche Feiertage und die Rituale, die wir behalten.",
      national: "Unabhängigkeitstage, Tage der Republik, nationale Festtage.",
      religion: "Feste, Fastenzeiten und heilige Tage aller Religionen.",
      awareness: "UN-Gedenktage und internationale Aktionstage.",
      fun: "Tag der Pizza, Tag des Piratensprechens und andere Ausreden.",
      culture: "Feste, Festtage und der kulturelle Kalender.",
      festivals: "Karneval, Jahrmärkte und große Zusammenkünfte.",
      sports: "Finals, Eröffnungsfeiern und die nächste WM.",
      esports: "Worlds, Majors und The International.",
      games: "Release-Termine und Showcases.",
      film: "Premieren und Preisverleihungen.",
      tv: "Staffelstarts und Finalfolgen.",
      anime: "Season-Starts und Kinofilme.",
      music: "Wettbewerbe, Tourneen und Jubiläen.",
      entertainment: "Fan-Termine und die Feiertage der Popkultur.",
      politics: "Wahlen und die Termine, die Länder lenken.",
      tech: "Konferenzen, Support-Enden und die Uhren, die Computer führen.",
      science: "Termine für Neugierige.",
      space: "Starts, Landungen und der lange Weg zurück zum Mond.",
      astronomy: "Finsternisse, Sternschnuppen, Sonnenwenden – Verabredungen mit dem Himmel.",
      nature: "Erde, Ozeane und das lebendige Jahr.",
      history: "Jahrestage von Dingen, die längst passiert sind – und weiter ticken.",
      curiosities: "Unix-Meilensteine, Palindrom-Daten, Freitage der 13.",
    },

    groups: {
      celebrate: { label: "Feiern", tagline: "Feiertage, Festtage und die Ausreden, die wir pflegen." },
      watch: { label: "Zuschauen", tagline: "Finals, Premieren, Tourneen und der nächste große Release." },
      play: { label: "Spielen", tagline: "Release-Termine und Showcases." },
      "look-up": { label: "Hochschauen", tagline: "Raketenstarts, Finsternisse und das lebendige Jahr." },
      vote: { label: "Wählen", tagline: "Wahlen, Konferenzen und die Uhren, die Computer führen." },
      wonder: { label: "Staunen", tagline: "Jahrestage und Kalender-Kuriositäten." },
    },
  },

  seo: {
    homeTitle: "Until — Countdowns für alles, was noch kommt",
    siteDescription:
      "Tausende künftiger Termine, verschlagwortet und tickend. Feiertage, Finsternisse, Weltmeisterschaften, Wahlen – und die, die du selbst anlegst.",
    titleTemplate: "%s · Until",

    event: {
      whenIs: "Wann ist {title}? {when}",
      whenIsCoarse: "Wann ist {title}? Voraussichtlich {period}",
      countdownColon: "Countdown zu {title}: {when}",
      countdownDash: "{title} — Countdown bis {when}",
      countdownDashCoarse: "{title} — {when}",
      description: "{title}{status} ist am {date}. {days} Live-Countdown und Kalender-Link.",
      descriptionCoarse:
        "{title} wird für {period} erwartet. Der genaue Tag steht noch nicht fest. Sobald er feststeht, läuft hier der Countdown.",
      statusCancelled: " (abgesagt)",
      statusPostponed: " (verschoben)",
      fallbackTitle: "Countdown",
      mineTitle: "Dein Countdown",
      sharedTitle: "Geteilter Countdown",
      sharedMetaTitle: "{title} — Countdown bis {date}",
      sharedMetaDescription: "{title} ist am {date}. Ein Countdown, erstellt auf Until.",
    },

    series: {
      title: "Wie viele Tage bis {title}? — {when}",
      titleNoDate: "Wie viele Tage bis {title}?",
      heading: "Wie viele Tage bis {title}?",
      description: "{title} ist am {date}. {days} Live-Countdown, Termine für jedes Jahr, Kalender-Link.",
      descriptionCoarse:
        "{title} wird für {period} erwartet. Termine für jedes Jahr, Live-Countdown und Kalender-Links.",
      descriptionNoDate: "{title}: kommende Termine, ein Live-Countdown bis zum nächsten und Kalender-Links.",
      fallbackTitle: "Tage bis",
    },

    hub: {
      category: "{category}: kommende Termine und Countdowns",
      country: "{country}: kommende Feiertage und Termine",
      month: "Was ist los im {month}? Termine und Countdowns",
      tag: "Kommende Termine rund um {tag}, mit Countdown",
      lowercaseCategory: false,
    },

    days: {
      today: "Das ist heute.",
      tomorrow: "Das ist morgen.",
      yesterday: "Das war gestern.",
      away: { one: "Noch {n} Tag.", other: "Noch {n} Tage." } as PluralForms,
      ago: { one: "Das war vor {n} Tag.", other: "Das war vor {n} Tagen." } as PluralForms,
    },

    period: {
      month: "{month} {year}",
      quarter: "{q}. Quartal {year}",
      year: "{year}",
      expected: "voraussichtlich {period}",
      unknown: "Termin noch offen",
    },

    jsonLd: {
      siteDescription:
        "Live-Countdowns und Termine für Tausende kommender Ereignisse, Feiertage und Meilensteine.",
      seriesDescription: "Kommende Termine für {title}.",
    },
  },

  home: {
    loading: "Katalog wird geladen",

    hero: {
      eyebrow: "Ausgewählter Countdown",
      meta: "{category} · {when}",
      open: "Diesen Countdown öffnen",
    },

    hub: {
      alsoOnTheHorizon: "Ebenfalls am Horizont",
      next7Days: "Die nächsten 7 Tage",
      wholeMonth: "Ganzer Monat →",
      browseByCategory: "Nach Kategorie stöbern",
      allCategories: "Alle Kategorien →",
      popularCountdowns: "Beliebte Countdowns",
      everyRecurringDate: "Alle jährlichen Termine →",
      byCountry: "Nach Land",
      allCountries: "Alle Länder →",
      noCountries: "Die Länderdaten werden gerade ergänzt.",
      byMonth: "Nach Monat",
      thisMonth: "Dieser Monat — {month}",
      nextMonth: "Nächster Monat — {month}",
    },

    explorer: {
      heading: "Der Katalog",
      count: { one: "{n} kommender Termin.", other: "{n} kommende Termine." } as PluralForms,
      countMatching: {
        one: "{n} kommender Termin passt zu „{q}“.",
        other: "{n} kommende Termine passen zu „{q}“.",
      } as PluralForms,
      countInCategory: {
        one: "{n} kommender Termin in der Kategorie {category}.",
        other: "{n} kommende Termine in der Kategorie {category}.",
      } as PluralForms,
      countMatchingInCategory: {
        one: "{n} kommender Termin passt zu „{q}“ in der Kategorie {category}.",
        other: "{n} kommende Termine passen zu „{q}“ in der Kategorie {category}.",
      } as PluralForms,
      sort: {
        soonest: "Als Nächstes",
        popular: "Beliebt",
        latest: "Am spätesten",
      },
    },

    filters: {
      all: "Alle",
    },

    empty: {
      noMatch: "Nichts im Katalog passt zu „{q}“.",
      nothing: "Hier ist noch nichts.",
      hint: "Tippfehler sind verziehen und Abkürzungen funktionieren, ein knapper Treffer sollte also trotzdem landen — diesen Termin führt der Katalog offenbar nicht.",
      busiest: "Die vollsten Kategorien",
      everyRecurringDate: "Alle jährlichen Termine",
      startOver: "Von vorn anfangen",
    },

    table: {
      date: "Datum",
      event: "Termin",
      within: "In",
      category: "Kategorie",
      empty: "Hier ist noch nichts geplant.",
    },

    pagination: "Seitennavigation",
  },

  event: {
    answer: {
      today: "{title} ist heute, {date}.",
      tomorrow: "Bis {title} ist es noch {n} Tag: morgen, {date}.",
      days: {
        one: "Bis {title} ist es noch {n} Tag: {date}.",
        other: "Bis {title} sind es noch {n} Tage: {date}.",
      } as PluralForms,
      past: {
        one: "{title} war vor {n} Tag, am {date}.",
        other: "{title} war vor {n} Tagen, am {date}.",
      } as PluralForms,
      cancelled: "{title} war für {date} geplant und wurde abgesagt.",
      coarse: "{title} wird für {period} erwartet. Der genaue Tag steht noch nicht fest.",
      plain: "{title} ist am {date}.",
    },

    statusHappened: "Schon vorbei",

    dateRange: "{start} – {end}",

    coarseNote:
      "Der genaue Tag steht noch nicht fest. Sobald die Quelle einen nennt, läuft hier der Countdown.",
    dateChanged: "Termin geändert: vorher {date}.",
    partOfSeries: "Teil der Serie {series} — jedes Jahr, mit dem nächsten Termin immer oben.",
    everyUpcomingDate: "Alle kommenden Termine",
    otherYears: "Andere Jahre",
    alsoComing: "Kommt außerdem",

    fields: {
      where: "Wo",
      tags: "Schlagwörter",
    },

    provenance: {
      source: "Quelle:",
      lastVerified: "zuletzt geprüft am {date}",
      summary: "Zusammenfassung von {source} ({license})",
    },

    image: {
      photo: "Foto",
      photoBy: "Foto:",
      via: "über {provider}",
    },

    mine: {
      missingTitle: "Dieser Countdown liegt auf einem anderen Gerät",
      missingBody:
        "Persönliche Countdowns werden in dem Browser gespeichert, der sie angelegt hat. Wenn dir jemand einen Link geschickt hat, bitte ihn um die teilbare URL von der Erstellen-Seite.",
      makeNew: "Neuen anlegen",
      onThisDevice: "Auf diesem Gerät",
      remove: "Entfernen",
      savedCount: {
        one: "{n} Termin aus dem Katalog ist in diesem Browser gespeichert.",
        other: "{n} Termine aus dem Katalog sind in diesem Browser gespeichert.",
      } as PluralForms,
    },
  },

  series: {
    index: {
      title: "Wie viele Tage bis …? Alle wiederkehrenden Countdowns",
      description:
        "Weihnachten, Ramadan, der Super Bowl, die Perseiden: jeder wiederkehrende Termin im Katalog, mit dem nächsten Datum oben und einer Tabelle der kommenden Jahre.",
      heading: "Wie viele Tage bis …",
      intro: {
        one: "{n} Termin, der jedes Jahr wiederkommt. Jede Seite hält den nächsten Termin oben und listet die kommenden Jahre.",
        other:
          "{n} Termine, die jedes Jahr wiederkommen. Jede Seite hält den nächsten Termin oben und listet die kommenden Jahre.",
      } as PluralForms,
      empty: "Der Katalog wird gerade gefüllt — schau bald wieder vorbei.",
      jsonLdDescription: "Wiederkehrende Termine mit dem nächsten Datum und einer Tabelle über mehrere Jahre.",
    },

    noUpcoming: "Für {title} steht im Katalog noch kein kommender Termin.",

    thisYearsPage: "Die Seite für dieses Jahr",

    shareTitle: "Tage bis {title}",

    upcoming: {
      heading: "Kommende Termine",
      note: "Alle Termine für {title} im Katalog ab heute, die nächsten zuerst.",
      empty: "Noch keine künftigen Termine — schau nach der nächsten Aktualisierung wieder vorbei.",
    },

    variants: {
      heading: "Weitere Termine, die zu dieser Serie gehören",
      note: "In einzelnen Ländern unter demselben Namen an einem anderen Tag begangen — hier getrennt gelistet, damit der Countdown oben am Hauptdatum bleibt.",
    },

    faqHeading: "Häufige Fragen",

    tagsLabel: "Schlagwörter:",

    related: {
      heading: "Weitere jährliche Termine in der Kategorie {category}",
      all: "Alle wiederkehrenden Countdowns",
    },
  },

  hubs: {
    label: {
      browse: "Entdecken",
      category: "Kategorie",
      country: "Land",
      calendar: "Kalender",
      tag: "Schlagwort",
    },

    breadcrumbLabel: "Navigationspfad",

    paged: {
      title: "{name} (Seite {n})",
      headingSuffix: "— Seite {n}",
      backToFirst: "Zurück zur ersten Seite.",
    },

    categoryIndex: {
      title: "Kategorien — jede Art von Termin, die noch bevorsteht",
      description:
        "Kommende Termine nach Kategorie: Feiertage, Sport, Film und Serien, Games, Raumfahrt, Wahlen, Jahrestage und mehr, jeweils mit Live-Countdown.",
      heading: "Jede Art von Termin",
      intro: "Dreiundzwanzig Kategorien, sortiert danach, was man damit anfängt.",
      collectionDescription: "Kommende Termine nach Kategorie.",
    },

    category: {
      description: {
        one: "{blurb} {n} kommender Termin mit Live-Countdown und Kalender-Link.",
        other: "{blurb} {n} kommende Termine mit Live-Countdowns und Kalender-Links.",
      } as PluralForms,
      descriptionEmpty: "{blurb} Kommende Termine mit Live-Countdowns und Kalender-Links.",
      descriptionPaged:
        "{blurb} Seite {n} der kommenden Termine, die nächsten zuerst, mit Live-Countdowns und Kalender-Links.",
      heading: "{category}: kommende Termine",
      count: { one: "{n} kommender Termin.", other: "{n} kommende Termine." } as PluralForms,
      countPaged: {
        one: "{n} kommender Termin, der nächste zuerst.",
        other: "{n} kommende Termine, die nächsten zuerst.",
      } as PluralForms,
      soon: "Die nächsten 30 Tage",
      everyYear: "Jedes Jahr",
      all: "Alle Termine in der Kategorie {category}",
      empty: "In dieser Kategorie ist noch nichts.",
    },

    countryIndex: {
      title: "Länder — kommende Feiertage und Termine nach Land",
      description:
        "Gesetzliche Feiertage, Nationalfeiertage und lokale Termine aus über 200 Ländern und Gebieten, jeweils mit Live-Countdown und Kalender-Link.",
      heading: "Nach Land",
      intro: {
        one: "{n} Land und Gebiet mit kommenden Feiertagen und Terminen im Katalog.",
        other: "{n} Länder und Gebiete mit kommenden Feiertagen und Terminen im Katalog.",
      } as PluralForms,
      empty: "Der Katalog wird gerade gefüllt — schau bald wieder vorbei.",
      collectionDescription: "Kommende Feiertage und Termine nach Land.",
    },

    country: {
      description: {
        one: "{country}: Feiertage, Nationalfeiertage und Termine — {n} kommender Termin, nach Monat sortiert, mit Live-Countdown und Kalender-Link.",
        other:
          "{country}: Feiertage, Nationalfeiertage und Termine — {n} kommende Termine, nach Monat sortiert, mit Live-Countdowns und Kalender-Links.",
      } as PluralForms,
      descriptionEmpty:
        "{country}: Feiertage, Nationalfeiertage und Termine, nach Monat sortiert, jeweils mit Live-Countdown und Kalender-Link.",
      intro:
        "{country}, Monat für Monat: kommende Feiertage und Termine. Weltweite Termine — Finsternisse, Releases, internationale Tage — stehen separat weiter unten.",
      count: { one: "{n} kommender Termin.", other: "{n} kommende Termine." } as PluralForms,
      countCapped: { one: "{n}+ kommender Termin.", other: "{n}+ kommende Termine." } as PluralForms,
      empty: "{country}: noch keine Termine im Katalog.",
      worldwide: "Weltweit, demnächst",
      collectionDescription: "{country}: Feiertage und Termine.",
    },

    calendar: {
      description:
        "Alles im Katalog für {month}: Feiertage, Raketenstarts, Finals, Premieren und Jahrestage, Tag für Tag, mit Live-Countdown.",
      count: {
        one: "{n} kommender Termin im {month}, Tag für Tag.",
        other: "{n} kommende Termine im {month}, Tag für Tag.",
      } as PluralForms,
      empty: "Im {month} steht noch nichts an.",
      months: "Monate",
      previous: "← {month}",
      next: "{month} →",
      collectionDescription: "Kommende Termine im {month}.",
    },

    tag: {
      description: {
        one: "{n} kommender Termin zu „{tag}“, mit Live-Countdown und Kalender-Link.",
        other:
          "{n} kommende Termine zu „{tag}“, die nächsten zuerst, jeweils mit Live-Countdown und Kalender-Link.",
      } as PluralForms,
      descriptionPaged:
        "Seite {n} der kommenden Termine zu „{tag}“, die nächsten zuerst, jeweils mit Live-Countdown und Kalender-Link.",
      crumb: "#{tag}",
      count: {
        one: "{n} kommender Termin zu „{tag}“.",
        other: "{n} kommende Termine zu „{tag}“, die nächsten zuerst.",
      } as PluralForms,
      searchPrompt: "Auf der Suche nach etwas anderem?",
      searchLink: "Den ganzen Katalog nach „{tag}“ durchsuchen.",
      collectionDescription: "Kommende Termine zu {tag}.",
    },
  },

  pages: {
    about: {
      title: "Über das Projekt",
      description: "Wie Until Tausende künftiger Termine sammelt, verschlagwortet und einordnet.",
      eyebrow: "Das Projekt",
      heading: "Eine Zeitung der Zukunft",

      intro:
        "Until ist ein Katalog von Terminen, die noch nicht stattgefunden haben. Gesetzliche Feiertage aus fast jedem Land, geplante Ereignisse aus den Jahresartikeln der Wikipedia und aus Wikidata, dazu eine kuratierte Schicht mit dem, worauf Menschen wirklich warten — Finsternisse, Weltmeisterschaften, Olympische Spiele, Wahlen, der Halleysche Komet.",
      categories:
        "Jeder Eintrag ist verschlagwortet und in {n} Kategorien eingeordnet — Feiertage, Nationalfeiertage, Sport, Astronomie, Raumfahrt, Technik, Politik, Geschichte und mehr. Durchsuche den ganzen Bestand, filtere eine Kategorie, öffne einen Live-Countdown und trage ihn in einen Kalender ein.",
      sources:
        "Das Rückgrat der Feiertage ist der Offline-Datensatz {dateHolidays}, ergänzt um {wikidata} und {wikipedia}. Gleiche Namen am selben Tag (Weihnachten in 140 Ländern) werden zu einem Countdown zusammengefasst. Widersprechen sich Quellen, gewinnen kuratierte Einträge. Jede Terminseite nennt ihre Quelle und wann das Datum zuletzt geprüft wurde.",
      expected:
        "Termine ohne bestätigten Tag tragen den Hinweis „voraussichtlich“ mit Monat, Quartal oder Jahr, das die Quelle angibt, und ticken erst, wenn ein echtes Datum veröffentlicht ist. Der Katalog aktualisiert sich täglich aus seinen Quellen.",
      yourOwn:
        "Du kannst eigene anlegen. Die bleiben im Browser — ohne Konto — und der Teilen-Link trägt Titel und Datum in der URL, sodass alle dieselbe tickende Uhr öffnen können.",

      stats: {
        dates: "Termine",
        featured: "Ausgewählt",
        updated: "Aktualisiert",
      },

      byCategory: {
        heading: "Nach Kategorie",
        empty: "Der Katalog wird gerade gefüllt — schau bald wieder vorbei.",
      },

      bySource: {
        heading: "Nach Quelle",
        empty: "Noch keine Quellen gemeldet.",
      },
    },

    attributions: {
      title: "Quellen — woher die Termine kommen",
      description:
        "Alle Quellen hinter dem Until-Katalog, mit Lizenz und der jeweils geforderten Namensnennung: date-holidays, Wikipedia, Wikidata, Hebcal, Launch Library und mehr.",
      eyebrow: "Quellen",
      heading: "Quellen und Lizenzen",
      intro:
        "Until übernimmt nur Quellen, deren Bedingungen das Speichern und Weiterveröffentlichen der Daten erlauben. Share-alike-Quellen (Wikipedia-Text, TVMaze, date-holidays-Daten) werden auf jeder Seite genannt, die sie nutzt; Bilder werden nur unter CC0, Public Domain, CC BY oder CC BY-SA neu gehostet, immer mit Nennung der Urheberin oder des Urhebers. Jede Terminseite verlinkt zurück auf den Datensatz, aus dem sie gebaut ist.",
      sourcesEmpty: "Die Quellenliste ist gerade nicht verfügbar.",

      images: {
        heading: "Bilder",
        policy:
          "Fotos sind neu gehostete Kopien: verkleinert und von unserem eigenen Speicher ausgeliefert, damit nie auf die ursprünglichen Server verlinkt wird. Aufgenommen werden nur frei lizenzierte Dateien — CC0, Public Domain, CC BY, CC BY-SA und einige nationale Open-Government-Lizenzen, dazu NASA-Bilder nach deren Medienrichtlinien. Dateien unter Fair Use sowie Lizenzen mit NC- oder ND-Klausel werden ebenso abgelehnt wie Dateien mit Marken- oder Persönlichkeitsrechtsvorbehalt, und jede gespeicherte Datei behält Urheber, Lizenz und einen Link zurück zur Dateiseite. Termine ohne freies Foto bekommen stattdessen eine generierte Karte.",
        shareAlike:
          "Share-alike-Fotos (CC BY-SA) werden unverändert und in ihren eigenen Proportionen gezeigt, mit der Namensnennung darunter. Für eine Social-Karte werden sie nie zurechtgeschnitten: Diese Montage wäre eine Bearbeitung und müsste dieselbe Share-alike-Lizenz tragen, deshalb nutzen solche Karten das generierte Design. Gespeicherte Dateien werden monatlich erneut gegen ihre Quelle geprüft; wurde eine gelöscht oder ist sie nicht mehr frei, verschwindet sie aus unserem Speicher und ihre Seiten fallen auf die generierte Karte zurück.",
        empty: "Noch keine neu gehosteten Bilder.",
        count: {
          one: "{n} Bild heute in der Bibliothek:",
          other: "{n} Bilder heute in der Bibliothek:",
        } as PluralForms,
      },

      fonts:
        "Schriften: Fraunces (SIL Open Font License) und Geist (SIL Open Font License). Astronomie berechnet mit astronomy-engine (MIT).",
    },

    create: {
      title: "Countdown erstellen",
      description: "Leg dir einen persönlichen Countdown an und trage ihn in deinen Kalender ein.",
      eyebrow: "Deine Termine",
      heading: "Mach dir einen Countdown",
      intro:
        "Geburtstage, Releases, eine Reise, ein Gerichtstermin, ein Wiedersehen. Es tickt genauso wie der Katalog — und du bekommst es direkt in Google Calendar, Outlook oder eine .ics-Datei.",

      form: {
        draftTitle: "Etwas, worauf ich warte",
        draftNote: "Ein Countdown von dir.",
        titleLabel: "Titel",
        dateLabel: "Datum",
        categoryLabel: "Kategorie",
        noteLabel: "Notiz",
        notePlaceholder: "Warum dieser Termin für dich zählt.",
        save: "Auf diesem Gerät speichern",
        openShareable: "Teilbare Seite öffnen",
        saved: "Gespeichert. {link} — er bleibt in diesem Browser, bis du den Speicher leerst.",
        savedLink: "Ansehen",
        privacy:
          "Eigene Countdowns bleiben auf deinem Gerät (kein Konto). Der Teilen-Link kodiert Titel und Datum in der URL.",
        previewLabel: "Live-Vorschau",
        chooseDate: "Wähle ein Datum, damit die Uhr läuft.",
      },
    },

    notFound: {
      heading: "Dieser Termin steht nicht im Katalog",
      body: "Vielleicht wurde er zusammengeführt, umbenannt — oder es gab ihn nie.",
      backHome: "Zurück zu allem, was kommt",
    },
  },

  embed: {
    countdown: {
      units: {
        days: { one: "Tag", other: "Tage" } as PluralForms,
        hours: "Std",
        minutes: "Min",
        seconds: "Sek",
      },
      today: "Heute.",
      past: "Das ist schon vorbei.",
    },

    studio: {
      heading: "Nimm ihn mit",

      controls: {
        preset: "Vorlage",
        digits: "Ziffern",
        type: "Text",
        background: "Hintergrund",
        transparent: "Transparent — lässt die Szene oder die Seite durch",
        font: "Schrift",
        size: "Größe",
        layout: "Anordnung",
        units: "Einheiten",
        separator: "Trennzeichen",
        frame: "Rahmen",
        radius: "Eckenradius",
        inset: "Randabstand",
        position: "Position",
        done: "Schlussmeldung",
        reset: "Zurücksetzen",
        colourPicker: "{label} — Farbwähler",
      },

      toggles: {
        unitLabels: "Beschriftung der Einheiten",
        title: "Titel",
        date: "Datum",
        note: "Notiz",
        wordmark: "Schriftzug",
        glow: "Leuchten",
        trim: "Führende Nullen weglassen",
      },

      presets: {
        dark: "Until dunkel",
        light: "Hell",
        amber: "Bernstein",
        mono: "Mono",
        neon: "Neon",
        clear: "Transparent",
      },

      fonts: {
        serif: "Serif",
        sans: "Sans",
        mono: "Mono",
      },

      layouts: {
        row: "Reihe",
        stack: "Gestapelt",
        compact: "Kompakt",
        big: "Eine große Zahl",
      },

      separators: {
        colon: "Doppelpunkt",
        dot: "Punkt",
        space: "Leerzeichen",
        none: "Keins",
      },

      frames: {
        card: "Karte",
        outline: "Umriss",
        none: "Keiner",
      },

      units: {
        dhms: "Tage · Stunden · Minuten · Sekunden",
        dhm: "Tage · Stunden · Minuten",
        dh: "Tage · Stunden",
        d: "Tage",
        hms: "Stunden · Minuten · Sekunden",
        hm: "Stunden · Minuten",
        ms: "Minuten · Sekunden",
      },

      positions: {
        "top-left": "Oben links",
        top: "Oben",
        "top-right": "Oben rechts",
        left: "Links",
        center: "Mitte",
        right: "Rechts",
        "bottom-left": "Unten links",
        bottom: "Unten",
        "bottom-right": "Unten rechts",
      },

      copy: {
        code: "Code kopieren",
        url: "URL kopieren",
      },

      embed: {
        previewTitle: "Vorschau der Einbettung",
        paste: "Das hier in deine Seite einfügen",
        codeLabel: "Einbettungscode",
        note: "Sie wird in voller Breite und {height} px hoch eingebunden. WordPress, Ghost und Notion nehmen auch den Link des Countdowns und finden das iframe von selbst — dabei entsteht aber die Standardkarte, also füge lieber den Code oben ein, damit bleibt, was du hier gebaut hast.",
      },

      stream: {
        previewTitle: "Vorschau des Stream-Overlays",
        canvasNote:
          "Die Fläche mit {width} × {height}, verkleinert — das Schachbrettmuster ist das, was OBS ausblendet.",
        urlLabel: "URL für die Browserquelle",
        source: "Browserquelle · {width} × {height}",
        steps: [
          "In OBS oder Streamlabs eine Browserquelle hinzufügen.",
          "Die URL von oben einfügen.",
          "Die Größe auf {width} × {height} stellen — die Fläche, an der die Position gemessen wird.",
          "Den Hintergrund transparent lassen; das Overlay bringt seinen eigenen mit.",
          "„Browser aktualisieren, wenn Szene aktiv wird“ anhaken, damit die Uhr frisch startet.",
        ],
      },
    },
  },
};
