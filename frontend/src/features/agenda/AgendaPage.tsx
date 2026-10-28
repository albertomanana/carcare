import { BellPlus, CalendarCheck, Car, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import {
  AGENDA_MAX_PAGES,
  useAllWorkspaceReminders,
} from "@/api/hooks/workspaces";
import type { Reminder, ReminderState } from "@/api/types";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Select } from "@/components/ui/inputs";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState, NoResults } from "@/components/ui/States";
import {
  ReminderItem,
  ReminderList,
  ReminderListSkeleton,
} from "@/components/vehicles/ReminderItem";
import { useQuickActions } from "@/features/quick-actions/quick-actions-context";
import { useReminderActions } from "@/features/vehicle/useReminderActions";
import { useWorkspace } from "@/features/workspace/workspace-context";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useSearchParam } from "@/hooks/useSearchParam";
import { parseMonthKey } from "@/lib/agenda";
import { cn } from "@/lib/cn";
import { formatPlate, todayISO } from "@/lib/format";
import { INTERVAL_DISCLAIMER } from "@/lib/reminders";
import {
  REMINDER_STATE,
  REMINDER_STATE_ORDER,
  TONE_CLASSES,
} from "@/lib/status";
import { plural } from "@/lib/text";
import { AgendaCalendar } from "./AgendaCalendar";

type StateFilter = "all" | ReminderState;
type View = "lista" | "calendario";

const GROUP_TITLE: Record<
  ReminderState,
  { title: string; description: string }
> = {
  overdue: {
    title: "Vencidos",
    description: "Fecha pasada o kilómetros superados.",
  },
  soon: {
    title: "Próximos",
    description: "En 30 días o menos, o a 1.000 km o menos.",
  },
  ok: {
    title: "En plazo",
    description: "Falta más de un mes y más de 1.000 km.",
  },
  unknown: {
    title: "Sin datos para calcular",
    description: "Vencen por kilómetros y el vehículo aún no tiene lecturas.",
  },
};

