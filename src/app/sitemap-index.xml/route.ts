import { sitemapShardIds } from "@/lib/catalog";
import { absoluteUrl } from "@/lib/seo";

export const revalidate = 3600;

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Next emits no sitemap index for `generateSitemaps()` shards, so this lists `/sitemap/<id>.xml`. */
export async function GET() {
  const ids = await sitemapShardIds();
  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    ids.map((id) => `  <sitemap><loc>${escapeXml(absoluteUrl(`/sitemap/${id}.xml`))}</loc></sitemap>`).join("\n") +
    "\n</sitemapindex>\n";
  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
