// Links aus Nutzereingaben: fehlendes Schema wird zu https://, erlaubt sind
// nur http und https (kein javascript:, data:, mailto: …).

const OTHER_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
/** „amazon.de:8080/…“ ist Host + Port, kein Schema. */
const HOST_WITH_PORT = /^[^/?#:]+:\d+(?:[/?#]|$)/;

/** Normalisierte, sichere URL oder undefined (leer, anderes Schema, kein Host mit Punkt). */
export function normalizeUrl(input: string | null | undefined): string | undefined {
  const s = typeof input === "string" ? input.trim() : "";
  if (!s) return undefined;
  let candidate: string;
  if (/^https?:\/\//i.test(s)) candidate = s;
  else if (s.startsWith("//")) candidate = `https:${s}`;
  else if (OTHER_SCHEME.test(s) && !HOST_WITH_PORT.test(s)) return undefined;
  else candidate = `https://${s}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return undefined;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
  if (!url.hostname.includes(".")) return undefined;
  return url.href;
}

/** Anzeige-Host ohne „www.“, z. B. „amazon.de“; ungültig → undefined. */
export function hostLabel(input: string | null | undefined): string | undefined {
  const href = normalizeUrl(input);
  return href ? new URL(href).hostname.replace(/^www\./i, "") : undefined;
}
