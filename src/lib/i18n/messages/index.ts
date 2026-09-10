/**
 * The catalogue registry.
 *
 * `server-only` on purpose: importing this from a Client Component would put all fifteen
 * catalogues in the browser bundle. Client Components take the strings they need as props — a
 * namespace is plain data (see `types.ts`), so `<Header nav={m.common.nav} />` is all it takes.
 */
import "server-only";
import type { Locale } from "../config";
import { ar } from "./ar";
import { de } from "./de";
import { EN, type Messages } from "./en";
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

export type { Messages };

export const CATALOGS: Record<Locale, Messages> = { en: EN, es, pt, fr, de, it, nl, pl, tr, ru, id, ja, ko, hi, ar };

/** The catalogue for a locale, English for anything unrecognised. Never throws. */
export function messagesFor(locale: Locale): Messages {
  return CATALOGS[locale] ?? EN;
}
