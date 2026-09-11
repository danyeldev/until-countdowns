/**
 * Brazilian Portuguese messages. See `en/` for what each key is for.
 *
 * Two structural decisions a maintainer should not undo. (1) The query is "quantos dias faltam
 * para X", so that is the heading, the title and the nav word — not a literal "dias até". (2) Any
 * message that would otherwise have to agree with a value it cannot see is rewritten so it does
 * not: `{category}` always opens its sentence ("{category}: próximas datas") because "próximos
 * {category}" would be wrong for every feminine or singular label, and `{country}` opens its own
 * ("{country}: feriados…") because Portuguese country names carry an article — "em {country}"
 * would render "em Brasil" instead of "no Brasil". `lowercaseCategory` is therefore false, not
 * because Portuguese capitalises nouns (it does not) but because the label starts the sentence.
 */
import type { Messages } from "./en";
import type { PluralForms } from "./types";

export const pt: Messages = {
  common: {
    siteName: "Until",
    tagline: "um catálogo de coisas que ainda não aconteceram.",
    wordmarkLine: "Until — um catálogo de coisas que ainda não aconteceram.",

    nav: {
      categories: "Categorias",
      countries: "Países",
      daysUntil: "Quantos dias faltam",
      create: "Criar",
      about: "Sobre",
    },

    search: {
      label: "Buscar",
      navLabel: "Buscar contagens regressivas",
      placeholder: "Buscar no catálogo…",
      navPlaceholder: "Busque eclipses, Copas do Mundo, feriados…",
      submit: "Buscar",
    },

    breadcrumb: {
      home: "Início",
    },

    footer: {
      datesCount: { one: "{n} data", other: "{n} datas" } as PluralForms,
      aboutTheData: "sobre os dados",
      attributions: "atribuições",
      categories: "Categorias",
      browse: "Explorar",
      all: "todas →",
      makeYourOwn: "Crie a sua",
      language: "Idioma",
    },

    actions: {
      share: "Compartilhar",
      shareCopied: "Link copiado",
      save: "Salvar",
      saved: "Salvo",
      addToCalendar: "Adicionar ao calendário",
      google: "Google Calendar",
      outlook: "Outlook",
      downloadIcs: "Baixar .ics",
      embed: "Incorporar no seu site",
      stream: "Usar na sua live",
      copy: "Copiar",
      copied: "Copiado",
    },

    labels: {
      worldwide: "Mundial",
      countriesCount: { one: "{n} país", other: "{n} países" } as PluralForms,
      recurring: "Se repete",
      series: "Série",
      today: "Hoje",
      tba: "A definir",
      dateToBeAnnounced: "uma data ainda a ser anunciada",
      nothingHereYet: "Nada por aqui ainda",
      more: "Mais",
      seeAll: "Ver tudo →",
      loading: "Carregando…",
      source: "Fonte",
      sources: "Fontes",
      lastVerified: "Última verificação",
    },

    status: {
      scheduled: "Agendado",
      tentative: "A confirmar",
      postponed: "Adiado",
      cancelled: "Cancelado",
      done: "Concluído",
      retired: "Encerrado",
    },

    units: {
      days: "dias",
      hours: "horas",
      minutes: "minutos",
      seconds: "segundos",
      daysShort: "d",
      hoursShort: "h",
      minutesShort: "min",
      secondsShort: "s",
    },

    pagination: {
      previous: "Anterior",
      next: "Próxima",
      page: "Página {n}",
      pageOf: "Página {n} de {total}",
    },

    languageSwitcher: {
      label: "Idioma",
      description: "Leia o Until em outro idioma",
    },
  },

  categories: {
    labels: {
      holidays: "Feriados",
      national: "Datas nacionais",
      religion: "Datas religiosas",
      awareness: "Dias de conscientização",
      fun: "Dias divertidos",
      culture: "Cultura",
      festivals: "Festivais",
      sports: "Esportes",
      esports: "Esports",
      games: "Jogos",
      film: "Filmes",
      tv: "Séries",
      anime: "Anime",
      music: "Música",
      entertainment: "Entretenimento",
      politics: "Política",
      tech: "Tecnologia",
      science: "Ciência",
      space: "Espaço",
      astronomy: "Astronomia",
      nature: "Natureza",
      history: "História",
      curiosities: "Curiosidades",
    },

    blurbs: {
      holidays: "Feriados oficiais e os rituais que a gente mantém.",
      national: "Independências, proclamações e festas nacionais.",
      religion: "Festas, jejuns e dias santos de várias religiões.",
      awareness: "Datas da ONU e dias internacionais.",
      fun: "Dia da Pizza, Dia de Falar como Pirata e outras desculpas.",
      culture: "Festivais, datas festivas e o calendário cívico.",
      festivals: "Carnavais, feiras e encontros.",
      sports: "Finais, cerimônias de abertura e a próxima Copa do Mundo.",
      esports: "Worlds, Majors e o The International.",
      games: "Datas de lançamento e apresentações.",
      film: "Estreias e noites de premiação.",
      tv: "Estreias e finais de temporada.",
      anime: "Inícios de temporada e estreias de filmes.",
      music: "Concursos, turnês e aniversários.",
      entertainment: "Datas de fandom e feriados da cultura pop.",
      politics: "Eleições e as datas que guiam os países.",
      tech: "Conferências, fins de suporte e os relógios que os computadores mantêm.",
      science: "Datas para quem tem curiosidade.",
      space: "Lançamentos, pousos e a longa volta à Lua.",
      astronomy: "Eclipses, chuvas de meteoros, solstícios — encontros marcados com o céu.",
      nature: "A Terra, os oceanos e o calendário da vida.",
      history: "Aniversários de coisas que já aconteceram — e o relógio segue correndo.",
      curiosities: "Marcos do Unix, datas palíndromas, sextas-feiras 13.",
    },

    groups: {
      celebrate: { label: "Comemorar", tagline: "Feriados, datas festivas e as desculpas que a gente guarda." },
      watch: { label: "Assistir", tagline: "Finais, estreias, turnês e o próximo grande lançamento." },
      play: { label: "Jogar", tagline: "Datas de lançamento e apresentações." },
      "look-up": { label: "Olhar para o céu", tagline: "Lançamentos, eclipses e o ano que passa lá em cima." },
      vote: { label: "Votar", tagline: "Eleições, conferências e os relógios que os computadores mantêm." },
      wonder: { label: "Se espantar", tagline: "Aniversários e curiosidades do calendário." },
    },
  },

  seo: {
    homeTitle: "Until — contagem regressiva para tudo o que está por vir",
    siteDescription:
      "Milhares de datas futuras, marcadas e contando. Feriados, eclipses, Copas do Mundo, eleições — e as que você mesmo cria.",
    titleTemplate: "%s · Until",

    event: {
      whenIs: "Quando é {title}? {when}",
      whenIsCoarse: "Quando é {title}? Previsão para {period}",
      countdownColon: "{title}: contagem regressiva — {when}",
      countdownDash: "{title} — contagem regressiva até {when}",
      countdownDashCoarse: "{title} — {when}",
      description: "{title}{status}: {date}. {days} Contagem regressiva e link de calendário.",
      descriptionCoarse:
        "{title} tem previsão para {period}. O dia exato ainda não foi anunciado — a contagem começa assim que sair.",
      statusCancelled: " (cancelado)",
      statusPostponed: " (adiado)",
      fallbackTitle: "Contagem regressiva",
      mineTitle: "Sua contagem regressiva",
      sharedTitle: "Contagem regressiva compartilhada",
      sharedMetaTitle: "{title} — contagem regressiva para {date}",
      sharedMetaDescription: "{title}: {date}. Uma contagem regressiva criada no Until.",
    },

    series: {
      title: "Quantos dias faltam para {title}? — {when}",
      titleNoDate: "Quantos dias faltam para {title}?",
      heading: "Quantos dias faltam para {title}?",
      description: "{title}: {date}. {days} Contagem regressiva, datas de todos os anos e calendário.",
      descriptionCoarse:
        "{title} tem previsão para {period}. Datas de todos os anos, contagem regressiva ao vivo e calendário.",
      descriptionNoDate: "{title}: próximas datas, contagem regressiva para a mais próxima e links de calendário.",
      fallbackTitle: "Quantos dias faltam",
    },

    hub: {
      category: "{category}: próximas datas e contagem regressiva",
      country: "{country}: próximos feriados e eventos",
      month: "O que vem por aí em {month}",
      tag: "{tag} — próximas datas e contagem regressiva",
      lowercaseCategory: false,
    },

    days: {
      today: "É hoje.",
      tomorrow: "É amanhã.",
      yesterday: "Foi ontem.",
      away: { one: "Falta {n} dia.", other: "Faltam {n} dias." } as PluralForms,
      ago: { one: "Foi há {n} dia.", other: "Foi há {n} dias." } as PluralForms,
    },

    period: {
      month: "{month} de {year}",
      quarter: "{q}º trimestre de {year}",
      year: "{year}",
      expected: "previsão para {period}",
      unknown: "data a ser anunciada",
    },

    jsonLd: {
      siteDescription:
        "Contagens regressivas ao vivo e datas de milhares de eventos, feriados e marcos que estão por vir.",
      seriesDescription: "Próximas datas de {title}.",
    },
  },

  home: {
    loading: "Carregando o catálogo",

    hero: {
      eyebrow: "Contagem em destaque",
      meta: "{category} · {when}",
      open: "Abrir esta contagem regressiva",
    },

    hub: {
      alsoOnTheHorizon: "Também no horizonte",
      next7Days: "Próximos 7 dias",
      wholeMonth: "Mês inteiro →",
      browseByCategory: "Explorar por categoria",
      allCategories: "Todas as categorias →",
      popularCountdowns: "Contagens regressivas populares",
      everyRecurringDate: "Todas as datas que se repetem →",
      byCountry: "Por país",
      allCountries: "Todos os países →",
      noCountries: "Os dados por país estão sendo preenchidos.",
      byMonth: "Por mês",
      thisMonth: "Este mês — {month}",
      nextMonth: "Mês que vem — {month}",
    },

    explorer: {
      heading: "O catálogo",
      count: { one: "{n} próxima data.", other: "{n} próximas datas." } as PluralForms,
      countMatching: {
        one: "{n} próxima data para “{q}”.",
        other: "{n} próximas datas para “{q}”.",
      } as PluralForms,
      countInCategory: {
        one: "{n} próxima data na categoria {category}.",
        other: "{n} próximas datas na categoria {category}.",
      } as PluralForms,
      countMatchingInCategory: {
        one: "{n} próxima data para “{q}” na categoria {category}.",
        other: "{n} próximas datas para “{q}” na categoria {category}.",
      } as PluralForms,
      sort: {
        soonest: "Mais próximas",
        popular: "Populares",
        latest: "Mais distantes",
      },
    },

    filters: {
      all: "Todas",
    },

    empty: {
      noMatch: "Nada no catálogo corresponde a “{q}”.",
      nothing: "Nada por aqui ainda.",
      hint: "A busca perdoa erros de digitação e entende siglas, então quase acertar costuma bastar — esta parece ser uma data que o catálogo não tem.",
      busiest: "Categorias mais cheias",
      everyRecurringDate: "Todas as datas que se repetem",
      startOver: "Começar de novo",
    },

    table: {
      date: "Data",
      event: "Evento",
      within: "Quando",
      category: "Categoria",
      empty: "Ainda não há nada marcado por aqui.",
    },

    pagination: "Paginação",
  },

  event: {
    answer: {
      today: "{title} é hoje, {date}.",
      tomorrow: "Falta {n} dia para {title}: é amanhã, {date}.",
      days: {
        one: "Falta {n} dia para {title}: {date}.",
        other: "Faltam {n} dias para {title}: {date}.",
      } as PluralForms,
      past: {
        one: "{title} foi há {n} dia: {date}.",
        other: "{title} foi há {n} dias: {date}.",
      } as PluralForms,
      cancelled: "A data de {title} era {date}, mas o evento foi cancelado.",
      coarse: "{title} tem previsão para {period}. O dia exato ainda não foi anunciado.",
      plain: "{title}: {date}.",
    },

    statusHappened: "Já aconteceu",

    dateRange: "{start} – {end}",

    coarseNote:
      "O dia exato ainda não foi anunciado. Esta página começa a contar assim que a fonte publicar uma data.",
    dateChanged: "Data alterada: antes era {date}.",
    partOfSeries: "Faz parte da série {series} — todo ano, com a próxima data sempre no topo.",
    everyUpcomingDate: "Todas as próximas datas",
    otherYears: "Outros anos",
    alsoComing: "Também por vir",

    fields: {
      where: "Onde",
      tags: "Tags",
    },

    provenance: {
      source: "Fonte:",
      lastVerified: "última verificação em {date}",
      summary: "Resumo de {source} ({license})",
    },

    image: {
      photo: "Foto",
      photoBy: "Foto:",
      via: "via {provider}",
    },

    mine: {
      missingTitle: "Esta contagem regressiva está em outro dispositivo",
      missingBody:
        "As contagens pessoais ficam salvas no navegador que as criou. Se alguém compartilhou um link com você, peça o link de compartilhamento gerado na página de criação.",
      makeNew: "Criar uma nova",
      onThisDevice: "Neste dispositivo",
      remove: "Remover",
      savedCount: {
        one: "{n} data do catálogo salva neste navegador.",
        other: "{n} datas do catálogo salvas neste navegador.",
      } as PluralForms,
    },
  },

  series: {
    index: {
      title: "Quantos dias faltam — todas as contagens que se repetem",
      description:
        "Natal, Ramadã, Super Bowl, Perseidas: todas as datas que voltam todo ano, com a próxima no topo e uma tabela dos anos seguintes.",
      heading: "Quantos dias faltam para…",
      intro: {
        one: "{n} data que volta todo ano. Cada página mantém a próxima ocorrência no topo e lista os anos seguintes.",
        other:
          "{n} datas que voltam todo ano. Cada página mantém a próxima ocorrência no topo e lista os anos seguintes.",
      } as PluralForms,
      empty: "O catálogo está sendo preenchido — volte em breve.",
      jsonLdDescription: "Datas que se repetem, com a próxima ocorrência e uma tabela de vários anos.",
    },

    noUpcoming: "Ainda não há nenhuma data futura de {title} no catálogo.",

    thisYearsPage: "Página deste ano",

    shareTitle: "Quantos dias faltam para {title}",

    upcoming: {
      heading: "Próximas datas",
      note: "Todas as datas de {title} no catálogo a partir de hoje, das mais próximas às mais distantes.",
      empty: "Ainda não há datas futuras — volte depois da próxima atualização.",
    },

    variants: {
      heading: "Outras datas ligadas a esta série",
      note: "Celebrada com o mesmo nome em outro dia em alguns países — listada à parte para que a contagem acima fique na data principal.",
    },

    faqHeading: "Perguntas que as pessoas fazem",

    tagsLabel: "Tags:",

    related: {
      heading: "{category}: mais datas que voltam todo ano",
      all: "Todas as contagens que se repetem",
    },
  },

  hubs: {
    label: {
      browse: "Explorar",
      category: "Categoria",
      country: "País",
      calendar: "Calendário",
      tag: "Tag",
    },

    breadcrumbLabel: "Trilha de navegação",

    paged: {
      title: "{name} (página {n})",
      headingSuffix: "— página {n}",
      backToFirst: "Voltar para a primeira página.",
    },

    categoryIndex: {
      title: "Categorias — todo tipo de data que ainda não aconteceu",
      description:
        "Explore as próximas datas por categoria: feriados, esportes, cinema e séries, jogos, espaço, eleições, aniversários e mais, com contagem regressiva.",
      heading: "Todo tipo de data",
      intro: "Vinte e três categorias, agrupadas pelo que você faria com elas.",
      collectionDescription: "Próximas datas por categoria.",
    },

    category: {
      description: {
        one: "{blurb} {n} próxima data com contagem regressiva ao vivo e links de calendário.",
        other: "{blurb} {n} próximas datas com contagem regressiva ao vivo e links de calendário.",
      } as PluralForms,
      descriptionEmpty: "{blurb} Próximas datas com contagem regressiva ao vivo e links de calendário.",
      descriptionPaged:
        "{blurb} Página {n} das próximas datas, das mais próximas às mais distantes, com contagem regressiva e calendário.",
      heading: "{category}: próximas datas",
      count: { one: "{n} próxima data.", other: "{n} próximas datas." } as PluralForms,
      countPaged: {
        one: "{n} próxima data, da mais próxima em diante.",
        other: "{n} próximas datas, das mais próximas em diante.",
      } as PluralForms,
      soon: "Próximos 30 dias",
      everyYear: "Todo ano",
      all: "{category}: todas as próximas datas",
      empty: "Ainda não há nada nesta categoria.",
    },

    countryIndex: {
      title: "Países — próximos feriados e eventos por país",
      description:
        "Feriados, datas nacionais e eventos locais de mais de 200 países e territórios, com contagem regressiva ao vivo e links de calendário.",
      heading: "Por país",
      intro: {
        one: "{n} país e território com próximos feriados e eventos no catálogo.",
        other: "{n} países e territórios com próximos feriados e eventos no catálogo.",
      } as PluralForms,
      empty: "O catálogo está sendo preenchido — volte em breve.",
      collectionDescription: "Próximos feriados e eventos por país.",
    },

    country: {
      description: {
        one: "{country}: feriados, datas nacionais e eventos — {n} próxima data, mês a mês, com contagem regressiva e links de calendário.",
        other:
          "{country}: feriados, datas nacionais e eventos — {n} próximas datas, mês a mês, com contagem regressiva e links de calendário.",
      } as PluralForms,
      descriptionEmpty:
        "{country}: feriados, datas nacionais e eventos, mês a mês, com contagem regressiva ao vivo e links de calendário.",
      intro:
        "Próximos feriados e eventos marcados com {country}, mês a mês. As datas mundiais — eclipses, lançamentos, dias internacionais — aparecem separadas abaixo.",
      count: { one: "{n} próxima data.", other: "{n} próximas datas." } as PluralForms,
      countCapped: { one: "Mais de {n} próxima data.", other: "Mais de {n} próximas datas." } as PluralForms,
      empty: "Ainda não há datas marcadas com {country}.",
      worldwide: "Datas mundiais por vir",
      collectionDescription: "{country}: feriados e eventos.",
    },

    calendar: {
      description:
        "Tudo o que o catálogo traz para {month}: feriados, lançamentos, finais, estreias e aniversários, dia a dia, com contagem regressiva.",
      count: {
        one: "{n} próxima data em {month}, dia a dia.",
        other: "{n} próximas datas em {month}, dia a dia.",
      } as PluralForms,
      empty: "Ainda não há nada marcado para {month}.",
      months: "Meses",
      previous: "← {month}",
      next: "{month} →",
      collectionDescription: "Próximas datas em {month}.",
    },

    tag: {
      description: {
        one: "{n} próxima data marcada com \"{tag}\", com contagem regressiva ao vivo e links de calendário.",
        other:
          "{n} próximas datas marcadas com \"{tag}\", das mais próximas em diante, com contagem regressiva e calendário.",
      } as PluralForms,
      descriptionPaged:
        "Página {n} das datas marcadas com \"{tag}\", das mais próximas em diante, com contagem regressiva e calendário.",
      crumb: "#{tag}",
      count: {
        one: "{n} próxima data marcada com “{tag}”.",
        other: "{n} próximas datas marcadas com “{tag}”, das mais próximas em diante.",
      } as PluralForms,
      searchPrompt: "Procurando outra coisa?",
      searchLink: "Busque “{tag}” no catálogo inteiro.",
      collectionDescription: "Próximas datas marcadas com {tag}.",
    },
  },

  pages: {
    about: {
      title: "Sobre",
      description: "Como o Until reúne, marca e classifica milhares de datas futuras.",
      eyebrow: "O projeto",
      heading: "Um jornal do futuro",

      intro:
        "O Until é um catálogo de datas que ainda não aconteceram. Feriados de quase todos os países, eventos programados extraídos das páginas de ano da Wikipédia e do Wikidata, mais uma camada curada das datas que as pessoas de fato esperam — eclipses, Copas do Mundo, Olimpíadas, eleições, o cometa Halley.",
      categories:
        "Cada registro é marcado e classificado em {n} categorias — feriados, datas nacionais, esportes, astronomia, espaço, tecnologia, política, história e mais. Busque em tudo, filtre uma categoria, abra uma contagem regressiva ao vivo e leve a data para o seu calendário.",
      sources:
        "A base dos feriados é o conjunto de dados offline {dateHolidays}, ampliado com {wikidata} e {wikipedia}. Nomes repetidos no mesmo dia (o Natal em 140 países) viram uma contagem só. Quando as fontes discordam, o registro curado vence. Cada página de evento diz qual é a sua fonte e quando a data foi verificada pela última vez.",
      expected:
        "Datas sem dia confirmado aparecem como “previsão”, com o mês, o trimestre ou o ano que a fonte informa, e não começam a contar enquanto não sair uma data real. O catálogo é atualizado diariamente a partir das fontes.",
      yourOwn:
        "Você pode criar a sua. Ela fica no navegador — sem conta — e o link de compartilhamento leva o título e a data na URL, para qualquer pessoa abrir o mesmo relógio correndo.",

      stats: {
        dates: "Datas",
        featured: "Em destaque",
        updated: "Atualizado",
      },

      byCategory: {
        heading: "Por categoria",
        empty: "O catálogo está sendo preenchido — volte em breve.",
      },

      bySource: {
        heading: "Por fonte",
        empty: "Nenhuma fonte informada ainda.",
      },
    },

    attributions: {
      title: "Atribuições — de onde vêm as datas",
      description:
        "Todas as fontes do catálogo do Until, com licença e a atribuição que cada uma pede: date-holidays, Wikipédia, Wikidata, Hebcal, Launch Library e mais.",
      eyebrow: "Fontes",
      heading: "Atribuições",
      intro:
        "O Until só usa fontes cujos termos permitem armazenar e republicar os dados. Fontes com compartilhamento pela mesma licença (texto da Wikipédia, TVMaze, dados do date-holidays) são creditadas em toda página que as usa; imagens só entram sob CC0, domínio público, CC BY ou CC BY-SA, com o autor identificado. Cada página de evento tem link para o registro que a originou.",
      sourcesEmpty: "A lista de fontes está indisponível no momento.",

      images: {
        heading: "Imagens",
        policy:
          "As fotos são cópias re-hospedadas, redimensionadas e servidas do nosso próprio armazenamento, para que os sites originais nunca sejam acessados direto. Só aceitamos arquivos com licença livre — CC0, domínio público, CC BY, CC BY-SA e algumas licenças nacionais de dados abertos, mais as imagens da NASA sob as diretrizes de mídia dela. Arquivos de uso justo, licenças não comerciais (NC) e sem derivações (ND) são recusados de saída, assim como arquivos com restrição de marca ou de imagem de pessoa, e todo arquivo guardado mantém autor, licença e um link de volta para a página do arquivo. Eventos sem foto livre recebem um cartão gerado.",
        shareAlike:
          "As fotos com compartilhamento pela mesma licença (CC BY-SA) são publicadas sem modificação, nas proporções originais e com o crédito embaixo. Elas nunca são cortadas em um cartão de rede social: essa composição seria obra derivada e teria de carregar a mesma licença, então esses cartões usam o design gerado. Os arquivos guardados são reconferidos com a fonte todo mês; um que tenha sido apagado ou deixado de ser livre sai do nosso armazenamento e suas páginas voltam para o cartão gerado.",
        empty: "Nenhuma imagem re-hospedada ainda.",
        count: {
          one: "{n} imagem na biblioteca hoje:",
          other: "{n} imagens na biblioteca hoje:",
        } as PluralForms,
      },

      fonts:
        "Tipografia: Fraunces (SIL Open Font License) e Geist (SIL Open Font License). Astronomia calculada com astronomy-engine (MIT).",
    },

    create: {
      title: "Criar uma contagem regressiva",
      description: "Crie uma contagem regressiva pessoal e leve para o seu calendário.",
      eyebrow: "Suas datas",
      heading: "Crie uma contagem regressiva",
      intro:
        "Aniversários, lançamentos, uma viagem, uma audiência, um reencontro. Ela conta igual às do catálogo — e vai direto para o Google Calendar, o Outlook ou um arquivo .ics.",

      form: {
        draftTitle: "Algo que estou esperando",
        draftNote: "Uma contagem regressiva que você criou.",
        titleLabel: "Título",
        dateLabel: "Data",
        categoryLabel: "Categoria",
        noteLabel: "Observação",
        notePlaceholder: "Por que essa data importa para você.",
        save: "Salvar neste dispositivo",
        openShareable: "Abrir página compartilhável",
        saved: "Salvo. {link} — fica neste navegador até você limpar os dados.",
        savedLink: "Ver a página",
        privacy:
          "As contagens personalizadas ficam no seu dispositivo (sem conta). O link de compartilhamento leva o título e a data na URL.",
        previewLabel: "Prévia ao vivo",
        chooseDate: "Escolha uma data para o relógio começar.",
      },
    },

    notFound: {
      heading: "Esta data não está no catálogo",
      body: "Ela pode ter sido unificada, renomeada ou nunca ter existido.",
      backHome: "Voltar para tudo o que está por vir",
    },
  },

  embed: {
    countdown: {
      units: {
        days: { one: "dia", other: "dias" } as PluralForms,
        hours: "h",
        minutes: "min",
        seconds: "seg",
      },
      today: "É hoje.",
      past: "Isso já aconteceu.",
    },

    studio: {
      heading: "Leve com você",

      controls: {
        preset: "Predefinição",
        digits: "Números",
        type: "Texto",
        background: "Fundo",
        transparent: "Transparente — deixa a cena ou a página aparecer",
        font: "Fonte",
        size: "Tamanho",
        layout: "Layout",
        units: "Unidades",
        separator: "Separador",
        frame: "Moldura",
        radius: "Cantos arredondados",
        inset: "Recuo da borda",
        position: "Posição",
        done: "Mensagem do fim",
        reset: "Restaurar",
        colourPicker: "{label} — seletor de cor",
      },

      toggles: {
        unitLabels: "Nomes das unidades",
        title: "Título",
        date: "Data",
        note: "Observação",
        wordmark: "Marca",
        glow: "Brilho",
        trim: "Tirar zeros à esquerda",
      },

      presets: {
        dark: "Until escuro",
        light: "Claro",
        amber: "Âmbar",
        mono: "Mono",
        neon: "Neon",
        clear: "Transparente",
      },

      fonts: {
        serif: "Serifada",
        sans: "Sem serifa",
        mono: "Monoespaçada",
      },

      layouts: {
        row: "Em linha",
        stack: "Empilhado",
        compact: "Compacto",
        big: "Um número grande",
      },

      separators: {
        colon: "Dois-pontos",
        dot: "Ponto",
        space: "Espaço",
        none: "Nenhum",
      },

      frames: {
        card: "Cartão",
        outline: "Contorno",
        none: "Nenhuma",
      },

      units: {
        dhms: "Dias · horas · minutos · segundos",
        dhm: "Dias · horas · minutos",
        dh: "Dias · horas",
        d: "Dias",
        hms: "Horas · minutos · segundos",
        hm: "Horas · minutos",
        ms: "Minutos · segundos",
      },

      positions: {
        "top-left": "Superior esquerdo",
        top: "Superior",
        "top-right": "Superior direito",
        left: "Esquerda",
        center: "Centro",
        right: "Direita",
        "bottom-left": "Inferior esquerdo",
        bottom: "Inferior",
        "bottom-right": "Inferior direito",
      },

      copy: {
        code: "Copiar código",
        url: "Copiar URL",
      },

      embed: {
        previewTitle: "Prévia da incorporação",
        paste: "Cole isto na sua página",
        codeLabel: "Código de incorporação",
        note: "Ele entra com largura total e {height}px de altura. WordPress, Ghost e Notion também aceitam o link da própria contagem e acham o iframe sozinhos — mas aí aparece o cartão padrão, então cole o código acima para manter o que você montou aqui.",
      },

      stream: {
        previewTitle: "Prévia do overlay para live",
        canvasNote: "A tela de {width} × {height}, reduzida — o xadrez é o que o OBS deixa transparente.",
        urlLabel: "URL da fonte de navegador",
        source: "Fonte de navegador · {width} × {height}",
        steps: [
          "No OBS ou no Streamlabs, adicione uma fonte de navegador.",
          "Cole a URL acima.",
          "Defina o tamanho como {width} × {height} — a tela em que a posição é medida.",
          "Deixe o fundo transparente; o overlay já traz o dele.",
          "Marque “Atualizar navegador quando a cena ficar ativa” para o relógio começar do zero.",
        ],
      },
    },
  },
};
