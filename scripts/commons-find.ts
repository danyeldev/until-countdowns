/**
 * Look up candidate photos on Wikimedia Commons for a subject and print them with the same
 * licence verdict the image pipeline applies, so a person (or an agent) can pick a file that is
 * guaranteed to be storable.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/commons-find.ts "Perseid meteor shower" [--n 12]
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/commons-find.ts --file "File:Perseids 2016.jpg"
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/commons-find.ts --batch queries.txt [--n 6]
 *     `queries.txt`: one `label<TAB>query` (or just `query`) per line; results are printed under
 *     a `### label | query` heading each, in order.
 *
 * One line per candidate:
 *   OK  | File:….jpg | 4000x2667 | image/jpeg | CC BY-SA 4.0 | restrictions: - | <description> | cats: a; b; c
 *   NO <reason> | File:….png | …
 */
import { makeContext } from "@/lib/enrich/context";
import { COMMONS_ACTION_API, commonsImageInfo, fileTitle } from "@/lib/enrich/images/commons";
import { type CommonsImageInfo, evaluateCommonsFile, PREFERRED_THUMB_WIDTH, stripHtml } from "@/lib/enrich/images/license";

type SearchResponse = {
  query?: { pages?: Array<{ title?: string; index?: number; imageinfo?: CommonsImageInfo[] }> };
};

const args = process.argv.slice(2);
const fileMode = args.indexOf("--file");
const batchMode = args.indexOf("--batch");
const nFlag = args.indexOf("--n");
const limit = nFlag >= 0 ? Math.min(50, Math.max(1, Number(args[nFlag + 1]) || 12)) : 12;
const consumed = new Set<number>();
if (nFlag >= 0) consumed.add(nFlag + 1);
if (fileMode >= 0) consumed.add(fileMode + 1);
if (batchMode >= 0) consumed.add(batchMode + 1);
const positional = args.filter((a, i) => !a.startsWith("--") && !consumed.has(i));

const ctx = makeContext({ deadline: Date.now() + 30 * 60_000, scope: "commons-find", log: { info() {}, warn() {}, error() {} } });

function meta(info: CommonsImageInfo, key: string): string {
  const raw = info.extmetadata?.[key]?.value;
  return raw === undefined || raw === null ? "" : String(raw);
}

function line(title: string, info: CommonsImageInfo): string {
  const verdict = evaluateCommonsFile(info, "commons-find");
  const head = verdict.ok ? "OK " : `NO ${verdict.reason.slice(0, 60)}`;
  const description = (stripHtml(meta(info, "ImageDescription")) ?? "").replace(/\s+/g, " ").slice(0, 140);
  const categories = meta(info, "Categories").split("|").filter(Boolean).slice(0, 4).join("; ");
  const restrictions = meta(info, "Restrictions") || "-";
  return [
    head,
    title,
    `${info.width ?? "?"}x${info.height ?? "?"}`,
    info.mime ?? "?",
    meta(info, "LicenseShortName") || "(no licence)",
    `restrictions: ${restrictions}`,
    description || "(no description)",
    `cats: ${categories || "-"}`,
  ].join(" | ");
}

async function search(query: string): Promise<void> {
  const url =
    `${COMMONS_ACTION_API}?action=query&format=json&formatversion=2&generator=search&gsrnamespace=6` +
    `&gsrlimit=${limit}&gsrsearch=${encodeURIComponent(query)}` +
    `&prop=imageinfo&iiprop=url%7Csize%7Cmime%7Cextmetadata&iiurlwidth=${PREFERRED_THUMB_WIDTH}`;
  const data = await ctx.http.fetchJson<SearchResponse>(url);
  const pages = (data.query?.pages ?? []).slice().sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  if (pages.length === 0) {
    console.log(`(no results for "${query}")`);
    return;
  }
  for (const page of pages) {
    const info = page.imageinfo?.[0];
    if (!page.title || !info) continue;
    console.log(line(page.title, info));
  }
}

async function check(name: string): Promise<void> {
  const title = fileTitle(name);
  const found = await commonsImageInfo(ctx, [title]);
  const info = found.get(title);
  if (!info) {
    console.log(`NO file not found | ${title}`);
    return;
  }
  console.log(line(title, info));
}

async function batch(path: string): Promise<void> {
  const { readFileSync } = await import("node:fs");
  const lines = readFileSync(path, "utf8").split("\n").map((l) => l.trim()).filter(Boolean);
  for (const raw of lines) {
    const tab = raw.indexOf("\t");
    const label = tab >= 0 ? raw.slice(0, tab).trim() : raw;
    const query = tab >= 0 ? raw.slice(tab + 1).trim() : raw;
    console.log(`### ${label} | ${query}`);
    try {
      if (/^File:/i.test(query)) await check(query);
      else await search(query);
    } catch (err) {
      console.log(`(error: ${err instanceof Error ? err.message : String(err)})`);
    }
  }
}

async function main(): Promise<void> {
  if (fileMode >= 0) {
    const name = args[fileMode + 1];
    if (!name) throw new Error("--file needs a file title");
    await check(name);
    return;
  }
  if (batchMode >= 0) {
    const path = args[batchMode + 1];
    if (!path) throw new Error("--batch needs a file path");
    await batch(path);
    return;
  }
  const query = positional.join(" ").trim();
  if (!query) throw new Error('usage: commons-find "<query>" [--n 12] | --file "File:Name.jpg" | --batch queries.txt');
  await search(query);
}

void main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
