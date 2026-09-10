/**
 * Message shapes and the two helpers that turn a message into a rendered string.
 *
 * Messages are **plain data** — strings, string arrays, and `PluralForms` objects — never
 * functions. That is a deliberate constraint: a whole namespace can then be handed to a Client
 * Component as a prop (functions do not cross the RSC boundary), and a translation file stays
 * something a translator can read without knowing TypeScript.
 *
 * Interpolation is `{name}`; `tests/i18n/messages.test.ts` fails a locale whose placeholders do not
 * match English, which is the check that a hand-typed catalogue actually needs.
 */
import type { PluralForms } from "../format";
import { number, selectPlural } from "../format";
import type { Locale } from "../config";

export type { PluralForms };

export type Vars = Record<string, string | number>;

/** `fill("{n} days until {title}", { n: 3, title: "Christmas" })`. Unknown keys are left in place. */
export function fill(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = vars[key];
    return value === undefined ? match : String(value);
  });
}

/**
 * The right plural form for `n`, filled. `{n}` is available without passing it: it is the count,
 * grouped for the locale ("1,234" · "1.234" · "١٬٢٣٤"), while the form is chosen from the raw
 * number. A plain string is accepted too, for the messages (and languages) that need no forms.
 */
export function plural(locale: Locale, message: PluralForms | string, n: number, vars?: Vars): string {
  const template = typeof message === "string" ? message : selectPlural(locale, n, message);
  return fill(template, { n: number(locale, n), ...vars });
}
