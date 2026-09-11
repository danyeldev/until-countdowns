/**
 * Italian messages. See `en/` for what each key is for.
 *
 * Four decisions a maintainer should not undo:
 * - "Quanti giorni mancano a {title}?" carries the series URL, title and `<h1>` alike, because that
 *   is the query Italians type. The event pages take "Quando è {title}?" and "Conto alla rovescia
 *   per {title}", so both phrasings are covered without two page types competing for one.
 * - `lowercaseCategory` is false. Italian would need "di / dello / della / dei" in front of a
 *   category label and the gender is not knowable from here, so every `{category}`, `{country}` and
 *   `{month}` slot opens its clause (with a colon after it) or sits behind an agreement-free
 *   preposition — "nella categoria {category}", "nel mese di {month}", "con l’etichetta {country}".
 *   At the head of a clause the label's own capital is the right one.
 * - No template puts a definite article in front of `{title}`, and none puts a preposition there
 *   either. Italian picks the article by gender and number and then fuses it into the preposition —
 *   "alle Olimpiadi", "ai Mondiali", "dall’Epifania" — and nothing here knows which one an entity
 *   takes. So `{title}` opens its clause, followed by a colon; the verb then agrees with "giorni",
 *   which is always plural, instead of with a title that might be either.
 * - For the same reason no sentence puts a copula or a participle after `{title}`: "{title}: {date}"
 *   rather than "{title} è {date}" (a plural entity needs "sono"), and "l’evento è stato annullato"
 *   rather than "{title} è stato annullato".
 */
import type { Messages } from "./en";
import type { PluralForms } from "./types";

