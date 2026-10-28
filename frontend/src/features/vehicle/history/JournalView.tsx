import { NotebookPen } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router";
import { useJournal } from "@/api/hooks/vehicles";
import type {
  ExpenseCategory,
  FuelUnit,
  JournalDay,
  JournalEntry,
  Vehicle,
} from "@/api/types";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/inputs";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useQuickActions } from "@/features/quick-actions/quick-actions-context";
import { useWorkspace } from "@/features/workspace/workspace-context";
import { useSearchParam } from "@/hooks/useSearchParam";
import {
  formatDate,
  formatDecimal,
  formatKm,
  formatMoney,
  toNumber,
} from "@/lib/format";
import {
  filterJournal,
  groupByYear,
  type HistoryView,
  journalTotals,
} from "@/lib/history";
import {
  EXPENSE_CATEGORY_LABEL,
  FUEL_UNIT_SHORT,
  JOURNAL_TYPE_LABEL,
} from "@/lib/labels";
import { PERIOD_LABEL, presetPeriod } from "@/lib/period";
import { capitalize, plural } from "@/lib/text";

const RANGES = ["last_30", "last_90", "last_12"] as const;
type Range = (typeof RANGES)[number];

const EMPTY_TEXT: Record<
  "todo" | "gastos" | "documentos",
  { title: string; description: string }
> = {
  todo: {
    title: "Nada registrado en este periodo",
    description:
      "Anota los kilómetros o un repostaje y aquí verás tu día a día.",
  },
  gastos: {
    title: "Sin gastos en este periodo",
    description:
      "Los repostajes, el seguro o el aparcamiento aparecen aquí por días.",
  },
  documentos: {
    title: "Sin documentos subidos en este periodo",
    description: "Facturas, seguro o ITV: se guardan en la pestaña Datos.",
  },
};

/**
 * "Todo" del historial: lo registrado agrupado por día (lo que antes era el Diario), y "Gastos" y "Documentos", que
 * son la misma lista filtrada. Sin tarjetas de cifras ni mapa de calor (5.2): los totales del periodo van en una línea.
 * Los días van con su año encima cuando la lista pasa de un año a otro.
 */
