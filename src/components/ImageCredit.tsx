import { i18n } from "@/lib/i18n/server";
import { providerLabel } from "@/lib/images";
import type { EventImage } from "@/lib/types";

/**
 * The attribution line under a photo: `Photo: {author} · {licence} · via {provider}`, with the
 * author linking the file description page and the licence linking its deed.
 *
 * CC BY and CC BY-SA both require this; public-domain files do not, and a file with neither an
 * author nor a licence renders nothing rather than an empty caption. The provider is always named
 * so a reader can trace the file back even when the uploader is anonymous.
 *
 * The author, the licence code and the provider are names and stay as the file records them; only
 * the words around them are translated.
 */
export async function ImageCredit({ image, className }: { image: EventImage; className?: string }) {
  const { author, license, licenseUrl, originPage, provider } = image;
  if (!author && !license) return null;
  const L = await i18n();
  const c = L.m.event.image;
  const providerName = provider ? providerLabel(provider) : null;

  return (
    <figcaption className={`text-xs text-muted ${className ?? ""}`}>
      {author ? (
        <>
          {c.photoBy}{" "}
          {originPage ? (
            <a href={originPage} className="underline hover:text-paper" target="_blank" rel="noreferrer nofollow">
              {author}
            </a>
          ) : (
            author
          )}
        </>
      ) : originPage ? (
        <a href={originPage} className="underline hover:text-paper" target="_blank" rel="noreferrer nofollow">
          {c.photo}
        </a>
      ) : (
        c.photo
      )}
      {license ? (
        <>
          {" · "}
          {licenseUrl ? (
            <a href={licenseUrl} className="underline hover:text-paper" target="_blank" rel="noreferrer nofollow">
              {license}
            </a>
          ) : (
            license
          )}
        </>
      ) : null}
      {providerName ? ` · ${L.t(c.via, { provider: providerName })}` : null}
    </figcaption>
  );
}
