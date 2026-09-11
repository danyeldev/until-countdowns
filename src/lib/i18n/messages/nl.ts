/**
 * Dutch messages. See `en/` for what each key is for.
 *
 * Five decisions a maintainer should not undo:
 * - The ranking phrase is "Hoeveel dagen tot {title}?" — heading, title, share sheet and nav all
 *   carry it, and the nav keeps the whole question ("Hoeveel dagen tot…") rather than shortening it
 *   to "Dagen tot", because that link is also the breadcrumb of /hoeveel-dagen-tot.
 * - `{category}`, `{country}` and `{tag}` never sit behind a preposition. Dutch would need an
 *   article there ("in de Verenigde Staten", "in het nieuws") and the values arrive bare from
 *   `Intl.DisplayNames` and the category labels, so every template puts them first, before a colon:
 *   "Feestdagen: wat er aankomt", "{country}: aankomende feestdagen en evenementen". That is also
 *   why `lowercaseCategory` is false — the label is sentence-initial, so it keeps its capital, and
 *   Dutch would never capitalise it mid-sentence anyway.
 * - `{period}` is always introduced with "verwacht in" ("verwacht in juni 2027", "verwacht in
 *   2027", "verwacht in Q2 2027"); the quarter therefore stays "Q{q}" rather than "{q}e kwartaal",
 *   which would need "het" after "in" and break the one template that serves all three precisions.
 * - The event answer opens with "Nog {n} dagen tot …", which is how a Dutch speaker says it and
 *   puts the number first, where English puts an expletive "There are".
 * - "date" is "datum"/"datums" throughout, never "data" — that reads as computer data in Dutch.
 */
import type { Messages } from "./en";
import type { PluralForms } from "./types";

