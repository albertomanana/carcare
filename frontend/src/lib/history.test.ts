import { describe, expect, it } from "vitest";
import type { JournalDay } from "@/api/types";
import {
  filterJournal,
  groupByYear,
  journalTotals,
  parseHistoryView,
} from "./history";
import { toNumber } from "./format";

const day = (
  date: string,
  types: JournalDay["entries"][number]["type"][],
  over: Partial<JournalDay> = {},
): JournalDay => ({
  date,
  km_driven: null,
  spent: "0.00",
  entries: types.map((type, i) => ({
    type,
    id: i + 1,
    date,
    title: `${type} ${i}`,
    amount: null,
    mileage: null,
    meta: {},
  })),
  ...over,
});

describe("parseHistoryView", () => {
  it('lo desconocido o vacío es "Todo"', () => {
    expect(parseHistoryView(null, true)).toBe("todo");
    expect(parseHistoryView("lecturas", true)).toBe("todo");
    expect(parseHistoryView("km", true)).toBe("km");
  });

  it('"Gastos" sin permiso para verlos cae en "Todo"', () => {
    expect(parseHistoryView("gastos", true)).toBe("gastos");
    expect(parseHistoryView("gastos", false)).toBe("todo");
  });
});

describe("filterJournal", () => {
  const days = [
    day("2026-10-20", ["mileage", "expense"]),
    day("2026-10-18", ["document"]),
    day("2026-10-10", ["record"]),
  ];

  it('"Todo" deja los días tal cual', () => {
    expect(filterJournal(days, "todo")).toBe(days);
  });

  it('"Gastos" deja solo los gastos y quita los días vacíos', () => {
    const out = filterJournal(days, "gastos");
    expect(out.map((d) => d.date)).toEqual(["2026-10-20"]);
    expect(out[0].entries.map((e) => e.type)).toEqual(["expense"]);
  });

  it('"Documentos" deja solo los documentos', () => {
    expect(filterJournal(days, "documentos").map((d) => d.date)).toEqual([
      "2026-10-18",
    ]);
  });
});

describe("groupByYear", () => {
  it("agrupa en el orden de llegada, del más reciente al más antiguo", () => {
    const items = [
      { d: "2026-03-01" },
      { d: "2026-01-05" },
      { d: "2025-12-30" },
      { d: "2024-06-01" },
    ];
    const groups = groupByYear(items, (i) => i.d);
    expect(groups.map((g) => [g.year, g.items.length])).toEqual([
      [2026, 2],
      [2025, 1],
      [2024, 1],
    ]);
  });

  it("lista vacía ⇒ sin grupos", () => {
    expect(groupByYear([], () => "2026-01-01")).toEqual([]);
  });
});

describe("journalTotals", () => {
  it("suma km solo de los días con lecturas y avisa si no hay ninguno", () => {
    const t = journalTotals(
      [
        day("2026-10-20", ["mileage"], { km_driven: 40, spent: "12.50" }),
        day("2026-10-19", ["expense"], { spent: "30.00" }),
      ],
      toNumber,
    );
    expect(t).toEqual({ activeDays: 2, km: 40, kmDays: 1, spent: 42.5 });
    expect(
      journalTotals([day("2026-10-19", ["expense"])], toNumber).km,
    ).toBeNull();
  });
});
