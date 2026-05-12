export function isStandalonePWA(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  if (window.matchMedia?.("(display-mode: minimal-ui)").matches) return true;
  const iosStandalone = (window.navigator as { standalone?: boolean }).standalone;
  return iosStandalone === true;
}
