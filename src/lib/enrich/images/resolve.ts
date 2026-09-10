/**
 * The image discovery chain (Phase 5, brief §21). Stops at the first **licensed** hit.
 *
 *   a. `events.image_candidate_url` written by an adapter — accepted only for providers whose
 *      terms allow re-hosting: Launch Library (with a licence from its allowlist — "Unknown" and
 *      every NC/ND value are rejected), NASA, and Commons/Wikipedia files (re-verified against
 *      Commons, because the adapter only saw a file name).
 *   b. Wikipedia `prop=pageimages&pilicense=free`, batched 50 titles per call.
 *   c. Wikidata `P18` → venue `P276`'s `P18` → country `P17`'s `P41` flag (elections and national
 *      days). `P154` logos are not taken at all: the brief allows them inline only, and every
 *      stored image becomes a hero here.
 *   d. Commons keyword search (`gsrnamespace=6`).
 *   e. NASA image library, for space/astronomy/science rows.
 *   f. nothing licensed → `image_status = 'skip'` with a reason; the UI draws `FallbackCard`.
 *
 * Every Wikimedia candidate — including the ones an adapter pre-resolved — goes through the
 * Commons `imageinfo` + `extmetadata` gate in `license.ts` before it can be stored. Nothing here
 * ever reads the REST `page/summary` image fields.
 *
 * The chain is run over a whole batch of events at once so the two batchable calls
 * (`pageimages` 50/call, `wbgetentities` 50/call) happen once per run rather than per event.
 */
import type { EnrichContext } from "../context";
import { readEnwiki, readQid, titleFromWikipediaUrl } from "../wikipedia";
import { commonsSearch, CommonsVerifier, fileTitleFromUrl, pageImages } from "./commons";
import { evaluateLl2Candidate, evaluateNamedLicense, fileHostKind, type LicensedImage } from "./license";
import { findNasaImage } from "./nasa";
import { fetchEntities, fileCandidates, type EntityInfo } from "./wikidata";

export type ResolvableEvent = {
  id: string;
  slug: string;
  title: string;
  category: string;
  tags: string[];
  external_ids: Record<string, unknown>;
  source_url: string | null;
  image_candidate_url: string | null;
  image_candidate_meta: Record<string, unknown> | null;
};

export type Resolution = { ok: true; image: LicensedImage } | { ok: false; reason: string };

/** Categories where a country flag is an acceptable last visual resort. */
const FLAG_CATEGORIES = new Set(["politics", "national", "holidays"]);
/** Categories the NASA library is searched for. */
const NASA_CATEGORIES = new Set(["space", "astronomy", "science"]);
/** Categories whose long tail is worth a Commons keyword search. */
const SEARCH_CATEGORIES = new Set(["fun", "awareness", "national", "holidays", "religion", "festivals", "culture", "curiosities", "nature"]);

/** Reasons a candidate is not even attempted — surfaced verbatim in `enrichment_jobs.last_error`. */
export const SKIP_NO_CANDIDATE = "no licensed image candidate";

/**
 * Rows where a photograph of an identifiable person is the wrong picture whatever its licence
 * says: an accident, a disaster, a crime, a trial, a funeral, a political split. `extmetadata`
 * does not surface personality rights (brief §21 step 4), and a head-of-state portrait
 * illustrating a fatal-incident countdown is a reputational problem, not a licensing one — the
 * fallback card is the better answer. For these titles the file's own categories are screened.
 */
export const SENSITIVE_TITLE_RE =
  /\b(?:incident|accident|crash|disaster|collision|sinking|derailment|collapse|explosion|shooting|attack|bombing|massacre|murder|killing|assassination|kidnapping|hostage|riot|coup|scandal|trial|verdict|inquest|funeral|memorial|outbreak|epidemic|famine|wildfire|earthquake|hurricane|flood|death|dies|split)\b/i;

export function isSensitiveTitle(title: string): boolean {
  return SENSITIVE_TITLE_RE.test(title);
}

function providerOf(meta: Record<string, unknown> | null): string {
  const value = meta && typeof meta.provider === "string" ? meta.provider : "";
  return value.toLowerCase();
}

