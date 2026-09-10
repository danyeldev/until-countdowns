/**
 * Japanese messages. See `en/` for what each key is for.
 *
 * Four decisions a maintainer should not undo:
 * - The money phrase is "{title}まであと何日？" — the exact string people type into a search box
 *   ("クリスマスまであと何日"). It carries the series `<h1>`, the series title and the countdown-dash
 *   event title, and the answer sentence under it echoes it word for word ("{title}まであと{n}日").
 *   Dated occurrences in the "when is" categories take the other real query, "{title}はいつ？".
 * - `seo.titleTemplate` separates with "｜", the full-width bar Japanese SERPs are built out of.
 *   Titles that need an internal break use the same bar; everything else runs on, as Japanese does.
 * - `seo.hub.lowercaseCategory` is false. Japanese has no letter case, and lower-casing would only
 *   reach the Latin inside a label ("eスポーツ", "NBA"), where it does damage and buys nothing.
 * - Japanese has one plural category (`other` is all ICU selects for `ja-JP`) and no plural noun,
 *   so every `PluralForms` object carries `other` alone. Counted nouns take their counter instead:
 *   件 for catalog rows and images, か国 for countries, 日 for days, ページ for pages.
 *
 * Register is です・ます throughout — the reader is a stranger arriving from a search result — and
 * punctuation is full-width (。、：？（）「」) because the surrounding text is.
 */
import type { Messages } from "./en";
import type { PluralForms } from "./types";

