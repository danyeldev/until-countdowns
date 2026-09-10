/**
 * Curated entity names per locale — see `src/lib/i18n/content.ts` for why this is curated rather
 * than machine-translated, and `keys.ts` for the list of entities worth naming.
 */
import type { Locale } from "@/lib/i18n/config";
import { ar } from "./ar";
import { de } from "./de";
import { es } from "./es";
import { fr } from "./fr";
import { hi } from "./hi";
import { id } from "./id";
import { it } from "./it";
import { ja } from "./ja";
import { ko } from "./ko";
import { nl } from "./nl";
import { pl } from "./pl";
import { pt } from "./pt";
import { ru } from "./ru";
import { tr } from "./tr";

/** `slugify(englishTitle)` → the name in this locale. */
export type EntityNames = Record<string, string>;

/** English is absent on purpose: the catalog's own title is the English name. */
export const ENTITY_NAMES: Partial<Record<Locale, EntityNames>> = {
  es, pt, fr, de, it, nl, pl, tr, ru, id, ja, ko, hi, ar,
};
