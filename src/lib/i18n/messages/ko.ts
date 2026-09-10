/**
 * Korean messages. See `en/` for what each key is for.
 *
 * Four decisions a maintainer should not undo:
 * - The money phrase is "{title}까지 며칠 남았을까?". It carries both strings Koreans actually type
 *   ("…까지 며칠", "…며칠 남았"), and "까지" is one of the few particles with no allomorph, so it
 *   attaches safely to any title — Hangul, Latin ("Super Bowl까지"), or digits.
 * - No template ever puts a case particle on a placeholder. 은/는, 이/가, 을/를, 와/과 all depend on
 *   whether the preceding syllable ends in a consonant, which we cannot know for a `{title}`,
 *   `{tag}` or `{q}` we never see. So every sentence hosts its particle on one of our own nouns
 *   ("{title} 날짜는 …", "{title} 일정은 …", "“{q}” 검색 결과, …") or uses an invariant one
 *   (까지, 에, 의, 도). A hard-coded "은" would be visibly wrong on half the corpus.
 * - `lowercaseCategory` is false. Hangul has no case, so lowercasing buys nothing, and it would
 *   turn the labels that are not Hangul ("TV", "e스포츠") into "tv" and "e스포츠" in every title.
 * - Korean has no plural agreement and no numeral-driven inflection, so every plural object carries
 *   only `other` — which is the single category `Intl.PluralRules("ko-KR")` ever selects.
 */
import type { Messages } from "./en";
import type { PluralForms } from "./types";

