/**
 * The English catalogue, and the type every other locale is checked against.
 *
 * `Messages` is `typeof EN`, so a missing key, a stray key or a `PluralForms` where a string belongs
 * fails `npm run typecheck` in the locale that got it wrong — which is the only practical way to
 * keep fifteen hand-written catalogues in step. What the type cannot see (a dropped `{title}`, a
 * catalogue left as a copy of English) is covered by `tests/i18n/messages.test.ts`.
 */
import { categories } from "./categories";
import { common } from "./common";
import { embed } from "./embed";
import { event } from "./event";
import { home } from "./home";
import { hubs } from "./hubs";
import { pages } from "./pages";
import { seo } from "./seo";
import { series } from "./series";

export const EN = { common, categories, seo, home, event, series, hubs, pages, embed };

export type Messages = typeof EN;
