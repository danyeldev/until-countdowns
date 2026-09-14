/** Catalog IDs are immutable first-created slugs; legacy UUID IDs are accepted too. */
export function isCatalogEventId(value: string): boolean {
  return /^[a-z0-9-]{1,200}$/.test(value) && !value.startsWith("mine-") && !value.startsWith("share-");
}