export const it: Messages = {
  common: {
    siteName: "Until",
    tagline: "un catalogo di cose che non sono ancora successe.",
    wordmarkLine: "Until — un catalogo di cose che non sono ancora successe.",

    nav: {
      categories: "Categorie",
      countries: "Paesi",
      daysUntil: "Quanti giorni mancano",
      create: "Crea",
      about: "Informazioni",
    },

    search: {
      label: "Cerca",
      navLabel: "Cerca un conto alla rovescia",
      placeholder: "Cerca nel catalogo…",
      navPlaceholder: "Cerca eclissi, Mondiali, festività…",
      submit: "Cerca",
    },

    breadcrumb: {
      home: "Home",
    },

    footer: {
      datesCount: { one: "{n} data", other: "{n} date" } as PluralForms,
      aboutTheData: "sui dati",
      attributions: "attribuzioni",
      categories: "Categorie",
      browse: "Esplora",
      all: "tutte →",
      makeYourOwn: "Crea il tuo",
      language: "Lingua",
    },

    actions: {
      share: "Condividi",
      shareCopied: "Link copiato",
      save: "Salva",
      saved: "Salvato",
      addToCalendar: "Aggiungi al calendario",
      google: "Google Calendar",
      outlook: "Outlook",
      downloadIcs: "Scarica .ics",
      embed: "Incorpora nel tuo sito",
      stream: "Aggiungi alla tua diretta",
      copy: "Copia",
      copied: "Copiato",
    },

    labels: {
      worldwide: "In tutto il mondo",
      countriesCount: { one: "{n} paese", other: "{n} paesi" } as PluralForms,
      recurring: "Ricorrente",
      series: "Serie",
      today: "Oggi",
      tba: "Da definire",
      dateToBeAnnounced: "una data ancora da annunciare",
      nothingHereYet: "Qui non c’è ancora niente",
      more: "Altro",
      seeAll: "Vedi tutto →",
      loading: "Caricamento…",
      source: "Fonte",
      sources: "Fonti",
      lastVerified: "Ultima verifica",
    },

    status: {
      scheduled: "In programma",
      tentative: "Provvisorio",
      postponed: "Rinviato",
      cancelled: "Annullato",
      done: "Concluso",
      retired: "Ritirato",
    },

    units: {
      days: "giorni",
      hours: "ore",
      minutes: "minuti",
      seconds: "secondi",
      daysShort: "g",
      hoursShort: "h",
      minutesShort: "m",
      secondsShort: "s",
    },

    pagination: {
      previous: "Precedente",
      next: "Successiva",
      page: "Pagina {n}",
      pageOf: "Pagina {n} di {total}",
    },

    languageSwitcher: {
      label: "Lingua",
      description: "Leggi Until in un’altra lingua",
    },
  },

  categories: {
    labels: {
      holidays: "Festività",
      national: "Feste nazionali",
      religion: "Religione",
      awareness: "Giornate mondiali",
      fun: "Giornate curiose",
      culture: "Cultura",
      festivals: "Festival",
      sports: "Sport",
      esports: "Esports",
      games: "Videogiochi",
      film: "Cinema",
      tv: "TV",
      anime: "Anime",
      music: "Musica",
      entertainment: "Intrattenimento",
      politics: "Politica",
      tech: "Tecnologia",
      science: "Scienza",
      space: "Spazio",
      astronomy: "Astronomia",
      nature: "Natura",
      history: "Storia",
      curiosities: "Curiosità",
    },

    blurbs: {
      holidays: "Giorni festivi e i riti che continuiamo a ripetere.",
      national: "Giorni dell’indipendenza, feste della repubblica, ricorrenze nazionali.",
      religion: "Feste, digiuni e giorni sacri di ogni religione.",
      awareness: "Giornate internazionali e ricorrenze dell’ONU.",
      fun: "Giornata della pizza, giornata del parlare come un pirata e altre scuse.",
      culture: "Festival, ricorrenze e calendario civile.",
      festivals: "Carnevali, fiere e raduni.",
      sports: "Finali, cerimonie d’apertura e il prossimo Mondiale.",
      esports: "Worlds, Major e The International.",
      games: "Date di uscita e presentazioni.",
      film: "Uscite al cinema e notti di premiazione.",
      tv: "Debutti e finali di stagione.",
      anime: "Inizi di stagione e film in uscita.",
      music: "Concorsi, tour e anniversari.",
      entertainment: "Date per i fan e giorni sacri della cultura pop.",
      politics: "Elezioni e le date che decidono la rotta dei paesi.",
      tech: "Conferenze, fine del supporto e gli orologi dei computer.",
      science: "Date per chi è curioso.",
      space: "Lanci, atterraggi e la lunga strada di ritorno sulla Luna.",
      astronomy: "Eclissi, sciami meteorici, solstizi: appuntamenti con il cielo.",
      nature: "La Terra, gli oceani e l’anno che vive.",
      history: "Anniversari di cose già successe, che continuano a scorrere.",
      curiosities: "Traguardi di Unix, date palindrome, venerdì 13.",
    },

    groups: {
      celebrate: { label: "Festeggiare", tagline: "Festività, ricorrenze e le scuse che ci teniamo strette." },
      watch: { label: "Guardare", tagline: "Finali, prime, tour e la prossima grande uscita." },
      play: { label: "Giocare", tagline: "Date di uscita e presentazioni." },
      "look-up": { label: "Guardare in alto", tagline: "Lanci, eclissi e l’anno che vive." },
      vote: { label: "Votare", tagline: "Elezioni, conferenze e gli orologi dei computer." },
      wonder: { label: "Stupirsi", tagline: "Anniversari e stranezze del calendario." },
    },
  },

  seo: {
    homeTitle: "Until — conti alla rovescia per tutto quello che deve arrivare",
    siteDescription:
      "Migliaia di date future, etichettate e in movimento. Festività, eclissi, Mondiali, elezioni — e quelle che crei tu.",
    titleTemplate: "%s · Until",

    event: {
      whenIs: "Quando è {title}? {when}",
      whenIsCoarse: "Quando è {title}? Data prevista: {period}",
      countdownColon: "Conto alla rovescia per {title}: {when}",
      countdownDash: "{title} — conto alla rovescia: {when}",
      countdownDashCoarse: "{title} — {when}",
      description: "{title}{status}: {date}. {days} Conto alla rovescia in tempo reale e calendario.",
      descriptionCoarse:
        "{title}: data prevista {period}. Il giorno esatto non è ancora annunciato. Conto alla rovescia appena lo sarà.",
      statusCancelled: " (annullato)",
      statusPostponed: " (rinviato)",
      fallbackTitle: "Conto alla rovescia",
      mineTitle: "Il tuo conto alla rovescia",
      sharedTitle: "Conto alla rovescia condiviso",
      sharedMetaTitle: "{title} — conto alla rovescia: {date}",
      sharedMetaDescription: "{title}: {date}. Un conto alla rovescia creato su Until.",
    },

    series: {
      title: "{title}: quanti giorni mancano? — {when}",
      titleNoDate: "{title}: quanti giorni mancano?",
      heading: "{title}: quanti giorni mancano?",
      description: "{title}: {date}. {days} Conto alla rovescia, date di ogni anno e calendario.",
      descriptionCoarse:
        "{title}: data prevista {period}. Date di ogni anno, conto alla rovescia e link al calendario.",
      descriptionNoDate: "{title}: le prossime date, il conto alla rovescia verso la prima e il calendario.",
      fallbackTitle: "Quanti giorni mancano",
    },

    hub: {
      category: "{category}: prossime date e conti alla rovescia",
      country: "{country}: festività ed eventi in arrivo",
      month: "Calendario di {month}: tutte le date in arrivo",
      tag: "Date in arrivo e conti alla rovescia: {tag}",
      lowercaseCategory: false,
    },

    days: {
      today: "È oggi.",
      tomorrow: "È domani.",
      yesterday: "Era ieri.",
      away: { one: "Manca {n} giorno.", other: "Mancano {n} giorni." } as PluralForms,
      ago: { one: "È passato {n} giorno.", other: "Sono passati {n} giorni." } as PluralForms,
    },

    period: {
      month: "{month} {year}",
      quarter: "{q}º trimestre {year}",
      year: "{year}",
      expected: "previsto per {period}",
      unknown: "data da annunciare",
    },

    jsonLd: {
      siteDescription:
        "Conti alla rovescia e date di migliaia di eventi, festività e traguardi in arrivo.",
      seriesDescription: "Prossime date di {title}.",
    },
  },

  home: {
    loading: "Caricamento del catalogo",

    hero: {
      eyebrow: "Conto alla rovescia in evidenza",
      meta: "{category} · {when}",
      open: "Apri questo conto alla rovescia",
    },

    hub: {
      alsoOnTheHorizon: "Anche all’orizzonte",
      next7Days: "Prossimi 7 giorni",
      wholeMonth: "Tutto il mese →",
      browseByCategory: "Esplora per categoria",
      allCategories: "Tutte le categorie →",
      popularCountdowns: "Conti alla rovescia popolari",
      everyRecurringDate: "Tutte le date ricorrenti →",
      byCountry: "Per paese",
      allCountries: "Tutti i paesi →",
      noCountries: "I dati per paese si stanno completando.",
      byMonth: "Per mese",
      thisMonth: "Questo mese — {month}",
      nextMonth: "Il mese prossimo — {month}",
    },

    explorer: {
      heading: "Il catalogo",
      count: { one: "{n} data in arrivo.", other: "{n} date in arrivo." } as PluralForms,
      countMatching: {
        one: "{n} data in arrivo che corrisponde a “{q}”.",
        other: "{n} date in arrivo che corrispondono a “{q}”.",
      } as PluralForms,
      countInCategory: {
        one: "{n} data in arrivo nella categoria {category}.",
        other: "{n} date in arrivo nella categoria {category}.",
      } as PluralForms,
      countMatchingInCategory: {
        one: "{n} data in arrivo nella categoria {category} che corrisponde a “{q}”.",
        other: "{n} date in arrivo nella categoria {category} che corrispondono a “{q}”.",
      } as PluralForms,
      sort: {
        soonest: "Più vicine",
        popular: "Popolari",
        latest: "Più lontane",
      },
    },

    filters: {
      all: "Tutte",
    },

    empty: {
      noMatch: "Nel catalogo non c’è niente che corrisponda a “{q}”.",
      nothing: "Qui non c’è ancora niente.",
      hint: "Gli errori di battitura sono perdonati e bastano anche le iniziali, quindi anche un quasi-centro dovrebbe funzionare: questa sembra una data che il catalogo non ha.",
      busiest: "Categorie più affollate",
      everyRecurringDate: "Tutte le date ricorrenti",
      startOver: "Ricomincia",
    },

    table: {
      date: "Data",
      event: "Evento",
      within: "Tra quanto",
      category: "Categoria",
      empty: "Qui non c’è ancora niente in programma.",
    },

    pagination: "Paginazione",
  },

  event: {
    answer: {
      today: "{title}: oggi, {date}.",
      tomorrow: "{title}: manca {n} giorno, domani {date}.",
      days: {
        one: "{title}: manca {n} giorno, {date}.",
        other: "{title}: mancano {n} giorni, {date}.",
      } as PluralForms,
      past: {
        one: "{title}: è passato {n} giorno, {date}.",
        other: "{title}: sono passati {n} giorni, {date}.",
      } as PluralForms,
      cancelled: "{title} era in programma per {date}: l’evento è stato annullato.",
      coarse: "{title}: la data prevista è {period}. Il giorno esatto non è ancora stato annunciato.",
      plain: "{title}: {date}.",
    },

    statusHappened: "Già passato",

    dateRange: "dal {start} al {end}",

    coarseNote:
      "Il giorno esatto non è ancora stato annunciato. Questa pagina inizierà a scorrere appena la fonte lo pubblica.",
    dateChanged: "Data cambiata: prima era {date}.",
    partOfSeries: "Fa parte della serie {series}: ogni anno, con la prossima data sempre in cima.",
    everyUpcomingDate: "Tutte le date in arrivo",
    otherYears: "Altri anni",
    alsoComing: "In arrivo anche",

    fields: {
      where: "Dove",
      tags: "Etichette",
    },

    provenance: {
      source: "Fonte:",
      lastVerified: "verificato l’ultima volta il {date}",
      summary: "Riassunto da {source} ({license})",
    },

    image: {
      photo: "Foto",
      photoBy: "Foto:",
      via: "via {provider}",
    },

    mine: {
      missingTitle: "Questo conto alla rovescia vive su un altro dispositivo",
      missingBody:
        "I conti alla rovescia personali restano nel browser che li ha creati. Se qualcuno ti ha mandato un link, chiedigli l’URL da condividere che trova nella pagina di creazione.",
      makeNew: "Creane uno nuovo",
      onThisDevice: "Su questo dispositivo",
      remove: "Rimuovi",
      savedCount: {
        one: "{n} data del catalogo salvata in questo browser.",
        other: "{n} date del catalogo salvate in questo browser.",
      } as PluralForms,
    },
  },

  series: {
    index: {
      title: "Quanti giorni mancano — tutti i conti alla rovescia che tornano ogni anno",
      description:
        "Natale, Ramadan, il Super Bowl, le Perseidi: ogni data che torna ogni anno, con la prossima in cima e una tabella degli anni che verranno.",
      heading: "Quanti giorni mancano a…",
      intro: {
        one: "{n} data che torna ogni anno. Ogni pagina tiene in cima la prossima ed elenca gli anni che verranno.",
        other:
          "{n} date che tornano ogni anno. Ogni pagina tiene in cima la prossima ed elenca gli anni che verranno.",
      } as PluralForms,
      empty: "Il catalogo si sta riempiendo: torna presto.",
      jsonLdDescription: "Date ricorrenti, con la prossima occorrenza e una tabella pluriennale.",
    },

    noUpcoming: "Nel catalogo non c’è ancora una data in arrivo per {title}.",

    thisYearsPage: "La pagina di quest’anno",

    shareTitle: "Quanti giorni mancano a {title}",

    upcoming: {
      heading: "Prossime date",
      note: "Ogni {title} nel catalogo da oggi in poi, dalla più vicina.",
      empty: "Ancora nessuna data futura: torna dopo il prossimo aggiornamento.",
    },

    variants: {
      heading: "Altre date legate a questa serie",
      note: "In qualche paese si celebra con lo stesso nome in un giorno diverso: sono elencate a parte, così il conto alla rovescia qui sopra resta sulla data principale.",
    },

    faqHeading: "Le domande più frequenti",

    tagsLabel: "Etichette:",

    related: {
      heading: "Altre ricorrenze annuali nella categoria {category}",
      all: "Tutti i conti alla rovescia ricorrenti",
    },
  },

  hubs: {
    label: {
      browse: "Esplora",
      category: "Categoria",
      country: "Paese",
      calendar: "Calendario",
      tag: "Etichetta",
    },

    breadcrumbLabel: "Percorso di navigazione",

    paged: {
      title: "{name} (pagina {n})",
      headingSuffix: "— pagina {n}",
      backToFirst: "Torna alla prima pagina.",
    },

    categoryIndex: {
      title: "Categorie — tutti i tipi di data che non sono ancora arrivati",
      description:
        "Esplora le date in arrivo per categoria: festività, sport, cinema e TV, videogiochi, spazio, elezioni, anniversari e altro, con i conti alla rovescia.",
      heading: "Tutti i tipi di data",
      intro: "Ventitré categorie, raggruppate per quello che ci faresti.",
      collectionDescription: "Date in arrivo per categoria.",
    },

    category: {
      description: {
        one: "{blurb} {n} data in arrivo, con conto alla rovescia e link al calendario.",
        other: "{blurb} {n} date in arrivo, con conti alla rovescia e link al calendario.",
      } as PluralForms,
      descriptionEmpty: "{blurb} Le date in arrivo, con conti alla rovescia e link al calendario.",
      descriptionPaged:
        "{blurb} Pagina {n} delle date in arrivo, dalla più vicina, con conti alla rovescia e link al calendario.",
      heading: "{category}: le prossime date",
      count: { one: "{n} data in arrivo.", other: "{n} date in arrivo." } as PluralForms,
      countPaged: {
        one: "{n} data in arrivo, dalla più vicina.",
        other: "{n} date in arrivo, dalla più vicina.",
      } as PluralForms,
      soon: "Prossimi 30 giorni",
      everyYear: "Ogni anno",
      all: "{category}: tutte le date in arrivo",
      empty: "Ancora niente in questa categoria.",
    },

    countryIndex: {
      title: "Paesi — festività ed eventi in arrivo, paese per paese",
      description:
        "Giorni festivi, feste nazionali ed eventi locali di oltre 200 paesi e territori, ognuno con conto alla rovescia e link al calendario.",
      heading: "Per paese",
      intro: {
        one: "{n} paese o territorio con festività ed eventi in arrivo nel catalogo.",
        other: "{n} paesi e territori con festività ed eventi in arrivo nel catalogo.",
      } as PluralForms,
      empty: "Il catalogo si sta riempiendo: torna presto.",
      collectionDescription: "Festività ed eventi in arrivo, paese per paese.",
    },

    country: {
      description: {
        one: "{country}: festività, feste nazionali ed eventi — {n} data in arrivo, mese per mese, con conto alla rovescia e link al calendario.",
        other:
          "{country}: festività, feste nazionali ed eventi — {n} date in arrivo, mese per mese, ognuna con conto alla rovescia e link al calendario.",
      } as PluralForms,
      descriptionEmpty:
        "{country}: festività, feste nazionali ed eventi, mese per mese, ognuno con conto alla rovescia e link al calendario.",
      intro:
        "Festività ed eventi in arrivo con l’etichetta {country}, mese per mese. Le date mondiali — eclissi, uscite, giornate internazionali — sono elencate a parte qui sotto.",
      count: { one: "{n} data in arrivo.", other: "{n} date in arrivo." } as PluralForms,
      countCapped: { one: "{n}+ data in arrivo.", other: "{n}+ date in arrivo." } as PluralForms,
      empty: "Ancora nessuna data con l’etichetta {country}.",
      worldwide: "In tutto il mondo, in arrivo",
      collectionDescription: "{country}: festività ed eventi.",
    },

    calendar: {
      description:
        "Tutto il catalogo nel mese di {month}: festività, lanci, finali, uscite e anniversari, giorno per giorno, con i conti alla rovescia.",
      count: {
        one: "{n} data in arrivo nel mese di {month}, giorno per giorno.",
        other: "{n} date in arrivo nel mese di {month}, giorno per giorno.",
      } as PluralForms,
      empty: "Ancora niente in programma per {month}.",
      months: "Mesi",
      previous: "← {month}",
      next: "{month} →",
      collectionDescription: "Date in arrivo nel mese di {month}.",
    },

    tag: {
      description: {
        one: "{n} data in arrivo con l’etichetta “{tag}”, con conto alla rovescia e link al calendario.",
        other:
          "{n} date in arrivo con l’etichetta “{tag}”, dalla più vicina, ognuna con conto alla rovescia e link al calendario.",
      } as PluralForms,
      descriptionPaged:
        "Pagina {n} delle date in arrivo con l’etichetta “{tag}”, dalla più vicina, ognuna con conto alla rovescia e link al calendario.",
      crumb: "#{tag}",
      count: {
        one: "{n} data in arrivo con l’etichetta “{tag}”.",
        other: "{n} date in arrivo con l’etichetta “{tag}”, dalla più vicina.",
      } as PluralForms,
      searchPrompt: "Cerchi qualcos’altro?",
      searchLink: "Cerca “{tag}” in tutto il catalogo.",
      collectionDescription: "Date in arrivo con l’etichetta {tag}.",
    },
  },

  pages: {
    about: {
      title: "Informazioni",
      description: "Come Until raccoglie, etichetta e classifica migliaia di date future.",
      eyebrow: "Il progetto",
      heading: "Un giornale del futuro",

      intro:
        "Until è un catalogo di date che non sono ancora arrivate. Giorni festivi di quasi tutti i paesi, eventi in programma raccolti dalle pagine degli anni di Wikipedia e da Wikidata, più uno strato curato di quelli che la gente aspetta davvero: eclissi, Mondiali, Olimpiadi, elezioni, la cometa di Halley.",
      categories:
        "Ogni riga è etichettata e classificata in {n} categorie: festività, feste nazionali, sport, astronomia, spazio, tecnologia, politica, storia e altro ancora. Cerca in tutto l’archivio, filtra una categoria, apri un conto alla rovescia e aggiungilo al calendario.",
      sources:
        "La base delle festività è il dataset offline {dateHolidays}, ampliato con {wikidata} e {wikipedia}. I nomi che si ripetono lo stesso giorno (il Natale in 140 paesi) vengono uniti in un solo conto alla rovescia. Quando le fonti non concordano, vincono i record curati. Ogni pagina evento indica la sua fonte e quando la data è stata verificata l’ultima volta.",
      expected:
        "Le date senza un giorno confermato sono contrassegnate come “previste”, con il mese, il trimestre o l’anno che indica la fonte, e non iniziano a scorrere finché non viene pubblicata una data vera. Il catalogo si aggiorna ogni giorno dalle sue fonti.",
      yourOwn:
        "Puoi crearne uno tuo. Quelli restano nel browser — senza account — e il link di condivisione porta titolo e data nell’URL, così chiunque può aprire lo stesso orologio in movimento.",

      stats: {
        dates: "Date",
        featured: "In evidenza",
        updated: "Aggiornato",
      },

      byCategory: {
        heading: "Per categoria",
        empty: "Il catalogo si sta riempiendo: torna presto.",
      },

      bySource: {
        heading: "Per fonte",
        empty: "Ancora nessuna fonte registrata.",
      },
    },

    attributions: {
      title: "Attribuzioni — da dove arrivano le date",
      description:
        "Tutte le fonti dietro al catalogo di Until, con la licenza e l’attribuzione che chiedono: date-holidays, Wikipedia, Wikidata, Hebcal, Launch Library e altre.",
      eyebrow: "Fonti",
      heading: "Attribuzioni",
      intro:
        "Until acquisisce solo fonti le cui condizioni permettono di conservare e ripubblicare i dati. Le fonti con licenza share-alike (il testo di Wikipedia, TVMaze, i dati di date-holidays) sono citate su ogni pagina che le usa; le immagini vengono riospitate solo con licenze CC0, di pubblico dominio, CC BY o CC BY-SA, sempre con l’autore indicato. Ogni pagina evento rimanda al record da cui è stata costruita.",
      sourcesEmpty: "L’elenco delle fonti non è disponibile in questo momento.",

      images: {
        heading: "Immagini",
        policy:
          "Le foto sono copie riospitate, ridimensionate e servite dal nostro archivio, così i server originali non vengono mai collegati direttamente. Si accettano solo file con licenza libera — CC0, pubblico dominio, CC BY, CC BY-SA e qualche licenza nazionale di dati aperti — più le immagini della NASA secondo le sue linee guida. I file in fair use e le licenze non commerciali (NC) e senza opere derivate (ND) vengono rifiutati senza eccezioni, come i file con vincoli di marchio o di immagine personale, e ogni file conservato mantiene autore, licenza e un link alla pagina del file. Gli eventi senza una foto libera ricevono una scheda generata.",
        shareAlike:
          "Le foto share-alike (CC BY-SA) sono pubblicate senza modifiche, nelle loro proporzioni, con il credito sotto. Non vengono mai ritagliate dentro una scheda social: quel montaggio sarebbe un’opera derivata e dovrebbe portare la stessa licenza share-alike, quindi quelle schede usano il design generato. I file conservati vengono riverificati ogni mese sulla fonte; quello che è stato cancellato o non è più libero viene tolto dal nostro archivio e le sue pagine tornano alla scheda generata.",
        empty: "Ancora nessuna immagine riospitata.",
        count: {
          one: "{n} immagine nella libreria a oggi:",
          other: "{n} immagini nella libreria a oggi:",
        } as PluralForms,
      },

      fonts:
        "Caratteri: Fraunces (SIL Open Font License) e Geist (SIL Open Font License). Astronomia calcolata con astronomy-engine (MIT).",
    },

    create: {
      title: "Crea un conto alla rovescia",
      description: "Crea un conto alla rovescia personale e aggiungilo al calendario.",
      eyebrow: "Le tue date",
      heading: "Crea un conto alla rovescia",
      intro:
        "Compleanni, lanci, un viaggio, un’udienza, una rimpatriata. Scorre come quelli del catalogo, e puoi portarlo dritto su Google Calendar, su Outlook o in un file .ics.",

      form: {
        draftTitle: "Qualcosa che sto aspettando",
        draftNote: "Un conto alla rovescia creato da te.",
        titleLabel: "Titolo",
        dateLabel: "Data",
        categoryLabel: "Categoria",
        noteLabel: "Nota",
        notePlaceholder: "Perché questa data conta per te.",
        save: "Salva su questo dispositivo",
        openShareable: "Apri la pagina da condividere",
        saved: "Salvato. {link} — resta in questo browser finché non svuoti la memoria.",
        savedLink: "Guardalo",
        privacy:
          "I conti alla rovescia personali restano sul tuo dispositivo (senza account). Il link di condivisione codifica titolo e data nell’URL.",
        previewLabel: "Anteprima dal vivo",
        chooseDate: "Scegli una data per far partire l’orologio.",
      },
    },

    notFound: {
      heading: "Questa data non è nel catalogo",
      body: "Potrebbe essere stata unita, rinominata, o non essere mai esistita.",
      backHome: "Torna a tutto quello che deve arrivare",
    },
  },

  embed: {
    countdown: {
      units: {
        days: { one: "giorno", other: "giorni" } as PluralForms,
        hours: "ore",
        minutes: "min",
        seconds: "sec",
      },
      today: "È oggi.",
      past: "Questo è già passato.",
    },

    studio: {
      heading: "Portalo con te",

      controls: {
        preset: "Preset",
        digits: "Cifre",
        type: "Tipo",
        background: "Sfondo",
        transparent: "Trasparente — lascia passare la scena o la pagina",
        font: "Carattere",
        size: "Dimensione",
        layout: "Disposizione",
        units: "Unità",
        separator: "Separatore",
        frame: "Cornice",
        radius: "Raggio degli angoli",
        inset: "Margine dal bordo",
        position: "Posizione",
        done: "Messaggio finale",
        reset: "Reimposta",
        colourPicker: "{label} — selettore di colore",
      },

      toggles: {
        unitLabels: "Etichette delle unità",
        title: "Titolo",
        date: "Data",
        note: "Nota",
        wordmark: "Logo",
        glow: "Bagliore",
        trim: "Togli gli zeri iniziali",
      },

      presets: {
        dark: "Until scuro",
        light: "Chiaro",
        amber: "Ambra",
        mono: "Mono",
        neon: "Neon",
        clear: "Trasparente",
      },

      fonts: {
        serif: "Serif",
        sans: "Sans",
        mono: "Mono",
      },

      layouts: {
        row: "Riga",
        stack: "Impilato",
        compact: "Compatto",
        big: "Un numero grande",
      },

      separators: {
        colon: "Due punti",
        dot: "Punto",
        space: "Spazio",
        none: "Nessuno",
      },

      frames: {
        card: "Scheda",
        outline: "Contorno",
        none: "Nessuna",
      },

      units: {
        dhms: "Giorni · ore · minuti · secondi",
        dhm: "Giorni · ore · minuti",
        dh: "Giorni · ore",
        d: "Giorni",
        hms: "Ore · minuti · secondi",
        hm: "Ore · minuti",
        ms: "Minuti · secondi",
      },

      positions: {
        "top-left": "In alto a sinistra",
        top: "In alto",
        "top-right": "In alto a destra",
        left: "A sinistra",
        center: "Al centro",
        right: "A destra",
        "bottom-left": "In basso a sinistra",
        bottom: "In basso",
        "bottom-right": "In basso a destra",
      },

      copy: {
        code: "Copia il codice",
        url: "Copia l’URL",
      },

      embed: {
        previewTitle: "Anteprima dell’incorporamento",
        paste: "Incolla questo nella tua pagina",
        codeLabel: "Codice da incorporare",
        note: "Si inserisce a tutta larghezza e alto {height} px. Anche WordPress, Ghost e Notion accettano il link del conto alla rovescia e trovano l’incorporamento da soli, ma così si apre la scheda standard: incolla il codice qui sopra per tenere quello che hai costruito qui.",
      },

      stream: {
        previewTitle: "Anteprima dell’overlay per le dirette",
        canvasNote: "La tela {width} × {height}, rimpicciolita: la scacchiera è quello che OBS rende trasparente.",
        urlLabel: "URL della sorgente browser",
        source: "Sorgente browser · {width} × {height}",
        steps: [
          "In OBS o Streamlabs, aggiungi una sorgente browser.",
          "Incolla l’URL qui sopra.",
          "Imposta la dimensione a {width} × {height}, la tela su cui si misura la posizione.",
          "Lascia lo sfondo trasparente: l’overlay porta il suo.",
          "Spunta “Aggiorna browser quando la scena diventa attiva” così l’orologio riparte da zero.",
        ],
      },
    },
  },
};
