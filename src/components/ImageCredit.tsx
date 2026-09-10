import { providerLabel } from "@/lib/images";
import type { EventImage } from "@/lib/types";

/**
 * The attribution line under a photo: `Photo: {author} · {licence} · via {provider}`, with the
 * author linking the file description page and the licence linking its deed.
 *
 * CC BY and CC BY-SA both require this; public-domain files do not, and a file with neither an
 * author nor a licence renders nothing rather than an empty caption. The provider is always named
 * so a reader can trace the file back even when the uploader is anonymous.
 */
export function ImageCredit({ image, className }: { image: EventImage; className?: string }) {
  const { author, license, licenseUrl, originPage, provider } = image;
  if (!author && !license) return null;
  const providerName = provider ? providerLabel(provider) : null;

  return (
    <figcaption className={`text-xs text-muted ${className ?? ""}`}>
      {author ? (
        <>
          Photo:{" "}
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
          Photo
        </a>
      ) : (
        "Photo"
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
      {providerName ? ` · via ${providerName}` : null}
    </figcaption>
  );
}