export const nl: Messages = {
  common: {
    siteName: "Until",
    tagline: "een catalogus van dingen die nog moeten gebeuren.",
    wordmarkLine: "Until — een catalogus van dingen die nog moeten gebeuren.",

    nav: {
      categories: "Categorieën",
      countries: "Landen",
      daysUntil: "Hoeveel dagen tot…",
      create: "Maken",
      about: "Over Until",
    },

    search: {
      label: "Zoeken",
      navLabel: "Countdowns doorzoeken",
      placeholder: "Doorzoek de catalogus…",
      navPlaceholder: "Zoek eclipsen, WK’s, feestdagen…",
      submit: "Zoeken",
    },

    breadcrumb: {
      home: "Startpagina",
    },

    footer: {
      datesCount: { one: "{n} datum", other: "{n} datums" } as PluralForms,
      aboutTheData: "over de gegevens",
      attributions: "bronvermelding",
      categories: "Categorieën",
      browse: "Ontdekken",
      all: "alle →",
      makeYourOwn: "Zelf maken",
      language: "Taal",
    },

    actions: {
      share: "Delen",
      shareCopied: "Link gekopieerd",
      save: "Bewaren",
      saved: "Bewaard",
      addToCalendar: "Toevoegen aan agenda",
      google: "Google Calendar",
      outlook: "Outlook",
      downloadIcs: ".ics downloaden",
      embed: "Op je site plaatsen",
      stream: "Aan je stream toevoegen",
      copy: "Kopiëren",
      copied: "Gekopieerd",
    },

    labels: {
      worldwide: "Wereldwijd",
      countriesCount: { one: "{n} land", other: "{n} landen" } as PluralForms,
      recurring: "Elk jaar",
      series: "Reeks",
      today: "Vandaag",
      tba: "Nog onbekend",
      dateToBeAnnounced: "een nog onbekende datum",
      nothingHereYet: "Hier staat nog niets",
      more: "Meer",
      seeAll: "Alles bekijken →",
      loading: "Laden…",
      source: "Bron",
      sources: "Bronnen",
      lastVerified: "Laatst gecontroleerd",
    },

    status: {
      scheduled: "Gepland",
      tentative: "Onder voorbehoud",
      postponed: "Uitgesteld",
      cancelled: "Afgelast",
      done: "Voorbij",
      retired: "Vervallen",
    },

    units: {
      days: "dagen",
      hours: "uren",
      minutes: "minuten",
      seconds: "seconden",
      daysShort: "d",
      hoursShort: "u",
      minutesShort: "m",
      secondsShort: "s",
    },

    pagination: {
      previous: "Vorige",
      next: "Volgende",
      page: "Pagina {n}",
      pageOf: "Pagina {n} van {total}",
    },

    languageSwitcher: {
      label: "Taal",
      description: "Lees Until in een andere taal",
    },
  },

  categories: {
    labels: {
      holidays: "Feestdagen",
      national: "Nationale dagen",
      religion: "Religieuze dagen",
      awareness: "Themadagen",
      fun: "Gekke dagen",
      culture: "Cultuur",
      festivals: "Festivals",
      sports: "Sport",
      esports: "Esports",
      games: "Games",
      film: "Film",
      tv: "Tv",
      anime: "Anime",
      music: "Muziek",
      entertainment: "Entertainment",
      politics: "Politiek",
      tech: "Tech",
      science: "Wetenschap",
      space: "Ruimtevaart",
      astronomy: "Astronomie",
      nature: "Natuur",
      history: "Geschiedenis",
      curiosities: "Curiosa",
    },

    blurbs: {
      holidays: "Officiële feestdagen en de rituelen die we volhouden.",
      national: "Onafhankelijkheidsdagen, republiekdagen, nationale feesten.",
      religion: "Feesten, vastentijden en heilige dagen uit alle geloven.",
      awareness: "VN-dagen en internationale themadagen.",
      fun: "Pizzadag, Talk Like a Pirate Day en andere smoesjes.",
      culture: "Festivals, gedenkdagen en de culturele kalender.",
      festivals: "Carnavals, kermissen en samenkomsten.",
      sports: "Finales, openingsceremonies en het volgende WK.",
      esports: "Worlds, Majors en The International.",
      games: "Releasedatums en showcases.",
      film: "Premières en prijsuitreikingen.",
      tv: "Seizoensstarts en finales.",
      anime: "Seizoensstarts en filmreleases.",
      music: "Songfestivals, tournees en jubilea.",
      entertainment: "Fandomdatums en heilige dagen van de popcultuur.",
      politics: "Verkiezingen en de datums die landen sturen.",
      tech: "Conferenties, end-of-life-datums en de klokken die computers bijhouden.",
      science: "Datums voor de nieuwsgierigen.",
      space: "Lanceringen, landingen en de lange weg terug naar de maan.",
      astronomy: "Eclipsen, meteorenzwermen, zonnewendes — afspraken met de hemel.",
      nature: "De aarde, de oceanen en het levende jaar.",
      history: "Jubilea van dingen die al gebeurd zijn — en die nog steeds tikken.",
      curiosities: "Unix-mijlpalen, palindroomdatums, vrijdag de dertiende.",
    },

    groups: {
      celebrate: { label: "Vieren", tagline: "Feestdagen, gedenkdagen en de smoesjes die we koesteren." },
      watch: { label: "Kijken", tagline: "Finales, premières, tournees en de volgende grote release." },
      play: { label: "Spelen", tagline: "Releasedatums en showcases." },
      "look-up": { label: "Omhoogkijken", tagline: "Lanceringen, eclipsen en het levende jaar." },
      vote: { label: "Stemmen", tagline: "Verkiezingen, conferenties en de klokken die computers bijhouden." },
      wonder: { label: "Verwonderen", tagline: "Jubilea en rariteiten in de kalender." },
    },
  },

  seo: {
    homeTitle: "Until — countdowns naar alles wat komt",
    siteDescription:
      "Duizenden toekomstige datums, gelabeld en tikkend. Feestdagen, eclipsen, WK’s, verkiezingen — en de datums die je zelf maakt.",
    titleTemplate: "%s · Until",

    event: {
      whenIs: "Wanneer is {title}? {when}",
      whenIsCoarse: "Wanneer is {title}? Verwacht in {period}",
      countdownColon: "{title} countdown: {when}",
      countdownDash: "{title} — aftellen naar {when}",
      countdownDashCoarse: "{title} — {when}",
      description: "{title}{status} is op {date}. {days} Live countdown en agenda-links.",
      descriptionCoarse:
        "{title} wordt verwacht in {period}. De exacte dag is nog niet bekend; de countdown start zodra die er is.",
      statusCancelled: " (afgelast)",
      statusPostponed: " (uitgesteld)",
      fallbackTitle: "Countdown",
      mineTitle: "Jouw countdown",
      sharedTitle: "Gedeelde countdown",
      sharedMetaTitle: "{title} — aftellen naar {date}",
      sharedMetaDescription: "{title} is op {date}. Een countdown die iemand op Until heeft gemaakt.",
    },

    series: {
      title: "Hoeveel dagen tot {title}? — {when}",
      titleNoDate: "Hoeveel dagen tot {title}?",
      heading: "Hoeveel dagen tot {title}?",
      description: "{title} is op {date}. {days} Live countdown, datums van elk jaar, agenda-links.",
      descriptionCoarse:
        "De volgende {title} wordt verwacht in {period}. Datums van elk jaar, live countdown, agenda-links.",
      descriptionNoDate: "{title}: aankomende datums, een live countdown naar de eerstvolgende en agenda-links.",
      fallbackTitle: "Hoeveel dagen tot",
    },

    hub: {
      category: "{category}: aankomende datums en countdowns",
      country: "{country}: aankomende feestdagen en evenementen",
      month: "Wat komt eraan in {month}? Datums en countdowns",
      tag: "Aankomende datums rond {tag}, met countdown",
      lowercaseCategory: false,
    },

    days: {
      today: "Dat is vandaag.",
      tomorrow: "Dat is morgen.",
      yesterday: "Dat was gisteren.",
      away: { one: "Dat is over {n} dag.", other: "Dat is over {n} dagen." } as PluralForms,
      ago: { one: "Dat was {n} dag geleden.", other: "Dat was {n} dagen geleden." } as PluralForms,
    },

    period: {
      month: "{month} {year}",
      quarter: "Q{q} {year}",
      year: "{year}",
      expected: "verwacht in {period}",
      unknown: "datum nog niet bekend",
    },

    jsonLd: {
      siteDescription:
        "Live countdowns en datums voor duizenden aankomende evenementen, feestdagen en mijlpalen.",
      seriesDescription: "Aankomende datums van {title}.",
    },
  },

  home: {
    loading: "De catalogus laden",

    hero: {
      eyebrow: "Uitgelichte countdown",
      meta: "{category} · {when}",
      open: "Open deze countdown",
    },

    hub: {
      alsoOnTheHorizon: "Ook aan de horizon",
      next7Days: "De komende 7 dagen",
      wholeMonth: "Hele maand →",
      browseByCategory: "Bladeren op categorie",
      allCategories: "Alle categorieën →",
      popularCountdowns: "Populaire countdowns",
      everyRecurringDate: "Alle jaarlijkse datums →",
      byCountry: "Per land",
      allCountries: "Alle landen →",
      noCountries: "De landgegevens worden nog aangevuld.",
      byMonth: "Per maand",
      thisMonth: "Deze maand — {month}",
      nextMonth: "Volgende maand — {month}",
    },

    explorer: {
      heading: "De catalogus",
      count: { one: "{n} aankomende datum.", other: "{n} aankomende datums." } as PluralForms,
      countMatching: {
        one: "{n} aankomende datum voor “{q}”.",
        other: "{n} aankomende datums voor “{q}”.",
      } as PluralForms,
      countInCategory: {
        one: "{category}: {n} aankomende datum.",
        other: "{category}: {n} aankomende datums.",
      } as PluralForms,
      countMatchingInCategory: {
        one: "{category}: {n} aankomende datum voor “{q}”.",
        other: "{category}: {n} aankomende datums voor “{q}”.",
      } as PluralForms,
      sort: {
        soonest: "Eerstvolgend",
        popular: "Populair",
        latest: "Verst weg",
      },
    },

    filters: {
      all: "Alles",
    },

    empty: {
      noMatch: "Niets in de catalogus komt overeen met “{q}”.",
      nothing: "Hier staat nog niets.",
      hint: "Spelfouten worden vergeven en initialen werken ook, dus een bijna-treffer komt meestal wel aan — dit lijkt een datum die de catalogus niet heeft.",
      busiest: "Drukste categorieën",
      everyRecurringDate: "Alle jaarlijkse datums",
      startOver: "Opnieuw beginnen",
    },

    table: {
      date: "Datum",
      event: "Evenement",
      within: "Over",
      category: "Categorie",
      empty: "Hier staat nog niets gepland.",
    },

    pagination: "Paginering",
  },

  event: {
    answer: {
      today: "{title} is vandaag, {date}.",
      tomorrow: "Nog {n} dag tot {title}: morgen, {date}.",
      days: {
        one: "Nog {n} dag tot {title}, op {date}.",
        other: "Nog {n} dagen tot {title}, op {date}.",
      } as PluralForms,
      past: {
        one: "{title} was {n} dag geleden, op {date}.",
        other: "{title} was {n} dagen geleden, op {date}.",
      } as PluralForms,
      cancelled: "{title} stond gepland voor {date} en is afgelast.",
      coarse: "{title} wordt verwacht in {period}. De exacte dag is nog niet bekendgemaakt.",
      plain: "{title} is op {date}.",
    },

    statusHappened: "Geweest",

    dateRange: "{start} – {end}",

    coarseNote:
      "De exacte dag is nog niet bekendgemaakt. Deze pagina begint te tikken zodra de bron er een publiceert.",
    dateChanged: "Datum gewijzigd: eerder {date}.",
    partOfSeries: "Onderdeel van de reeks {series} — elk jaar, met de eerstvolgende datum altijd bovenaan.",
    everyUpcomingDate: "Alle aankomende datums",
    otherYears: "Andere jaren",
    alsoComing: "Komt er ook aan",

    fields: {
      where: "Waar",
      tags: "Labels",
    },

    provenance: {
      source: "Bron:",
      lastVerified: "laatst gecontroleerd op {date}",
      summary: "Samenvatting van {source} ({license})",
    },

    image: {
      photo: "Foto",
      photoBy: "Foto:",
      via: "via {provider}",
    },

    mine: {
      missingTitle: "Deze countdown staat op een ander apparaat",
      missingBody:
        "Persoonlijke countdowns worden bewaard in de browser waarin ze gemaakt zijn. Heeft iemand je een link gestuurd? Vraag dan om de deelbare URL van de maakpagina.",
      makeNew: "Maak een nieuwe",
      onThisDevice: "Op dit apparaat",
      remove: "Verwijderen",
      savedCount: {
        one: "{n} datum uit de catalogus bewaard in deze browser.",
        other: "{n} datums uit de catalogus bewaard in deze browser.",
      } as PluralForms,
    },
  },

  series: {
    index: {
      title: "Hoeveel dagen tot… — elke terugkerende countdown",
      description:
        "Kerstmis, de ramadan, de Super Bowl, de Perseïden: elke terugkerende datum in de catalogus, met de eerstvolgende bovenaan en een tabel met de jaren die komen.",
      heading: "Hoeveel dagen tot…",
      intro: {
        one: "{n} datum die elk jaar terugkomt. Elke pagina houdt de eerstvolgende keer bovenaan en toont de jaren die komen.",
        other:
          "{n} datums die elk jaar terugkomen. Elke pagina houdt de eerstvolgende keer bovenaan en toont de jaren die komen.",
      } as PluralForms,
      empty: "De catalogus wordt gevuld — kom snel terug.",
      jsonLdDescription: "Terugkerende datums met de eerstvolgende keer en een tabel over meerdere jaren.",
    },

    noUpcoming: "Er staat nog geen aankomende datum voor {title} in de catalogus.",

    thisYearsPage: "De pagina van dit jaar",

    shareTitle: "Hoeveel dagen tot {title}",

    upcoming: {
      heading: "Aankomende datums",
      note: "Elke {title} in de catalogus vanaf vandaag, de eerstvolgende bovenaan.",
      empty: "Nog geen toekomstige datums — kom terug na de volgende verversing.",
    },

    variants: {
      heading: "Andere datums bij deze reeks",
      note: "In een paar landen valt dit onder dezelfde naam op een andere dag — apart gezet, zodat de countdown hierboven op de hoofddatum blijft staan.",
    },

    faqHeading: "Wat mensen vragen",

    tagsLabel: "Labels:",

    related: {
      heading: "{category}: meer datums die elk jaar terugkomen",
      all: "Alle terugkerende countdowns",
    },
  },

  hubs: {
    label: {
      browse: "Ontdekken",
      category: "Categorie",
      country: "Land",
      calendar: "Kalender",
      tag: "Label",
    },

    breadcrumbLabel: "Kruimelpad",

    paged: {
      title: "{name} (pagina {n})",
      headingSuffix: "— pagina {n}",
      backToFirst: "Terug naar de eerste pagina.",
    },

    categoryIndex: {
      title: "Categorieën — elk soort datum dat nog moet komen",
      description:
        "Blader per categorie door alles wat eraan komt: feestdagen, sport, film en tv, games, ruimtevaart, verkiezingen en jubilea, elk met live countdown.",
      heading: "Elk soort datum",
      intro: "Drieëntwintig categorieën, gegroepeerd naar wat je ermee zou doen.",
      collectionDescription: "Aankomende datums per categorie.",
    },

    category: {
      description: {
        one: "{blurb} {n} aankomende datum met live countdown en agenda-links.",
        other: "{blurb} {n} aankomende datums met live countdowns en agenda-links.",
      } as PluralForms,
      descriptionEmpty: "{blurb} Aankomende datums met live countdowns en agenda-links.",
      descriptionPaged:
        "{blurb} Pagina {n} van de aankomende datums, met live countdowns en agenda-links.",
      heading: "{category}: wat er aankomt",
      count: { one: "{n} aankomende datum.", other: "{n} aankomende datums." } as PluralForms,
      countPaged: {
        one: "{n} aankomende datum, de eerstvolgende bovenaan.",
        other: "{n} aankomende datums, de eerstvolgende bovenaan.",
      } as PluralForms,
      soon: "De komende 30 dagen",
      everyYear: "Elk jaar",
      all: "{category}: alles wat eraan komt",
      empty: "Nog niets in deze categorie.",
    },

    countryIndex: {
      title: "Landen — aankomende feestdagen en evenementen per land",
      description:
        "Officiële feestdagen, nationale dagen en lokale evenementen uit meer dan 200 landen en gebieden, elk met live countdown en agenda-links.",
      heading: "Per land",
      intro: {
        one: "{n} land of gebied met aankomende feestdagen en evenementen in de catalogus.",
        other: "{n} landen en gebieden met aankomende feestdagen en evenementen in de catalogus.",
      } as PluralForms,
      empty: "De catalogus wordt gevuld — kom snel terug.",
      collectionDescription: "Aankomende feestdagen en evenementen per land.",
    },

    country: {
      description: {
        one: "{country}: feestdagen, nationale dagen en evenementen — {n} aankomende datum, per maand gegroepeerd, met live countdown en agenda-links.",
        other:
          "{country}: feestdagen, nationale dagen en evenementen — {n} aankomende datums, per maand gegroepeerd, elk met live countdown en agenda-links.",
      } as PluralForms,
      descriptionEmpty:
        "{country}: feestdagen, nationale dagen en evenementen, per maand gegroepeerd, elk met live countdown en agenda-links.",
      intro:
        "Aankomende feestdagen en evenementen met het label {country}, maand voor maand. Wereldwijde datums — eclipsen, releases, internationale dagen — staan hieronder apart.",
      count: { one: "{n} aankomende datum.", other: "{n} aankomende datums." } as PluralForms,
      countCapped: { one: "{n}+ aankomende datum.", other: "{n}+ aankomende datums." } as PluralForms,
      empty: "Nog geen datums met het label {country}.",
      worldwide: "Wereldwijd, binnenkort",
      collectionDescription: "{country}: feestdagen en evenementen.",
    },

    calendar: {
      description:
        "Alles wat de catalogus heeft voor {month}: feestdagen, lanceringen, finales, premières en jubilea, dag voor dag, met live countdowns.",
      count: {
        one: "{n} aankomende datum in {month}, dag voor dag.",
        other: "{n} aankomende datums in {month}, dag voor dag.",
      } as PluralForms,
      empty: "Nog niets gepland in {month}.",
      months: "Maanden",
      previous: "← {month}",
      next: "{month} →",
      collectionDescription: "Aankomende datums in {month}.",
    },

    tag: {
      description: {
        one: "{n} aankomende datum met het label “{tag}”, de eerstvolgende bovenaan, met live countdown en agenda-links.",
        other:
          "{n} aankomende datums met het label “{tag}”, de eerstvolgende bovenaan, elk met live countdown en agenda-links.",
      } as PluralForms,
      descriptionPaged:
        "Pagina {n} van de aankomende datums met het label “{tag}”, de eerstvolgende bovenaan, elk met live countdown en agenda-links.",
      crumb: "#{tag}",
      count: {
        one: "{n} aankomende datum met het label “{tag}”, de eerstvolgende bovenaan.",
        other: "{n} aankomende datums met het label “{tag}”, de eerstvolgende bovenaan.",
      } as PluralForms,
      searchPrompt: "Zoek je iets anders?",
      searchLink: "Doorzoek de hele catalogus op “{tag}”.",
      collectionDescription: "Aankomende datums met het label {tag}.",
    },
  },

  pages: {
    about: {
      title: "Over Until",
      description: "Hoe Until duizenden toekomstige datums verzamelt, labelt en indeelt.",
      eyebrow: "Het project",
      heading: "Een krant van de toekomst",

      intro:
        "Until is een catalogus van datums die nog niet gebeurd zijn. Officiële feestdagen uit bijna elk land, geplande evenementen uit de jaarpagina’s van Wikipedia en uit Wikidata, plus een samengestelde laag met de datums waar mensen echt op wachten — eclipsen, WK’s, Olympische Spelen, verkiezingen, de komeet van Halley.",
      categories:
        "Elke regel is gelabeld en ingedeeld in {n} categorieën — feestdagen, nationale dagen, sport, astronomie, ruimtevaart, tech, politiek, geschiedenis en meer. Doorzoek de hele set, filter op categorie, open een live countdown en zet die in je agenda.",
      sources:
        "De ruggengraat voor feestdagen is de offline dataset {dateHolidays}, aangevuld met {wikidata} en {wikipedia}. Dezelfde naam op dezelfde dag (Kerstmis in 140 landen) wordt samengevoegd tot één countdown. Spreken bronnen elkaar tegen, dan wint het samengestelde record. Elke evenementpagina noemt de bron en wanneer de datum voor het laatst is gecontroleerd.",
      expected:
        "Datums zonder bevestigde dag krijgen het label “verwacht”, met de maand, het kwartaal of het jaar dat de bron geeft, en ze gaan pas tikken zodra er een echte datum is gepubliceerd. De catalogus wordt dagelijks ververst vanuit zijn bronnen.",
      yourOwn:
        "Je kunt er zelf een maken. Die blijven in je browser — geen account — en de deellink zet de titel en de datum in de URL, zodat iedereen dezelfde tikkende klok kan openen.",

      stats: {
        dates: "Datums",
        featured: "Uitgelicht",
        updated: "Bijgewerkt",
      },

      byCategory: {
        heading: "Per categorie",
        empty: "De catalogus wordt gevuld — kom snel terug.",
      },

      bySource: {
        heading: "Per bron",
        empty: "Nog geen bronnen gemeld.",
      },
    },

    attributions: {
      title: "Bronvermelding — waar de datums vandaan komen",
      description:
        "Elke bron achter de catalogus van Until, met licentie en de gevraagde vermelding: date-holidays, Wikipedia, Wikidata, Hebcal, Launch Library en meer.",
      eyebrow: "Bronnen",
      heading: "Bronvermelding",
      intro:
        "Until neemt alleen bronnen op waarvan de voorwaarden het opslaan en herpubliceren van de gegevens toestaan. Bronnen met een share-alike-licentie (tekst van Wikipedia, TVMaze, gegevens van date-holidays) worden vermeld op elke pagina die ze gebruikt; afbeeldingen worden alleen opnieuw gehost onder CC0, publiek domein, CC BY of CC BY-SA, met de maker erbij. Elke evenementpagina linkt terug naar het record waaruit ze is opgebouwd.",
      sourcesEmpty: "De bronnenlijst is op dit moment niet beschikbaar.",

      images: {
        heading: "Afbeeldingen",
        policy:
          "Foto’s zijn opnieuw gehoste kopieën, verkleind en geserveerd vanaf onze eigen opslag, zodat er nooit naar de oorspronkelijke host wordt gehotlinkt. Alleen vrij gelicentieerde bestanden worden geaccepteerd — CC0, publiek domein, CC BY, CC BY-SA en een paar nationale open-overheidslicenties, plus beeldmateriaal van NASA onder zijn mediarichtlijnen. Bestanden onder fair use en licenties met niet-commercieel (NC) of geen-afgeleiden (ND) worden geweigerd, net als bestanden met een merk- of portretrechtbeperking, en elk opgeslagen bestand houdt zijn maker, licentie en een link terug naar de bestandspagina. Evenementen zonder vrije foto krijgen een gegenereerde kaart.",
        shareAlike:
          "Foto’s met een share-alike-licentie (CC BY-SA) worden ongewijzigd gepubliceerd, op hun eigen verhoudingen, met de vermelding eronder. Ze worden nooit bijgesneden tot een socialkaart: die samenstelling zou een afgeleid werk zijn en dezelfde share-alike-licentie moeten dragen, dus die kaarten gebruiken het gegenereerde ontwerp. Opgeslagen bestanden worden maandelijks opnieuw bij hun bron gecontroleerd; is er een verwijderd of niet langer vrij, dan halen we het uit onze opslag en vallen de pagina’s terug op de gegenereerde kaart.",
        empty: "Nog geen opnieuw gehoste afbeeldingen.",
        count: {
          one: "{n} afbeelding in de bibliotheek vandaag:",
          other: "{n} afbeeldingen in de bibliotheek vandaag:",
        } as PluralForms,
      },

      fonts:
        "Lettertypen: Fraunces (SIL Open Font License) en Geist (SIL Open Font License). Astronomie berekend met astronomy-engine (MIT).",
    },

    create: {
      title: "Een countdown maken",
      description: "Maak een persoonlijke countdown en zet die in je agenda.",
      eyebrow: "Jouw datums",
      heading: "Maak een countdown",
      intro:
        "Verjaardagen, een lancering, een reis, een zitting, een reünie. Hij tikt net als de catalogus — en je zet hem zo in Google Calendar, Outlook of een .ics-bestand.",

      form: {
        draftTitle: "Iets waar ik op wacht",
        draftNote: "Een countdown die je zelf gemaakt hebt.",
        titleLabel: "Titel",
        dateLabel: "Datum",
        categoryLabel: "Categorie",
        noteLabel: "Notitie",
        notePlaceholder: "Waarom deze datum voor jou telt.",
        save: "Bewaren op dit apparaat",
        openShareable: "Deelbare pagina openen",
        saved: "Bewaard. {link} — hij blijft in deze browser tot je je opslag wist.",
        savedLink: "Bekijk hem",
        privacy:
          "Eigen countdowns blijven op je apparaat (geen account). De deellink zet de titel en de datum in de URL.",
        previewLabel: "Live voorbeeld",
        chooseDate: "Kies een datum om de klok te starten.",
      },
    },

    notFound: {
      heading: "Deze datum staat niet in de catalogus",
      body: "Misschien is hij samengevoegd of hernoemd, of heeft hij nooit bestaan.",
      backHome: "Terug naar alles wat komt",
    },
  },

  embed: {
    countdown: {
      units: {
        days: { one: "dag", other: "dagen" } as PluralForms,
        hours: "uur",
        minutes: "min",
        seconds: "sec",
      },
      today: "Vandaag.",
      past: "Dit is al geweest.",
    },

    studio: {
      heading: "Neem hem mee",

      controls: {
        preset: "Voorinstelling",
        digits: "Cijfers",
        type: "Type",
        background: "Achtergrond",
        transparent: "Transparant — laat de scène of de pagina erdoorheen zien",
        font: "Lettertype",
        size: "Grootte",
        layout: "Indeling",
        units: "Eenheden",
        separator: "Scheidingsteken",
        frame: "Kader",
        radius: "Hoekafronding",
        inset: "Marge tot de rand",
        position: "Positie",
        done: "Eindbericht",
        reset: "Herstellen",
        colourPicker: "{label} — kleurkiezer",
      },

      toggles: {
        unitLabels: "Labels bij eenheden",
        title: "Titel",
        date: "Datum",
        note: "Notitie",
        wordmark: "Woordmerk",
        glow: "Gloed",
        trim: "Voorloopnullen weglaten",
      },

      presets: {
        dark: "Until donker",
        light: "Licht",
        amber: "Amber",
        mono: "Mono",
        neon: "Neon",
        clear: "Transparant",
      },

      fonts: {
        serif: "Schreef",
        sans: "Schreefloos",
        mono: "Mono",
      },

      layouts: {
        row: "Rij",
        stack: "Gestapeld",
        compact: "Compact",
        big: "Eén groot getal",
      },

      separators: {
        colon: "Dubbele punt",
        dot: "Punt",
        space: "Spatie",
        none: "Geen",
      },

      frames: {
        card: "Kaart",
        outline: "Omlijning",
        none: "Geen",
      },

      units: {
        dhms: "Dagen · uren · minuten · seconden",
        dhm: "Dagen · uren · minuten",
        dh: "Dagen · uren",
        d: "Dagen",
        hms: "Uren · minuten · seconden",
        hm: "Uren · minuten",
        ms: "Minuten · seconden",
      },

      positions: {
        "top-left": "Linksboven",
        top: "Boven",
        "top-right": "Rechtsboven",
        left: "Links",
        center: "Midden",
        right: "Rechts",
        "bottom-left": "Linksonder",
        bottom: "Onder",
        "bottom-right": "Rechtsonder",
      },

      copy: {
        code: "Code kopiëren",
        url: "URL kopiëren",
      },

      embed: {
        previewTitle: "Voorbeeld van de embed",
        paste: "Plak dit in je pagina",
        codeLabel: "Embedcode",
        note: "Hij komt binnen op volle breedte en {height}px hoog. WordPress, Ghost en Notion accepteren ook gewoon de link van de countdown en vinden de embed dan zelf — maar dan krijg je de standaardkaart, dus plak de code hierboven om te houden wat je hier gebouwd hebt.",
      },

      stream: {
        previewTitle: "Voorbeeld van de streamoverlay",
        canvasNote: "Het canvas van {width} × {height}, verkleind — het schaakbordpatroon is wat OBS wegfiltert.",
        urlLabel: "URL voor de browserbron",
        source: "Browserbron · {width} × {height}",
        steps: [
          "Voeg in OBS of Streamlabs een Browser-bron toe.",
          "Plak de URL hierboven.",
          "Zet de grootte op {width} × {height} — het canvas waartegen de positie gemeten wordt.",
          "Laat de achtergrond transparant; de overlay brengt zijn eigen achtergrond mee.",
          "Vink “Browser vernieuwen wanneer scène actief wordt” aan, zodat de klok opnieuw begint.",
        ],
      },
    },
  },
};
