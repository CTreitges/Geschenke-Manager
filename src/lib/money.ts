// Preise: Eingabe tolerant parsen (deutsches Komma, Tausenderpunkte, „€“),
// Ausgabe über Intl de-DE. Ganze Beträge ohne „,00“ („129 €“), sonst immer
// zwei Nachkommastellen („19,50 €“).

/**
 * „19,99“, „19.99“, „19“, „ 1.299,50 € “, „ca. 20“, „20,-“ → Zahl.
 * Leer, negativ oder unlesbar → undefined.
 */
export function parsePrice(input: string | null | undefined): number | undefined {
  if (typeof input !== "string") return undefined;
  const s = input
    .replace(/\s/g, "") // inkl. geschützter Leerzeichen
    .replace(/^(ca\.?|~)/i, "")
    .replace(/^€/, "")
    .replace(/(€|eur|euro)$/i, "")
    .replace(/[.,]-+$/, "");
  if (!/^\d[\d.,]*$/.test(s)) return undefined;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  let normalized: string;
  if (lastComma >= 0 && lastDot >= 0) {
    // Beides vorhanden: das letzte Zeichen ist das Dezimaltrennzeichen.
    const decimal = lastComma > lastDot ? "," : ".";
    const thousands = decimal === "," ? "." : ",";
    normalized = s.split(thousands).join("").replace(decimal, ".");
  } else if (lastComma >= 0) {
    normalized = s.replace(",", "."); // deutsches Dezimalkomma
  } else if (/^[1-9]\d{0,2}(\.\d{3})+$/.test(s)) {
    normalized = s.replace(/\./g, ""); // „1.299“ = Tausenderpunkt
  } else {
    normalized = s;
  }
  if (!/^\d+(\.\d*)?$/.test(normalized)) return undefined;
  const value = Number(normalized);
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : undefined;
}

const WHOLE = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const CENTS = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** „129 €“, „19,99 €“, „1.299,50 €“ (mit geschütztem Leerzeichen vor €); ungültig → "". */
export function formatEuro(value: number): string {
  if (!Number.isFinite(value)) return "";
  // Auf Cent runden; `|| 0` macht aus -0 eine 0 (sonst „-0 €“).
  const cents = Math.round(value * 100) / 100 || 0;
  return (Number.isInteger(cents) ? WHOLE : CENTS).format(cents);
}

/** Budget-Box ab „Entschieden“: „Auswahl 115 € · 38,33 €/Person (Budget 60 €, +55 €)“. */
export function decidedBudgetLine(total: number, participantCount: number, budget: number): string {
  const perPerson = participantCount > 0 ? ` · ${formatEuro(total / participantCount)}/Person` : "";
  const delta = total - budget;
  const diff = delta === 0 ? "" : `, ${delta > 0 ? "+" : "−"}${formatEuro(Math.abs(delta))}`;
  return `Auswahl ${formatEuro(total)}${perPerson} (Budget ${formatEuro(budget)}${diff})`;
}
