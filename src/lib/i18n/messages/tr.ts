/**
 * Turkish messages. See `en/` for what each key is for.
 *
 * Two decisions a maintainer should not undo:
 * - The money phrase is "{title} için kaç gün kaldı?". Turkish would normally take a dative suffix
 *   on the entity itself ("yılbaşına kaç gün kaldı"), but the suffix depends on vowel harmony and
 *   on the final letter of a title we never see, so any hard-coded "-e"/"-a" is wrong half the time
 *   and visibly wrong in a SERP. "için" is grammatical after every noun phrase and keeps the queried
 *   string "kaç gün kaldı" intact. The same reasoning gives "{country} etiketli", "{month} için" and
 *   "{title} tarihi: {date}" — every template attaches its suffixes to our own words, never to a
 *   placeholder.
 * - Turkish takes no plural after a numeral ("3 gün", never "3 günler"), so `one` and `other` carry
 *   the same wording. Both forms are still written out because the test requires every ICU category.
 */
import type { Messages } from "./en";
import type { PluralForms } from "./types";

export const tr: Messages = {
  common: {
    siteName: "Until",
    tagline: "henüz olmamış şeylerin kataloğu.",
    wordmarkLine: "Until — henüz olmamış şeylerin kataloğu.",

    nav: {
      categories: "Kategoriler",
      countries: "Ülkeler",
      daysUntil: "Kaç gün kaldı",
      create: "Oluştur",
      about: "Hakkında",
    },

    search: {
      label: "Ara",
      navLabel: "Geri sayım ara",
      placeholder: "Katalogda ara…",
      navPlaceholder: "Tutulma, Dünya Kupası, bayram ara…",
      submit: "Ara",
    },

    breadcrumb: {
      home: "Ana sayfa",
    },

    footer: {
      datesCount: { one: "{n} tarih", other: "{n} tarih" } as PluralForms,
      aboutTheData: "veriler hakkında",
      attributions: "kaynaklar",
      categories: "Kategoriler",
      browse: "Keşfet",
      all: "tümü →",
      makeYourOwn: "Kendin oluştur",
      language: "Dil",
    },

    actions: {
      share: "Paylaş",
      shareCopied: "Bağlantı kopyalandı",
      save: "Kaydet",
      saved: "Kaydedildi",
      addToCalendar: "Takvime ekle",
      google: "Google Calendar",
      outlook: "Outlook",
      downloadIcs: ".ics indir",
      embed: "Sitene ekle",
      stream: "Yayınına ekle",
      copy: "Kopyala",
      copied: "Kopyalandı",
    },

    labels: {
      worldwide: "Dünya geneli",
      countriesCount: { one: "{n} ülke", other: "{n} ülke" } as PluralForms,
      recurring: "Tekrarlanan",
      series: "Seri",
      today: "Bugün",
      tba: "Tarih belirsiz",
      dateToBeAnnounced: "açıklanacak bir tarih",
      nothingHereYet: "Burada henüz bir şey yok",
      more: "Daha fazla",
      seeAll: "Tümünü gör →",
      loading: "Yükleniyor…",
      source: "Kaynak",
      sources: "Kaynaklar",
      lastVerified: "Son doğrulama",
    },

    status: {
      scheduled: "Planlandı",
      tentative: "Kesinleşmedi",
      postponed: "Ertelendi",
      cancelled: "İptal edildi",
      done: "Tamamlandı",
      retired: "Kaldırıldı",
    },

    units: {
      days: "gün",
      hours: "saat",
      minutes: "dakika",
      seconds: "saniye",
      daysShort: "g",
      hoursShort: "sa",
      minutesShort: "dk",
      secondsShort: "sn",
    },

    pagination: {
      previous: "Önceki",
      next: "Sonraki",
      page: "Sayfa {n}",
      pageOf: "Sayfa {n} / {total}",
    },

    languageSwitcher: {
      label: "Dil",
      description: "Until'i başka bir dilde okuyun",
    },
  },

  categories: {
    labels: {
      holidays: "Resmî tatiller",
      national: "Ulusal günler",
      religion: "Dinî günler",
      awareness: "Farkındalık günleri",
      fun: "Eğlenceli günler",
      culture: "Kültür",
      festivals: "Festivaller",
      sports: "Spor",
      esports: "E-spor",
      games: "Oyunlar",
      film: "Sinema",
      tv: "Diziler",
      anime: "Anime",
      music: "Müzik",
      entertainment: "Eğlence",
      politics: "Siyaset",
      tech: "Teknoloji",
      science: "Bilim",
      space: "Uzay",
      astronomy: "Gök olayları",
      nature: "Doğa",
      history: "Yıl dönümleri",
      curiosities: "Takvim tuhaflıkları",
    },

    blurbs: {
      holidays: "Resmî tatiller ve sürdürdüğümüz ritüeller.",
      national: "Bağımsızlık günleri, cumhuriyet bayramları, ulusal kutlamalar.",
      religion: "Farklı inançlardan bayramlar, oruçlar ve kutsal günler.",
      awareness: "BM anma günleri ve uluslararası günler.",
      fun: "Pizza Günü, Korsan Gibi Konuş Günü ve diğer bahaneler.",
      culture: "Festivaller, yortular ve şehrin resmî takvimi.",
      festivals: "Karnavallar, fuarlar ve buluşmalar.",
      sports: "Finaller, açılış törenleri ve sıradaki Dünya Kupası.",
      esports: "Worlds, Major'lar ve The International.",
      games: "Çıkış tarihleri ve tanıtım etkinlikleri.",
      film: "Vizyon tarihleri ve ödül geceleri.",
      tv: "Sezon başlangıçları ve finaller.",
      anime: "Sezon başlangıçları ve film çıkışları.",
      music: "Yarışmalar, turneler ve yıl dönümleri.",
      entertainment: "Hayran takvimi ve pop kültürün kutsal günleri.",
      politics: "Seçimler ve ülkelerin rotasını belirleyen tarihler.",
      tech: "Konferanslar, destek bitiş tarihleri ve bilgisayarların tuttuğu saatler.",
      science: "Meraklısı için tarihler.",
      space: "Fırlatmalar, inişler ve Ay'a uzanan uzun yol.",
      astronomy: "Tutulmalar, meteor yağmurları, gündönümleri — gökyüzüyle randevular.",
      nature: "Dünya, okyanuslar ve yaşayan yıl.",
      history: "Çoktan yaşanmış olayların yıl dönümleri — sayaç hâlâ işliyor.",
      curiosities: "Unix dönüm noktaları, palindrom tarihler, 13. Cuma günleri.",
    },

    groups: {
      celebrate: { label: "Kutla", tagline: "Bayramlar, yortular ve sürdürdüğümüz bahaneler." },
      watch: { label: "İzle", tagline: "Finaller, galalar, turneler ve sıradaki büyük çıkış." },
      play: { label: "Oyna", tagline: "Çıkış tarihleri ve tanıtım etkinlikleri." },
      "look-up": { label: "Gökyüzüne bak", tagline: "Fırlatmalar, tutulmalar ve yaşayan yıl." },
      vote: { label: "Oy ver", tagline: "Seçimler, konferanslar ve bilgisayarların tuttuğu saatler." },
      wonder: { label: "Merak et", tagline: "Yıl dönümleri ve takvim tuhaflıkları." },
    },
  },

  seo: {
    homeTitle: "Until — yaklaşan her şey için geri sayım",
    siteDescription:
      "Binlerce gelecek tarih, etiketlenmiş ve işliyor. Bayramlar, tutulmalar, Dünya Kupaları, seçimler — bir de kendi oluşturduklarınız.",
    titleTemplate: "%s · Until",

    event: {
      whenIs: "{title} ne zaman? {when}",
      whenIsCoarse: "{title} ne zaman? Beklenen tarih: {period}",
      countdownColon: "{title} geri sayımı: {when}",
      countdownDash: "{title} — {when} geri sayımı",
      countdownDashCoarse: "{title} — {when}",
      description: "{title}{status} tarihi: {date}. {days} Canlı geri sayım, takvime ekleyin.",
      descriptionCoarse:
        "{title} için beklenen tarih: {period}. Kesin gün henüz açıklanmadı. Açıklanınca sayaç işlemeye başlar, takvime ekleyin.",
      statusCancelled: " (iptal edildi)",
      statusPostponed: " (ertelendi)",
      fallbackTitle: "Geri sayım",
      mineTitle: "Geri sayımınız",
      sharedTitle: "Paylaşılan geri sayım",
      sharedMetaTitle: "{title} — {date} geri sayımı",
      sharedMetaDescription: "{title} tarihi: {date}. Until'de oluşturulmuş bir geri sayım.",
    },

    series: {
      title: "{title} için kaç gün kaldı? — {when}",
      titleNoDate: "{title} için kaç gün kaldı?",
      heading: "{title} için kaç gün kaldı?",
      description: "{title} tarihi: {date}. {days} Canlı geri sayım, her yılın tarihleri, takvime ekleyin.",
      descriptionCoarse:
        "Sıradaki {title} için beklenen tarih: {period}. Her yılın tarihleri, canlı geri sayım, takvime ekleyin.",
      descriptionNoDate: "{title}: yaklaşan tarihler, sıradakine canlı geri sayım ve takvim bağlantıları.",
      fallbackTitle: "Kaç gün kaldı",
    },

    hub: {
      category: "Yaklaşan {category} — geri sayımlar ve tarihler",
      country: "{country}: yaklaşan tatiller ve etkinlikler",
      month: "{month} takvimi — yaklaşan tarihler",
      tag: "{tag} — yaklaşan tarihler ve geri sayımlar",
      lowercaseCategory: true,
    },

    days: {
      today: "Bugün.",
      tomorrow: "Yarın.",
      yesterday: "Dündü.",
      away: { one: "{n} gün kaldı.", other: "{n} gün kaldı." } as PluralForms,
      ago: { one: "{n} gün önceydi.", other: "{n} gün önceydi." } as PluralForms,
    },

    period: {
      month: "{month} {year}",
      quarter: "{year} {q}. çeyrek",
      year: "{year}",
      expected: "{period} bekleniyor",
      unknown: "tarih açıklanacak",
    },

    jsonLd: {
      siteDescription:
        "Binlerce yaklaşan etkinlik, tatil ve dönüm noktası için canlı geri sayımlar ve tarihler.",
      seriesDescription: "{title} için yaklaşan tarihler.",
    },
  },

  home: {
    loading: "Katalog yükleniyor",

    hero: {
      eyebrow: "Öne çıkan geri sayım",
      meta: "{category} · {when}",
      open: "Bu geri sayımı aç",
    },

    hub: {
      alsoOnTheHorizon: "Ufukta görünenler",
      next7Days: "Önümüzdeki 7 gün",
      wholeMonth: "Tüm ay →",
      browseByCategory: "Kategoriye göre keşfet",
      allCategories: "Tüm kategoriler →",
      popularCountdowns: "Popüler geri sayımlar",
      everyRecurringDate: "Tekrarlanan tüm tarihler →",
      byCountry: "Ülkeye göre",
      allCountries: "Tüm ülkeler →",
      noCountries: "Ülke verileri dolduruluyor.",
      byMonth: "Aya göre",
      thisMonth: "Bu ay — {month}",
      nextMonth: "Gelecek ay — {month}",
    },

    explorer: {
      heading: "Katalog",
      count: { one: "{n} yaklaşan tarih.", other: "{n} yaklaşan tarih." } as PluralForms,
      countMatching: {
        one: "“{q}” ile eşleşen {n} yaklaşan tarih.",
        other: "“{q}” ile eşleşen {n} yaklaşan tarih.",
      } as PluralForms,
      countInCategory: {
        one: "{category} kategorisinde {n} yaklaşan tarih.",
        other: "{category} kategorisinde {n} yaklaşan tarih.",
      } as PluralForms,
      countMatchingInCategory: {
        one: "{category} kategorisinde “{q}” ile eşleşen {n} yaklaşan tarih.",
        other: "{category} kategorisinde “{q}” ile eşleşen {n} yaklaşan tarih.",
      } as PluralForms,
      sort: {
        soonest: "En yakın",
        popular: "Popüler",
        latest: "En uzak",
      },
    },

    filters: {
      all: "Tümü",
    },

    empty: {
      noMatch: "Katalogda “{q}” ile eşleşen bir şey yok.",
      nothing: "Burada henüz bir şey yok.",
      hint: "Yazım hataları affedilir, baş harfler de işe yarar; yani yakın bir tahmin bile tutar — bu, katalogda olmayan bir tarihe benziyor.",
      busiest: "En yoğun kategoriler",
      everyRecurringDate: "Tekrarlanan tüm tarihler",
      startOver: "Baştan başla",
    },

    table: {
      date: "Tarih",
      event: "Etkinlik",
      within: "Kalan",
      category: "Kategori",
      empty: "Burada henüz planlanmış bir şey yok.",
    },

    pagination: "Sayfalama",
  },

  event: {
    answer: {
      today: "{title} bugün, {date}.",
      tomorrow: "{title} için {n} gün kaldı — yarın, {date}.",
      days: {
        one: "{title} için {n} gün kaldı: {date}.",
        other: "{title} için {n} gün kaldı: {date}.",
      } as PluralForms,
      past: {
        one: "{title} {n} gün önceydi: {date}.",
        other: "{title} {n} gün önceydi: {date}.",
      } as PluralForms,
      cancelled: "{title} {date} tarihinde planlanmıştı, iptal edildi.",
      coarse: "{title} için beklenen tarih: {period}. Kesin gün henüz açıklanmadı.",
      plain: "{title} tarihi: {date}.",
    },

    statusHappened: "Gerçekleşti",

    dateRange: "{start} – {end}",

    coarseNote:
      "Kesin gün henüz açıklanmadı. Kaynak bir tarih yayımladığında bu sayfadaki sayaç işlemeye başlayacak.",
    dateChanged: "Tarih değişti: önceki tarih {date}.",
    partOfSeries: "{series} serisinin bir parçası — her yıl tekrarlanır, sıradaki tarih hep en üstte.",
    everyUpcomingDate: "Yaklaşan tüm tarihler",
    otherYears: "Diğer yıllar",
    alsoComing: "Ayrıca yaklaşanlar",

    fields: {
      where: "Nerede",
      tags: "Etiketler",
    },

    provenance: {
      source: "Kaynak:",
      lastVerified: "son doğrulama {date}",
      summary: "Özet: {source} ({license})",
    },

    image: {
      photo: "Fotoğraf",
      photoBy: "Fotoğraf:",
      via: "{provider} üzerinden",
    },

    mine: {
      missingTitle: "Bu geri sayım başka bir cihazda",
      missingBody:
        "Kişisel geri sayımlar yalnızca oluşturuldukları tarayıcıda saklanır. Biri sizinle bir bağlantı paylaştıysa, oluşturma sayfasındaki paylaşılabilir adresi isteyin.",
      makeNew: "Yenisini oluştur",
      onThisDevice: "Bu cihazda",
      remove: "Kaldır",
      savedCount: {
        one: "Bu tarayıcıda kayıtlı {n} katalog tarihi.",
        other: "Bu tarayıcıda kayıtlı {n} katalog tarihi.",
      } as PluralForms,
    },
  },

  series: {
    index: {
      title: "Kaç gün kaldı — tekrarlanan tüm geri sayımlar",
      description:
        "Yılbaşı, Ramazan, Kurban Bayramı, Perseidler: katalogdaki tekrarlanan her tarih, en üstte sıradaki tarih ve gelecek yılların tablosu.",
      heading: "… için kaç gün kaldı?",
      intro: {
        one: "Her yıl tekrarlanan {n} tarih. Her sayfa sıradaki tarihi en üstte tutar ve gelecek yılları listeler.",
        other:
          "Her yıl tekrarlanan {n} tarih. Her sayfa sıradaki tarihi en üstte tutar ve gelecek yılları listeler.",
      } as PluralForms,
      empty: "Katalog dolduruluyor — yakında tekrar bakın.",
      jsonLdDescription: "Sıradaki tarihi ve yıllara yayılan tablosuyla tekrarlanan tarihler.",
    },

    noUpcoming: "{title} için katalogda henüz yaklaşan bir tarih yok.",

    thisYearsPage: "Bu yılın sayfası",

    shareTitle: "{title} için kaç gün kaldı",

    upcoming: {
      heading: "Yaklaşan tarihler",
      note: "Katalogdaki bugünden sonraki tüm {title} tarihleri, en yakından başlayarak.",
      empty: "Henüz gelecek tarih yok — bir sonraki güncellemeden sonra tekrar bakın.",
    },

    variants: {
      heading: "Bu seriye bağlı diğer tarihler",
      note: "Birkaç ülkede aynı adla farklı bir günde kutlanır — yukarıdaki geri sayım ana tarihte kalsın diye ayrı listelendi.",
    },

    faqHeading: "Sık sorulan sorular",

    tagsLabel: "Etiketler:",

    related: {
      heading: "Her yıl tekrarlanan diğer {category}",
      all: "Tekrarlanan tüm geri sayımlar",
    },
  },

  hubs: {
    label: {
      browse: "Keşfet",
      category: "Kategori",
      country: "Ülke",
      calendar: "Takvim",
      tag: "Etiket",
    },

    breadcrumbLabel: "Sayfa yolu",

    paged: {
      title: "{name} (sayfa {n})",
      headingSuffix: "— sayfa {n}",
      backToFirst: "İlk sayfaya dön.",
    },

    categoryIndex: {
      title: "Kategoriler — henüz gerçekleşmemiş her tür tarih",
      description:
        "Yaklaşan tarihleri kategoriye göre keşfedin: tatiller, spor, sinema, diziler, oyunlar, uzay, seçimler, yıl dönümleri ve daha fazlası — canlı geri sayımla.",
      heading: "Her tür tarih",
      intro: "Yirmi üç kategori, onlarla ne yapacağınıza göre gruplanmış.",
      collectionDescription: "Kategoriye göre yaklaşan tarihler.",
    },

    category: {
      description: {
        one: "{blurb} Canlı geri sayım ve takvim bağlantılarıyla {n} yaklaşan tarih.",
        other: "{blurb} Canlı geri sayım ve takvim bağlantılarıyla {n} yaklaşan tarih.",
      } as PluralForms,
      descriptionEmpty: "{blurb} Canlı geri sayım ve takvim bağlantılarıyla yaklaşan tarihler.",
      descriptionPaged:
        "{blurb} Yaklaşan tarihlerin {n}. sayfası, en yakından başlayarak, canlı geri sayım ve takvim bağlantılarıyla.",
      heading: "Yaklaşan {category}",
      count: { one: "{n} yaklaşan tarih.", other: "{n} yaklaşan tarih." } as PluralForms,
      countPaged: {
        one: "{n} yaklaşan tarih, en yakından başlayarak.",
        other: "{n} yaklaşan tarih, en yakından başlayarak.",
      } as PluralForms,
      soon: "Önümüzdeki 30 gün",
      everyYear: "Her yıl",
      all: "Yaklaşan tüm {category}",
      empty: "Bu kategoride henüz bir şey yok.",
    },

    countryIndex: {
      title: "Ülkeler — ülkeye göre yaklaşan tatiller ve etkinlikler",
      description:
        "200'den fazla ülke ve bölge için resmî tatiller, ulusal günler ve yerel etkinlikler; hepsi canlı geri sayım ve takvim bağlantılarıyla.",
      heading: "Ülkeye göre",
      intro: {
        one: "Katalogda yaklaşan tatil ve etkinlikleri bulunan {n} ülke ve bölge.",
        other: "Katalogda yaklaşan tatil ve etkinlikleri bulunan {n} ülke ve bölge.",
      } as PluralForms,
      empty: "Katalog dolduruluyor — yakında tekrar bakın.",
      collectionDescription: "Ülkeye göre yaklaşan tatiller ve etkinlikler.",
    },

    country: {
      description: {
        one: "{country}: aya göre gruplanmış {n} yaklaşan resmî tatil, ulusal gün ve etkinlik — her biri canlı geri sayım ve takvim bağlantılarıyla.",
        other:
          "{country}: aya göre gruplanmış {n} yaklaşan resmî tatil, ulusal gün ve etkinlik — her biri canlı geri sayım ve takvim bağlantılarıyla.",
      } as PluralForms,
      descriptionEmpty:
        "{country}: aya göre gruplanmış resmî tatiller, ulusal günler ve etkinlikler — her biri canlı geri sayım ve takvim bağlantılarıyla.",
      intro:
        "{country} etiketli yaklaşan tatiller ve etkinlikler, ay ay. Dünya geneli tarihler — tutulmalar, çıkışlar, uluslararası günler — aşağıda ayrıca listelenir.",
      count: { one: "{n} yaklaşan tarih.", other: "{n} yaklaşan tarih." } as PluralForms,
      countCapped: { one: "{n}+ yaklaşan tarih.", other: "{n}+ yaklaşan tarih." } as PluralForms,
      empty: "{country} etiketli henüz bir tarih yok.",
      worldwide: "Dünya genelinde yaklaşanlar",
      collectionDescription: "{country}: tatiller ve etkinlikler.",
    },

    calendar: {
      description:
        "{month} takvimi: tatiller, fırlatmalar, finaller, galalar ve yıl dönümleri — gün gün, canlı geri sayımlarla.",
      count: {
        one: "{month} için {n} yaklaşan tarih, gün gün.",
        other: "{month} için {n} yaklaşan tarih, gün gün.",
      } as PluralForms,
      empty: "{month} için henüz yaklaşan bir tarih yok.",
      months: "Aylar",
      previous: "← {month}",
      next: "{month} →",
      collectionDescription: "{month} için yaklaşan tarihler.",
    },

    tag: {
      description: {
        one: "\"{tag}\" etiketli {n} yaklaşan tarih, en yakından başlayarak, canlı geri sayım ve takvim bağlantılarıyla.",
        other:
          "\"{tag}\" etiketli {n} yaklaşan tarih, en yakından başlayarak, her biri canlı geri sayım ve takvim bağlantılarıyla.",
      } as PluralForms,
      descriptionPaged:
        "\"{tag}\" etiketli yaklaşan tarihlerin {n}. sayfası, en yakından başlayarak, canlı geri sayım ve takvim bağlantılarıyla.",
      crumb: "#{tag}",
      count: {
        one: "“{tag}” etiketli {n} yaklaşan tarih, en yakından başlayarak.",
        other: "“{tag}” etiketli {n} yaklaşan tarih, en yakından başlayarak.",
      } as PluralForms,
      searchPrompt: "Başka bir şey mi arıyorsunuz?",
      searchLink: "Tüm katalogda “{tag}” ara.",
      collectionDescription: "{tag} etiketli yaklaşan tarihler.",
    },
  },

  pages: {
    about: {
      title: "Hakkında",
      description: "Until binlerce gelecek tarihi nasıl topluyor, etiketliyor ve sınıflandırıyor.",
      eyebrow: "Proje",
      heading: "Geleceğin gazetesi",

      intro:
        "Until, henüz gerçekleşmemiş tarihlerin kataloğu. Neredeyse her ülkenin resmî tatilleri, Wikipedia yıl sayfaları ve Wikidata'dan derlenen planlı etkinlikler, bir de insanların gerçekten beklediklerinden oluşan seçilmiş bir katman — tutulmalar, Dünya Kupaları, Olimpiyatlar, seçimler, Halley Kuyruklu Yıldızı.",
      categories:
        "Her kayıt {n} kategori altında etiketlenir ve sınıflandırılır — resmî tatiller, ulusal günler, spor, gök olayları, uzay, teknoloji, siyaset, yıl dönümleri ve daha fazlası. Tümünü arayın, bir kategoriyi süzün, canlı bir geri sayım açın ve takviminize ekleyin.",
      sources:
        "Tatillerin omurgası çevrimdışı {dateHolidays} veri kümesi; {wikidata} ve {wikipedia} ile genişletildi. Aynı gün aynı adı taşıyan kayıtlar (140 ülkede Noel) tek bir geri sayımda birleştirilir. Kaynaklar çeliştiğinde seçilmiş kayıtlar kazanır. Her etkinlik sayfası kaynağını ve tarihin en son ne zaman doğrulandığını belirtir.",
      expected:
        "Kesin günü belli olmayan tarihler, kaynağın verdiği ay, çeyrek ya da yılla birlikte “beklenen” olarak işaretlenir ve gerçek bir tarih yayımlanana kadar işlemeye başlamaz. Katalog kaynaklarından her gün güncellenir.",
      yourOwn:
        "Kendi geri sayımınızı da oluşturabilirsiniz. Bunlar tarayıcıda kalır — hesap yok — ve paylaşım bağlantısı başlığı ve tarihi adresin içinde taşır; böylece herkes aynı işleyen sayacı açabilir.",

      stats: {
        dates: "Tarih",
        featured: "Öne çıkan",
        updated: "Güncellendi",
      },

      byCategory: {
        heading: "Kategoriye göre",
        empty: "Katalog dolduruluyor — yakında tekrar bakın.",
      },

      bySource: {
        heading: "Kaynağa göre",
        empty: "Henüz kaynak bildirilmedi.",
      },
    },

    attributions: {
      title: "Kaynaklar — tarihler nereden geliyor",
      description:
        "Until kataloğunun arkasındaki her kaynak, lisansı ve istediği atıfla: date-holidays, Wikipedia, Wikidata, Hebcal, Launch Library ve daha fazlası.",
      eyebrow: "Kaynaklar",
      heading: "Kaynaklar ve atıflar",
      intro:
        "Until yalnızca koşulları veriyi saklamaya ve yeniden yayımlamaya izin veren kaynakları alır. Aynı lisansla paylaşım isteyen kaynaklar (Wikipedia metinleri, TVMaze, date-holidays verileri) kullanıldıkları her sayfada belirtilir; görseller yalnızca CC0, kamu malı, CC BY veya CC BY-SA lisanslarıyla ve yazarı belirtilerek yeniden barındırılır. Her etkinlik sayfası oluşturulduğu kayda bağlantı verir.",
      sourcesEmpty: "Kaynak listesi şu anda görüntülenemiyor.",

      images: {
        heading: "Görseller",
        policy:
          "Fotoğraflar yeniden barındırılan kopyalardır: yeniden boyutlandırılır ve kendi depolama alanımızdan sunulur, böylece kaynak siteler hiçbir zaman doğrudan bağlanmaz. Yalnızca serbest lisanslı dosyalar kabul edilir — CC0, kamu malı, CC BY, CC BY-SA ve birkaç ulusal açık devlet lisansı, ayrıca NASA görselleri kendi medya kurallarıyla. Adil kullanım dosyaları, ticari olmayan (NC) ve türetilemez (ND) lisanslar doğrudan reddedilir; marka ya da kişilik hakkı kısıtlaması taşıyan dosyalar da öyle. Saklanan her dosya yazarını, lisansını ve dosya sayfasına bağlantısını korur. Serbest fotoğrafı olmayan etkinlikler için üretilmiş bir kart kullanılır.",
        shareAlike:
          "Aynı lisansla paylaşım isteyen fotoğraflar (CC BY-SA) değiştirilmeden, kendi oranlarında ve altında künyesiyle yayımlanır. Sosyal medya kartına asla kırpılmazlar: bu birleşim türev bir eser olur ve aynı lisansı taşımak zorunda kalırdı, bu yüzden o kartlarda üretilmiş tasarım kullanılır. Saklanan dosyalar her ay kaynağına karşı yeniden doğrulanır; silinmiş ya da artık serbest olmayan bir dosya depolamamızdan kaldırılır ve sayfaları üretilmiş karta döner.",
        empty: "Henüz yeniden barındırılan görsel yok.",
        count: {
          one: "Bugün kitaplıkta {n} görsel:",
          other: "Bugün kitaplıkta {n} görsel:",
        } as PluralForms,
      },

      fonts:
        "Yazı tipleri: Fraunces (SIL Open Font License) ve Geist (SIL Open Font License). Astronomi hesapları astronomy-engine (MIT) ile yapıldı.",
    },

    create: {
      title: "Geri sayım oluştur",
      description: "Kişisel bir geri sayım oluşturun ve takviminize ekleyin.",
      eyebrow: "Sizin tarihleriniz",
      heading: "Geri sayım oluştur",
      intro:
        "Doğum günleri, lansmanlar, bir seyahat, bir duruşma, bir buluşma. Katalogdakiyle aynı şekilde işler — ve doğrudan Google Calendar'a, Outlook'a ya da bir .ics dosyasına aktarabilirsiniz.",

      form: {
        draftTitle: "Beklediğim bir şey",
        draftNote: "Oluşturduğunuz bir geri sayım.",
        titleLabel: "Başlık",
        dateLabel: "Tarih",
        categoryLabel: "Kategori",
        noteLabel: "Not",
        notePlaceholder: "Bu tarih sizin için neden önemli?",
        save: "Bu cihaza kaydet",
        openShareable: "Paylaşılabilir sayfayı aç",
        saved: "Kaydedildi. {link} — depolama alanını temizleyene kadar bu tarayıcıda kalır.",
        savedLink: "Görüntüle",
        privacy:
          "Kişisel geri sayımlar cihazınızda kalır (hesap gerekmez). Paylaşım bağlantısı başlığı ve tarihi adresin içine kodlar.",
        previewLabel: "Canlı önizleme",
        chooseDate: "Sayacı başlatmak için bir tarih seçin.",
      },
    },

    notFound: {
      heading: "Bu tarih katalogda yok",
      body: "Birleştirilmiş, adı değiştirilmiş ya da hiç var olmamış olabilir.",
      backHome: "Yaklaşan her şeye dön",
    },
  },

  embed: {
    countdown: {
      units: {
        days: { one: "gün", other: "gün" } as PluralForms,
        hours: "sa",
        minutes: "dk",
        seconds: "sn",
      },
      today: "Bugün.",
      past: "Bu çoktan gerçekleşti.",
    },

    studio: {
      heading: "Yanınızda götürün",

      controls: {
        preset: "Hazır ayar",
        digits: "Rakamlar",
        type: "Tür",
        background: "Arka plan",
        transparent: "Saydam — sahnenin ya da sayfanın görünmesini sağlar",
        font: "Yazı tipi",
        size: "Boyut",
        layout: "Yerleşim",
        units: "Birimler",
        separator: "Ayırıcı",
        frame: "Çerçeve",
        radius: "Köşe yuvarlaklığı",
        inset: "Kenar boşluğu",
        position: "Konum",
        done: "Bitiş mesajı",
        reset: "Sıfırla",
        colourPicker: "{label} — renk seçici",
      },

      toggles: {
        unitLabels: "Birim etiketleri",
        title: "Başlık",
        date: "Tarih",
        note: "Not",
        wordmark: "Logo",
        glow: "Parlama",
        trim: "Baştaki sıfırları gizle",
      },

      presets: {
        dark: "Until koyu",
        light: "Açık",
        amber: "Kehribar",
        mono: "Mono",
        neon: "Neon",
        clear: "Saydam",
      },

      fonts: {
        serif: "Serif",
        sans: "Sans",
        mono: "Mono",
      },

      layouts: {
        row: "Satır",
        stack: "Üst üste",
        compact: "Sıkışık",
        big: "Tek büyük sayı",
      },

      separators: {
        colon: "İki nokta",
        dot: "Nokta",
        space: "Boşluk",
        none: "Yok",
      },

      frames: {
        card: "Kart",
        outline: "Çizgi",
        none: "Yok",
      },

      units: {
        dhms: "Gün · saat · dakika · saniye",
        dhm: "Gün · saat · dakika",
        dh: "Gün · saat",
        d: "Gün",
        hms: "Saat · dakika · saniye",
        hm: "Saat · dakika",
        ms: "Dakika · saniye",
      },

      positions: {
        "top-left": "Sol üst",
        top: "Üst",
        "top-right": "Sağ üst",
        left: "Sol",
        center: "Orta",
        right: "Sağ",
        "bottom-left": "Sol alt",
        bottom: "Alt",
        "bottom-right": "Sağ alt",
      },

      copy: {
        code: "Kodu kopyala",
        url: "Adresi kopyala",
      },

      embed: {
        previewTitle: "Yerleştirme önizlemesi",
        paste: "Bunu sayfanıza yapıştırın",
        codeLabel: "Yerleştirme kodu",
        note: "Tam genişlikte ve {height}px yüksekliğinde yerleşir. WordPress, Ghost ve Notion geri sayımın kendi bağlantısını da kabul edip yerleştirmeyi kendileri bulur — ama bu, standart kartı açar; burada oluşturduğunuz görünümü korumak için yukarıdaki kodu yapıştırın.",
      },

      stream: {
        previewTitle: "Yayın kaplaması önizlemesi",
        canvasNote: "{width} × {height} tuval, küçültülmüş hâliyle — damalı zemin OBS'nin şeffaflaştırdığı yer.",
        urlLabel: "Tarayıcı kaynağı adresi",
        source: "Tarayıcı kaynağı · {width} × {height}",
        steps: [
          "OBS veya Streamlabs'ta bir tarayıcı kaynağı (Browser source) ekleyin.",
          "Yukarıdaki adresi yapıştırın.",
          "Boyutu {width} × {height} olarak ayarlayın — konum bu tuvale göre ölçülür.",
          "Arka planı saydam bırakın; kaplama kendi arka planını getirir.",
          "“Sahne etkinleştiğinde tarayıcıyı yenile” seçeneğini işaretleyin ki sayaç sıfırdan başlasın.",
        ],
      },
    },
  },
};
