import { COUNTRY_NAMES } from "@/lib/regions";

/**
 * Country name → ISO-3166 alpha-2 for the electoral calendar, where the country only appears as
 * link text ("[[Elections in France|France]]"). `COUNTRY_NAMES` (date-holidays) is matched on a
 * normalised exact name; `ALIASES` covers the ~50 sovereign states date-holidays lacks or spells
 * differently. Substring matching (`regionCodesMatching`) is deliberately not used: "Niger" would
 * match Nigeria and "Oman" Romania.
 *
 * KNOWN GAP (needs a shared change to `src/data/countries.json`, outside this adapter): 33 of the
 * codes below have no entry in `COUNTRY_NAMES` — TL FM MH KG QA LA SY MM PS OM AF BT KH IQ JO KI
 * KW LB MV NR NP KP PW PG WS SB TJ TM TV UZ YE MO NU. The codes are still correct ISO-3166 and are
 * the right filter value, but until those names exist `regionLabel()` renders the bare code and
 * `/country/<cc>` 404s (`countryOf()` returns null). Do not drop the aliases to paper over this:
 * the alternative is a wrong `GLOBAL` region on, e.g., the 2026 Palestinian legislative election.
 */

const ALIASES: Record<string, string> = {
  "united states": "US",
  "united states of america": "US",
  usa: "US",
  "united kingdom": "GB",
  "great britain": "GB",
  britain: "GB",
  gambia: "GM",
  "the gambia": "GM",
  niger: "NE",
  "equatorial guinea": "GQ",
  morocco: "MA",
  "north macedonia": "MK",
  czechia: "CZ",
  "czech republic": "CZ",
  "ivory coast": "CI",
  "cote d'ivoire": "CI",
  "timor-leste": "TL",
  "east timor": "TL",
  micronesia: "FM",
  "federated states of micronesia": "FM",
  "marshall islands": "MH",
  kyrgyzstan: "KG",
  mongolia: "MN",
  qatar: "QA",
  italy: "IT",
  laos: "LA",
  syria: "SY",
  myanmar: "MM",
  burma: "MM",
  eswatini: "SZ",
  swaziland: "SZ",
  palestine: "PS",
  "state of palestine": "PS",
  "sao tome and principe": "ST",
  oman: "OM",
  afghanistan: "AF",
  bangladesh: "BD",
  bhutan: "BT",
  cambodia: "KH",
  iraq: "IQ",
  jordan: "JO",
  kiribati: "KI",
  kuwait: "KW",
  lebanon: "LB",
  maldives: "MV",
  mali: "ML",
  nauru: "NR",
  nepal: "NP",
  "north korea": "KP",
  "south korea": "KR",
  "republic of korea": "KR",
  palau: "PW",
  "papua new guinea": "PG",
  samoa: "WS",
  "solomon islands": "SB",
  tajikistan: "TJ",
  togo: "TG",
  turkmenistan: "TM",
  tuvalu: "TV",
  uzbekistan: "UZ",
  yemen: "YE",
  turkiye: "TR",
  turkey: "TR",
  "russian federation": "RU",
  "people's republic of china": "CN",
  "republic of china": "TW",
  "democratic republic of the congo": "CD",
  "dr congo": "CD",
  "republic of the congo": "CG",
  congo: "CG",
  "vatican city": "VA",
  "holy see": "VA",
  "cabo verde": "CV",
  "cape verde": "CV",
  "brunei darussalam": "BN",
  "saint kitts and nevis": "KN",
  "st kitts and nevis": "KN",
  "saint lucia": "LC",
  "st lucia": "LC",
  "saint vincent and the grenadines": "VC",
  "st vincent and the grenadines": "VC",
  "trinidad and tobago": "TT",
  "antigua and barbuda": "AG",
  "bosnia and herzegovina": "BA",
  netherlands: "NL",
  "the netherlands": "NL",
  bahamas: "BS",
  "the bahamas": "BS",
  philippines: "PH",
  "the philippines": "PH",
  "united arab emirates": "AE",
  uae: "AE",
  iran: "IR",
  vietnam: "VN",
  "viet nam": "VN",
  "hong kong": "HK",
  macau: "MO",
  macao: "MO",
  "puerto rico": "PR",
  greenland: "GL",
  "faroe islands": "FO",
  "cook islands": "CK",
  niue: "NU",
  "new caledonia": "NC",
  "french polynesia": "PF",
  bermuda: "BM",
  "cayman islands": "KY",
  "isle of man": "IM",
  jersey: "JE",
  guernsey: "GG",
  gibraltar: "GI",
  "western sahara": "EH",
  // Limited-recognition states (Somaliland, Northern Cyprus, Abkhazia, South Ossetia,
  // Transnistria) are deliberately NOT aliased to their de jure parent: their elections
  // must not appear on the parent's country page. countryCode() returns null → GLOBAL.
  kosovo: "XK",
  taiwan: "TW",
};

/** G20 members (the EU and AU are unions, not countries) for the election popularity bump. */
export const G20 = new Set(["AR", "AU", "BR", "CA", "CN", "FR", "DE", "IN", "ID", "IT", "JP", "KR", "MX", "RU", "SA", "ZA", "TR", "GB", "US"]);

export function normalizeCountryName(name: string): string {
  return String(name ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[’‘]/g, "'")
    .replace(/\bst\.\s*/g, "st ")
    .replace(/[^a-z0-9' -]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^the\s+/, "");
}

let reverse: Map<string, string> | null = null;

function reverseNames(): Map<string, string> {
  if (reverse) return reverse;
  reverse = new Map();
  for (const [code, name] of Object.entries(COUNTRY_NAMES)) {
    if (code === "GLOBAL") continue;
    const key = normalizeCountryName(name);
    if (key && !reverse.has(key)) reverse.set(key, code);
  }
  return reverse;
}

/** ISO alpha-2 for an English country name, or null when unknown. */
export function countryCode(name: string): string | null {
  const key = normalizeCountryName(name);
  if (!key) return null;
  const alias = ALIASES[key];
  if (alias) return alias;
  const exact = reverseNames().get(key);
  if (exact) return exact;
  // "Republic of X" / "Kingdom of X" wrappers used by date-holidays ("Kingdom of Morocco").
  for (const [n, code] of reverseNames()) {
    if (n === `republic of ${key}` || n === `kingdom of ${key}` || n === `republic of the ${key}`) return code;
  }
  return null;
}
