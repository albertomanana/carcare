/**
 * Historial de la ficha (5.2 del informe de UX y E3‑3): un solo sitio con todo lo registrado y un filtro de tipo.
 * Diario e Historial se juntaron; `?ver=` elige qué se muestra.
 */
import type { JournalDay, JournalEntryType } from "@/api/types";

export type HistoryView =
  "todo" | "intervenciones" | "gastos" | "km" | "documentos";

export const HISTORY_VIEWS: HistoryView[] = [
  "todo",
  "intervenciones",
  "gastos",
  "km",
  "documentos",
];

export const HISTORY_VIEW_LABEL: Record<HistoryView, string> = {
  todo: "Todo",
  intervenciones: "Intervenciones",
  gastos: "Gastos",
  km: "Kilometraje",
  documentos: "Documentos",
};

/** Valor de `?ver=` → vista. Lo desconocido (o "Gastos" sin permiso para verlos) cae en "Todo". */
export function parseHistoryView(
  value: string | null | undefined,
  canExpenses: boolean,
): HistoryView {
  const view = HISTORY_VIEWS.find((v) => v === value) ?? "todo";
  return view === "gastos" && !canExpenses ? "todo" : view;
}

/** Tipos del diario que entran en cada vista basada en el diario. */
const JOURNAL_TYPES: Partial<Record<HistoryView, JournalEntryType[]>> = {
  gastos: ["expense"],
  documentos: ["document"],
};

/**
 * Deja en cada día solo las entradas de la vista y quita los días que se quedan vacíos.
 * "Todo" devuelve los días tal cual.
 */
export function filterJournal(
  days: JournalDay[],
  view: HistoryView,
): JournalDay[] {
  const types = JOURNAL_TYPES[view];
  if (!types) return days;
  return days
    .map((d) => ({
      ...d,
      entries: d.entries.filter((e) => types.includes(e.type)),
    }))
    .filter((d) => d.entries.length > 0);
}

/**
 * Agrupa por año una lista ya ordenada de más reciente a más antigua (E3‑3: "agrupado por año").
 * Respeta el orden de llegada: con la paginación, el último grupo sigue creciendo al cargar más.
 */
export function groupByYear<T>(
  items: T[],
  dateOf: (item: T) => string,
): { year: number; items: T[] }[] {
  const groups: { year: number; items: T[] }[] = [];
  for (const item of items) {
    const year = Number(dateOf(item).slice(0, 4));
    const last = groups[groups.length - 1];
    if (last && last.year === year) last.items.push(item);
    else groups.push({ year, items: [item] });
  }
  return groups;
}

/**
 * Totales del periodo del diario en una línea de texto (sin tarjetas de cifras, R2 y R7).
 * Los km solo se suman en los días que tienen lecturas suficientes; si no hay ninguno, `km` es null.
 */
export function journalTotals(
  days: JournalDay[],
  toNumber: (v: string) => number | null,
): { activeDays: number; km: number | null; kmDays: number; spent: number } {
  let km = 0;
  let kmDays = 0;
  let spent = 0;
  for (const d of days) {
    spent += toNumber(d.spent) ?? 0;
    if (d.km_driven !== null) {
      km += d.km_driven;
      kmDays++;
    }
  }
  return { activeDays: days.length, km: kmDays ? km : null, kmDays, spent };
}
