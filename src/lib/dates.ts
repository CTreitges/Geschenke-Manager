const MONTHS = [
  "Jan", "Feb", "Mär", "Apr", "Mai", "Jun",
  "Jul", "Aug", "Sep", "Okt", "Nov", "Dez",
];

export function formatRelativeDate(ts: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const min = 60_000;
  const hr = 60 * min;
  const day = 24 * hr;

  if (diff < 0) return "gerade eben";
  if (diff < min) return "gerade eben";
  if (diff < hr) {
    const m = Math.floor(diff / min);
    return `vor ${m} Min.`;
  }
  if (diff < day) {
    const h = Math.floor(diff / hr);
    return `vor ${h} Std.`;
  }
  if (diff < 2 * day) return "gestern";
  if (diff < 7 * day) {
    const dys = Math.floor(diff / day);
    return `vor ${dys} Tagen`;
  }

  const dd = d.getDate();
  const mm = MONTHS[d.getMonth()];
  const yyyy = d.getFullYear();
  const sameYear = yyyy === now.getFullYear();
  return sameYear ? `${dd}. ${mm}` : `${dd}. ${mm} ${yyyy}`;
}