export function JournalView({
  vehicle,
  view,
}: {
  vehicle: Vehicle;
  view: Extract<HistoryView, "todo" | "gastos" | "documentos">;
}) {
  const ctx = useWorkspace();
  const quick = useQuickActions();
  const [rangeParam, setRange] = useSearchParam("periodo", "last_30");
  const range: Range = (RANGES as readonly string[]).includes(rangeParam)
    ? (rangeParam as Range)
    : "last_30";
  const period = useMemo(() => presetPeriod(range), [range]);
  const journal = useJournal(vehicle.id, { from: period.from, to: period.to });
  const days = useMemo(
    () => filterJournal(journal.data ?? [], view),
    [journal.data, view],
  );
  const totals = journalTotals(days, toNumber);
  const canOperate = ctx.can("operate") && !vehicle.archived_at;
  const showMoney = ctx.canExpenses;
  const base = `${ctx.base}/vehiculos/${vehicle.id}`;
  const groups = groupByYear(days, (d) => d.date);
  // El año actual sale del periodo (que ya termina hoy), sin otra lectura del reloj durante el render
  const thisYear = Number(period.to.slice(0, 4));
  const yearHeadings =
    groups.length > 1 || (groups[0] && groups[0].year !== thisYear);
  const empty = EMPTY_TEXT[view];

  const summary = [
    plural(totals.activeDays, "día con actividad", "días con actividad"),
    view === "todo"
      ? totals.km !== null
        ? `${formatKm(totals.km)} recorridos`
        : "km recorridos: faltan lecturas para calcularlo"
      : null,
    showMoney && view !== "documentos"
      ? `${formatMoney(totals.spent)} gastados`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Select
          aria-label="Periodo"
          value={range}
          onChange={(e) => setRange(e.target.value)}
          className="w-auto sm:w-52"
        >
          {RANGES.map((r) => (
            <option key={r} value={r}>
              {PERIOD_LABEL[r]}
            </option>
          ))}
        </Select>
        {journal.isSuccess && days.length > 0 && (
          <p className="text-sm text-fg-muted tabular">{summary}</p>
        )}
        {view === "gastos" && (
          <Link
            to={`${base}/gastos`}
            className="text-sm font-medium text-accent-ink underline-offset-4 hover:underline sm:ml-auto"
          >
            Ver totales y categorías
          </Link>
        )}
        {view === "documentos" && (
          <Link
            to={`${base}/datos#documentos`}
            className="text-sm font-medium text-accent-ink underline-offset-4 hover:underline sm:ml-auto"
          >
            Ver todos los documentos
          </Link>
        )}
      </div>

      {journal.isPending ? (
        <div role="status" aria-live="polite" className="space-y-2">
          <span className="sr-only">Cargando el historial…</span>
          <Skeleton aria-hidden className="h-5 w-48" />
          <Skeleton aria-hidden className="h-12 w-full" />
          <Skeleton aria-hidden className="h-12 w-full" />
        </div>
      ) : journal.isError ? (
        <ErrorState
          error={journal.error}
          onRetry={() => void journal.refetch()}
        />
      ) : days.length === 0 ? (
        <EmptyState
          compact
          icon={<NotebookPen />}
          title={empty.title}
          description={
            range !== "last_12"
              ? `${empty.description} Prueba con un periodo más largo.`
              : empty.description
          }
          action={
            <>
              {range !== "last_12" && (
                <Button onClick={() => setRange("last_12")}>
                  Ver los últimos 12 meses
                </Button>
              )}
              {canOperate && view === "todo" && (
                <Button onClick={() => quick.run("mileage", vehicle.id)}>
                  Anotar km
                </Button>
              )}
              {canOperate && view === "gastos" && (
                <Button onClick={() => quick.run("expense", vehicle.id)}>
                  Añadir gasto
                </Button>
              )}
            </>
          }
        />
      ) : (
        <div className="space-y-6">
          {groups.map((g) =>
            yearHeadings ? (
              <section key={g.year} aria-labelledby={`dias-${g.year}`}>
                <h2
                  id={`dias-${g.year}`}
                  className="mb-2 font-display text-lg font-semibold tracking-tight text-fg-warm tabular"
                >
                  {g.year}
                </h2>
                <DayList
                  days={g.items}
                  base={base}
                  showMoney={showMoney}
                  level="h3"
                />
              </section>
            ) : (
              <DayList
                key={g.year}
                days={g.items}
                base={base}
                showMoney={showMoney}
                level="h2"
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}

function DayList({
  days,
  base,
  showMoney,
  level,
}: {
  days: JournalDay[];
  base: string;
  showMoney: boolean;
  level: "h2" | "h3";
}) {
  return (
    <ol
      className="space-y-5"
      aria-label="Días con actividad, del más reciente al más antiguo"
    >
      {days.map((day) => (
        <Day
          key={day.date}
          day={day}
          base={base}
          showMoney={showMoney}
          level={level}
        />
      ))}
    </ol>
  );
}

/** Un día: título con la fecha en minúscula salvo la primera letra (M1) y sus registros en filas (R3 y R4). */
function Day({
  day,
  base,
  showMoney,
  level: H,
}: {
  day: JournalDay;
  base: string;
  showMoney: boolean;
  level: "h2" | "h3";
}) {
  const spent = toNumber(day.spent) ?? 0;
  const extra = [
    day.km_driven !== null ? `${formatKm(day.km_driven)} recorridos` : null,
    showMoney && spent > 0 ? formatMoney(day.spent) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <li>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 border-b border-line pb-1.5">
        <H className="text-sm font-semibold text-fg">
          <time dateTime={day.date}>
            {capitalize(formatDate(day.date, "weekday"))}
          </time>
        </H>
        {extra && (
          <span className="text-sm text-fg-muted tabular">{extra}</span>
        )}
      </div>
      <ul className="divide-y divide-line">
        {day.entries.map((e) => (
          <Entry
            key={`${e.type}-${e.id}`}
            entry={e}
            base={base}
            showMoney={showMoney}
          />
        ))}
      </ul>
    </li>
  );
}

/** A dónde lleva cada registro del día. */
function entryHref(e: JournalEntry, base: string): string | null {
  switch (e.type) {
    case "record":
      return `${base}/historial?ver=intervenciones#intervencion-${e.id}`;
    case "expense":
      return `${base}/gastos?periodo=${e.date.slice(0, 4)}#gasto-${e.id}`;
    case "document":
      return `${base}/datos#documentos`;
    case "reminder_done":
      return `${base}/recordatorios?estado=done#recordatorio-${e.id}`;
    default:
      return null;
  }
}

function Entry({
  entry: e,
  base,
  showMoney,
}: {
  entry: JournalEntry;
  base: string;
  showMoney: boolean;
}) {
  const href = entryHref(e, base);
  const category =
    typeof e.meta.category === "string"
      ? (e.meta.category as ExpenseCategory)
      : null;
  const qty = e.meta.fuel_quantity;
  const unit =
    typeof e.meta.fuel_unit === "string"
      ? FUEL_UNIT_SHORT[e.meta.fuel_unit as FuelUnit]
      : null;
  const detail = [
    JOURNAL_TYPE_LABEL[e.type],
    category && EXPENSE_CATEGORY_LABEL[category]
      ? EXPENSE_CATEGORY_LABEL[category]
      : null,
    qty !== undefined && qty !== null && qty !== ""
      ? `${formatDecimal(String(qty), 2)}${unit ? ` ${unit}` : ""}`
      : null,
    e.mileage !== null ? formatKm(e.mileage) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <li className="flex items-baseline gap-3 py-2.5">
      <span className="min-w-0 flex-1">
        {href ? (
          <Link
            to={href}
            className="text-sm text-fg underline-offset-4 hover:underline"
          >
            {e.title}
          </Link>
        ) : (
          <span className="text-sm text-fg">{e.title}</span>
        )}
        <span className="block text-sm text-fg-muted tabular">{detail}</span>
      </span>
      {showMoney && e.amount && (
        <span className="shrink-0 text-sm font-medium text-fg tabular">
          {formatMoney(e.amount)}
        </span>
      )}
    </li>
  );
}