/** Agenda del espacio: todos los recordatorios pendientes por urgencia y en calendario mensual. */
export default function AgendaPage() {
  const ctx = useWorkspace();
  const title = ctx.isWorkshop ? "Agenda de flota" : "Agenda";
  useDocumentTitle(title);
  const quick = useQuickActions();
  const query = useAllWorkspaceReminders(ctx.id);
  const [viewParam, setView] = useSearchParam("vista", "lista");
  const view: View = viewParam === "calendario" ? "calendario" : "lista";
  const [stateParam, setStateParam] = useSearchParam("estado", "all");
  const stateFilter: StateFilter = (
    ["overdue", "soon", "ok", "unknown"] as string[]
  ).includes(stateParam)
    ? (stateParam as ReminderState)
    : "all";
  const [vehicleParam, setVehicle] = useSearchParam("vehiculo", "");
  const today = todayISO();
  const [dayParam, setDay] = useSearchParam("dia", today);
  const selectedDay = isValidDay(dayParam) ? dayParam : today;
  const [, setParams] = useSearchParams();

  const canOperate = ctx.can("operate");
  const { actions, dialogs } = useReminderActions({ canOperate });
  const all = useMemo(() => query.data?.items ?? [], [query.data]);

  const vehicles = useMemo(() => {
    const map = new Map<number, NonNullable<Reminder["vehicle"]>>();
    for (const r of all)
      if (r.vehicle && !map.has(r.vehicle.id)) map.set(r.vehicle.id, r.vehicle);
    return [...map.values()].sort((a, b) =>
      a.display_name.localeCompare(b.display_name, "es"),
    );
  }, [all]);
  const vehicleId = vehicles.some((v) => String(v.id) === vehicleParam)
    ? Number(vehicleParam)
    : null;
  const byVehicle = useMemo(
    () => (vehicleId ? all.filter((r) => r.vehicle_id === vehicleId) : all),
    [all, vehicleId],
  );
  const counts = useMemo(() => {
    const c: Record<ReminderState, number> = {
      overdue: 0,
      soon: 0,
      ok: 0,
      unknown: 0,
    };
    for (const r of byVehicle) if (r.state) c[r.state]++;
    return c;
  }, [byVehicle]);
  const filtered =
    stateFilter === "all"
      ? byVehicle
      : byVehicle.filter((r) => r.state === stateFilter);
  const withoutDate = filtered.filter((r) => !r.due_date).length;
  const vehicleLink = (r: Reminder) =>
    `${ctx.base}/vehiculos/${r.vehicle_id}/recordatorios`;
  const truncated = query.data
    ? query.data.total > query.data.items.length
    : false;

  const newReminder = canOperate && ctx.workspace.vehicles_count > 0 && (
    <Button
      variant="primary"
      icon={<BellPlus aria-hidden />}
      onClick={() => quick.run("reminder")}
    >
      Nuevo recordatorio
    </Button>
  );

  return (
    <>
      <PageHeader
        title={title}
        description={
          query.isSuccess && all.length > 0 ? statusLine(counts) : undefined
        }
        actions={newReminder}
      />

      {query.isPending ? (
        <AgendaSkeleton />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : all.length === 0 ? (
        <EmptyState
          icon={<CalendarCheck />}
          title="No hay nada pendiente"
          description={
            ctx.workspace.vehicles_count === 0
              ? "Primero añade un vehículo; después podrás crear recordatorios de ITV, seguro, aceite o neumáticos."
              : "ITV, seguro, impuesto, aceite, neumáticos… Crea recordatorios por fecha, por kilómetros o lo que llegue antes."
          }
          action={
            ctx.workspace.vehicles_count === 0
              ? canOperate && (
                  <ButtonLink
                    to={`${ctx.base}/vehiculos/nuevo`}
                    variant="primary"
                    icon={<Car aria-hidden />}
                  >
                    Añadir vehículo
                  </ButtonLink>
                )
              : newReminder
          }
        />
      ) : (
        <div className="space-y-6">
          {/* Filtros en una fila; el de estado es un selector para que quepa a 360 px (hallazgo I4) */}
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Select
              aria-label="Filtrar por estado"
              value={stateFilter}
              onChange={(e) => setStateParam(e.target.value)}
              className="sm:w-56"
            >
              <option value="all">
                Todos los estados ({byVehicle.length})
              </option>
              {REMINDER_STATE_ORDER.filter(
                (s) => s !== "unknown" || counts.unknown > 0,
              ).map((s) => (
                <option key={s} value={s}>
                  {GROUP_TITLE[s].title} ({counts[s]})
                </option>
              ))}
            </Select>
            {vehicles.length > 1 && (
              <Select
                aria-label="Vehículo"
                value={vehicleId ? String(vehicleId) : ""}
                onChange={(e) => setVehicle(e.target.value)}
                className="sm:w-60"
              >
                <option value="">Todos los vehículos</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.display_name}
                    {v.plate ? ` · ${formatPlate(v.plate)}` : ""}
                  </option>
                ))}
              </Select>
            )}
            <SegmentedControl<View>
              label="Vista"
              size="sm"
              value={view}
              onValueChange={(v) => setView(v)}
              className="sm:ml-auto"
              options={[
                { value: "lista", label: "Lista" },
                { value: "calendario", label: "Calendario" },
              ]}
            />
          </div>

          {/* El aviso va una vez para toda la agenda (R9) */}
          <p className="text-sm text-fg-muted">
            {INTERVAL_DISCLAIMER}. El estado se calcula con la fecha de hoy y el
            último kilometraje de cada vehículo.
            {truncated &&
              query.data &&
              ` Se muestran los ${AGENDA_MAX_PAGES * 100} más urgentes de ${query.data.total}.`}
          </p>

          {filtered.length === 0 ? (
            <NoResults
              what="vencimientos"
              onReset={() =>
                // Un solo cambio de URL (dos setSearchParams seguidos se pisan)
                setParams(
                  (prev) => {
                    const p = new URLSearchParams(prev);
                    p.delete("estado");
                    p.delete("vehiculo");
                    return p;
                  },
                  { replace: true },
                )
              }
            />
          ) : view === "calendario" ? (
            <>
              <AgendaCalendar
                reminders={filtered}
                selected={selectedDay}
                onSelect={setDay}
                actions={actions}
                vehicleLink={vehicleLink}
              />
              {withoutDate > 0 && (
                <p className="text-sm text-fg-muted">
                  <span>
                    {plural(
                      withoutDate,
                      "recordatorio vence",
                      "recordatorios vencen",
                    )}{" "}
                    solo por kilómetros y no{" "}
                    {withoutDate === 1 ? "aparece" : "aparecen"} en el
                    calendario.{" "}
                    <button
                      type="button"
                      className="font-medium text-accent-ink underline-offset-2 hover:underline"
                      onClick={() => setView("lista")}
                    >
                      Verlos en la lista
                    </button>
                  </span>
                </p>
              )}
            </>
          ) : stateFilter === "all" ? (
            <div className="space-y-8">
              {REMINDER_STATE_ORDER.map((state) => {
                const items = filtered.filter((r) => r.state === state);
                if (!items.length) return null;
                return (
                  <AgendaGroup
                    key={state}
                    state={state}
                    items={items}
                    actions={actions}
                    vehicleLink={vehicleLink}
                  />
                );
              })}
            </div>
          ) : (
            <ReminderList aria-label={GROUP_TITLE[stateFilter].title}>
              {filtered.map((r) => (
                <ReminderItem
                  key={r.id}
                  reminder={r}
                  actions={actions}
                  vehicleLink={vehicleLink(r)}
                />
              ))}
            </ReminderList>
          )}
        </div>
      )}
      {dialogs}
    </>
  );
}

