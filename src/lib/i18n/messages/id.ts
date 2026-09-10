/**
 * Indonesian messages. See `en/` for what each key is for.
 *
 * Three decisions a maintainer should not undo:
 * - The money phrase is "Berapa hari lagi {title}?" — the exact string people type. Its answer
 *   sentence echoes it ("{title} tinggal {n} hari lagi"), so the `<h1>` question and the
 *   server-rendered answer under it use the same words. The event titles take the other query
 *   people type for a dated occurrence, "{title} tanggal berapa?".
 * - `seo.hub.lowercaseCategory` is false. Indonesian does not lower-case a label mid-title the way
 *   English does, and lower-casing would turn "TV" into "tv"; every hub template here therefore
 *   puts `{category}` where a capital is correct.
 * - Indonesian has no grammatical plural and no numeral classifier before a counted noun ("3 hari",
 *   never "3 hari-hari"), so every plural object carries `other` alone — the only category ICU
 *   selects for `id-ID`. Formal register throughout ("Anda", "peramban", "tautan"): the catalog is
 *   read by strangers arriving from a search result, not by an app's logged-in users.
 */
import type { Messages } from "./en";
import type { PluralForms } from "./types";

export const id: Messages = {
  common: {
    siteName: "Until",
    tagline: "katalog hal-hal yang belum terjadi.",
    wordmarkLine: "Until — katalog hal-hal yang belum terjadi.",

    nav: {
      categories: "Kategori",
      countries: "Negara",
      daysUntil: "Berapa hari lagi",
      create: "Buat",
      about: "Tentang",
    },

    search: {
      label: "Cari",
      navLabel: "Cari hitung mundur",
      placeholder: "Cari di katalog…",
      navPlaceholder: "Cari gerhana, Piala Dunia, hari libur…",
      submit: "Cari",
    },

    breadcrumb: {
      home: "Beranda",
    },

    footer: {
      datesCount: { other: "{n} tanggal" } as PluralForms,
      aboutTheData: "tentang datanya",
      attributions: "atribusi",
      categories: "Kategori",
      browse: "Jelajahi",
      all: "semua →",
      makeYourOwn: "Buat sendiri",
      language: "Bahasa",
    },

    actions: {
      share: "Bagikan",
      shareCopied: "Tautan disalin",
      save: "Simpan",
      saved: "Tersimpan",
      addToCalendar: "Tambah ke kalender",
      google: "Google Calendar",
      outlook: "Outlook",
      downloadIcs: "Unduh .ics",
      embed: "Pasang di situs Anda",
      stream: "Tambah ke siaran",
      copy: "Salin",
      copied: "Tersalin",
    },

    labels: {
      worldwide: "Seluruh dunia",
      countriesCount: { other: "{n} negara" } as PluralForms,
      recurring: "Berulang",
      series: "Seri",
      today: "Hari ini",
      tba: "Belum ditentukan",
      dateToBeAnnounced: "tanggal yang akan diumumkan",
      nothingHereYet: "Belum ada apa-apa di sini",
      more: "Lainnya",
      seeAll: "Lihat semua →",
      loading: "Memuat…",
      source: "Sumber",
      sources: "Sumber",
      lastVerified: "Terakhir diperiksa",
    },

    status: {
      scheduled: "Terjadwal",
      tentative: "Belum pasti",
      postponed: "Ditunda",
      cancelled: "Dibatalkan",
      done: "Selesai",
      retired: "Tidak berlanjut",
    },

    units: {
      days: "hari",
      hours: "jam",
      minutes: "menit",
      seconds: "detik",
      daysShort: "h",
      hoursShort: "j",
      minutesShort: "m",
      secondsShort: "d",
    },

    pagination: {
      previous: "Sebelumnya",
      next: "Berikutnya",
      page: "Halaman {n}",
      pageOf: "Halaman {n} dari {total}",
    },

    languageSwitcher: {
      label: "Bahasa",
      description: "Baca Until dalam bahasa lain",
    },
  },

  categories: {
    labels: {
      holidays: "Hari libur",
      national: "Hari nasional",
      religion: "Keagamaan",
      awareness: "Hari peringatan",
      fun: "Hari seru",
      culture: "Budaya",
      festivals: "Festival",
      sports: "Olahraga",
      esports: "Esports",
      games: "Game",
      film: "Film",
      tv: "TV",
      anime: "Anime",
      music: "Musik",
      entertainment: "Hiburan",
      politics: "Politik",
      tech: "Teknologi",
      science: "Sains",
      space: "Antariksa",
      astronomy: "Astronomi",
      nature: "Alam",
      history: "Sejarah",
      curiosities: "Keunikan",
    },

    blurbs: {
      holidays: "Hari libur resmi dan tradisi yang terus dijaga.",
      national: "Hari kemerdekaan, hari republik, perayaan kenegaraan.",
      religion: "Hari raya, puasa, dan hari suci dari berbagai agama.",
      awareness: "Hari peringatan PBB dan hari internasional.",
      fun: "Hari Pizza, Hari Bicara Seperti Bajak Laut, dan alasan-alasan lain.",
      culture: "Festival, hari besar, dan kalender kewargaan.",
      festivals: "Karnaval, pameran, dan perhelatan orang banyak.",
      sports: "Final, upacara pembukaan, dan Piala Dunia berikutnya.",
      esports: "Worlds, Majors, dan The International.",
      games: "Tanggal rilis dan acara peluncuran.",
      film: "Penayangan perdana dan malam penghargaan.",
      tv: "Awal dan akhir musim tayang.",
      anime: "Awal musim dan rilis film.",
      music: "Kontes, tur konser, dan hari jadi.",
      entertainment: "Tanggal penting bagi penggemar dan hari besar budaya pop.",
      politics: "Pemilu dan tanggal-tanggal yang menentukan arah negara.",
      tech: "Konferensi, akhir masa dukungan, dan waktu yang dihitung komputer.",
      science: "Tanggal untuk yang penasaran.",
      space: "Peluncuran, pendaratan, dan jalan panjang kembali ke Bulan.",
      astronomy: "Gerhana, hujan meteor, titik balik matahari — janji temu dengan langit.",
      nature: "Bumi, samudra, dan siklus alam sepanjang tahun.",
      history: "Peringatan hal-hal yang sudah terjadi — jamnya masih berjalan.",
      curiosities: "Tonggak Unix, tanggal palindrom, Jumat tanggal 13.",
    },

    groups: {
      celebrate: { label: "Rayakan", tagline: "Hari libur, hari raya, dan alasan-alasan yang kita jaga." },
      watch: { label: "Tonton", tagline: "Final, penayangan perdana, tur, dan rilis besar berikutnya." },
      play: { label: "Main", tagline: "Tanggal rilis dan acara peluncuran." },
      "look-up": { label: "Lihat ke langit", tagline: "Peluncuran, gerhana, dan siklus alam sepanjang tahun." },
      vote: { label: "Pilih", tagline: "Pemilu, konferensi, dan waktu yang dihitung komputer." },
      wonder: { label: "Takjub", tagline: "Hari jadi dan keganjilan kalender." },
    },
  },

  seo: {
    homeTitle: "Until — hitung mundur untuk semua yang akan datang",
    siteDescription:
      "Ribuan tanggal mendatang, ditandai dan terus berdetak. Hari libur, gerhana, Piala Dunia, pemilu — plus yang Anda buat sendiri.",
    titleTemplate: "%s · Until",

    event: {
      whenIs: "{title} tanggal berapa? {when}",
      whenIsCoarse: "{title} tanggal berapa? Perkiraan {period}",
      countdownColon: "{title} — hitung mundur: {when}",
      countdownDash: "Hitung mundur {title} — {when}",
      countdownDashCoarse: "{title} — {when}",
      description: "{title}{status} jatuh pada {date}. {days} Hitung mundur langsung, tambah ke kalender.",
      descriptionCoarse:
        "{title} diperkirakan {period}. Tanggal pastinya belum diumumkan. Hitung mundur berjalan begitu tanggalnya keluar.",
      statusCancelled: " (dibatalkan)",
      statusPostponed: " (ditunda)",
      fallbackTitle: "Hitung mundur",
      mineTitle: "Hitung mundur Anda",
      sharedTitle: "Hitung mundur yang dibagikan",
      sharedMetaTitle: "{title} — hitung mundur {date}",
      sharedMetaDescription: "{title} jatuh pada {date}. Hitung mundur yang dibuat seseorang di Until.",
    },

    series: {
      title: "Berapa hari lagi {title}? — {when}",
      titleNoDate: "Berapa hari lagi {title}?",
      heading: "Berapa hari lagi {title}?",
      description: "{title} jatuh pada {date}. {days} Hitung mundur langsung, tanggal tiap tahun, tambah ke kalender.",
      descriptionCoarse:
        "{title} berikutnya diperkirakan {period}. Tanggal tiap tahun, hitung mundur langsung, tambah ke kalender.",
      descriptionNoDate: "{title}: tanggal mendatang, hitung mundur ke yang terdekat, dan tautan kalender.",
      fallbackTitle: "Berapa hari lagi",
    },

    hub: {
      category: "{category} mendatang — hitung mundur dan tanggalnya",
      country: "{country}: hari libur dan acara mendatang",
      month: "{month} — ada apa saja",
      tag: "{tag} — tanggal mendatang dan hitung mundurnya",
      lowercaseCategory: false,
    },

    days: {
      today: "Berarti hari ini.",
      tomorrow: "Berarti besok.",
      yesterday: "Berarti kemarin.",
      away: { other: "Tinggal {n} hari lagi." } as PluralForms,
      ago: { other: "Sudah {n} hari berlalu." } as PluralForms,
    },

    period: {
      month: "{month} {year}",
      quarter: "Kuartal {q} {year}",
      year: "{year}",
      expected: "diperkirakan {period}",
      unknown: "tanggal belum diumumkan",
    },

    jsonLd: {
      siteDescription:
        "Hitung mundur langsung dan tanggal ribuan acara, hari libur, dan momen penting yang akan datang.",
      seriesDescription: "Tanggal-tanggal {title} berikutnya.",
    },
  },

  home: {
    loading: "Memuat katalog",

    hero: {
      eyebrow: "Hitung mundur pilihan",
      meta: "{category} · {when}",
      open: "Buka hitung mundur ini",
    },

    hub: {
      alsoOnTheHorizon: "Sudah terlihat di depan",
      next7Days: "7 hari ke depan",
      wholeMonth: "Satu bulan penuh →",
      browseByCategory: "Jelajahi per kategori",
      allCategories: "Semua kategori →",
      popularCountdowns: "Hitung mundur populer",
      everyRecurringDate: "Semua tanggal berulang →",
      byCountry: "Per negara",
      allCountries: "Semua negara →",
      noCountries: "Data negara sedang dilengkapi.",
      byMonth: "Per bulan",
      thisMonth: "Bulan ini — {month}",
      nextMonth: "Bulan depan — {month}",
    },

    explorer: {
      heading: "Katalognya",
      count: { other: "{n} tanggal mendatang." } as PluralForms,
      countMatching: {
        other: "{n} tanggal mendatang yang cocok dengan “{q}”.",
      } as PluralForms,
      countInCategory: {
        other: "{n} tanggal mendatang di {category}.",
      } as PluralForms,
      countMatchingInCategory: {
        other: "{n} tanggal mendatang yang cocok dengan “{q}” di {category}.",
      } as PluralForms,
      sort: {
        soonest: "Terdekat",
        popular: "Populer",
        latest: "Terjauh",
      },
    },

    filters: {
      all: "Semua",
    },

    empty: {
      noMatch: "Tidak ada isi katalog yang cocok dengan “{q}”.",
      nothing: "Belum ada apa-apa di sini.",
      hint: "Salah ketik dimaafkan dan singkatan pun dikenali, jadi yang meleset sedikit mestinya tetap ketemu — yang ini sepertinya memang belum ada di katalog.",
      busiest: "Kategori terpadat",
      everyRecurringDate: "Semua tanggal berulang",
      startOver: "Mulai dari awal",
    },

    table: {
      date: "Tanggal",
      event: "Acara",
      within: "Dalam",
      category: "Kategori",
      empty: "Belum ada yang terjadwal di sini.",
    },

    pagination: "Penomoran halaman",
  },

  event: {
    answer: {
      today: "{title} jatuh hari ini, {date}.",
      tomorrow: "{title} tinggal {n} hari lagi — besok, {date}.",
      days: {
        other: "{title} tinggal {n} hari lagi, jatuh pada {date}.",
      } as PluralForms,
      past: {
        other: "{title} berlangsung {n} hari yang lalu, pada {date}.",
      } as PluralForms,
      cancelled: "{title} dijadwalkan pada {date} dan sudah dibatalkan.",
      coarse: "{title} diperkirakan {period}. Tanggal pastinya belum diumumkan.",
      plain: "{title} jatuh pada {date}.",
    },

    statusHappened: "Sudah lewat",

    dateRange: "{start} – {end}",

    coarseNote:
      "Tanggal pastinya belum diumumkan. Halaman ini mulai berdetak begitu sumbernya menerbitkan tanggal.",
    dateChanged: "Tanggal berubah: sebelumnya {date}.",
    partOfSeries: "Bagian dari seri {series} — tiap tahun, dengan tanggal terdekat selalu di atas.",
    everyUpcomingDate: "Semua tanggal mendatang",
    otherYears: "Tahun lain",
    alsoComing: "Juga akan datang",

    fields: {
      where: "Di mana",
      tags: "Tag",
    },

    provenance: {
      source: "Sumber:",
      lastVerified: "terakhir diperiksa {date}",
      summary: "Ringkasan dari {source} ({license})",
    },

    image: {
      photo: "Foto",
      photoBy: "Foto:",
      via: "via {provider}",
    },

    mine: {
      missingTitle: "Hitung mundur ini ada di perangkat lain",
      missingBody:
        "Hitung mundur pribadi tersimpan di peramban yang membuatnya. Kalau ada yang mengirimi Anda tautan, minta URL yang bisa dibagikan dari halaman Buat.",
      makeNew: "Buat yang baru",
      onThisDevice: "Di perangkat ini",
      remove: "Hapus",
      savedCount: {
        other: "{n} tanggal katalog tersimpan di peramban ini.",
      } as PluralForms,
    },
  },

  series: {
    index: {
      title: "Berapa hari lagi — semua hitung mundur berulang",
      description:
        "Natal, Ramadan, Super Bowl, Perseid: semua tanggal berulang di katalog, yang terdekat di atas plus tabel tahun-tahun berikutnya.",
      heading: "Berapa hari lagi…",
      intro: {
        other:
          "{n} tanggal yang kembali tiap tahun. Tiap halaman menaruh tanggal terdekat di atas dan memuat tahun-tahun berikutnya.",
      } as PluralForms,
      empty: "Katalog sedang dilengkapi — mampir lagi nanti.",
      jsonLdDescription: "Tanggal berulang dengan tanggal terdekat dan tabel lintas tahun.",
    },

    noUpcoming: "Tanggal {title} berikutnya belum ada di katalog.",

    thisYearsPage: "Halaman tahun ini",

    shareTitle: "Berapa hari lagi {title}",

    upcoming: {
      heading: "Tanggal mendatang",
      note: "Semua {title} di katalog mulai hari ini, dari yang terdekat.",
      empty: "Belum ada tanggal mendatang — cek lagi setelah pembaruan berikutnya.",
    },

    variants: {
      heading: "Tanggal lain yang terkait dengan seri ini",
      note: "Diperingati dengan nama yang sama pada hari berbeda di sejumlah negara — dipisah supaya hitung mundur di atas tetap pada tanggal utamanya.",
    },

    faqHeading: "Pertanyaan yang sering muncul",

    tagsLabel: "Tag:",

    related: {
      heading: "{category} lain yang kembali tiap tahun",
      all: "Semua hitung mundur berulang",
    },
  },

  hubs: {
    label: {
      browse: "Jelajahi",
      category: "Kategori",
      country: "Negara",
      calendar: "Kalender",
      tag: "Tag",
    },

    breadcrumbLabel: "Jejak navigasi",

    paged: {
      title: "{name} (halaman {n})",
      headingSuffix: "— halaman {n}",
      backToFirst: "Kembali ke halaman pertama.",
    },

    categoryIndex: {
      title: "Kategori — semua jenis tanggal yang belum terjadi",
      description:
        "Jelajahi tanggal mendatang per kategori: hari libur, olahraga, film dan TV, game, antariksa, pemilu, hari jadi, dan lainnya, dengan hitung mundur langsung.",
      heading: "Semua jenis tanggal",
      intro: "Dua puluh tiga kategori, dikelompokkan menurut apa yang biasanya Anda cari.",
      collectionDescription: "Tanggal mendatang per kategori.",
    },

    category: {
      description: {
        other: "{blurb} {n} tanggal mendatang dengan hitung mundur langsung dan tautan kalender.",
      } as PluralForms,
      descriptionEmpty: "{blurb} Tanggal mendatang dengan hitung mundur langsung dan tautan kalender.",
      descriptionPaged:
        "{blurb} Halaman {n} dari tanggal mendatang, dari yang terdekat, dengan hitung mundur langsung dan tautan kalender.",
      heading: "{category} mendatang",
      count: { other: "{n} tanggal mendatang." } as PluralForms,
      countPaged: {
        other: "{n} tanggal mendatang, dari yang terdekat.",
      } as PluralForms,
      soon: "30 hari ke depan",
      everyYear: "Tiap tahun",
      all: "Semua {category} mendatang",
      empty: "Belum ada apa-apa di kategori ini.",
    },

    countryIndex: {
      title: "Negara — hari libur dan acara mendatang per negara",
      description:
        "Hari libur resmi, hari nasional, dan acara lokal dari lebih dari 200 negara dan wilayah, dengan hitung mundur langsung dan tautan kalender.",
      heading: "Per negara",
      intro: {
        other: "{n} negara dan wilayah dengan hari libur serta acara mendatang di katalog.",
      } as PluralForms,
      empty: "Katalog sedang dilengkapi — mampir lagi nanti.",
      collectionDescription: "Hari libur dan acara mendatang per negara.",
    },

    country: {
      description: {
        other:
          "Hari libur, hari nasional, dan acara di {country} — {n} tanggal mendatang, dikelompokkan per bulan, dengan hitung mundur langsung dan tautan kalender.",
      } as PluralForms,
      descriptionEmpty:
        "Hari libur, hari nasional, dan acara di {country}, dikelompokkan per bulan, dengan hitung mundur langsung dan tautan kalender.",
      intro:
        "Hari libur dan acara mendatang bertanda {country}, bulan demi bulan. Tanggal berskala dunia — gerhana, rilis, hari internasional — dicantumkan terpisah di bawah.",
      count: { other: "{n} tanggal mendatang." } as PluralForms,
      countCapped: { other: "{n}+ tanggal mendatang." } as PluralForms,
      empty: "Belum ada tanggal bertanda {country}.",
      worldwide: "Seluruh dunia, akan datang",
      collectionDescription: "Hari libur dan acara di {country}.",
    },

    calendar: {
      description:
        "Semua isi katalog untuk {month}: hari libur, peluncuran, final, penayangan perdana, dan hari jadi, hari demi hari, dengan hitung mundur langsung.",
      count: {
        other: "{n} tanggal mendatang di {month}, hari demi hari.",
      } as PluralForms,
      empty: "Belum ada apa pun di {month}.",
      months: "Bulan",
      previous: "← {month}",
      next: "{month} →",
      collectionDescription: "Tanggal mendatang di {month}.",
    },

    tag: {
      description: {
        other:
          "{n} tanggal mendatang bertanda \"{tag}\", dari yang terdekat, masing-masing dengan hitung mundur langsung dan tautan kalender.",
      } as PluralForms,
      descriptionPaged:
        "Halaman {n} dari tanggal mendatang bertanda \"{tag}\", dari yang terdekat, masing-masing dengan hitung mundur langsung dan tautan kalender.",
      crumb: "#{tag}",
      count: {
        other: "{n} tanggal mendatang bertanda “{tag}”, dari yang terdekat.",
      } as PluralForms,
      searchPrompt: "Mencari yang lain?",
      searchLink: "Cari “{tag}” di seluruh katalog.",
      collectionDescription: "Tanggal mendatang bertanda {tag}.",
    },
  },

  pages: {
    about: {
      title: "Tentang",
      description: "Cara Until mengumpulkan, menandai, dan mengelompokkan ribuan tanggal mendatang.",
      eyebrow: "Proyek ini",
      heading: "Koran dari masa depan",

      intro:
        "Until adalah katalog tanggal yang belum terjadi. Hari libur resmi dari hampir semua negara, acara terjadwal yang diambil dari halaman tahun Wikipedia dan Wikidata, ditambah lapisan kurasi berisi hal-hal yang memang ditunggu orang — gerhana, Piala Dunia, Olimpiade, pemilu, Komet Halley.",
      categories:
        "Tiap baris ditandai dan dikelompokkan ke dalam {n} kategori — hari libur, hari nasional, olahraga, astronomi, antariksa, teknologi, politik, sejarah, dan lainnya. Cari di seluruh katalog, saring satu kategori, buka hitung mundur langsung, lalu tambahkan ke kalender.",
      sources:
        "Tulang punggung hari libur adalah data luring {dateHolidays}, diperluas dengan {wikidata} dan {wikipedia}. Nama yang sama pada hari yang sama (Natal di 140 negara) digabung menjadi satu hitung mundur. Kalau sumber berbeda pendapat, catatan kurasi yang menang. Tiap halaman acara menyebut sumbernya dan kapan tanggalnya terakhir diperiksa.",
      expected:
        "Tanggal yang harinya belum pasti diberi label “perkiraan” dengan bulan, kuartal, atau tahun yang disebut sumbernya, dan tidak berdetak sampai tanggal sebenarnya terbit. Katalog disegarkan tiap hari dari sumber-sumbernya.",
      yourOwn:
        "Anda bisa membuat sendiri. Yang itu tetap di peramban — tanpa akun — dan tautan berbaginya membawa judul serta tanggal di dalam URL, jadi siapa pun bisa membuka jam yang sama.",

      stats: {
        dates: "Tanggal",
        featured: "Pilihan",
        updated: "Diperbarui",
      },

      byCategory: {
        heading: "Per kategori",
        empty: "Katalog sedang dilengkapi — mampir lagi nanti.",
      },

      bySource: {
        heading: "Per sumber",
        empty: "Belum ada sumber yang dilaporkan.",
      },
    },

    attributions: {
      title: "Atribusi — dari mana tanggal-tanggal ini berasal",
      description:
        "Semua sumber di balik katalog Until, dengan lisensi dan atribusi yang diminta masing-masing: date-holidays, Wikipedia, Wikidata, Hebcal, Launch Library, dan lainnya.",
      eyebrow: "Sumber",
      heading: "Atribusi",
      intro:
        "Until hanya mengambil sumber yang syaratnya mengizinkan penyimpanan dan penerbitan ulang data. Sumber berbagi-serupa (teks Wikipedia, TVMaze, data date-holidays) dikreditkan di tiap halaman yang memakainya; gambar hanya di-hosting ulang di bawah lisensi CC0, domain publik, CC BY, atau CC BY-SA dengan nama pembuatnya. Tiap halaman acara menautkan kembali ke catatan asalnya.",
      sourcesEmpty: "Daftar sumber sedang tidak tersedia.",

      images: {
        heading: "Gambar",
        policy:
          "Foto adalah salinan yang di-hosting ulang, diubah ukurannya dan disajikan dari penyimpanan kami sendiri, jadi server aslinya tidak pernah dibebani. Hanya berkas berlisensi bebas yang diterima — CC0, domain publik, CC BY, CC BY-SA, dan beberapa lisensi pemerintah terbuka, ditambah citra NASA sesuai pedoman medianya. Berkas fair use serta lisensi nonkomersial (NC) dan tanpa-turunan (ND) langsung ditolak, begitu pula berkas yang terikat merek dagang atau hak atas potret, dan tiap berkas yang disimpan tetap membawa pembuat, lisensi, dan tautan kembali ke halaman berkasnya. Acara yang tidak punya foto bebas mendapat kartu buatan sebagai gantinya.",
        shareAlike:
          "Foto berbagi-serupa (CC BY-SA) ditampilkan tanpa diubah, pada proporsinya sendiri, dengan kredit di bawahnya. Foto seperti ini tidak pernah dipotong menjadi kartu media sosial: hasil gabungan itu akan menjadi karya turunan dan harus memakai lisensi berbagi-serupa yang sama, jadi kartu tersebut memakai desain buatan. Berkas yang tersimpan diperiksa ulang terhadap sumbernya tiap bulan; berkas yang sudah dihapus atau tidak lagi bebas dikeluarkan dari penyimpanan kami dan halamannya kembali memakai kartu buatan.",
        empty: "Belum ada gambar yang di-hosting ulang.",
        count: {
          other: "{n} gambar di pustaka hari ini:",
        } as PluralForms,
      },

      fonts:
        "Huruf: Fraunces (SIL Open Font License) dan Geist (SIL Open Font License). Astronomi dihitung dengan astronomy-engine (MIT).",
    },

    create: {
      title: "Buat hitung mundur",
      description: "Buat hitung mundur pribadi dan tambahkan ke kalender Anda.",
      eyebrow: "Tanggal Anda",
      heading: "Buat hitung mundur",
      intro:
        "Ulang tahun, peluncuran, perjalanan, sidang, reuni. Berdetak sama seperti isi katalog — dan bisa langsung dimasukkan ke Google Calendar, Outlook, atau berkas .ics.",

      form: {
        draftTitle: "Sesuatu yang saya tunggu",
        draftNote: "Hitung mundur buatan Anda.",
        titleLabel: "Judul",
        dateLabel: "Tanggal",
        categoryLabel: "Kategori",
        noteLabel: "Catatan",
        notePlaceholder: "Kenapa tanggal ini penting bagi Anda.",
        save: "Simpan di perangkat ini",
        openShareable: "Buka halaman yang bisa dibagikan",
        saved: "Tersimpan. {link} — hitung mundur ini ada di peramban ini sampai Anda menghapus datanya.",
        savedLink: "Lihat",
        privacy:
          "Hitung mundur buatan sendiri tetap di perangkat Anda (tanpa akun). Tautan berbaginya menyimpan judul dan tanggal di dalam URL.",
        previewLabel: "Pratinjau langsung",
        chooseDate: "Pilih tanggal untuk mulai menghitung.",
      },
    },

    notFound: {
      heading: "Tanggal ini tidak ada di katalog",
      body: "Mungkin sudah digabung, diganti nama, atau memang tidak pernah ada.",
      backHome: "Kembali ke semua yang akan datang",
    },
  },

  embed: {
    countdown: {
      units: {
        days: { other: "hari" } as PluralForms,
        hours: "jam",
        minutes: "mnt",
        seconds: "dtk",
      },
      today: "Hari ini.",
      past: "Yang ini sudah lewat.",
    },

    studio: {
      heading: "Bawa ke mana-mana",

      controls: {
        preset: "Prasetel",
        digits: "Angka",
        type: "Teks",
        background: "Latar",
        transparent: "Transparan — tembus ke adegan atau halaman di baliknya",
        font: "Huruf",
        size: "Ukuran",
        layout: "Tata letak",
        units: "Satuan",
        separator: "Pemisah",
        frame: "Bingkai",
        radius: "Radius sudut",
        inset: "Jarak tepi",
        position: "Posisi",
        done: "Pesan setelah selesai",
        reset: "Setel ulang",
        colourPicker: "{label} — pemilih warna",
      },

      toggles: {
        unitLabels: "Label satuan",
        title: "Judul",
        date: "Tanggal",
        note: "Catatan",
        wordmark: "Logo teks",
        glow: "Cahaya",
        trim: "Hilangkan nol di depan",
      },

      presets: {
        dark: "Until gelap",
        light: "Terang",
        amber: "Ambar",
        mono: "Mono",
        neon: "Neon",
        clear: "Transparan",
      },

      fonts: {
        serif: "Serif",
        sans: "Sans",
        mono: "Mono",
      },

      layouts: {
        row: "Baris",
        stack: "Bertumpuk",
        compact: "Ringkas",
        big: "Satu angka besar",
      },

      separators: {
        colon: "Titik dua",
        dot: "Titik",
        space: "Spasi",
        none: "Tanpa pemisah",
      },

      frames: {
        card: "Kartu",
        outline: "Garis tepi",
        none: "Tanpa bingkai",
      },

      units: {
        dhms: "Hari · jam · menit · detik",
        dhm: "Hari · jam · menit",
        dh: "Hari · jam",
        d: "Hari",
        hms: "Jam · menit · detik",
        hm: "Jam · menit",
        ms: "Menit · detik",
      },

      positions: {
        "top-left": "Kiri atas",
        top: "Atas",
        "top-right": "Kanan atas",
        left: "Kiri",
        center: "Tengah",
        right: "Kanan",
        "bottom-left": "Kiri bawah",
        bottom: "Bawah",
        "bottom-right": "Kanan bawah",
      },

      copy: {
        code: "Salin kode",
        url: "Salin URL",
      },

      embed: {
        previewTitle: "Pratinjau sematan",
        paste: "Tempel ini ke halaman Anda",
        codeLabel: "Kode sematan",
        note: "Sematan ini masuk selebar halaman dengan tinggi {height}px. WordPress, Ghost, dan Notion juga menerima tautan hitung mundurnya sendiri dan mencari sematannya — tapi cara itu memunculkan kartu standar, jadi tempel kode di atas supaya hasil rancangan Anda di sini yang terpakai.",
      },

      stream: {
        previewTitle: "Pratinjau lapisan siaran",
        canvasNote: "Kanvas {width} × {height}, diperkecil — pola papan catur itulah yang dibuat tembus oleh OBS.",
        urlLabel: "URL sumber peramban",
        source: "Sumber peramban · {width} × {height}",
        steps: [
          "Di OBS atau Streamlabs, tambahkan sumber peramban (Browser).",
          "Tempel URL di atas.",
          "Setel ukurannya ke {width} × {height} — kanvas yang dipakai sebagai acuan posisi.",
          "Biarkan latarnya transparan; lapisan ini membawa latarnya sendiri.",
          "Centang “Refresh browser when scene becomes active” supaya jamnya mulai dari awal.",
        ],
      },
    },
  },
};
