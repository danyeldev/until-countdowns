/**
 * Props for every link into `/search?…` (sort toggles, category chips with a query, pagers, tag
 * and QuickSearch shortcuts).
 *
 * Search results are `noindex`, disallowed in robots.txt and rendered live from the database, so
 * a crawler that follows them gains nothing and costs a function invocation plus three database
 * reads per hit — and there are 27 locales × 4 sorts × 1,000 pages of them. `nofollow` keeps
 * well-behaved crawlers out; `prefetch={false}` keeps a real visitor's viewport from firing a
 * dozen speculative requests at an uncacheable route.
 */
export const SEARCH_LINK = { rel: "nofollow", prefetch: false } as const;
