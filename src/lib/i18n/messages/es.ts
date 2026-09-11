/**
 * Spanish messages. See `en/` for what each key is for.
 *
 * Three decisions a maintainer should not undo:
 * - "cuenta atrás" (peninsular) is used throughout rather than the Latin American "cuenta
 *   regresiva". Both are understood everywhere; mixing them inside one corpus is what is not.
 * - `lowercaseCategory` is true and every template that takes `{category}` is built around
 *   "… de {category}", so one phrasing works for masculine, feminine, singular and plural labels
 *   ("de cine", "de días festivos", "de música") with no agreement to get wrong.
 * - Hub titles do not start with `{month}` or `{tag}`: Spanish writes months and common nouns in
 *   lower case, and a search result that opens with "diciembre de 2026…" reads like a fragment.
 */
import type { Messages } from "./en";
import type { PluralForms } from "./types";

export const es: Messages = {
  common: {
    siteName: "Until",
    tagline: "un catálogo de cosas que todavía no han pasado.",
    wordmarkLine: "Until — un catálogo de cosas que todavía no han pasado.",

    nav: {
      categories: "Categorías",
      countries: "Países",
      daysUntil: "Cuántos días faltan",
      create: "Crear",
      about: "Acerca de",
    },

    search: {
      label: "Buscar",
      navLabel: "Buscar cuentas atrás",
      placeholder: "Busca en el catálogo…",
      navPlaceholder: "Busca eclipses, Mundiales, días festivos…",
      submit: "Buscar",
    },

    breadcrumb: {
      home: "Inicio",
    },

    footer: {
      datesCount: { one: "{n} fecha", other: "{n} fechas" } as PluralForms,
      aboutTheData: "sobre los datos",
      attributions: "atribuciones",
      categories: "Categorías",
      browse: "Explorar",
      all: "todas →",
      makeYourOwn: "Crea la tuya",
      language: "Idioma",
    },

    actions: {
      share: "Compartir",
      shareCopied: "Enlace copiado",
      save: "Guardar",
      saved: "Guardada",
      addToCalendar: "Añadir al calendario",
      google: "Google Calendar",
      outlook: "Outlook",
      downloadIcs: "Descargar .ics",
      embed: "Insertar en tu web",
      stream: "Añadir a tu directo",
      copy: "Copiar",
      copied: "Copiado",
    },

    labels: {
      worldwide: "En todo el mundo",
      countriesCount: { one: "{n} país", other: "{n} países" } as PluralForms,
      recurring: "Se repite",
      series: "Serie",
      today: "Hoy",
      tba: "Por confirmar",
      dateToBeAnnounced: "una fecha por confirmar",
      nothingHereYet: "Aquí todavía no hay nada",
      more: "Más",
      seeAll: "Ver todo →",
      loading: "Cargando…",
      source: "Fuente",
      sources: "Fuentes",
      lastVerified: "Última verificación",
    },

    status: {
      scheduled: "Programado",
      tentative: "Provisional",
      postponed: "Aplazado",
      cancelled: "Cancelado",
      done: "Terminado",
      retired: "Retirado",
    },

    units: {
      days: "días",
      hours: "horas",
      minutes: "minutos",
      seconds: "segundos",
      daysShort: "d",
      hoursShort: "h",
      minutesShort: "m",
      secondsShort: "s",
    },

    pagination: {
      previous: "Anterior",
      next: "Siguiente",
      page: "Página {n}",
      pageOf: "Página {n} de {total}",
    },

    languageSwitcher: {
      label: "Idioma",
      description: "Lee Until en otro idioma",
    },
  },

  categories: {
    labels: {
      holidays: "Días festivos",
      national: "Fiestas nacionales",
      religion: "Religión",
      awareness: "Días internacionales",
      fun: "Días divertidos",
      culture: "Cultura",
      festivals: "Festivales",
      sports: "Deportes",
      esports: "Esports",
      games: "Videojuegos",
      film: "Cine",
      tv: "Televisión",
      anime: "Anime",
      music: "Música",
      entertainment: "Entretenimiento",
      politics: "Política",
      tech: "Tecnología",
      science: "Ciencia",
      space: "Espacio",
      astronomy: "Astronomía",
      nature: "Naturaleza",
      history: "Historia",
      curiosities: "Curiosidades",
    },

    blurbs: {
      holidays: "Días festivos y los ritos que mantenemos.",
      national: "Días de la independencia, días de la república, fiestas nacionales.",
      religion: "Fiestas, ayunos y días sagrados de distintas religiones.",
      awareness: "Días internacionales y efemérides de la ONU.",
      fun: "Día de la Pizza, Día de Hablar como un Pirata y otras excusas.",
      culture: "Festivales, celebraciones y el calendario cívico.",
      festivals: "Carnavales, ferias y encuentros.",
      sports: "Finales, ceremonias de apertura y el próximo Mundial.",
      esports: "Worlds, Majors y The International.",
      games: "Fechas de lanzamiento y presentaciones.",
      film: "Estrenos y noches de premios.",
      tv: "Estrenos y finales de temporada.",
      anime: "Comienzos de temporada y estrenos de películas.",
      music: "Concursos, giras y aniversarios.",
      entertainment: "Fechas del fandom y días sagrados de la cultura pop.",
      politics: "Elecciones y las fechas que marcan el rumbo de los países.",
      tech: "Conferencias, fin del soporte y los relojes que llevan los ordenadores.",
      science: "Fechas para gente curiosa.",
      space: "Lanzamientos, aterrizajes y el largo camino de vuelta a la Luna.",
      astronomy: "Eclipses, lluvias de estrellas, solsticios: citas con el cielo.",
      nature: "La Tierra, los océanos y el año vivo.",
      history: "Aniversarios de cosas que ya pasaron y que siguen contando.",
      curiosities: "Hitos de Unix, fechas capicúa, viernes 13.",
    },

    groups: {
      celebrate: { label: "Celebrar", tagline: "Días festivos, celebraciones y las excusas que guardamos." },
      watch: { label: "Ver", tagline: "Finales, estrenos, giras y el próximo gran lanzamiento." },
      play: { label: "Jugar", tagline: "Fechas de lanzamiento y presentaciones." },
      "look-up": { label: "Mirar arriba", tagline: "Lanzamientos, eclipses y el año vivo." },
      vote: { label: "Votar", tagline: "Elecciones, conferencias y los relojes que llevan los ordenadores." },
      wonder: { label: "Asombrarse", tagline: "Aniversarios y rarezas del calendario." },
    },
  },

  seo: {
    homeTitle: "Until — cuenta atrás para todo lo que está por venir",
    siteDescription:
      "Miles de fechas futuras, etiquetadas y en marcha. Días festivos, eclipses, Mundiales, elecciones y las que crees tú mismo.",
    titleTemplate: "%s · Until",

    event: {
      whenIs: "¿Cuándo es {title}? {when}",
      whenIsCoarse: "¿Cuándo es {title}? Previsto para {period}",
      countdownColon: "Cuenta atrás para {title}: {when}",
      countdownDash: "{title} — cuenta atrás hasta el {when}",
      countdownDashCoarse: "{title} — {when}",
      description: "{title}{status}: {date}. {days} Cuenta atrás y enlaces al calendario.",
      descriptionCoarse:
        "{title}: fecha prevista, {period}. Todavía no hay día exacto. La cuenta atrás arranca en cuanto lo haya.",
      statusCancelled: " (cancelado)",
      statusPostponed: " (aplazado)",
      fallbackTitle: "Cuenta atrás",
      mineTitle: "Tu cuenta atrás",
      sharedTitle: "Cuenta atrás compartida",
      sharedMetaTitle: "{title} — cuenta atrás hasta el {date}",
      sharedMetaDescription: "{title}: {date}. Una cuenta atrás creada en Until.",
    },

    series: {
      title: "¿Cuántos días faltan para {title}? — {when}",
      titleNoDate: "¿Cuántos días faltan para {title}?",
      heading: "¿Cuántos días faltan para {title}?",
      description: "{title}: {date}. {days} Cuenta atrás, fechas de cada año y calendario.",
      descriptionCoarse:
        "{title}: fecha prevista, {period}. Fechas de cada año, cuenta atrás en directo y enlaces al calendario.",
      descriptionNoDate: "{title}: próximas fechas, cuenta atrás hasta la siguiente y enlaces al calendario.",
      fallbackTitle: "Cuántos días faltan",
    },

    hub: {
      category: "Próximas fechas de {category}: cuentas atrás y calendario",
      country: "{country}: próximos días festivos y eventos",
      month: "Qué pasa en {month}: fechas y cuentas atrás",
      tag: "Próximas fechas de {tag}, con cuenta atrás",
      lowercaseCategory: true,
    },

    days: {
      today: "Es hoy.",
      tomorrow: "Es mañana.",
      yesterday: "Fue ayer.",
      away: { one: "Falta {n} día.", other: "Faltan {n} días." } as PluralForms,
      ago: { one: "Fue hace {n} día.", other: "Fue hace {n} días." } as PluralForms,
    },

    period: {
      month: "{month} de {year}",
      quarter: "T{q} de {year}",
      year: "{year}",
      expected: "previsto para {period}",
      unknown: "fecha por confirmar",
    },

    jsonLd: {
      siteDescription:
        "Cuentas atrás y fechas de miles de eventos, días festivos y aniversarios que están por llegar.",
      seriesDescription: "Próximas fechas de {title}.",
    },
  },

  home: {
    loading: "Cargando el catálogo",

    hero: {
      eyebrow: "Cuenta atrás destacada",
      meta: "{category} · {when}",
      open: "Abrir esta cuenta atrás",
    },

    hub: {
      alsoOnTheHorizon: "También en el horizonte",
      next7Days: "Próximos 7 días",
      wholeMonth: "Todo el mes →",
      browseByCategory: "Explorar por categoría",
      allCategories: "Todas las categorías →",
      popularCountdowns: "Cuentas atrás populares",
      everyRecurringDate: "Todas las fechas que se repiten →",
      byCountry: "Por país",
      allCountries: "Todos los países →",
      noCountries: "Los datos por país se están completando.",
      byMonth: "Por mes",
      thisMonth: "Este mes — {month}",
      nextMonth: "El mes que viene — {month}",
    },

    explorer: {
      heading: "El catálogo",
      count: { one: "{n} fecha próxima.", other: "{n} fechas próximas." } as PluralForms,
      countMatching: {
        one: "{n} fecha próxima que coincide con “{q}”.",
        other: "{n} fechas próximas que coinciden con “{q}”.",
      } as PluralForms,
      countInCategory: {
        one: "{n} fecha próxima en {category}.",
        other: "{n} fechas próximas en {category}.",
      } as PluralForms,
      countMatchingInCategory: {
        one: "{n} fecha próxima en {category} que coincide con “{q}”.",
        other: "{n} fechas próximas en {category} que coinciden con “{q}”.",
      } as PluralForms,
      sort: {
        soonest: "Más próximas",
        popular: "Populares",
        latest: "Más lejanas",
      },
    },

    filters: {
      all: "Todas",
    },

    empty: {
      noMatch: "Nada del catálogo coincide con “{q}”.",
      nothing: "Aquí todavía no hay nada.",
      hint: "Se perdonan las erratas y valen las iniciales, así que casi cualquier aproximación acierta: esta parece una fecha que el catálogo no tiene.",
      busiest: "Categorías con más fechas",
      everyRecurringDate: "Todas las fechas que se repiten",
      startOver: "Empezar de nuevo",
    },

    table: {
      date: "Fecha",
      event: "Evento",
      within: "Cuándo",
      category: "Categoría",
      empty: "Aquí todavía no hay nada programado.",
    },

    pagination: "Paginación",
  },

  event: {
    answer: {
      today: "{title}: hoy, {date}.",
      tomorrow: "Falta {n} día para {title}: mañana, {date}.",
      days: {
        one: "Falta {n} día para {title}, el {date}.",
        other: "Faltan {n} días para {title}, el {date}.",
      } as PluralForms,
      past: {
        one: "{title}: hace {n} día, el {date}.",
        other: "{title}: hace {n} días, el {date}.",
      } as PluralForms,
      cancelled: "{title} se ha cancelado. Fecha prevista: {date}.",
      coarse: "{title}: fecha prevista, {period}. Todavía no se ha anunciado el día exacto.",
      plain: "{title}: {date}.",
    },

    statusHappened: "Ya pasó",

    dateRange: "del {start} al {end}",

    coarseNote:
      "Todavía no se ha anunciado el día exacto. Esta página empezará a contar en cuanto la fuente lo publique.",
    dateChanged: "Cambio de fecha: antes era el {date}.",
    partOfSeries: "Forma parte de la serie {series}: todos los años, con la próxima fecha siempre arriba.",
    everyUpcomingDate: "Todas las fechas próximas",
    otherYears: "Otros años",
    alsoComing: "También en camino",

    fields: {
      where: "Dónde",
      tags: "Etiquetas",
    },

    provenance: {
      source: "Fuente:",
      lastVerified: "verificado por última vez el {date}",
      summary: "Resumen de {source} ({license})",
    },

    image: {
      photo: "Foto",
      photoBy: "Foto:",
      via: "vía {provider}",
    },

    mine: {
      missingTitle: "Esta cuenta atrás vive en otro dispositivo",
      missingBody:
        "Las cuentas atrás personales se guardan en el navegador que las creó. Si alguien te ha pasado un enlace, pídele la URL para compartir de la página de creación.",
      makeNew: "Crear una nueva",
      onThisDevice: "En este dispositivo",
      remove: "Quitar",
      savedCount: {
        one: "{n} fecha del catálogo guardada en este navegador.",
        other: "{n} fechas del catálogo guardadas en este navegador.",
      } as PluralForms,
    },
  },

  series: {
    index: {
      title: "Cuántos días faltan — todas las cuentas atrás que se repiten",
      description:
        "Navidad, Ramadán, la Super Bowl, las Perseidas: cada fecha que vuelve cada año, con la próxima arriba y una tabla de los años que vienen.",
      heading: "¿Cuántos días faltan para…?",
      intro: {
        one: "{n} fecha que vuelve cada año. Cada página mantiene arriba la próxima y enumera los años que vienen.",
        other:
          "{n} fechas que vuelven cada año. Cada página mantiene arriba la próxima y enumera los años que vienen.",
      } as PluralForms,
      empty: "El catálogo se está llenando: vuelve pronto.",
      jsonLdDescription: "Fechas que se repiten, con la próxima y una tabla de varios años.",
    },

    noUpcoming: "Todavía no hay ninguna fecha próxima de {title} en el catálogo.",

    thisYearsPage: "La página de este año",

    shareTitle: "Cuántos días faltan para {title}",

    upcoming: {
      heading: "Próximas fechas",
      note: "Cada {title} del catálogo a partir de hoy, empezando por la más cercana.",
      empty: "Todavía no hay fechas futuras: vuelve tras la próxima actualización.",
    },

    variants: {
      heading: "Otras fechas ligadas a esta serie",
      note: "Se celebran con el mismo nombre en otro día en algunos países; van aparte para que la cuenta atrás de arriba siga en la fecha principal.",
    },

    faqHeading: "Preguntas frecuentes",

    tagsLabel: "Etiquetas:",

    related: {
      heading: "Más fechas de {category} que vuelven cada año",
      all: "Todas las cuentas atrás que se repiten",
    },
  },

  hubs: {
    label: {
      browse: "Explorar",
      category: "Categoría",
      country: "País",
      calendar: "Calendario",
      tag: "Etiqueta",
    },

    breadcrumbLabel: "Ruta de navegación",

    paged: {
      title: "{name} (página {n})",
      headingSuffix: "— página {n}",
      backToFirst: "Volver a la primera página.",
    },

    categoryIndex: {
      title: "Categorías — todo tipo de fecha que aún no ha pasado",
      description:
        "Explora las próximas fechas por categoría: días festivos, deportes, cine, televisión, videojuegos, espacio, elecciones y aniversarios, con cuenta atrás.",
      heading: "Todo tipo de fecha",
      intro: "Veintitrés categorías, agrupadas por lo que harías con ellas.",
      collectionDescription: "Próximas fechas por categoría.",
    },

    category: {
      description: {
        one: "{blurb} {n} fecha próxima con cuenta atrás y enlaces al calendario.",
        other: "{blurb} {n} fechas próximas con cuenta atrás y enlaces al calendario.",
      } as PluralForms,
      descriptionEmpty: "{blurb} Próximas fechas con cuenta atrás y enlaces al calendario.",
      descriptionPaged:
        "{blurb} Página {n} de las próximas fechas, de la más cercana a la más lejana, con cuenta atrás.",
      heading: "Próximas fechas de {category}",
      count: { one: "{n} fecha próxima.", other: "{n} fechas próximas." } as PluralForms,
      countPaged: {
        one: "{n} fecha próxima, empezando por la más cercana.",
        other: "{n} fechas próximas, empezando por la más cercana.",
      } as PluralForms,
      soon: "Próximos 30 días",
      everyYear: "Cada año",
      all: "Todas las fechas de {category}",
      empty: "Todavía no hay nada en esta categoría.",
    },

    countryIndex: {
      title: "Países — próximos días festivos y eventos por país",
      description:
        "Días festivos, fiestas nacionales y eventos locales de más de 200 países y territorios, con cuenta atrás y enlaces al calendario.",
      heading: "Por país",
      intro: {
        one: "{n} país y territorio con días festivos y eventos próximos en el catálogo.",
        other: "{n} países y territorios con días festivos y eventos próximos en el catálogo.",
      } as PluralForms,
      empty: "El catálogo se está llenando: vuelve pronto.",
      collectionDescription: "Próximos días festivos y eventos por país.",
    },

    country: {
      description: {
        one: "Días festivos, fiestas nacionales y eventos en {country}: {n} fecha próxima, mes a mes, con cuenta atrás y enlaces al calendario.",
        other:
          "Días festivos, fiestas nacionales y eventos en {country}: {n} fechas próximas, mes a mes, cada una con cuenta atrás y enlaces al calendario.",
      } as PluralForms,
      descriptionEmpty:
        "Días festivos, fiestas nacionales y eventos en {country}, mes a mes, cada uno con cuenta atrás y enlaces al calendario.",
      intro:
        "Días festivos y eventos próximos etiquetados como {country}, mes a mes. Las fechas mundiales —eclipses, estrenos, días internacionales— van aparte, más abajo.",
      count: { one: "{n} fecha próxima.", other: "{n} fechas próximas." } as PluralForms,
      countCapped: { one: "{n}+ fecha próxima.", other: "{n}+ fechas próximas." } as PluralForms,
      empty: "Todavía no hay fechas etiquetadas como {country}.",
      worldwide: "En todo el mundo, próximamente",
      collectionDescription: "Días festivos y eventos en {country}.",
    },

    calendar: {
      description:
        "Todo lo que hay en el catálogo para {month}: días festivos, lanzamientos, finales, estrenos y aniversarios, día a día, con cuenta atrás.",
      count: {
        one: "{n} fecha próxima en {month}, día a día.",
        other: "{n} fechas próximas en {month}, día a día.",
      } as PluralForms,
      empty: "Todavía no hay nada previsto en {month}.",
      months: "Meses",
      previous: "← {month}",
      next: "{month} →",
      collectionDescription: "Próximas fechas de {month}.",
    },

    tag: {
      description: {
        one: "{n} fecha próxima etiquetada como “{tag}”, con cuenta atrás y enlaces al calendario.",
        other:
          "{n} fechas próximas etiquetadas como “{tag}”, empezando por la más cercana, con cuenta atrás y enlaces al calendario.",
      } as PluralForms,
      descriptionPaged:
        "Página {n} de las próximas fechas etiquetadas como “{tag}”, empezando por la más cercana, con cuenta atrás y enlaces al calendario.",
      crumb: "#{tag}",
      count: {
        one: "{n} fecha próxima etiquetada como “{tag}”.",
        other: "{n} fechas próximas etiquetadas como “{tag}”, empezando por la más cercana.",
      } as PluralForms,
      searchPrompt: "¿Buscas otra cosa?",
      searchLink: "Busca “{tag}” en todo el catálogo.",
      collectionDescription: "Próximas fechas etiquetadas como {tag}.",
    },
  },

  pages: {
    about: {
      title: "Acerca de",
      description: "Cómo Until recopila, etiqueta y clasifica miles de fechas futuras.",
      eyebrow: "El proyecto",
      heading: "Un periódico del futuro",

      intro:
        "Until es un catálogo de fechas que todavía no han pasado. Días festivos de casi todos los países, eventos programados a partir de las páginas de años de Wikipedia y de Wikidata, más una capa curada de los que la gente de verdad espera: eclipses, Mundiales, Juegos Olímpicos, elecciones, el cometa Halley.",
      categories:
        "Cada fila se etiqueta y se clasifica en {n} categorías: días festivos, fiestas nacionales, deportes, astronomía, espacio, tecnología, política, historia y más. Busca en todo el conjunto, filtra una categoría, abre una cuenta atrás en directo y añádela a tu calendario.",
      sources:
        "La base de los días festivos es el conjunto de datos sin conexión {dateHolidays}, ampliado con {wikidata} y {wikipedia}. Los nombres repetidos el mismo día (la Navidad en 140 países) se fusionan en una sola cuenta atrás. Cuando las fuentes no coinciden, mandan los registros curados. Cada página de evento indica su fuente y cuándo se verificó la fecha por última vez.",
      expected:
        "Las fechas sin día confirmado se marcan como “previstas”, con el mes, el trimestre o el año que dé la fuente, y no empiezan a contar hasta que se publica una fecha real. El catálogo se actualiza a diario desde sus fuentes.",
      yourOwn:
        "Puedes crear la tuya. Esas se quedan en el navegador —sin cuenta— y el enlace para compartir lleva el título y la fecha en la URL, así que cualquiera puede abrir el mismo reloj en marcha.",

      stats: {
        dates: "Fechas",
        featured: "Destacadas",
        updated: "Actualizado",
      },

      byCategory: {
        heading: "Por categoría",
        empty: "El catálogo se está llenando: vuelve pronto.",
      },

      bySource: {
        heading: "Por fuente",
        empty: "Todavía no hay fuentes registradas.",
      },
    },

    attributions: {
      title: "Atribuciones — de dónde salen las fechas",
      description:
        "Todas las fuentes del catálogo de Until, con su licencia y la atribución que piden: date-holidays, Wikipedia, Wikidata, Hebcal, Launch Library y más.",
      eyebrow: "Fuentes",
      heading: "Atribuciones",
      intro:
        "Until solo incorpora fuentes cuyas condiciones permiten almacenar y volver a publicar los datos. Las fuentes con licencia de compartir igual (el texto de Wikipedia, TVMaze, los datos de date-holidays) se acreditan en cada página que las usa; las imágenes solo se rehospedan con licencias CC0, de dominio público, CC BY o CC BY-SA, y siempre con el autor indicado. Cada página de evento enlaza al registro con el que se construyó.",
      sourcesEmpty: "La lista de fuentes no está disponible ahora mismo.",

      images: {
        heading: "Imágenes",
        policy:
          "Las fotos son copias rehospedadas, redimensionadas y servidas desde nuestro propio almacenamiento, así que nunca se enlaza directamente al servidor original. Solo se aceptan archivos con licencia libre —CC0, dominio público, CC BY, CC BY-SA y unas cuantas licencias nacionales de datos abiertos—, además de las imágenes de la NASA según sus normas de uso. Los archivos de uso legítimo y las licencias no comerciales (NC) y sin obra derivada (ND) se rechazan de plano, igual que los archivos con restricciones de marca o de imagen personal, y cada archivo guardado conserva su autor, su licencia y un enlace a la página del archivo. Los eventos sin foto libre reciben una tarjeta generada.",
        shareAlike:
          "Las fotos de compartir igual (CC BY-SA) se publican sin modificar, con sus propias proporciones y el crédito debajo. Nunca se recortan dentro de una tarjeta social: ese montaje sería una obra derivada y tendría que llevar la misma licencia de compartir igual, así que esas tarjetas usan el diseño generado. Los archivos guardados se vuelven a verificar cada mes contra su fuente; el que se haya borrado o haya dejado de ser libre se elimina de nuestro almacenamiento y sus páginas pasan a la tarjeta generada.",
        empty: "Todavía no hay imágenes rehospedadas.",
        count: {
          one: "{n} imagen en la biblioteca a día de hoy:",
          other: "{n} imágenes en la biblioteca a día de hoy:",
        } as PluralForms,
      },

      fonts:
        "Tipografías: Fraunces (SIL Open Font License) y Geist (SIL Open Font License). Astronomía calculada con astronomy-engine (MIT).",
    },

    create: {
      title: "Crear una cuenta atrás",
      description: "Crea una cuenta atrás personal y añádela a tu calendario.",
      eyebrow: "Tus fechas",
      heading: "Crea una cuenta atrás",
      intro:
        "Cumpleaños, lanzamientos, un viaje, una cita en el juzgado, un reencuentro. Corre igual que las del catálogo, y puedes llevarla directamente a Google Calendar, a Outlook o a un archivo .ics.",

      form: {
        draftTitle: "Algo que estoy esperando",
        draftNote: "Una cuenta atrás que has creado tú.",
        titleLabel: "Título",
        dateLabel: "Fecha",
        categoryLabel: "Categoría",
        noteLabel: "Nota",
        notePlaceholder: "Por qué esta fecha te importa.",
        save: "Guardar en este dispositivo",
        openShareable: "Abrir la página para compartir",
        saved: "Guardada. {link}: vive en este navegador hasta que borres los datos.",
        savedLink: "Verla",
        privacy:
          "Las cuentas atrás personalizadas se quedan en tu dispositivo (sin cuenta). El enlace para compartir codifica el título y la fecha en la URL.",
        previewLabel: "Vista previa en directo",
        chooseDate: "Elige una fecha para poner el reloj en marcha.",
      },
    },

    notFound: {
      heading: "Esta fecha no está en el catálogo",
      body: "Puede que se haya fusionado, que se haya renombrado o que nunca existiera.",
      backHome: "Volver a todo lo que viene",
    },
  },

  embed: {
    countdown: {
      units: {
        days: { one: "día", other: "días" } as PluralForms,
        hours: "h",
        minutes: "min",
        seconds: "seg",
      },
      today: "Es hoy.",
      past: "Esto ya pasó.",
    },

    studio: {
      heading: "Llévatelo contigo",

      controls: {
        preset: "Preajuste",
        digits: "Dígitos",
        type: "Tipo",
        background: "Fondo",
        transparent: "Transparente: deja ver la escena o la página",
        font: "Tipografía",
        size: "Tamaño",
        layout: "Disposición",
        units: "Unidades",
        separator: "Separador",
        frame: "Marco",
        radius: "Radio de las esquinas",
        inset: "Margen del borde",
        position: "Posición",
        done: "Mensaje al terminar",
        reset: "Restablecer",
        colourPicker: "{label}: selector de color",
      },

      toggles: {
        unitLabels: "Etiquetas de unidad",
        title: "Título",
        date: "Fecha",
        note: "Nota",
        wordmark: "Logotipo",
        glow: "Resplandor",
        trim: "Quitar los ceros a la izquierda",
      },

      presets: {
        dark: "Until oscuro",
        light: "Claro",
        amber: "Ámbar",
        mono: "Mono",
        neon: "Neón",
        clear: "Transparente",
      },

      fonts: {
        serif: "Serif",
        sans: "Sans",
        mono: "Mono",
      },

      layouts: {
        row: "Fila",
        stack: "Apilado",
        compact: "Compacto",
        big: "Un número grande",
      },

      separators: {
        colon: "Dos puntos",
        dot: "Punto",
        space: "Espacio",
        none: "Ninguno",
      },

      frames: {
        card: "Tarjeta",
        outline: "Contorno",
        none: "Ninguno",
      },

      units: {
        dhms: "Días · horas · minutos · segundos",
        dhm: "Días · horas · minutos",
        dh: "Días · horas",
        d: "Días",
        hms: "Horas · minutos · segundos",
        hm: "Horas · minutos",
        ms: "Minutos · segundos",
      },

      positions: {
        "top-left": "Arriba a la izquierda",
        top: "Arriba",
        "top-right": "Arriba a la derecha",
        left: "Izquierda",
        center: "Centro",
        right: "Derecha",
        "bottom-left": "Abajo a la izquierda",
        bottom: "Abajo",
        "bottom-right": "Abajo a la derecha",
      },

      copy: {
        code: "Copiar el código",
        url: "Copiar la URL",
      },

      embed: {
        previewTitle: "Vista previa del insertado",
        paste: "Pega esto en tu página",
        codeLabel: "Código para insertar",
        note: "Se coloca a todo el ancho y con {height} px de alto. WordPress, Ghost y Notion también aceptan el enlace de la propia cuenta atrás y encuentran el insertado solos, pero eso despliega la tarjeta estándar: pega el código de arriba para conservar lo que has construido aquí.",
      },

      stream: {
        previewTitle: "Vista previa de la superposición para directos",
        canvasNote: "El lienzo de {width} × {height}, a escala reducida: el damero es lo que OBS recorta.",
        urlLabel: "URL de la fuente de navegador",
        source: "Fuente de navegador · {width} × {height}",
        steps: [
          "En OBS o Streamlabs, añade una fuente de navegador.",
          "Pega la URL de arriba.",
          "Ajusta el tamaño a {width} × {height}, el lienzo con el que se mide la posición.",
          "Deja el fondo transparente; la superposición trae el suyo.",
          "Marca “Actualizar el navegador cuando la escena se active” para que el reloj empiece de cero.",
        ],
      },
    },
  },
};
