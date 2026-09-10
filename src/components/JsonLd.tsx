import type { JsonLdObject } from "@/lib/jsonld";

/**
 * Inline JSON-LD. `<` is escaped so a title containing `</script>` cannot break out of the
 * script element; `JSON.parse` treats `<` as a plain `<`.
 */
export function JsonLd({ data }: { data: JsonLdObject | JsonLdObject[] | null | undefined }) {
  if (!data) return null;
  const list = Array.isArray(data) ? data : [data];
  if (list.length === 0) return null;
  return (
    <>
      {list.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item).replace(/</g, "\\u003c") }}
        />
      ))}
    </>
  );
}
