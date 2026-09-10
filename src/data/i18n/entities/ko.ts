/**
 * Korean entity names.
 *
 * Bare names, no particle: each string is an `<h1>`, a breadcrumb crumb and the `{title}` inside
 * "…까지 며칠 남았을까?", so it has to stand on its own in all three places.
 *
 * Hangul is a different script, so a Korean transliteration is not a translation nobody types — it
 * is the string people actually put in the search box (윔블던, 코첼라, 슈퍼볼). That is why this
 * table is fuller than a Latin-script locale's. What is left out is what Korean has no settled name
 * for at all: most of the Hindu festival calendar, the smaller US and Commonwealth civic days,
 * Fête de la Musique, Last Night of the Proms, Tax Day.
 *
 * Where the Korean name is the local observance rather than a rendering of the English one —
 * Lunar New Year is 설날, Vesak is 부처님 오신 날, Singles' Day is 광군제 — the comment says so.
 */
import type { EntityNames } from "./index";

export const ko: EntityNames = {
  // Turns of the calendar
  "new-year-s-day": "새해 첫날",
  "new-year-s-eve": "새해 전야",
  "leap-day": "윤일",
  "friday-the-13th": "13일의 금요일",
  "daylight-saving-time-begins": "서머타임 시작",
  "daylight-saving-time-ends": "서머타임 종료",
  "daylight-saving-time-begins-us": "서머타임 시작 (미국)",
  "daylight-saving-time-ends-us": "서머타임 종료 (미국)",
  "summer-time-begins-europe": "서머타임 시작 (유럽)",
  "summer-time-ends-europe": "서머타임 종료 (유럽)",
  "leap-second": "윤초",
  "year-2038-problem": "2038년 문제",

  // Christmas and the Christian year. Catholic feasts take the Korean Church's own names.
  "christmas-day": "크리스마스",
  "christmas-eve": "크리스마스이브",
  "boxing-day": "박싱데이",
  epiphany: "주현절",
  advent: "대림절",
  lent: "사순절",
  carnival: "카니발",
  "ash-wednesday": "재의 수요일",
  "palm-sunday": "종려주일",
  "maundy-thursday": "성목요일",
  "good-friday": "성금요일",
  "easter-sunday": "부활절",
  "easter-monday": "부활절 월요일",
  "orthodox-easter": "정교회 부활절",
  "ascension-day": "예수 승천 대축일",
  pentecost: "성령강림절",
  "whit-monday": "성령강림절 월요일",
  "corpus-christi": "성체 성혈 대축일",
  "assumption-of-mary": "성모 승천 대축일",
  "all-saints-day": "만성절",
  "all-souls-day": "위령의 날",
  "immaculate-conception": "성모 무염시태 대축일",
  "saint-nicholas-day": "성 니콜라오 축일",
  "saint-patrick-s-day": "성 패트릭의 날",
  "saint-stephen-s-day": "성 스테파노 축일",

  // Islamic calendar
  ramadan: "라마단",
  "eid-al-fitr": "이드 알피트르",
  "eid-al-adha": "이드 알아드하",
  "islamic-new-year": "이슬람력 새해",
  ashura: "아슈라",

  // Jewish calendar. The Korean names are the ones the Korean Bible uses.
  "rosh-hashanah": "로시 하샤나",
  "yom-kippur": "욤 키푸르",
  sukkot: "초막절",
  hanukkah: "하누카",
  purim: "부림절",
  passover: "유월절",
  shavuot: "칠칠절",

  // East and South Asia
  "lunar-new-year": "설날", // the Korean new year itself, not a rendering of "Lunar New Year"
  "chinese-new-year": "춘절", // the Chinese one, kept distinct from 설날
  chuseok: "추석",
  "mid-autumn-festival": "중추절", // the Chinese festival; Korea's own is 추석 above
  "dragon-boat-festival": "단오절",
  "qingming-festival": "청명절",
  vesak: "부처님 오신 날", // the Korean name for Buddha's birthday, and what people search
  songkran: "송끄란",
  nowruz: "노루즈",
  obon: "오봉",
  diwali: "디왈리",
  holi: "홀리",

  // National and civic days
  "independence-day": "독립기념일",
  "national-day": "국경일",
  "constitution-day": "제헌절",
  "liberation-day": "광복절", // Korea's own 8·15; the word Korean readers search for
  "republic-day": "공화국의 날",
  "labour-day": "노동절",
  "labor-day": "노동절 (미국)", // the US September holiday, kept apart from 5월 1일
  "may-day": "메이데이",
  "memorial-day": "현충일",
  "veterans-day": "재향군인의 날",
  "presidents-day": "대통령의 날",
  "martin-luther-king-jr-day": "마틴 루서 킹의 날",
  "columbus-day": "콜럼버스의 날",
  "canada-day": "캐나다의 날",
  "bastille-day": "프랑스 혁명 기념일", // Koreans do not say "바스티유의 날"
  "german-unity-day": "독일 통일의 날",
  "australia-day": "호주의 날",

  // Family and seasonal days
  "mother-s-day": "어머니의 날", // Korea keeps 어버이날 instead, but this is the day the catalog carries
  "father-s-day": "아버지의 날",
  "thanksgiving-day": "추수감사절",
  halloween: "핼러윈",
  "valentine-s-day": "밸런타인데이",
  "may-the-fourth-star-wars-day": "메이 더 포스 (스타워즈의 날)",
  "star-wars-day": "스타워즈의 날",
  "talk-like-a-pirate-day": "해적처럼 말하는 날",

  // Shopping
  "black-friday": "블랙 프라이데이",
  "cyber-monday": "사이버 먼데이",
  "singles-day": "광군제", // the Chinese 11·11 sale, known in Korea by its Chinese name
  "amazon-prime-day": "아마존 프라임 데이",

  // UN and international observances
  "international-women-s-day": "세계 여성의 날",
  "world-health-day": "세계 보건의 날",
  "world-water-day": "세계 물의 날",
  "earth-day": "지구의 날",
  "world-environment-day": "세계 환경의 날",
  "world-oceans-day": "세계 해양의 날",
  "world-book-day": "세계 책의 날",
  "world-sleep-day": "세계 수면의 날",
  "international-day-of-happiness": "국제 행복의 날",
  "world-food-day": "세계 식량의 날",
  "international-literacy-day": "세계 문해의 날",
  "international-friendship-day": "국제 우정의 날",
  "international-day-of-peace": "세계 평화의 날",
  "human-rights-day": "세계 인권의 날",
  "international-jazz-day": "국제 재즈의 날",
  "international-coffee-day": "국제 커피의 날",
  "international-yoga-day": "국제 요가의 날",
  "world-photography-day": "세계 사진의 날",
  "world-emoji-day": "세계 이모지의 날",
  "world-ufo-day": "세계 UFO의 날",
  "world-space-week-begins": "세계 우주 주간 시작",
  "earth-hour": "어스아워",
  "pi-day": "파이 데이",

  // Sky
  "total-solar-eclipse": "개기일식",
  "annular-solar-eclipse": "금환일식",
  "partial-solar-eclipse": "부분일식",
  "total-lunar-eclipse": "개기월식",
  supermoon: "슈퍼문",
  "blue-moon": "블루문",
  "march-equinox": "춘분",
  "september-equinox": "추분",
  "northern-hemisphere-summer-solstice": "하지",
  "northern-hemisphere-winter-solstice": "동지",
  "perseid-meteor-shower-peak": "페르세우스자리 유성우 극대기",
  "geminid-meteor-shower-peak": "쌍둥이자리 유성우 극대기",
  "quadrantid-meteor-shower-peak": "사분의자리 유성우 극대기",
  "lyrid-meteor-shower-peak": "거문고자리 유성우 극대기",
  "orionid-meteor-shower-peak": "오리온자리 유성우 극대기",
  "leonid-meteor-shower-peak": "사자자리 유성우 극대기",
  "ursid-meteor-shower-peak": "작은곰자리 유성우 극대기",
  "eta-aquariid-meteor-shower-peak": "물병자리 에타 유성우 극대기",
  "doomsday-clock-announcement": "지구 종말 시계 발표",

  // Sport
  "summer-olympics": "하계 올림픽",
  "winter-olympics": "동계 올림픽",
  "paralympic-games": "패럴림픽",
  "fifa-world-cup": "FIFA 월드컵",
  "uefa-champions-league-final": "UEFA 챔피언스리그 결승",
  "uefa-european-championship": "UEFA 유로",
  "copa-america": "코파 아메리카",
  "africa-cup-of-nations": "아프리카 네이션스컵",
  "rugby-world-cup": "럭비 월드컵",
  "cricket-world-cup": "크리켓 월드컵",
  "super-bowl": "슈퍼볼",
  "nba-finals": "NBA 파이널",
  "world-series": "월드시리즈",
  "stanley-cup-finals": "스탠리컵 파이널",
  "tour-de-france": "투르 드 프랑스",
  "formula-one-season-start": "포뮬러 1 시즌 개막",
  "monaco-grand-prix": "모나코 그랑프리",
  wimbledon: "윔블던",
  "roland-garros": "프랑스 오픈", // what Koreans call Roland-Garros
  "us-open-tennis": "US 오픈 테니스",
  "australian-open": "호주 오픈",
  "the-masters": "마스터스 토너먼트",
  "ryder-cup": "라이더컵",
  "boston-marathon": "보스턴 마라톤",
  "new-york-city-marathon": "뉴욕 마라톤",
  "berlin-marathon": "베를린 마라톤",
  "chicago-marathon": "시카고 마라톤",
  "tokyo-marathon": "도쿄 마라톤",

  // Culture, awards and festivals
  "academy-awards": "아카데미 시상식",
  "golden-globe-awards": "골든글로브 시상식",
  "grammy-awards": "그래미 어워드",
  "cannes-film-festival": "칸 영화제",
  "met-gala": "멧 갈라",
  "nobel-prize-ceremony": "노벨상 시상식",
  "eurovision-song-contest": "유로비전 송 콘테스트",
  "vienna-new-year-s-concert": "빈 신년 음악회",
  "comic-con": "코믹콘",
  "burning-man": "버닝맨",
  "glastonbury-festival": "글래스턴베리 페스티벌",
  coachella: "코첼라",
  tomorrowland: "투모로우랜드",
  oktoberfest: "옥토버페스트",
  "la-tomatina": "라 토마티나",
  "san-fermin": "산페르민 축제",
};