/**
 * Step (a) for one event, without any network call for LL2 (the licence travels in the payload)
 * and with a Commons verification for Wikimedia files.
 */
export async function resolveAdapterCandidate(
  event: ResolvableEvent,
  verifier: CommonsVerifier,
  gate: { rejectPortraits?: boolean } = {},
): Promise<Resolution | null> {
  const url = event.image_candidate_url;
  if (!url) return null;
  const meta = event.image_candidate_meta ?? {};
  const provider = providerOf(event.image_candidate_meta);

  if (provider === "launchlibrary" || fileHostKind(url) === "launchlibrary") {
    return evaluateLl2Candidate(url, meta, "candidate-ll2");
  }
  if (provider === "nasa" || fileHostKind(url) === "nasa") {
    // Same two checks as every other branch: the bytes must live on a NASA asset host, and the
    // licence the adapter wrote must be one from the allowlist. Without them a candidate row
    // saying `{provider:'nasa', license:'All rights reserved'}` on any host would be re-hosted.
    if (fileHostKind(url) !== "nasa") return { ok: false, reason: `not a NASA asset url: ${url.slice(0, 120)}` };
    const license = typeof meta.license === "string" ? meta.license.trim() : "";
    const verdict = evaluateNamedLicense(license);
    if (!verdict.ok) return { ok: false, reason: verdict.reason };
    return {
      ok: true,
      image: {
        fileUrl: url,
        provider: "nasa",
        license,
        licenseUrl: typeof meta.licenseUrl === "string" ? meta.licenseUrl : null,
        author: typeof meta.author === "string" ? meta.author : null,
        credit: typeof meta.author === "string" ? meta.author : null,
        attributionRequired: true,
        originPage: typeof meta.pageUrl === "string" ? meta.pageUrl : null,
        via: "candidate-nasa",
      },
    };
  }
  if (provider === "commons" || provider === "wikipedia" || provider === "wikimedia") {
    const file = (typeof meta.file === "string" ? meta.file : null) ?? fileTitleFromUrl(url);
    if (!file) return { ok: false, reason: "adapter candidate is not a resolvable Commons file" };
    return verifier.verify(file, "candidate-commons", gate);
  }
  // Any other provider: their terms do not cover re-hosting.
  return { ok: false, reason: `provider "${provider || "unknown"}" is not re-hostable` };
}

type Prefetch = {
  verifier: CommonsVerifier;
  lead: Map<string, { source: string; file: string | null }>;
  entities: Map<string, EntityInfo>;
  secondary: Map<string, EntityInfo>;
};

/** Article title we know for an event without asking the network (chain steps b and c need one). */
export function knownTitle(event: ResolvableEvent): string | null {
  return readEnwiki(event.external_ids) ?? titleFromWikipediaUrl(event.source_url);
}

async function prefetch(ctx: EnrichContext, events: readonly ResolvableEvent[]): Promise<Prefetch> {
  const verifier = new CommonsVerifier(ctx);

  // (a) verify every adapter-supplied Commons file in one batch.
  const adapterFiles: string[] = [];
  for (const event of events) {
    if (!event.image_candidate_url) continue;
    const provider = providerOf(event.image_candidate_meta);
    if (provider !== "commons" && provider !== "wikipedia" && provider !== "wikimedia") continue;
    const meta = event.image_candidate_meta ?? {};
    const file = (typeof meta.file === "string" ? meta.file : null) ?? fileTitleFromUrl(event.image_candidate_url);
    if (file) adapterFiles.push(file);
  }
  await verifier.warm(adapterFiles);

  // (b) lead images for every event with a known article title.
  const titles = events.map(knownTitle).filter((t): t is string => Boolean(t));
  const leadRaw = await pageImages(ctx, titles);
  const lead = new Map<string, { source: string; file: string | null }>();
  for (const [title, entry] of leadRaw) lead.set(title, { source: entry.source, file: entry.file });
  await verifier.warm([...leadRaw.values()].map((e) => e.file ?? "").filter(Boolean));

  // (c) claims for every event with a QID, then the venue/country entities they point at.
  const qids = events.map((e) => readQid(e.external_ids)).filter((q): q is string => Boolean(q));
  const entities = await fetchEntities(ctx, qids);
  const linked: string[] = [];
  for (const info of entities.values()) {
    if (info.venueQid) linked.push(info.venueQid);
    if (info.countryQid) linked.push(info.countryQid);
  }
  const secondary = linked.length > 0 ? await fetchEntities(ctx, linked) : new Map<string, EntityInfo>();
  return { verifier, lead, entities, secondary };
}

