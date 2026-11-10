// Teil-Updates für updateDoc: ein geleertes Feld (undefined) soll wirklich
// verschwinden. clean() würde es nur weglassen – dann bliebe der alte Wert
// stehen (B26). Der Lösch-Marker kommt von außen (deleteField()), damit das
// hier ohne Firebase testbar bleibt.

export function toUpdate<M>(patch: Record<string, unknown>, deleteMarker: () => M): Record<string, unknown> {
  return Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, v === undefined ? deleteMarker() : v]));
}
