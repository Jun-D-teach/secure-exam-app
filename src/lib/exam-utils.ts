/**
 * Convert a Google Form link into a URL safe to embed in an iframe
 * (https://docs.google.com/forms/d/e/{id}/viewform?embedded=true).
 * Non-Google URLs are returned unchanged.
 */
export function toGoogleFormEmbedUrl(url: string): string {
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    const isGoogle =
      parsed.hostname === "docs.google.com" ||
      parsed.hostname === "forms.google.com" ||
      parsed.hostname.endsWith(".google.com");
    if (isGoogle) {
      const longForm = trimmed.match(/\/forms\/d\/e\/([^/]+)\/viewform/);
      const shortForm = trimmed.match(/\/forms\/d\/([^/]+)\/viewform/);
      const formId = longForm?.[1] ?? shortForm?.[1];
      if (formId) {
        return `https://docs.google.com/forms/d/e/${formId}/viewform?embedded=true`;
      }
    }
  } catch {
    // fall through — not a valid URL
  }
  return trimmed;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} menit`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} jam` : `${hours} jam ${rest} menit`;
}

export function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}