/** Línea bajo el título: solo lo que pide atención (R10). */
function statusLine(c: Record<ReminderState, number>): string {
  const parts = [
    c.overdue ? plural(c.overdue, "vencido", "vencidos") : null,
    c.soon ? plural(c.soon, "próximo", "próximos") : null,
  ].filter(Boolean);
  return parts.length ? `${parts.join(" y ")}.` : "Nada vencido ni próximo.";
}

/** Los grupos que no piden atención ("En plazo" y "Sin datos") empiezan plegados (5.5). */
const FOLDED: ReminderState[] = ["ok", "unknown"];

function AgendaGroup({
  state,
  items,
  actions,
  vehicleLink,
}: {
  state: ReminderState;
  items: Reminder[];
  actions: ReturnType<typeof useReminderActions>["actions"];
  vehicleLink: (r: Reminder) => string;
}) {
  const [open, setOpen] = useState(!FOLDED.includes(state));
  const st = REMINDER_STATE[state];
  const Icon = st.icon;
  const listId = `agenda-${state}-lista`;
  const heading = (
    <span className="inline-flex items-center gap-2">
      <Icon aria-hidden className={cn("size-5", TONE_CLASSES[st.tone].text)} />
      {GROUP_TITLE[state].title}
      <span className="text-base font-normal text-fg-muted tabular">
        ({items.length})
      </span>
    </span>
  );
  return (
    <section aria-labelledby={`agenda-${state}-title`} className="min-w-0">
      <h2
        id={`agenda-${state}-title`}
        className="font-display text-lg font-semibold tracking-tight text-fg-warm"
      >
        {FOLDED.includes(state) ? (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls={listId}
            className="inline-flex min-h-11 items-center gap-1 rounded-control text-left hover:text-fg"
          >
            <ChevronRight
              aria-hidden
              className={cn(
                "size-5 text-fg-subtle transition-transform duration-150",
                open && "rotate-90",
              )}
            />
            {heading}
          </button>
        ) : (
          heading
        )}
      </h2>
      <p className="mb-2 mt-0.5 text-sm text-fg-muted">
        {GROUP_TITLE[state].description}
      </p>
      {open && (
        <ReminderList id={listId}>
          {items.map((r) => (
            <ReminderItem
              key={r.id}
              reminder={r}
              actions={actions}
              vehicleLink={vehicleLink(r)}
            />
          ))}
        </ReminderList>
      )}
    </section>
  );
}

function isValidDay(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    parseMonthKey(value.slice(0, 7)) !== null &&
    !Number.isNaN(new Date(value).getTime())
  );
}

function AgendaSkeleton() {
  return (
    <div className="space-y-6">
      <div aria-hidden className="flex flex-wrap gap-3">
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-10 w-48 lg:ml-auto" />
      </div>
      <ReminderListSkeleton rows={4} />
    </div>
  );
}