export const ja: Messages = {
  common: {
    siteName: "Until",
    tagline: "まだ起きていないことのカタログ。",
    wordmarkLine: "Until — まだ起きていないことのカタログ。",

    nav: {
      categories: "カテゴリ",
      countries: "国",
      daysUntil: "あと何日",
      create: "作る",
      about: "このサイトについて",
    },

    search: {
      label: "検索",
      navLabel: "カウントダウンを検索",
      placeholder: "カタログを検索…",
      navPlaceholder: "日食、ワールドカップ、祝日を検索…",
      submit: "検索",
    },

    breadcrumb: {
      home: "ホーム",
    },

    footer: {
      datesCount: { other: "{n}件の日付" } as PluralForms,
      aboutTheData: "データについて",
      attributions: "出典",
      categories: "カテゴリ",
      browse: "さがす",
      all: "すべて →",
      makeYourOwn: "自分で作る",
      language: "言語",
    },

    actions: {
      share: "共有",
      shareCopied: "リンクをコピーしました",
      save: "保存",
      saved: "保存しました",
      addToCalendar: "カレンダーに追加",
      google: "Google Calendar",
      outlook: "Outlook",
      downloadIcs: ".ics をダウンロード",
      embed: "サイトに埋め込む",
      stream: "配信に追加",
      copy: "コピー",
      copied: "コピーしました",
    },

    labels: {
      worldwide: "世界共通",
      countriesCount: { other: "{n}か国" } as PluralForms,
      recurring: "毎年",
      series: "シリーズ",
      today: "今日",
      tba: "未定",
      dateToBeAnnounced: "後日発表の日付",
      nothingHereYet: "ここにはまだ何もありません",
      more: "もっと見る",
      seeAll: "すべて見る →",
      loading: "読み込み中…",
      source: "出典",
      sources: "出典",
      lastVerified: "最終確認",
    },

    status: {
      scheduled: "予定",
      tentative: "暫定",
      postponed: "延期",
      cancelled: "中止",
      done: "完了",
      retired: "廃止",
    },

    units: {
      days: "日",
      hours: "時間",
      minutes: "分",
      seconds: "秒",
      daysShort: "日",
      hoursShort: "時",
      minutesShort: "分",
      secondsShort: "秒",
    },

    pagination: {
      previous: "前へ",
      next: "次へ",
      page: "{n}ページ",
      pageOf: "{n} / {total}ページ",
    },

    languageSwitcher: {
      label: "言語",
      description: "Until をほかの言語で読む",
    },
  },

  categories: {
    labels: {
      holidays: "祝日",
      national: "建国記念日",
      religion: "宗教",
      awareness: "国際デー",
      fun: "おもしろ記念日",
      culture: "文化",
      festivals: "祭り",
      sports: "スポーツ",
      esports: "eスポーツ",
      games: "ゲーム",
      film: "映画",
      tv: "テレビ",
      anime: "アニメ",
      music: "音楽",
      entertainment: "エンタメ",
      politics: "政治",
      tech: "テクノロジー",
      science: "科学",
      space: "宇宙開発",
      astronomy: "天文",
      nature: "自然",
      history: "歴史",
      curiosities: "雑学",
    },

    blurbs: {
      holidays: "公休日と、人々が守り続けてきた習わし。",
      national: "独立記念日、共和国記念日、建国の祝典。",
      religion: "さまざまな宗教の祝祭日、断食、聖なる日。",
      awareness: "国連の記念日と国際デー。",
      fun: "ピザの日、海賊の言葉で話す日、そのほか祝うための口実。",
      culture: "祭り、祝祭日、そして市民の暦。",
      festivals: "カーニバル、市、人が集まる催し。",
      sports: "決勝、開会式、そして次のワールドカップ。",
      esports: "Worlds、Major、The International。",
      games: "発売日とショーケース。",
      film: "公開日と授賞式の夜。",
      tv: "シーズンの初回と最終回。",
      anime: "放送開始日と劇場版の公開日。",
      music: "コンテスト、ツアー、記念日。",
      entertainment: "ファンダムの記念日と、ポップカルチャーの聖なる日。",
      politics: "選挙と、国の針路を決める日。",
      tech: "カンファレンス、サポート終了日、そしてコンピューターが刻む時計。",
      science: "好奇心のための日付。",
      space: "打ち上げ、着陸、そして月へ戻る長い道のり。",
      astronomy: "日食、流星群、至点 — 空との約束。",
      nature: "地球、海、そして生きものの一年。",
      history: "すでに起きたことの記念日 — 時計はまだ動いています。",
      curiosities: "Unix 時間の節目、回文の日付、13日の金曜日。",
    },

    groups: {
      celebrate: { label: "祝う", tagline: "祝日、祝祭日、そして祝うための口実。" },
      watch: { label: "観る", tagline: "決勝、公開、ツアー、そして次の大型リリース。" },
      play: { label: "遊ぶ", tagline: "発売日とショーケース。" },
      "look-up": { label: "見上げる", tagline: "打ち上げ、日食、そして巡る季節。" },
      vote: { label: "投票する", tagline: "選挙、カンファレンス、コンピューターが刻む時計。" },
      wonder: { label: "驚く", tagline: "記念日と、暦の不思議。" },
    },
  },

  seo: {
    homeTitle: "Until｜これから起こることのカウントダウン",
    siteDescription:
      "何千もの未来の日付を、タグをつけて秒単位で。祝日、日食、ワールドカップ、選挙 — そして自分で作るカウントダウンも。",
    titleTemplate: "%s｜Until",

    event: {
      whenIs: "{title}はいつ？{when}",
      whenIsCoarse: "{title}はいつ？{period}ごろ予定",
      countdownColon: "{title}カウントダウン：{when}",
      countdownDash: "{title}まであと何日？{when}",
      countdownDashCoarse: "{title}（{when}）",
      description: "{title}{status}は{date}。{days}リアルタイムのカウントダウンとカレンダー登録。",
      descriptionCoarse:
        "{title}は{period}ごろの予定。正確な日付はまだ未発表です。発表され次第カウントダウンを開始、カレンダー登録も。",
      statusCancelled: "（中止）",
      statusPostponed: "（延期）",
      fallbackTitle: "カウントダウン",
      mineTitle: "あなたのカウントダウン",
      sharedTitle: "共有されたカウントダウン",
      sharedMetaTitle: "{title}｜{date}までのカウントダウン",
      sharedMetaDescription: "{title}は{date}。Until で作られたカウントダウンです。",
    },

    series: {
      title: "{title}まであと何日？｜{when}",
      titleNoDate: "{title}まであと何日？",
      heading: "{title}まであと何日？",
      description: "{title}は{date}。{days}毎年の日付一覧、リアルタイムのカウントダウン、カレンダー登録。",
      descriptionCoarse:
        "次の{title}は{period}ごろの予定。毎年の日付一覧、リアルタイムのカウントダウン、カレンダー登録。",
      descriptionNoDate: "{title}の今後の日付、次回までのリアルタイムのカウントダウン、カレンダー登録リンク。",
      fallbackTitle: "あと何日",
    },

    hub: {
      category: "今後の{category}｜日付とカウントダウン",
      country: "{country}の今後の祝日とイベント",
      month: "{month}の予定とイベント一覧",
      tag: "{tag}｜今後の日付とカウントダウン",
      lowercaseCategory: false,
    },

    days: {
      today: "今日です。",
      tomorrow: "明日です。",
      yesterday: "昨日でした。",
      away: { other: "あと{n}日です。" } as PluralForms,
      ago: { other: "{n}日前でした。" } as PluralForms,
    },

    period: {
      month: "{year}年{month}",
      quarter: "{year}年第{q}四半期",
      year: "{year}年",
      expected: "{period}ごろ予定",
      unknown: "日付未定",
    },

    jsonLd: {
      siteDescription: "何千もの今後のイベント、祝日、節目の日付とリアルタイムのカウントダウン。",
      seriesDescription: "{title}の今後の日付。",
    },
  },

  home: {
    loading: "カタログを読み込み中",

    hero: {
      eyebrow: "注目のカウントダウン",
      meta: "{category}・{when}",
      open: "このカウントダウンを開く",
    },

    hub: {
      alsoOnTheHorizon: "そのほかの近日予定",
      next7Days: "今後7日間",
      wholeMonth: "今月まるごと →",
      browseByCategory: "カテゴリから探す",
      allCategories: "カテゴリ一覧 →",
      popularCountdowns: "人気のカウントダウン",
      everyRecurringDate: "毎年くり返す日付をすべて →",
      byCountry: "国から探す",
      allCountries: "国の一覧 →",
      noCountries: "国のデータは追加中です。",
      byMonth: "月から探す",
      thisMonth: "今月（{month}）",
      nextMonth: "来月（{month}）",
    },

    explorer: {
      heading: "カタログ",
      count: { other: "今後の日付{n}件。" } as PluralForms,
      countMatching: {
        other: "「{q}」に一致する今後の日付{n}件。",
      } as PluralForms,
      countInCategory: {
        other: "{category}の今後の日付{n}件。",
      } as PluralForms,
      countMatchingInCategory: {
        other: "{category}で「{q}」に一致する今後の日付{n}件。",
      } as PluralForms,
      sort: {
        soonest: "近い順",
        popular: "人気順",
        latest: "遠い順",
      },
    },

    filters: {
      all: "すべて",
    },

    empty: {
      noMatch: "「{q}」に一致するものはカタログにありません。",
      nothing: "ここにはまだ何もありません。",
      hint: "つづりの多少の違いや頭文字でも見つかるようになっているので、近ければ届くはずです。これはカタログにない日付のようです。",
      busiest: "件数の多いカテゴリ",
      everyRecurringDate: "毎年くり返す日付をすべて",
      startOver: "最初からやり直す",
    },

    table: {
      date: "日付",
      event: "イベント",
      within: "残り",
      category: "カテゴリ",
      empty: "ここにはまだ予定がありません。",
    },

    pagination: "ページ送り",
  },

  event: {
    answer: {
      today: "{title}は今日、{date}です。",
      tomorrow: "{title}まであと{n}日、明日{date}です。",
      days: {
        other: "{title}まであと{n}日、{date}です。",
      } as PluralForms,
      past: {
        other: "{title}は{n}日前、{date}でした。",
      } as PluralForms,
      cancelled: "{title}は{date}に予定されていましたが、中止になりました。",
      coarse: "{title}は{period}ごろの予定です。正確な日付はまだ発表されていません。",
      plain: "{title}は{date}です。",
    },

    statusHappened: "終了",

    dateRange: "{start}〜{end}",

    coarseNote:
      "正確な日付はまだ発表されていません。情報源が日付を公開した時点で、このページのカウントダウンが動き出します。",
    dateChanged: "日付が変更されました。以前は{date}。",
    partOfSeries: "{series}シリーズの1つです。毎年の日付を、次回を一番上にしてまとめています。",
    everyUpcomingDate: "今後の日付をすべて",
    otherYears: "ほかの年",
    alsoComing: "こちらも近日",

    fields: {
      where: "場所",
      tags: "タグ",
    },

    provenance: {
      source: "出典：",
      lastVerified: "最終確認 {date}",
      summary: "{source}（{license}）より要約",
    },

    image: {
      photo: "写真",
      photoBy: "写真：",
      via: "{provider} 経由",
    },

    mine: {
      missingTitle: "このカウントダウンは別の端末にあります",
      missingBody:
        "自分で作ったカウントダウンは、作成したブラウザの中だけに保存されます。誰かからリンクを教えてもらった場合は、作成ページで発行される共有用の URL を送ってもらってください。",
      makeNew: "新しく作る",
      onThisDevice: "この端末に保存",
      remove: "削除",
      savedCount: {
        other: "このブラウザにカタログの日付を{n}件保存しています。",
      } as PluralForms,
    },
  },

  series: {
    index: {
      title: "あと何日？｜毎年くり返す日付のカウントダウン一覧",
      description:
        "クリスマス、ラマダン、スーパーボウル、ペルセウス座流星群 — カタログにある毎年くり返す日付を、次回を先頭に、これからの年の一覧つきで。",
      heading: "…まであと何日？",
      intro: {
        other: "毎年くり返す日付が{n}件。各ページは次回を一番上に置き、これからの年を一覧にしています。",
      } as PluralForms,
      empty: "カタログは追加中です。しばらくしてからもう一度どうぞ。",
      jsonLdDescription: "毎年くり返す日付。次回の日付と、複数年の一覧つき。",
    },

    noUpcoming: "{title}の今後の日付は、まだカタログにありません。",

    thisYearsPage: "今年のページ",

    shareTitle: "{title}まであと何日",

    upcoming: {
      heading: "今後の日付",
      note: "カタログにある今日以降の{title}を、近い順にすべて。",
      empty: "今後の日付はまだありません。次回の更新後にご確認ください。",
    },

    variants: {
      heading: "このシリーズに関連するほかの日付",
      note: "いくつかの国では同じ名前で別の日に祝われます。上のカウントダウンを主要な日付に保つため、分けて掲載しています。",
    },

    faqHeading: "よくある質問",

    tagsLabel: "タグ：",

    related: {
      heading: "毎年くり返す{category}をもっと見る",
      all: "毎年くり返すカウントダウンをすべて",
    },
  },

  hubs: {
    label: {
      browse: "さがす",
      category: "カテゴリ",
      country: "国",
      calendar: "カレンダー",
      tag: "タグ",
    },

    breadcrumbLabel: "パンくずリスト",

    paged: {
      title: "{name}（{n}ページ目）",
      headingSuffix: "（{n}ページ目）",
      backToFirst: "1ページ目に戻る。",
    },

    categoryIndex: {
      title: "カテゴリ一覧｜まだ起きていない日付のすべての種類",
      description:
        "今後の日付をカテゴリから探す：祝日、スポーツ、映画・テレビ、ゲーム、宇宙、選挙、記念日など。すべてリアルタイムのカウントダウンつき。",
      heading: "カテゴリから探す",
      intro: "23のカテゴリを、何に使うかでまとめています。",
      collectionDescription: "カテゴリ別の今後の日付。",
    },

    category: {
      description: {
        other: "{blurb}今後の日付{n}件を、リアルタイムのカウントダウンとカレンダー登録つきで。",
      } as PluralForms,
      descriptionEmpty: "{blurb}今後の日付を、リアルタイムのカウントダウンとカレンダー登録つきで。",
      descriptionPaged:
        "{blurb}今後の日付の{n}ページ目。近い順に、リアルタイムのカウントダウンとカレンダー登録つき。",
      heading: "今後の{category}",
      count: { other: "今後の日付{n}件。" } as PluralForms,
      countPaged: {
        other: "今後の日付{n}件、近い順。",
      } as PluralForms,
      soon: "今後30日",
      everyYear: "毎年",
      all: "今後の{category}をすべて",
      empty: "このカテゴリにはまだ何もありません。",
    },

    countryIndex: {
      title: "国の一覧｜国別の今後の祝日とイベント",
      description:
        "200を超える国と地域の公休日、建国記念日、地域のイベント。すべてリアルタイムのカウントダウンとカレンダー登録つき。",
      heading: "国から探す",
      intro: {
        other: "{n}の国と地域に、今後の祝日やイベントがカタログにあります。",
      } as PluralForms,
      empty: "カタログは追加中です。しばらくしてからもう一度どうぞ。",
      collectionDescription: "国別の今後の祝日とイベント。",
    },

    country: {
      description: {
        other:
          "{country}の祝日、建国記念日、イベント — 今後の日付{n}件を月ごとに、リアルタイムのカウントダウンとカレンダー登録つきで。",
      } as PluralForms,
      descriptionEmpty:
        "{country}の祝日、建国記念日、イベントを月ごとに、リアルタイムのカウントダウンとカレンダー登録つきで。",
      intro:
        "{country}のタグがついた今後の祝日とイベントを、月ごとに。日食、公開日、国際デーなど世界共通の日付は、下に分けて掲載しています。",
      count: { other: "今後の日付{n}件。" } as PluralForms,
      countCapped: { other: "今後の日付{n}件以上。" } as PluralForms,
      empty: "{country}のタグがついた日付はまだありません。",
      worldwide: "世界共通の近日予定",
      collectionDescription: "{country}の祝日とイベント。",
    },

    calendar: {
      description:
        "{month}のカタログにあるすべて：祝日、打ち上げ、決勝、公開、記念日を日ごとに、リアルタイムのカウントダウンつきで。",
      count: {
        other: "{month}の今後の日付{n}件を、日ごとに。",
      } as PluralForms,
      empty: "{month}の今後の日付はまだありません。",
      months: "月の切り替え",
      previous: "← {month}",
      next: "{month} →",
      collectionDescription: "{month}の今後の日付。",
    },

    tag: {
      description: {
        other:
          "「{tag}」のタグがついた今後の日付{n}件。近い順に、リアルタイムのカウントダウンとカレンダー登録つき。",
      } as PluralForms,
      descriptionPaged:
        "「{tag}」のタグがついた今後の日付の{n}ページ目。近い順に、リアルタイムのカウントダウンとカレンダー登録つき。",
      crumb: "#{tag}",
      count: {
        other: "「{tag}」のタグがついた今後の日付{n}件、近い順。",
      } as PluralForms,
      searchPrompt: "ほかをお探しですか？",
      searchLink: "カタログ全体から「{tag}」を検索する。",
      collectionDescription: "{tag}のタグがついた今後の日付。",
    },
  },

  pages: {
    about: {
      title: "このサイトについて",
      description: "Until が何千もの未来の日付をどう集め、タグをつけ、分類しているか。",
      eyebrow: "プロジェクト",
      heading: "未来の新聞",

      intro:
        "Until は、まだ起きていない日付のカタログです。ほぼすべての国の公休日、Wikipedia の年別ページと Wikidata から集めた予定、そして人が実際に待っているもの — 日食、ワールドカップ、オリンピック、選挙、ハレー彗星 — を厳選して重ねています。",
      categories:
        "一つひとつの日付に、祝日、建国記念日、スポーツ、天文、宇宙開発、テクノロジー、政治、歴史などの{n}カテゴリでタグと分類がついています。全体を検索し、カテゴリで絞り込み、リアルタイムのカウントダウンを開いて、カレンダーに追加できます。",
      sources:
        "祝日の土台はオフラインの {dateHolidays} データセットで、{wikidata} と {wikipedia} で補っています。同じ日の同じ名前（140か国のクリスマス）は1つのカウントダウンにまとめます。情報源が食い違うときは、厳選した記録を優先します。各イベントのページには、出典と最終確認日を明記しています。",
      expected:
        "日付が確定していないものは「予定」として、情報源が示す月・四半期・年を添えて掲載し、実際の日付が公開されるまでカウントダウンは動きません。カタログは毎日、情報源から更新されます。",
      yourOwn:
        "自分で作ることもできます。作ったものはブラウザの中だけに残り、アカウントは不要です。共有リンクはタイトルと日付を URL に含むので、誰でも同じ時計を開けます。",

      stats: {
        dates: "日付",
        featured: "注目",
        updated: "更新",
      },

      byCategory: {
        heading: "カテゴリ別",
        empty: "カタログは追加中です。しばらくしてからもう一度どうぞ。",
      },

      bySource: {
        heading: "出典別",
        empty: "報告されている出典はまだありません。",
      },
    },

    attributions: {
      title: "出典｜日付はどこから来たのか",
      description:
        "Until のカタログを支えるすべての情報源と、そのライセンス、求められる表示：date-holidays、Wikipedia、Wikidata、Hebcal、Launch Library など。",
      eyebrow: "情報源",
      heading: "出典表示",
      intro:
        "Until は、データの保存と再公開を認める条件の情報源だけを取り込んでいます。継承ライセンスの情報源（Wikipedia の文章、TVMaze、date-holidays のデータ）は、それを使うすべてのページでクレジットを表示します。画像は CC0、パブリックドメイン、CC BY、CC BY-SA のものだけを、作者名を明記したうえで再ホストしています。各イベントのページは、元になった記録へリンクします。",
      sourcesEmpty: "情報源の一覧を今は取得できません。",

      images: {
        heading: "画像",
        policy:
          "写真は再ホストした複製で、リサイズして自前のストレージから配信しています。元のホストに直リンクすることはありません。受け入れるのは自由なライセンスのファイルだけ — CC0、パブリックドメイン、CC BY、CC BY-SA、いくつかの国のオープンガバメントライセンス、そしてメディアガイドラインに基づく NASA の画像です。フェアユースのファイル、非営利（NC）や改変禁止（ND）のライセンス、商標や肖像の制限がつくファイルはすべて除外します。保存したファイルはすべて作者名、ライセンス、ファイルページへのリンクを保持します。自由な写真がないイベントには、生成したカードを使います。",
        shareAlike:
          "継承ライセンス（CC BY-SA）の写真は、改変せず、元の比率のまま、下にクレジットを添えて掲載します。SNS 用カードに切り抜くことはありません。その合成物は二次的著作物にあたり、同じ継承ライセンスを引き継ぐ必要があるためで、そうしたカードには生成デザインを使います。保存したファイルは毎月、出典と照らして再確認し、削除されたものや自由なライセンスでなくなったものはストレージから取り除き、そのページは生成カードに切り替わります。",
        empty: "再ホストした画像はまだありません。",
        count: {
          other: "現在ライブラリにある画像は{n}件：",
        } as PluralForms,
      },

      fonts:
        "フォント：Fraunces（SIL Open Font License）と Geist（SIL Open Font License）。天文計算は astronomy-engine（MIT）。",
    },

    create: {
      title: "カウントダウンを作る",
      description: "自分だけのカウントダウンを作って、カレンダーに追加。",
      eyebrow: "あなたの日付",
      heading: "カウントダウンを作る",
      intro:
        "誕生日、発売日、旅行、裁判の日、同窓会。カタログと同じように動き、Google Calendar や Outlook、.ics ファイルにそのまま入れられます。",

      form: {
        draftTitle: "楽しみにしていること",
        draftNote: "あなたが作ったカウントダウン。",
        titleLabel: "タイトル",
        dateLabel: "日付",
        categoryLabel: "カテゴリ",
        noteLabel: "メモ",
        notePlaceholder: "この日付が自分にとって大切な理由。",
        save: "この端末に保存",
        openShareable: "共有ページを開く",
        saved: "保存しました。{link} — ストレージを消すまで、このブラウザの中に残ります。",
        savedLink: "表示する",
        privacy:
          "作ったカウントダウンは端末の中に残ります（アカウント不要）。共有リンクは、タイトルと日付を URL に埋め込みます。",
        previewLabel: "リアルタイムのプレビュー",
        chooseDate: "日付を選ぶと時計が動き出します。",
      },
    },

    notFound: {
      heading: "この日付はカタログにありません",
      body: "統合されたか、名前が変わったか、もともと存在しなかったのかもしれません。",
      backHome: "これから起こることへ戻る",
    },
  },

  embed: {
    countdown: {
      units: {
        days: { other: "日" } as PluralForms,
        hours: "時",
        minutes: "分",
        seconds: "秒",
      },
      today: "今日です。",
      past: "これはもう終わりました。",
    },

    studio: {
      heading: "持ち出して使う",

      controls: {
        preset: "プリセット",
        digits: "数字の色",
        type: "文字の色",
        background: "背景色",
        transparent: "透明 — 背景の映像やページを透かします",
        font: "フォント",
        size: "サイズ",
        layout: "レイアウト",
        units: "単位",
        separator: "区切り",
        frame: "枠",
        radius: "角の丸み",
        inset: "内側の余白",
        position: "位置",
        done: "終了後のメッセージ",
        reset: "リセット",
        colourPicker: "{label} — カラーピッカー",
      },

      toggles: {
        unitLabels: "単位のラベル",
        title: "タイトル",
        date: "日付",
        note: "メモ",
        wordmark: "ロゴ",
        glow: "グロー",
        trim: "先頭の0を省く",
      },

      presets: {
        dark: "Until ダーク",
        light: "ライト",
        amber: "アンバー",
        mono: "モノクロ",
        neon: "ネオン",
        clear: "透明",
      },

      fonts: {
        serif: "セリフ",
        sans: "サンセリフ",
        mono: "等幅",
      },

      layouts: {
        row: "横並び",
        stack: "縦積み",
        compact: "コンパクト",
        big: "大きな数字ひとつ",
      },

      separators: {
        colon: "コロン",
        dot: "ドット",
        space: "スペース",
        none: "なし",
      },

      frames: {
        card: "カード",
        outline: "枠線",
        none: "なし",
      },

      units: {
        dhms: "日・時・分・秒",
        dhm: "日・時・分",
        dh: "日・時",
        d: "日",
        hms: "時・分・秒",
        hm: "時・分",
        ms: "分・秒",
      },

      positions: {
        "top-left": "左上",
        top: "上",
        "top-right": "右上",
        left: "左",
        center: "中央",
        right: "右",
        "bottom-left": "左下",
        bottom: "下",
        "bottom-right": "右下",
      },

      copy: {
        code: "コードをコピー",
        url: "URL をコピー",
      },

      embed: {
        previewTitle: "埋め込みプレビュー",
        paste: "これをページに貼り付けてください",
        codeLabel: "埋め込みコード",
        note: "全幅・高さ {height}px で表示されます。WordPress、Ghost、Notion はカウントダウンのリンクを貼るだけでも埋め込みを見つけますが、それだと標準のカードが展開されます。ここで作った見た目のままにするには、上のコードを貼り付けてください。",
      },

      stream: {
        previewTitle: "配信オーバーレイのプレビュー",
        canvasNote: "{width} × {height} のキャンバスを縮小表示。市松模様は OBS が透過させる部分です。",
        urlLabel: "ブラウザソースの URL",
        source: "ブラウザソース・{width} × {height}",
        steps: [
          "OBS または Streamlabs で「ブラウザ」ソースを追加します。",
          "上の URL を貼り付けます。",
          "サイズを {width} × {height} に設定します。位置の基準になるキャンバスです。",
          "背景は透明のままにしてください。オーバーレイが自前の背景を持っています。",
          "「シーンがアクティブになったらブラウザの表示を更新する」にチェックを入れると、時計が最初から動き出します。",
        ],
      },
    },
  },
};