export const ko: Messages = {
  common: {
    siteName: "Until",
    tagline: "아직 일어나지 않은 일들의 목록.",
    wordmarkLine: "Until — 아직 일어나지 않은 일들의 목록.",

    nav: {
      categories: "카테고리",
      countries: "국가",
      daysUntil: "며칠 남았을까",
      create: "만들기",
      about: "소개",
    },

    search: {
      label: "검색",
      navLabel: "카운트다운 검색",
      placeholder: "카탈로그에서 검색…",
      navPlaceholder: "일식, 월드컵, 공휴일 검색…",
      submit: "검색",
    },

    breadcrumb: {
      home: "홈",
    },

    footer: {
      datesCount: { other: "{n}개의 날짜" } as PluralForms,
      aboutTheData: "데이터 안내",
      attributions: "출처 표기",
      categories: "카테고리",
      browse: "둘러보기",
      all: "전체 →",
      makeYourOwn: "직접 만들기",
      language: "언어",
    },

    actions: {
      share: "공유",
      shareCopied: "링크 복사됨",
      save: "저장",
      saved: "저장됨",
      addToCalendar: "캘린더에 추가",
      google: "Google Calendar",
      outlook: "Outlook",
      downloadIcs: ".ics 내려받기",
      embed: "내 사이트에 넣기",
      stream: "방송에 넣기",
      copy: "복사",
      copied: "복사됨",
    },

    labels: {
      worldwide: "전 세계",
      countriesCount: { other: "{n}개국" } as PluralForms,
      recurring: "매년 반복",
      series: "시리즈",
      today: "오늘",
      tba: "미정",
      dateToBeAnnounced: "추후 발표될 날짜",
      nothingHereYet: "아직 아무것도 없습니다",
      more: "더 보기",
      seeAll: "전체 보기 →",
      loading: "불러오는 중…",
      source: "출처",
      sources: "출처",
      lastVerified: "마지막 확인",
    },

    status: {
      scheduled: "예정",
      tentative: "잠정",
      postponed: "연기",
      cancelled: "취소",
      done: "종료",
      retired: "중단",
    },

    units: {
      days: "일",
      hours: "시간",
      minutes: "분",
      seconds: "초",
      daysShort: "일",
      hoursShort: "시",
      minutesShort: "분",
      secondsShort: "초",
    },

    pagination: {
      previous: "이전",
      next: "다음",
      page: "{n}페이지",
      pageOf: "{total}페이지 중 {n}페이지",
    },

    languageSwitcher: {
      label: "언어",
      description: "Until을 다른 언어로 읽기",
    },
  },

  categories: {
    labels: {
      holidays: "공휴일",
      national: "국경일",
      religion: "종교 기념일",
      awareness: "국제 기념일",
      fun: "재미있는 날",
      culture: "문화",
      festivals: "축제",
      sports: "스포츠",
      esports: "e스포츠",
      games: "게임",
      film: "영화",
      tv: "TV",
      anime: "애니메이션",
      music: "음악",
      entertainment: "엔터테인먼트",
      politics: "정치",
      tech: "테크",
      science: "과학",
      space: "우주",
      astronomy: "천문",
      nature: "자연",
      history: "역사",
      curiosities: "이색 날짜",
    },

    blurbs: {
      holidays: "공휴일과 우리가 지켜 온 의식들.",
      national: "독립기념일, 제헌절, 나라의 기념일.",
      religion: "여러 종교의 축일, 금식일, 성일.",
      awareness: "유엔 기념일과 국제 기념일.",
      fun: "피자의 날, 해적처럼 말하는 날, 그 밖의 핑곗거리.",
      culture: "축제, 축일, 그리고 도시의 공식 달력.",
      festivals: "카니발, 장터, 사람이 모이는 날.",
      sports: "결승전, 개회식, 그리고 다음 월드컵.",
      esports: "롤드컵, 메이저, 그리고 The International.",
      games: "출시일과 쇼케이스.",
      film: "개봉일과 시상식의 밤.",
      tv: "시즌 시작과 최종회.",
      anime: "분기 시작과 극장판 개봉.",
      music: "경연, 투어, 기념일.",
      entertainment: "팬들의 달력과 대중문화의 기념일.",
      politics: "선거와 나라의 방향을 정하는 날짜.",
      tech: "콘퍼런스, 지원 종료일, 그리고 컴퓨터가 세는 시간.",
      science: "궁금한 사람들을 위한 날짜.",
      space: "발사와 착륙, 그리고 달로 돌아가는 먼 길.",
      astronomy: "일식, 유성우, 지점 — 하늘과 잡은 약속.",
      nature: "지구, 바다, 그리고 살아 있는 한 해.",
      history: "이미 일어난 일의 기념일 — 시계는 여전히 돕니다.",
      curiosities: "유닉스 시간의 이정표, 회문 날짜, 13일의 금요일.",
    },

    groups: {
      celebrate: { label: "축하", tagline: "공휴일, 축일, 그리고 우리가 챙기는 핑곗거리." },
      watch: { label: "관람", tagline: "결승전, 개봉, 투어, 그리고 다음 대작." },
      play: { label: "플레이", tagline: "출시일과 쇼케이스." },
      "look-up": { label: "하늘 보기", tagline: "발사, 일식, 그리고 살아 있는 한 해." },
      vote: { label: "투표", tagline: "선거, 콘퍼런스, 그리고 컴퓨터가 세는 시간." },
      wonder: { label: "호기심", tagline: "기념일과 달력의 진기한 날들." },
    },
  },

  seo: {
    homeTitle: "Until — 다가오는 모든 것의 카운트다운",
    siteDescription:
      "수천 개의 미래 날짜에 태그를 붙이고 시계를 돌립니다. 공휴일, 일식, 월드컵, 선거 — 직접 만든 날짜까지.",
    titleTemplate: "%s · Until",

    event: {
      whenIs: "{title} 언제? {when}",
      whenIsCoarse: "{title} 언제? {period} 예정",
      countdownColon: "{title} 카운트다운: {when}",
      countdownDash: "{title} — {when} 카운트다운",
      countdownDashCoarse: "{title} — {when}",
      description: "{title}{status} 날짜는 {date}입니다. {days} 실시간 카운트다운, 캘린더에 추가.",
      descriptionCoarse:
        "{title} 일정은 {period} 예정입니다. 정확한 날짜는 아직 미정입니다. 발표되면 시계가 돕니다. 캘린더에 추가.",
      statusCancelled: " (취소)",
      statusPostponed: " (연기)",
      fallbackTitle: "카운트다운",
      mineTitle: "내 카운트다운",
      sharedTitle: "공유된 카운트다운",
      sharedMetaTitle: "{title} — {date} 카운트다운",
      sharedMetaDescription: "{title} 날짜는 {date}입니다. Until에서 누군가 만든 카운트다운.",
    },

    series: {
      title: "{title}까지 며칠 남았을까? — {when}",
      titleNoDate: "{title}까지 며칠 남았을까?",
      heading: "{title}까지 며칠 남았을까?",
      description: "{title} 날짜는 {date}입니다. {days} 실시간 카운트다운, 연도별 날짜, 캘린더에 추가.",
      descriptionCoarse:
        "다음 {title} 일정은 {period} 예정입니다. 연도별 날짜, 실시간 카운트다운, 캘린더에 추가.",
      descriptionNoDate: "{title}: 다가오는 날짜, 다음 날짜까지의 실시간 카운트다운, 캘린더 링크.",
      fallbackTitle: "며칠 남았을까",
    },

    hub: {
      category: "다가오는 {category} — 카운트다운과 날짜",
      country: "{country} 공휴일과 다가오는 일정",
      month: "{month} — 다가오는 일정",
      tag: "{tag} — 다가오는 날짜와 카운트다운",
      lowercaseCategory: false,
    },

    days: {
      today: "오늘입니다.",
      tomorrow: "내일입니다.",
      yesterday: "어제였습니다.",
      away: { other: "{n}일 남았습니다." } as PluralForms,
      ago: { other: "{n}일 지났습니다." } as PluralForms,
    },

    period: {
      month: "{year}년 {month}",
      quarter: "{year}년 {q}분기",
      year: "{year}년",
      expected: "{period} 예정",
      unknown: "날짜 미정",
    },

    jsonLd: {
      siteDescription: "다가오는 수천 개의 일정, 공휴일, 이정표의 날짜와 실시간 카운트다운.",
      seriesDescription: "{title}의 다가오는 날짜.",
    },
  },

  home: {
    loading: "카탈로그 불러오는 중",

    hero: {
      eyebrow: "추천 카운트다운",
      meta: "{category} · {when}",
      open: "이 카운트다운 열기",
    },

    hub: {
      alsoOnTheHorizon: "곧 다가오는 일정",
      next7Days: "앞으로 7일",
      wholeMonth: "이번 달 전체 →",
      browseByCategory: "카테고리로 둘러보기",
      allCategories: "전체 카테고리 →",
      popularCountdowns: "인기 카운트다운",
      everyRecurringDate: "매년 반복되는 모든 날짜 →",
      byCountry: "국가별",
      allCountries: "전체 국가 →",
      noCountries: "국가 데이터를 채우는 중입니다.",
      byMonth: "월별",
      thisMonth: "이번 달 — {month}",
      nextMonth: "다음 달 — {month}",
    },

    explorer: {
      heading: "카탈로그",
      count: { other: "다가오는 날짜 {n}개." } as PluralForms,
      countMatching: {
        other: "“{q}” 검색 결과, 다가오는 날짜 {n}개.",
      } as PluralForms,
      countInCategory: {
        other: "{category} 카테고리의 다가오는 날짜 {n}개.",
      } as PluralForms,
      countMatchingInCategory: {
        other: "{category} 카테고리에서 “{q}” 검색 결과, 다가오는 날짜 {n}개.",
      } as PluralForms,
      sort: {
        soonest: "가까운 순",
        popular: "인기순",
        latest: "먼 순",
      },
    },

    filters: {
      all: "전체",
    },

    empty: {
      noMatch: "카탈로그에 “{q}” 검색 결과가 없습니다.",
      nothing: "아직 아무것도 없습니다.",
      hint: "철자가 조금 틀려도, 앞 글자만 써도 대개 찾아냅니다 — 이건 카탈로그에 없는 날짜인 것 같습니다.",
      busiest: "가장 붐비는 카테고리",
      everyRecurringDate: "매년 반복되는 모든 날짜",
      startOver: "처음부터 다시",
    },

    table: {
      date: "날짜",
      event: "일정",
      within: "남은 기간",
      category: "카테고리",
      empty: "아직 예정된 일정이 없습니다.",
    },

    pagination: "페이지 이동",
  },

  event: {
    answer: {
      today: "{title} 날짜는 오늘, {date}입니다.",
      tomorrow: "{title}까지 {n}일 남았습니다. 내일, {date}입니다.",
      days: {
        other: "{title}까지 {n}일 남았습니다. 날짜는 {date}입니다.",
      } as PluralForms,
      past: {
        other: "{title} 일정은 {n}일 전인 {date}에 있었습니다.",
      } as PluralForms,
      cancelled: "{title} 일정은 {date}에 예정되어 있었으나 취소되었습니다.",
      coarse: "{title} 일정은 {period} 예정입니다. 정확한 날짜는 아직 발표되지 않았습니다.",
      plain: "{title} 날짜는 {date}입니다.",
    },

    statusHappened: "지난 일정",

    dateRange: "{start} – {end}",

    coarseNote:
      "정확한 날짜는 아직 발표되지 않았습니다. 출처가 날짜를 공개하면 이 페이지의 시계가 돌기 시작합니다.",
    dateChanged: "날짜 변경: 이전 날짜는 {date}.",
    partOfSeries: "{series} 시리즈의 일부입니다 — 매년 돌아오고, 다음 날짜가 늘 맨 위에 있습니다.",
    everyUpcomingDate: "다가오는 모든 날짜",
    otherYears: "다른 연도",
    alsoComing: "함께 다가오는 일정",

    fields: {
      where: "장소",
      tags: "태그",
    },

    provenance: {
      source: "출처:",
      lastVerified: "{date} 마지막 확인",
      summary: "요약 출처: {source} ({license})",
    },

    image: {
      photo: "사진",
      photoBy: "사진:",
      via: "{provider} 경유",
    },

    mine: {
      missingTitle: "이 카운트다운은 다른 기기에 있습니다",
      missingBody:
        "직접 만든 카운트다운은 만든 브라우저에만 저장됩니다. 누군가 링크를 보내 줬다면, 만들기 페이지에서 나오는 공유용 주소를 다시 받아 보세요.",
      makeNew: "새로 만들기",
      onThisDevice: "이 기기에 저장됨",
      remove: "삭제",
      savedCount: {
        other: "이 브라우저에 저장된 카탈로그 날짜 {n}개.",
      } as PluralForms,
    },
  },

  series: {
    index: {
      title: "며칠 남았을까 — 매년 돌아오는 모든 카운트다운",
      description:
        "크리스마스, 라마단, 슈퍼볼, 페르세우스자리 유성우. 카탈로그에서 매년 돌아오는 모든 날짜를 다음 날짜부터, 앞으로의 연도 표와 함께.",
      heading: "…까지 며칠 남았을까?",
      intro: {
        other:
          "매년 돌아오는 날짜 {n}개. 각 페이지는 다음 날짜를 맨 위에 두고 앞으로의 연도를 정리합니다.",
      } as PluralForms,
      empty: "카탈로그를 채우는 중입니다 — 곧 다시 확인해 주세요.",
      jsonLdDescription: "다음 날짜와 연도별 표가 함께 있는, 매년 반복되는 날짜.",
    },

    noUpcoming: "{title}의 다가오는 날짜가 아직 카탈로그에 없습니다.",

    thisYearsPage: "올해 페이지",

    shareTitle: "{title}까지 며칠",

    upcoming: {
      heading: "다가오는 날짜",
      note: "카탈로그에 있는 오늘 이후의 모든 {title} 날짜, 가까운 순.",
      empty: "아직 앞으로의 날짜가 없습니다 — 다음 갱신 뒤에 다시 확인해 주세요.",
    },

    variants: {
      heading: "이 시리즈에 연결된 다른 날짜",
      note: "몇몇 나라에서는 같은 이름으로 다른 날에 지냅니다 — 위 카운트다운이 대표 날짜를 지키도록 따로 정리했습니다.",
    },

    faqHeading: "사람들이 자주 묻는 것",

    tagsLabel: "태그:",

    related: {
      heading: "매년 돌아오는 다른 {category}",
      all: "매년 반복되는 모든 카운트다운",
    },
  },

  hubs: {
    label: {
      browse: "둘러보기",
      category: "카테고리",
      country: "국가",
      calendar: "캘린더",
      tag: "태그",
    },

    breadcrumbLabel: "이동 경로",

    paged: {
      title: "{name} ({n}페이지)",
      headingSuffix: "— {n}페이지",
      backToFirst: "첫 페이지로 돌아가기.",
    },

    categoryIndex: {
      title: "카테고리 — 아직 일어나지 않은 모든 종류의 날짜",
      description:
        "카테고리로 다가오는 날짜를 둘러보세요. 공휴일, 스포츠, 영화와 TV, 게임, 우주, 선거, 기념일까지 모두 실시간 카운트다운과 함께.",
      heading: "모든 종류의 날짜",
      intro: "카테고리 23개, 무엇에 쓸지에 따라 묶었습니다.",
      collectionDescription: "카테고리별 다가오는 날짜.",
    },

    category: {
      description: {
        other: "{blurb} 실시간 카운트다운과 캘린더 링크가 있는 다가오는 날짜 {n}개.",
      } as PluralForms,
      descriptionEmpty: "{blurb} 실시간 카운트다운과 캘린더 링크가 있는 다가오는 날짜들.",
      descriptionPaged:
        "{blurb} 다가오는 날짜의 {n}페이지, 가까운 순. 실시간 카운트다운과 캘린더 링크와 함께.",
      heading: "다가오는 {category}",
      count: { other: "다가오는 날짜 {n}개." } as PluralForms,
      countPaged: { other: "다가오는 날짜 {n}개, 가까운 순." } as PluralForms,
      soon: "앞으로 30일",
      everyYear: "매년",
      all: "다가오는 {category} 전체",
      empty: "이 카테고리에는 아직 아무것도 없습니다.",
    },

    countryIndex: {
      title: "국가 — 나라별 다가오는 공휴일과 일정",
      description:
        "200개가 넘는 나라와 지역의 공휴일, 국경일, 현지 일정을 실시간 카운트다운과 캘린더 링크와 함께.",
      heading: "국가별",
      intro: {
        other: "카탈로그에 다가오는 공휴일과 일정이 있는 나라·지역 {n}곳.",
      } as PluralForms,
      empty: "카탈로그를 채우는 중입니다 — 곧 다시 확인해 주세요.",
      collectionDescription: "나라별 다가오는 공휴일과 일정.",
    },

    country: {
      description: {
        other:
          "{country}의 공휴일, 국경일, 일정 — 다가오는 날짜 {n}개를 달별로 묶어 실시간 카운트다운과 캘린더 링크와 함께.",
      } as PluralForms,
      descriptionEmpty:
        "{country}의 공휴일, 국경일, 일정을 달별로 묶어 실시간 카운트다운과 캘린더 링크와 함께.",
      intro:
        "{country} 태그가 붙은 다가오는 공휴일과 일정을 달별로 정리했습니다. 전 세계 공통 날짜 — 일식, 출시일, 국제 기념일 — 는 아래에 따로 있습니다.",
      count: { other: "다가오는 날짜 {n}개." } as PluralForms,
      countCapped: { other: "다가오는 날짜 {n}개 이상." } as PluralForms,
      empty: "{country} 태그가 붙은 날짜가 아직 없습니다.",
      worldwide: "전 세계, 다가오는 일정",
      collectionDescription: "{country}의 공휴일과 일정.",
    },

    calendar: {
      description:
        "{month} 카탈로그 전체. 공휴일, 발사, 결승전, 개봉, 기념일을 날짜순으로, 실시간 카운트다운과 함께.",
      count: {
        other: "{month}에 다가오는 날짜 {n}개, 날짜순.",
      } as PluralForms,
      empty: "{month}에는 아직 다가오는 일정이 없습니다.",
      months: "월 이동",
      previous: "← {month}",
      next: "{month} →",
      collectionDescription: "{month}의 다가오는 날짜.",
    },

    tag: {
      description: {
        other:
          "“{tag}” 태그가 붙은 다가오는 날짜 {n}개, 가까운 순. 실시간 카운트다운과 캘린더 링크와 함께.",
      } as PluralForms,
      descriptionPaged:
        "“{tag}” 태그가 붙은 다가오는 날짜의 {n}페이지, 가까운 순. 실시간 카운트다운과 캘린더 링크와 함께.",
      crumb: "#{tag}",
      count: {
        other: "“{tag}” 태그가 붙은 다가오는 날짜 {n}개, 가까운 순.",
      } as PluralForms,
      searchPrompt: "다른 걸 찾고 계신가요?",
      searchLink: "카탈로그 전체에서 “{tag}” 검색하기.",
      collectionDescription: "{tag} 태그가 붙은 다가오는 날짜.",
    },
  },

  pages: {
    about: {
      title: "소개",
      description: "Until이 수천 개의 미래 날짜를 모으고, 태그를 붙이고, 분류하는 방법.",
      eyebrow: "프로젝트",
      heading: "미래의 신문",

      intro:
        "Until은 아직 일어나지 않은 날짜의 카탈로그입니다. 거의 모든 나라의 공휴일, 위키백과 연도 문서와 Wikidata에서 모은 예정된 일정, 그리고 사람들이 실제로 기다리는 것들을 따로 손질해 얹었습니다 — 일식, 월드컵, 올림픽, 선거, 핼리 혜성.",
      categories:
        "모든 항목에는 태그가 붙고 {n}개 카테고리로 분류됩니다 — 공휴일, 국경일, 스포츠, 천문, 우주, 테크, 정치, 역사 등. 전체를 검색하고, 카테고리로 걸러내고, 실시간 카운트다운을 열고, 캘린더에 넣으세요.",
      sources:
        "공휴일의 뼈대는 오프라인 {dateHolidays} 데이터셋이고, 여기에 {wikidata}와 {wikipedia}를 덧댑니다. 같은 날 같은 이름이 겹치면(140개국의 크리스마스) 하나의 카운트다운으로 합칩니다. 출처가 서로 어긋나면 손질한 기록이 이깁니다. 모든 일정 페이지는 출처와 날짜를 마지막으로 확인한 시점을 밝힙니다.",
      expected:
        "확정된 날이 없는 날짜는 출처가 알려 준 달·분기·연도와 함께 “예정”으로 표시하고, 실제 날짜가 나오기 전까지는 시계가 돌지 않습니다. 카탈로그는 매일 출처에서 갱신됩니다.",
      yourOwn:
        "직접 만들 수도 있습니다. 직접 만든 카운트다운은 브라우저에만 남고 — 계정은 필요 없습니다 — 공유 링크가 제목과 날짜를 URL에 담아, 누구나 같은 시계를 열 수 있습니다.",

      stats: {
        dates: "날짜",
        featured: "추천",
        updated: "갱신",
      },

      byCategory: {
        heading: "카테고리별",
        empty: "카탈로그를 채우는 중입니다 — 곧 다시 확인해 주세요.",
      },

      bySource: {
        heading: "출처별",
        empty: "아직 보고된 출처가 없습니다.",
      },
    },

    attributions: {
      title: "출처 표기 — 날짜는 어디에서 오는가",
      description:
        "Until 카탈로그를 이루는 모든 출처와 각각의 라이선스, 그리고 요구하는 표기. date-holidays, 위키백과, Wikidata, Hebcal, Launch Library 등.",
      eyebrow: "출처",
      heading: "출처 표기",
      intro:
        "Until은 데이터를 저장하고 다시 공개하는 것이 약관상 허용된 출처만 수집합니다. 동일조건변경허락 출처(위키백과 본문, TVMaze, date-holidays 데이터)는 쓰는 페이지마다 표기하고, 이미지는 CC0·퍼블릭 도메인·CC BY·CC BY-SA 라이선스로 저작자를 밝힌 것만 다시 호스팅합니다. 모든 일정 페이지는 그 페이지가 만들어진 원본 기록으로 링크를 답니다.",
      sourcesEmpty: "지금은 출처 목록을 불러올 수 없습니다.",

      images: {
        heading: "이미지",
        policy:
          "사진은 크기를 조정해 자체 스토리지에서 내보내는 복사본이라, 원본 호스트에 직접 링크하는 일은 없습니다. 자유 라이선스 파일만 받습니다 — CC0, 퍼블릭 도메인, CC BY, CC BY-SA, 몇몇 나라의 공공 데이터 개방 라이선스, 그리고 미디어 가이드라인을 따르는 NASA 이미지. 공정 이용 파일, 비영리(NC)와 변경 금지(ND) 라이선스는 그대로 거절하고, 상표나 초상권 제한이 붙은 파일도 마찬가지입니다. 저장한 파일은 저작자, 라이선스, 파일 설명 페이지로 돌아가는 링크를 함께 보관합니다. 자유 라이선스 사진이 없는 일정에는 대신 생성된 카드를 붙입니다.",
        shareAlike:
          "동일조건변경허락(CC BY-SA) 사진은 고치지 않고 원래 비율 그대로, 아래에 저작자 표기를 달아 싣습니다. 소셜 카드로 잘라 쓰지는 않습니다. 그렇게 합성하면 2차적 저작물이 되어 같은 동일조건변경허락 라이선스를 따라야 하기 때문에, 그런 카드에는 생성된 디자인을 씁니다. 저장한 파일은 매달 출처와 다시 대조합니다. 삭제되었거나 더 이상 자유 라이선스가 아닌 파일은 스토리지에서 지우고, 그 페이지는 생성된 카드로 돌아갑니다.",
        empty: "다시 호스팅한 이미지가 아직 없습니다.",
        count: {
          other: "현재 라이브러리에 있는 이미지 {n}개:",
        } as PluralForms,
      },

      fonts:
        "글꼴: Fraunces(SIL Open Font License)와 Geist(SIL Open Font License). 천문 계산은 astronomy-engine(MIT).",
    },

    create: {
      title: "카운트다운 만들기",
      description: "나만의 카운트다운을 만들어 캘린더에 넣으세요.",
      eyebrow: "내 날짜",
      heading: "카운트다운 만들기",
      intro:
        "생일, 출시, 여행, 재판 날짜, 동창회. 카탈로그와 똑같이 돌아가고 — Google Calendar, Outlook, .ics 파일로 바로 넣을 수 있습니다.",

      form: {
        draftTitle: "내가 기다리는 무언가",
        draftNote: "직접 만든 카운트다운.",
        titleLabel: "제목",
        dateLabel: "날짜",
        categoryLabel: "카테고리",
        noteLabel: "메모",
        notePlaceholder: "이 날짜가 나에게 중요한 이유.",
        save: "이 기기에 저장",
        openShareable: "공유용 페이지 열기",
        saved: "저장했습니다. {link} — 저장소를 비우기 전까지 이 브라우저에 남습니다.",
        savedLink: "보러 가기",
        privacy:
          "직접 만든 카운트다운은 기기에 남습니다(계정 없음). 공유 링크는 제목과 날짜를 URL에 담습니다.",
        previewLabel: "실시간 미리보기",
        chooseDate: "날짜를 고르면 시계가 돌기 시작합니다.",
      },
    },

    notFound: {
      heading: "이 날짜는 카탈로그에 없습니다",
      body: "합쳐졌거나, 이름이 바뀌었거나, 처음부터 없었을 수 있습니다.",
      backHome: "다가오는 모든 것으로",
    },
  },

  embed: {
    countdown: {
      units: {
        days: { other: "일" } as PluralForms,
        hours: "시간",
        minutes: "분",
        seconds: "초",
      },
      today: "오늘입니다.",
      past: "이미 지난 일정입니다.",
    },

    studio: {
      heading: "가져가서 쓰기",

      controls: {
        preset: "프리셋",
        digits: "숫자",
        type: "글자",
        background: "배경",
        transparent: "투명 — 뒤의 화면이나 페이지가 비칩니다",
        font: "글꼴",
        size: "크기",
        layout: "배치",
        units: "단위",
        separator: "구분 기호",
        frame: "테두리",
        radius: "모서리 둥글기",
        inset: "가장자리 여백",
        position: "위치",
        done: "종료 문구",
        reset: "초기화",
        colourPicker: "{label} — 색상 선택",
      },

      toggles: {
        unitLabels: "단위 이름",
        title: "제목",
        date: "날짜",
        note: "메모",
        wordmark: "워드마크",
        glow: "발광",
        trim: "앞자리 0 지우기",
      },

      presets: {
        dark: "Until 다크",
        light: "라이트",
        amber: "앰버",
        mono: "모노",
        neon: "네온",
        clear: "투명",
      },

      fonts: {
        serif: "명조",
        sans: "고딕",
        mono: "고정폭",
      },

      layouts: {
        row: "가로",
        stack: "세로",
        compact: "간결",
        big: "큰 숫자 하나",
      },

      separators: {
        colon: "콜론",
        dot: "점",
        space: "공백",
        none: "없음",
      },

      frames: {
        card: "카드",
        outline: "선",
        none: "없음",
      },

      units: {
        dhms: "일 · 시간 · 분 · 초",
        dhm: "일 · 시간 · 분",
        dh: "일 · 시간",
        d: "일",
        hms: "시간 · 분 · 초",
        hm: "시간 · 분",
        ms: "분 · 초",
      },

      positions: {
        "top-left": "왼쪽 위",
        top: "위",
        "top-right": "오른쪽 위",
        left: "왼쪽",
        center: "가운데",
        right: "오른쪽",
        "bottom-left": "왼쪽 아래",
        bottom: "아래",
        "bottom-right": "오른쪽 아래",
      },

      copy: {
        code: "코드 복사",
        url: "URL 복사",
      },

      embed: {
        previewTitle: "임베드 미리보기",
        paste: "이 코드를 페이지에 붙여넣으세요",
        codeLabel: "임베드 코드",
        note: "너비는 전체, 높이는 {height}px로 들어갑니다. WordPress, Ghost, Notion은 카운트다운 링크만 붙여도 임베드를 알아서 찾지만 그러면 기본 카드가 펼쳐집니다 — 여기서 만든 모습 그대로 쓰려면 위 코드를 붙여넣으세요.",
      },

      stream: {
        previewTitle: "방송 오버레이 미리보기",
        canvasNote: "{width} × {height} 캔버스를 줄인 모습 — 체크무늬는 OBS가 투명하게 걸러내는 부분입니다.",
        urlLabel: "브라우저 소스 URL",
        source: "브라우저 소스 · {width} × {height}",
        steps: [
          "OBS나 Streamlabs에서 브라우저 소스를 추가합니다.",
          "위 URL을 붙여넣습니다.",
          "크기를 {width} × {height}로 맞춥니다 — 위치를 재는 기준이 되는 캔버스입니다.",
          "배경은 투명하게 둡니다. 오버레이가 자기 배경을 가지고 옵니다.",
          "“장면이 활성화될 때 브라우저 새로 고침”을 켜 두면 시계가 처음부터 돕니다.",
        ],
      },
    },
  },
};
