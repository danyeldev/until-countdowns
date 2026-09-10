/**
 * Major annual meteor showers with the peak solar longitude (λ☉, equinox J2000.0) and ZHR
 * copied from the IMO 2026 Meteor Shower Calendar, Table 5 "Working List of Visual Meteor
 * Showers" (IMO INFO(3-25); Wayback capture of imo.net/files/meteor-shower/cal2026.pdf dated
 * 2025-12-23 — imo.net itself is offline after a cyberattack and serves HTML error pages with
 * HTTP 200, so the live site must not be used as a source or a health check).
 *
 * The peak instant of a year is computed from λ☉ with astronomy-engine (see sky.ts): the IMO
 * value is referred to J2000.0 while the engine returns the ecliptic longitude of date, so the
 * general precession (≈ 50.29″/yr) is added before the search. IMO values are facts; the
 * methodology page credits the IMO. The IAU MDC list (ta3.sk) is a cross-check only: it has no
 * ZHR and several conflicting solutions per shower.
 */
export type MeteorShower = {
  /** Stable key (IMO/IAU three-letter code, lower case) used in `source_key`. */
  key: string;
  /** Title base, singular adjective form matching the curated series titles ("Perseid meteor shower peak"). */
  name: string;
  /** IAU MDC number and code, e.g. "007 PER". */
  iau: string;
  /** Peak solar longitude in degrees, equinox J2000.0 (IMO 2026 Table 5). */
  peakLambda: number;
  /** Zenithal hourly rate at maximum (IMO 2026 Table 5). */
  zhr: number;
  /** Activity period as printed by the IMO. */
  activity: string;
  /** Parent body. */
  parent: string;
  popularity: number;
  tags: string[];
};

export const METEOR_SHOWERS: MeteorShower[] = [
  {
    key: "qua",
    name: "Quadrantid",
    iau: "010 QUA",
    peakLambda: 283.15,
    zhr: 80,
    activity: "December 28 to January 12",
    parent: "asteroid (196256) 2003 EH1",
    popularity: 40,
    tags: ["quadrantids"],
  },
  {
    key: "lyr",
    name: "Lyrid",
    iau: "006 LYR",
    peakLambda: 32.32,
    zhr: 18,
    activity: "April 14 to April 30",
    parent: "comet C/1861 G1 (Thatcher)",
    popularity: 40,
    tags: ["lyrids"],
  },
  {
    key: "eta",
    name: "Eta Aquariid",
    iau: "031 ETA",
    peakLambda: 45.5,
    zhr: 50,
    activity: "April 19 to May 28",
    parent: "comet 1P/Halley",
    popularity: 40,
    tags: ["eta-aquariids"],
  },
  {
    key: "sda",
    name: "Southern Delta Aquariid",
    iau: "005 SDA",
    peakLambda: 128,
    zhr: 25,
    activity: "July 12 to August 23",
    parent: "comet 96P/Machholz (probable)",
    popularity: 35,
    tags: ["delta-aquariids"],
  },
  {
    key: "per",
    name: "Perseid",
    iau: "007 PER",
    peakLambda: 140.0,
    zhr: 100,
    activity: "July 17 to August 24",
    parent: "comet 109P/Swift–Tuttle",
    popularity: 55,
    tags: ["perseids"],
  },
  {
    key: "dra",
    name: "Draconid",
    iau: "009 DRA",
    peakLambda: 195.4,
    zhr: 5,
    activity: "October 6 to October 10",
    parent: "comet 21P/Giacobini–Zinner",
    popularity: 35,
    tags: ["draconids"],
  },
  {
    key: "ori",
    name: "Orionid",
    iau: "008 ORI",
    peakLambda: 208,
    zhr: 20,
    activity: "October 2 to November 7",
    parent: "comet 1P/Halley",
    popularity: 40,
    tags: ["orionids"],
  },
  {
    key: "leo",
    name: "Leonid",
    iau: "013 LEO",
    peakLambda: 235.27,
    zhr: 15,
    activity: "November 6 to November 30",
    parent: "comet 55P/Tempel–Tuttle",
    popularity: 40,
    tags: ["leonids"],
  },
  {
    key: "gem",
    name: "Geminid",
    iau: "004 GEM",
    peakLambda: 262.2,
    zhr: 150,
    activity: "December 4 to December 20",
    parent: "asteroid (3200) Phaethon",
    popularity: 55,
    tags: ["geminids"],
  },
  {
    key: "urs",
    name: "Ursid",
    iau: "015 URS",
    peakLambda: 270.7,
    zhr: 10,
    activity: "December 17 to December 26",
    parent: "comet 8P/Tuttle",
    popularity: 35,
    tags: ["ursids"],
  },
];
