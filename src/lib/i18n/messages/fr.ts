/**
 * French messages. See `en/` for what each key is for.
 *
 * Four decisions a maintainer should not undo:
 * - The series pages carry "combien de jours avant {title} ?" in the URL, the title and the `<h1>`
 *   alike, because that is the query and the three should rhyme. Event pages take "c’est quand ?"
 *   and "dans combien de jours ?" instead, so both phrasings are covered without two page types
 *   competing for one.
 * - Entity names are bare ("Noël", "Fête des Mères"), so no template puts an article or a
 *   preposition in front of `{title}`, `{category}`, `{country}` or `{tag}`: French elides
 *   ("d’Épiphanie") and picks the article by gender ("au Japon", "en France"), and neither is
 *   knowable from here. Every such placeholder opens its clause instead, with a colon after it.
 * - `lowercaseCategory` is false for the same reason: every `{category}` slot begins a clause,
 *   where the label’s own capital is the right one.
 * - Punctuation follows French typography: a no-break space before a question mark, a colon or a
 *   semicolon, and inside guillemets. It survives in headings; `truncate()` collapses it to a
 *   plain space in descriptions, which is fine, and is why no message depends on it.
 */
import type { Messages } from "./en";
import type { PluralForms } from "./types";

export const fr: Messages = {
  common: {
    siteName: "Until",
    tagline: "un catalogue de ce qui n’est pas encore arrivé.",
    wordmarkLine: "Until — un catalogue de ce qui n’est pas encore arrivé.",

    nav: {
      categories: "Catégories",
      countries: "Pays",
      daysUntil: "Combien de jours avant",
      create: "Créer",
      about: "À propos",
    },

    search: {
      label: "Rechercher",
      navLabel: "Rechercher un compte à rebours",
      placeholder: "Rechercher dans le catalogue…",
      navPlaceholder: "Éclipses, Coupes du monde, jours fériés…",
      submit: "Rechercher",
    },

    breadcrumb: {
      home: "Accueil",
    },

    footer: {
      datesCount: { one: "{n} date", other: "{n} dates" } as PluralForms,
      aboutTheData: "à propos des données",
      attributions: "attributions",
      categories: "Catégories",
      browse: "Explorer",
      all: "tout →",
      makeYourOwn: "Créez le vôtre",
      language: "Langue",
    },

    actions: {
      share: "Partager",
      shareCopied: "Lien copié",
      save: "Enregistrer",
      saved: "Enregistré",
      addToCalendar: "Ajouter au calendrier",
      google: "Google Calendar",
      outlook: "Outlook",
      downloadIcs: "Télécharger le .ics",
      embed: "Intégrer à votre site",
      stream: "Ajouter à votre stream",
      copy: "Copier",
      copied: "Copié",
    },

    labels: {
      worldwide: "Monde entier",
      countriesCount: { one: "{n} pays", other: "{n} pays" } as PluralForms,
      recurring: "Récurrent",
      series: "Série",
      today: "Aujourd’hui",
      tba: "À confirmer",
      dateToBeAnnounced: "date à confirmer",
      nothingHereYet: "Rien ici pour l’instant",
      more: "Plus",
      seeAll: "Tout voir →",
      loading: "Chargement…",
      source: "Source",
      sources: "Sources",
      lastVerified: "Dernière vérification",
    },

    status: {
      scheduled: "Programmé",
      tentative: "Provisoire",
      postponed: "Reporté",
      cancelled: "Annulé",
      done: "Terminé",
      retired: "Retiré",
    },

    units: {
      days: "jours",
      hours: "heures",
      minutes: "minutes",
      seconds: "secondes",
      daysShort: "j",
      hoursShort: "h",
      minutesShort: "min",
      secondsShort: "s",
    },

    pagination: {
      previous: "Précédent",
      next: "Suivant",
      page: "Page {n}",
      pageOf: "Page {n} sur {total}",
    },

    languageSwitcher: {
      label: "Langue",
      description: "Lire Until dans une autre langue",
    },
  },

  categories: {
    labels: {
      holidays: "Jours fériés",
      national: "Fêtes nationales",
      religion: "Religion",
      awareness: "Journées internationales",
      fun: "Journées insolites",
      culture: "Culture",
      festivals: "Festivals",
      sports: "Sport",
      esports: "Esport",
      games: "Jeux vidéo",
      film: "Cinéma",
      tv: "Télévision",
      anime: "Animés",
      music: "Musique",
      entertainment: "Divertissement",
      politics: "Politique",
      tech: "Tech",
      science: "Science",
      space: "Espace",
      astronomy: "Astronomie",
      nature: "Nature",
      history: "Histoire",
      curiosities: "Curiosités",
    },

    blurbs: {
      holidays: "Les jours fériés et les rites qu’on garde.",
      national: "Fêtes de l’indépendance, jours de la république, fêtes nationales.",
      religion: "Fêtes, jeûnes et jours saints, toutes religions confondues.",
      awareness: "Journées internationales et journées de l’ONU.",
      fun: "Journée de la pizza, journée du parler pirate et autres prétextes.",
      culture: "Festivals, fêtes patronales et calendrier civique.",
      festivals: "Carnavals, foires et grands rassemblements.",
      sports: "Finales, cérémonies d’ouverture et la prochaine Coupe du monde.",
      esports: "Worlds, Majors et The International.",
      games: "Dates de sortie et présentations.",
      film: "Sorties en salle et soirées de remise de prix.",
      tv: "Débuts et fins de saison.",
      anime: "Débuts de saison et sorties de films.",
      music: "Concours, tournées et anniversaires.",
      entertainment: "Les dates du fandom et les jours saints de la pop culture.",
      politics: "Élections et dates qui décident du cap des pays.",
      tech: "Conférences, fins de support et les horloges des ordinateurs.",
      science: "Des dates pour les curieux.",
      space: "Lancements, atterrissages et le long chemin du retour sur la Lune.",
      astronomy: "Éclipses, pluies d’étoiles, solstices : des rendez-vous avec le ciel.",
      nature: "La Terre, les océans et le rythme du vivant.",
      history: "Anniversaires de choses déjà arrivées — et qui tournent encore.",
      curiosities: "Jalons d’Unix, dates palindromes, vendredis 13.",
    },

    groups: {
      celebrate: { label: "Célébrer", tagline: "Jours fériés, fêtes et les prétextes qu’on garde." },
      watch: { label: "Regarder", tagline: "Finales, avant-premières, tournées et la prochaine grosse sortie." },
      play: { label: "Jouer", tagline: "Dates de sortie et présentations." },
      "look-up": { label: "Lever les yeux", tagline: "Lancements, éclipses et le rythme du vivant." },
      vote: { label: "Voter", tagline: "Élections, conférences et les horloges des ordinateurs." },
      wonder: { label: "S’étonner", tagline: "Anniversaires et bizarreries du calendrier." },
    },
  },

  seo: {
    homeTitle: "Until — des comptes à rebours pour tout ce qui arrive",
    siteDescription:
      "Des milliers de dates à venir, étiquetées et déjà en marche. Jours fériés, éclipses, Coupes du monde, élections — et celles que vous créez.",
    titleTemplate: "%s · Until",

    event: {
      whenIs: "{title} : c’est quand ? {when}",
      whenIsCoarse: "{title} : c’est quand ? Prévu en {period}",
      countdownColon: "{title} : dans combien de jours ? {when}",
      countdownDash: "{title} — compte à rebours, {when}",
      countdownDashCoarse: "{title} — {when}",
      description: "{title}{status} a lieu le {date}. {days} Compte à rebours et ajout au calendrier.",
      descriptionCoarse:
        "{title} : c’est prévu en {period}. Le jour exact n’est pas encore connu. Compte à rebours dès qu’il le sera.",
      statusCancelled: " (annulé)",
      statusPostponed: " (reporté)",
      fallbackTitle: "Compte à rebours",
      mineTitle: "Votre compte à rebours",
      sharedTitle: "Compte à rebours partagé",
      sharedMetaTitle: "{title} — compte à rebours, {date}",
      sharedMetaDescription: "{title} a lieu le {date}. Un compte à rebours créé sur Until.",
    },

    series: {
      title: "Combien de jours avant {title} ? — {when}",
      titleNoDate: "Combien de jours avant {title} ?",
      heading: "Combien de jours avant {title} ?",
      description: "{title} a lieu le {date}. {days} Compte à rebours, dates de chaque année et calendrier.",
      descriptionCoarse:
        "{title} : c’est prévu en {period}. Dates de chaque année, compte à rebours et liens calendrier.",
      descriptionNoDate: "{title} : les prochaines dates, un compte à rebours vers la suivante et le calendrier.",
      fallbackTitle: "Combien de jours avant",
    },

    hub: {
      category: "{category} : prochaines dates et comptes à rebours",
      country: "{country} : jours fériés et événements à venir",
      month: "En {month} : toutes les dates à venir",
      tag: "Dates à venir et comptes à rebours : {tag}",
      lowercaseCategory: false,
    },

    days: {
      today: "C’est aujourd’hui.",
      tomorrow: "C’est demain.",
      yesterday: "C’était hier.",
      away: { one: "Il reste {n} jour.", other: "Il reste {n} jours." } as PluralForms,
      ago: { one: "C’était il y a {n} jour.", other: "C’était il y a {n} jours." } as PluralForms,
    },

    period: {
      month: "{month} {year}",
      quarter: "T{q} {year}",
      year: "{year}",
      expected: "prévu en {period}",
      unknown: "date à confirmer",
    },

    jsonLd: {
      siteDescription:
        "Comptes à rebours et dates pour des milliers d’événements, jours fériés et anniversaires à venir.",
      seriesDescription: "{title} : les prochaines dates.",
    },
  },

  home: {
    loading: "Chargement du catalogue",

    hero: {
      eyebrow: "Compte à rebours du moment",
      meta: "{category} · {when}",
      open: "Ouvrir ce compte à rebours",
    },

    hub: {
      alsoOnTheHorizon: "Aussi à l’horizon",
      next7Days: "7 prochains jours",
      wholeMonth: "Tout le mois →",
      browseByCategory: "Explorer par catégorie",
      allCategories: "Toutes les catégories →",
      popularCountdowns: "Comptes à rebours populaires",
      everyRecurringDate: "Toutes les dates récurrentes →",
      byCountry: "Par pays",
      allCountries: "Tous les pays →",
      noCountries: "Les données par pays sont en cours de remplissage.",
      byMonth: "Par mois",
      thisMonth: "Ce mois-ci — {month}",
      nextMonth: "Le mois prochain — {month}",
    },

    explorer: {
      heading: "Le catalogue",
      count: { one: "{n} date à venir.", other: "{n} dates à venir." } as PluralForms,
      countMatching: {
        one: "{n} date à venir pour « {q} ».",
        other: "{n} dates à venir pour « {q} ».",
      } as PluralForms,
      countInCategory: {
        one: "{category} : {n} date à venir.",
        other: "{category} : {n} dates à venir.",
      } as PluralForms,
      countMatchingInCategory: {
        one: "{category} : {n} date à venir pour « {q} ».",
        other: "{category} : {n} dates à venir pour « {q} ».",
      } as PluralForms,
      sort: {
        soonest: "Les plus proches",
        popular: "Populaires",
        latest: "Les plus lointaines",
      },
    },

    filters: {
      all: "Tout",
    },

    empty: {
      noMatch: "Rien dans le catalogue ne correspond à « {q} ».",
      nothing: "Rien ici pour l’instant.",
      hint: "Les fautes de frappe sont pardonnées et les initiales fonctionnent, donc un à-peu-près suffit d’habitude : celle-ci ressemble à une date que le catalogue n’a pas.",
      busiest: "Catégories les mieux fournies",
      everyRecurringDate: "Toutes les dates récurrentes",
      startOver: "Tout recommencer",
    },

    table: {
      date: "Date",
      event: "Événement",
      within: "Dans",
      category: "Catégorie",
      empty: "Rien de prévu ici pour l’instant.",
    },

    pagination: "Pagination",
  },

  event: {
    answer: {
      today: "{title}, c’est aujourd’hui, {date}.",
      tomorrow: "Il reste {n} jour avant {title} : c’est demain, {date}.",
      days: {
        one: "Il reste {n} jour avant {title}, le {date}.",
        other: "Il reste {n} jours avant {title}, le {date}.",
      } as PluralForms,
      past: {
        one: "{title}, c’était il y a {n} jour, le {date}.",
        other: "{title}, c’était il y a {n} jours, le {date}.",
      } as PluralForms,
      cancelled: "{title} devait avoir lieu le {date} : l’événement a été annulé.",
      coarse: "{title} : c’est prévu en {period}. Le jour exact n’a pas encore été annoncé.",
      plain: "{title} a lieu le {date}.",
    },

    statusHappened: "Déjà passé",

    dateRange: "du {start} au {end}",

    coarseNote:
      "Le jour exact n’a pas encore été annoncé. Cette page se mettra à compter dès que la source en publiera un.",
    dateChanged: "Date modifiée : c’était le {date}.",
    partOfSeries: "Fait partie de la série {series} — chaque année, avec la prochaine date toujours en tête.",
    everyUpcomingDate: "Toutes les dates à venir",
    otherYears: "Autres années",
    alsoComing: "Aussi au programme",

    fields: {
      where: "Où",
      tags: "Étiquettes",
    },

    provenance: {
      source: "Source :",
      lastVerified: "vérifié pour la dernière fois le {date}",
      summary: "Résumé de {source} ({license})",
    },

    image: {
      photo: "Photo",
      photoBy: "Photo :",
      via: "via {provider}",
    },

    mine: {
      missingTitle: "Ce compte à rebours vit sur un autre appareil",
      missingBody:
        "Les comptes à rebours personnels sont enregistrés dans le navigateur qui les a créés. Si quelqu’un vous a envoyé un lien, demandez-lui l’URL de partage générée sur la page de création.",
      makeNew: "En créer un nouveau",
      onThisDevice: "Sur cet appareil",
      remove: "Retirer",
      savedCount: {
        one: "{n} date du catalogue enregistrée dans ce navigateur.",
        other: "{n} dates du catalogue enregistrées dans ce navigateur.",
      } as PluralForms,
    },
  },

  series: {
    index: {
      title: "Combien de jours avant — tous les comptes à rebours récurrents",
      description:
        "Noël, le ramadan, le Super Bowl, les Perséides : chaque date qui revient, avec la prochaine en tête et le tableau des années à venir.",
      heading: "Combien de jours avant…",
      intro: {
        one: "{n} date qui revient chaque année. Chaque page garde la prochaine en tête et liste les années à venir.",
        other:
          "{n} dates qui reviennent chaque année. Chaque page garde la prochaine en tête et liste les années à venir.",
      } as PluralForms,
      empty: "Le catalogue se remplit — revenez bientôt.",
      jsonLdDescription: "Dates récurrentes, avec la prochaine occurrence et un tableau sur plusieurs années.",
    },

    noUpcoming: "Aucune date à venir pour {title} n’est encore dans le catalogue.",

    thisYearsPage: "La page de cette année",

    shareTitle: "Combien de jours avant {title}",

    upcoming: {
      heading: "Prochaines dates",
      note: "Chaque {title} du catalogue à partir d’aujourd’hui, de la plus proche à la plus lointaine.",
      empty: "Pas encore de date future — revenez après la prochaine mise à jour.",
    },

    variants: {
      heading: "Autres dates liées à cette série",
      note: "Célébrées sous le même nom un autre jour dans quelques pays : listées à part pour que le compte à rebours ci-dessus reste sur la date principale.",
    },

    faqHeading: "Questions fréquentes",

    tagsLabel: "Étiquettes :",

    related: {
      heading: "{category} : d’autres dates qui reviennent chaque année",
      all: "Tous les comptes à rebours récurrents",
    },
  },

  hubs: {
    label: {
      browse: "Explorer",
      category: "Catégorie",
      country: "Pays",
      calendar: "Calendrier",
      tag: "Étiquette",
    },

    breadcrumbLabel: "Fil d’Ariane",

    paged: {
      title: "{name} (page {n})",
      headingSuffix: "— page {n}",
      backToFirst: "Retour à la première page.",
    },

    categoryIndex: {
      title: "Catégories — tous les types de dates qui n’ont pas encore eu lieu",
      description:
        "Les dates à venir par catégorie : jours fériés, sport, cinéma, séries, jeux vidéo, espace, élections, anniversaires — avec comptes à rebours.",
      heading: "Tous les types de dates",
      intro: "Vingt-trois catégories, regroupées par ce qu’on en ferait.",
      collectionDescription: "Les dates à venir, par catégorie.",
    },

    category: {
      description: {
        one: "{blurb} {n} date à venir, avec compte à rebours et liens calendrier.",
        other: "{blurb} {n} dates à venir, avec comptes à rebours et liens calendrier.",
      } as PluralForms,
      descriptionEmpty: "{blurb} Les dates à venir, avec comptes à rebours et liens calendrier.",
      descriptionPaged:
        "{blurb} Page {n} des dates à venir, les plus proches d’abord, avec comptes à rebours.",
      heading: "{category} : les prochaines dates",
      count: { one: "{n} date à venir.", other: "{n} dates à venir." } as PluralForms,
      countPaged: {
        one: "{n} date à venir, de la plus proche à la plus lointaine.",
        other: "{n} dates à venir, de la plus proche à la plus lointaine.",
      } as PluralForms,
      soon: "30 prochains jours",
      everyYear: "Chaque année",
      all: "{category} : toutes les dates à venir",
      empty: "Rien dans cette catégorie pour l’instant.",
    },

    countryIndex: {
      title: "Pays — jours fériés et événements à venir, pays par pays",
      description:
        "Jours fériés, fêtes nationales et événements locaux de plus de 200 pays et territoires, avec comptes à rebours et liens calendrier.",
      heading: "Par pays",
      intro: {
        one: "{n} pays ou territoire avec des jours fériés et des événements à venir dans le catalogue.",
        other: "{n} pays et territoires avec des jours fériés et des événements à venir dans le catalogue.",
      } as PluralForms,
      empty: "Le catalogue se remplit — revenez bientôt.",
      collectionDescription: "Jours fériés et événements à venir, par pays.",
    },

    country: {
      description: {
        one: "{country} : {n} date à venir — jours fériés, fêtes nationales et événements, mois par mois, avec compte à rebours.",
        other:
          "{country} : {n} dates à venir — jours fériés, fêtes nationales et événements, mois par mois, avec comptes à rebours.",
      } as PluralForms,
      descriptionEmpty:
        "{country} : jours fériés, fêtes nationales et événements, mois par mois, avec comptes à rebours et liens calendrier.",
      intro:
        "Les jours fériés et les événements à venir étiquetés {country}, mois par mois. Les dates mondiales — éclipses, sorties, journées internationales — sont listées à part, plus bas.",
      count: { one: "{n} date à venir.", other: "{n} dates à venir." } as PluralForms,
      countCapped: { one: "{n}+ date à venir.", other: "{n}+ dates à venir." } as PluralForms,
      empty: "Aucune date étiquetée {country} pour l’instant.",
      worldwide: "Dans le monde entier, à venir",
      collectionDescription: "{country} : jours fériés et événements.",
    },

    calendar: {
      description:
        "Tout le catalogue pour {month} : jours fériés, lancements, finales, sorties et anniversaires, jour par jour, avec comptes à rebours.",
      count: {
        one: "{n} date à venir en {month}, jour par jour.",
        other: "{n} dates à venir en {month}, jour par jour.",
      } as PluralForms,
      empty: "Rien de prévu en {month} pour l’instant.",
      months: "Mois",
      previous: "← {month}",
      next: "{month} →",
      collectionDescription: "Les dates à venir en {month}.",
    },

    tag: {
      description: {
        one: "{n} date à venir étiquetée « {tag} », avec compte à rebours et liens calendrier.",
        other:
          "{n} dates à venir étiquetées « {tag} », de la plus proche à la plus lointaine, avec comptes à rebours et liens calendrier.",
      } as PluralForms,
      descriptionPaged:
        "Page {n} des dates à venir étiquetées « {tag} », de la plus proche à la plus lointaine, avec comptes à rebours et liens calendrier.",
      crumb: "#{tag}",
      count: {
        one: "{n} date à venir étiquetée « {tag} ».",
        other: "{n} dates à venir étiquetées « {tag} », de la plus proche à la plus lointaine.",
      } as PluralForms,
      searchPrompt: "Vous cherchez autre chose ?",
      searchLink: "Chercher « {tag} » dans tout le catalogue.",
      collectionDescription: "Les dates à venir étiquetées {tag}.",
    },
  },

  pages: {
    about: {
      title: "À propos",
      description: "Comment Until collecte, étiquette et classe des milliers de dates à venir.",
      eyebrow: "Le projet",
      heading: "Un journal du futur",

      intro:
        "Until est un catalogue de dates qui n’ont pas encore eu lieu. Les jours fériés de presque tous les pays, les événements programmés tirés des pages d’années de Wikipedia et de Wikidata, plus une couche éditoriale de ceux qu’on attend vraiment : éclipses, Coupes du monde, Jeux olympiques, élections, comète de Halley.",
      categories:
        "Chaque ligne est étiquetée et classée dans {n} catégories : jours fériés, fêtes nationales, sport, astronomie, espace, tech, politique, histoire et bien d’autres. Cherchez dans l’ensemble, filtrez une catégorie, ouvrez un compte à rebours en direct et ajoutez-le à un calendrier.",
      sources:
        "La base des jours fériés est le jeu de données hors ligne {dateHolidays}, complété par {wikidata} et {wikipedia}. Les noms identiques le même jour (Noël dans 140 pays) sont fusionnés en un seul compte à rebours. Quand les sources divergent, les fiches éditoriales l’emportent. Chaque page d’événement indique sa source et la date de la dernière vérification.",
      expected:
        "Les dates sans jour confirmé sont marquées « prévues », avec le mois, le trimestre ou l’année que donne la source, et elles ne commencent à compter qu’une fois une vraie date publiée. Le catalogue se met à jour chaque jour depuis ses sources.",
      yourOwn:
        "Vous pouvez créer le vôtre. Il reste dans le navigateur — sans compte — et le lien de partage porte le titre et la date dans l’URL, pour que n’importe qui puisse ouvrir la même horloge en marche.",

      stats: {
        dates: "Dates",
        featured: "En vedette",
        updated: "Mis à jour",
      },

      byCategory: {
        heading: "Par catégorie",
        empty: "Le catalogue se remplit — revenez bientôt.",
      },

      bySource: {
        heading: "Par source",
        empty: "Aucune source enregistrée pour l’instant.",
      },
    },

    attributions: {
      title: "Attributions — d’où viennent les dates",
      description:
        "Toutes les sources du catalogue Until, avec leur licence et l’attribution demandée : date-holidays, Wikipedia, Wikidata, Hebcal, Launch Library.",
      eyebrow: "Sources",
      heading: "Attributions",
      intro:
        "Until n’intègre que des sources dont les conditions autorisent le stockage et la republication des données. Les sources en partage à l’identique (le texte de Wikipedia, TVMaze, les données de date-holidays) sont créditées sur chaque page qui les utilise ; les images ne sont réhébergées que sous licence CC0, domaine public, CC BY ou CC BY-SA, avec le nom de l’auteur. Chaque page d’événement renvoie à la fiche dont elle est issue.",
      sourcesEmpty: "La liste des sources n’est pas disponible pour le moment.",

      images: {
        heading: "Images",
        policy:
          "Les photos sont des copies réhébergées, redimensionnées et servies depuis notre propre stockage : les serveurs d’origine ne sont jamais sollicités. Seuls les fichiers librement licenciés sont acceptés — CC0, domaine public, CC BY, CC BY-SA et quelques licences nationales de données ouvertes, plus les images de la NASA selon ses règles d’usage. Les fichiers relevant du fair use et les licences non commerciales (NC) ou sans modification (ND) sont refusés d’emblée, tout comme les fichiers soumis à une marque déposée ou au droit à l’image, et chaque fichier stocké conserve son auteur, sa licence et un lien vers sa page de description. Les événements sans photo libre reçoivent une carte générée.",
        shareAlike:
          "Les photos en partage à l’identique (CC BY-SA) sont publiées sans modification, à leurs propres proportions, avec le crédit en dessous. Elles ne sont jamais recadrées dans une carte sociale : ce montage serait une œuvre dérivée et devrait porter la même licence de partage à l’identique, donc ces cartes utilisent le visuel généré. Les fichiers stockés sont revérifiés chaque mois auprès de leur source ; celui qui a été supprimé ou n’est plus libre est retiré de notre stockage et ses pages repassent à la carte générée.",
        empty: "Aucune image réhébergée pour l’instant.",
        count: {
          one: "{n} image dans la bibliothèque aujourd’hui :",
          other: "{n} images dans la bibliothèque aujourd’hui :",
        } as PluralForms,
      },

      fonts:
        "Polices : Fraunces (SIL Open Font License) et Geist (SIL Open Font License). Astronomie calculée avec astronomy-engine (MIT).",
    },

    create: {
      title: "Créer un compte à rebours",
      description: "Créez un compte à rebours personnel et ajoutez-le à votre calendrier.",
      eyebrow: "Vos dates",
      heading: "Créez un compte à rebours",
      intro:
        "Un anniversaire, un lancement, un voyage, une audience, des retrouvailles. Il tourne comme ceux du catalogue — et vous pouvez le glisser directement dans Google Calendar, dans Outlook ou dans un fichier .ics.",

      form: {
        draftTitle: "Quelque chose que j’attends",
        draftNote: "Un compte à rebours que vous avez créé.",
        titleLabel: "Titre",
        dateLabel: "Date",
        categoryLabel: "Catégorie",
        noteLabel: "Note",
        notePlaceholder: "Pourquoi cette date compte pour vous.",
        save: "Enregistrer sur cet appareil",
        openShareable: "Ouvrir la page à partager",
        saved: "Enregistré. {link} — il vit dans ce navigateur jusqu’à ce que vous vidiez le stockage.",
        savedLink: "Le voir",
        privacy:
          "Les comptes à rebours personnels restent sur votre appareil (sans compte). Le lien de partage encode le titre et la date dans l’URL.",
        previewLabel: "Aperçu en direct",
        chooseDate: "Choisissez une date pour lancer l’horloge.",
      },
    },

    notFound: {
      heading: "Cette date n’est pas dans le catalogue",
      body: "Elle a peut-être été fusionnée, renommée, ou n’a jamais existé.",
      backHome: "Retour à tout ce qui arrive",
    },
  },

  embed: {
    countdown: {
      units: {
        days: { one: "jour", other: "jours" } as PluralForms,
        hours: "h",
        minutes: "min",
        seconds: "s",
      },
      today: "C’est aujourd’hui.",
      past: "C’est déjà passé.",
    },

    studio: {
      heading: "Emportez-le avec vous",

      controls: {
        preset: "Préréglage",
        digits: "Chiffres",
        type: "Type",
        background: "Fond",
        transparent: "Transparent — laisse voir la scène ou la page",
        font: "Police",
        size: "Taille",
        layout: "Disposition",
        units: "Unités",
        separator: "Séparateur",
        frame: "Cadre",
        radius: "Rayon des coins",
        inset: "Marge du bord",
        position: "Position",
        done: "Message de fin",
        reset: "Réinitialiser",
        colourPicker: "{label} — sélecteur de couleur",
      },

      toggles: {
        unitLabels: "Libellés des unités",
        title: "Titre",
        date: "Date",
        note: "Note",
        wordmark: "Logo",
        glow: "Halo",
        trim: "Masquer les zéros initiaux",
      },

      presets: {
        dark: "Until sombre",
        light: "Clair",
        amber: "Ambre",
        mono: "Mono",
        neon: "Néon",
        clear: "Transparent",
      },

      fonts: {
        serif: "Serif",
        sans: "Sans",
        mono: "Mono",
      },

      layouts: {
        row: "Ligne",
        stack: "Empilé",
        compact: "Compact",
        big: "Un grand nombre",
      },

      separators: {
        colon: "Deux-points",
        dot: "Point",
        space: "Espace",
        none: "Aucun",
      },

      frames: {
        card: "Carte",
        outline: "Contour",
        none: "Aucun",
      },

      units: {
        dhms: "Jours · heures · minutes · secondes",
        dhm: "Jours · heures · minutes",
        dh: "Jours · heures",
        d: "Jours",
        hms: "Heures · minutes · secondes",
        hm: "Heures · minutes",
        ms: "Minutes · secondes",
      },

      positions: {
        "top-left": "En haut à gauche",
        top: "En haut",
        "top-right": "En haut à droite",
        left: "À gauche",
        center: "Au centre",
        right: "À droite",
        "bottom-left": "En bas à gauche",
        bottom: "En bas",
        "bottom-right": "En bas à droite",
      },

      copy: {
        code: "Copier le code",
        url: "Copier l’URL",
      },

      embed: {
        previewTitle: "Aperçu de l’intégration",
        paste: "Collez ceci dans votre page",
        codeLabel: "Code d’intégration",
        note: "Il s’insère sur toute la largeur, avec {height} px de haut. WordPress, Ghost et Notion acceptent aussi le lien du compte à rebours et trouvent l’intégration tout seuls — mais cela déploie la carte standard : collez le code ci-dessus pour garder ce que vous avez construit ici.",
      },

      stream: {
        previewTitle: "Aperçu de l’overlay pour le direct",
        canvasNote: "La zone de {width} × {height}, réduite — le damier est ce qu’OBS rend transparent.",
        urlLabel: "URL de la source navigateur",
        source: "Source navigateur · {width} × {height}",
        steps: [
          "Dans OBS ou Streamlabs, ajoutez une source Navigateur.",
          "Collez l’URL ci-dessus.",
          "Réglez la taille sur {width} × {height} — la zone qui sert de repère à la position.",
          "Laissez le fond transparent ; l’overlay apporte le sien.",
          "Cochez « Actualiser le navigateur lorsque la scène devient active » pour que l’horloge reparte de zéro.",
        ],
      },
    },
  },
};