async function resolveOne(ctx: EnrichContext, event: ResolvableEvent, pre: Prefetch): Promise<Resolution> {
  const reasons: string[] = [];
  const gate = { rejectPortraits: isSensitiveTitle(event.title) };
  const note = (r: Resolution | null) => {
    if (r && !r.ok) reasons.push(r.reason);
    return r;
  };

  // (a) adapter candidate
  const adapter = note(await resolveAdapterCandidate(event, pre.verifier, gate));
  if (adapter?.ok) return adapter;

  // (b) Wikipedia lead image (already fetched in the batch)
  const title = knownTitle(event);
  const leadEntry = title ? pre.lead.get(title) : undefined;
  if (leadEntry) {
    if (fileHostKind(leadEntry.source) !== "commons") {
      reasons.push("lead image is a local (non-free) Wikipedia upload");
    } else {
      const file = leadEntry.file ?? fileTitleFromUrl(leadEntry.source);
      const verdict = file ? note(await pre.verifier.verify(file, "pageimages", gate)) : null;
      if (verdict?.ok) return verdict;
    }
  }

  // (c) Wikidata claims
  const qid = readQid(event.external_ids);
  const info = qid ? pre.entities.get(qid) : undefined;
  const claims = fileCandidates(info, pre.secondary, {
    allowFlag: FLAG_CATEGORIES.has(event.category) || event.tags.includes("election"),
  });
  for (const claim of claims) {
    if (ctx.budget.remainingMs() < 5_000) break;
    const verdict = note(await pre.verifier.verify(claim.file, claim.via, gate));
    if (verdict?.ok) return verdict;
  }

  // (d) Commons keyword search — only where the long tail is worth the extra call.
  if (SEARCH_CATEGORIES.has(event.category) && ctx.budget.remainingMs() > 10_000) {
    const hits = await commonsSearch(ctx, event.title);
    for (const hit of hits.slice(0, 3)) {
      const verdict = note(await pre.verifier.verify(hit.title, "commons-search", gate));
      if (verdict?.ok) return verdict;
    }
  }

  // (e) NASA
  if (NASA_CATEGORIES.has(event.category) && ctx.budget.remainingMs() > 10_000) {
    try {
      const nasa = await findNasaImage(ctx, event.title);
      if (nasa) return { ok: true, image: nasa };
    } catch (err) {
      reasons.push(`nasa lookup failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // (f) nothing licensed
  return { ok: false, reason: reasons.length > 0 ? `${SKIP_NO_CANDIDATE}: ${reasons.slice(0, 3).join("; ")}` : SKIP_NO_CANDIDATE };
}

/** Run the chain over a batch, sharing the batched lookups. Serial: Wikimedia asks for it. */
export async function resolveImages(ctx: EnrichContext, events: readonly ResolvableEvent[]): Promise<Map<string, Resolution>> {
  const out = new Map<string, Resolution>();
  if (events.length === 0) return out;
  const pre = await prefetch(ctx, events);
  for (const event of events) {
    if (ctx.budget.remainingMs() < 8_000) break;
    try {
      out.set(event.id, await resolveOne(ctx, event, pre));
    } catch (err) {
      ctx.log.warn(`resolve failed for ${event.slug}`, { error: err instanceof Error ? err.message : String(err) });
      // Rethrow budget exhaustion so the run stops cleanly; anything else is this event's problem.
      if (err instanceof Error && err.name === "BudgetExceededError") break;
      out.set(event.id, { ok: false, reason: `resolve failed: ${err instanceof Error ? err.message : String(err)}` });
    }
  }
  return out;
}
