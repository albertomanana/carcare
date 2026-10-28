import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  EllipsisVertical,
  History,
  Pencil,
  Plus,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { errorMessage } from "@/api/client";
import {
  useArchiveRecord,
  useMaintenanceList,
  useRecord,
} from "@/api/hooks/records";
import { flattenPages, totalFromPages } from "@/api/hooks/shared";
import type { MaintenanceRecord, RecordType, Vehicle } from "@/api/types";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { SearchInput, Select } from "@/components/ui/inputs";
import { LoadMore } from "@/components/ui/LoadMore";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState, NoResults } from "@/components/ui/States";
import { useWorkspace } from "@/features/workspace/workspace-context";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useHashTarget, useRevealHashTarget } from "@/hooks/useHashTarget";
import { useSearchParam } from "@/hooks/useSearchParam";
import { cn } from "@/lib/cn";
import { formatDate, formatKm, formatMoney, formatNumber } from "@/lib/format";
import { groupByYear } from "@/lib/history";
import {
  ITEM_KIND_LABEL,
  RECORD_TYPE_LABEL,
  SERVICE_KIND_LABEL,
  ZONE_LABEL,
  ZONES,
} from "@/lib/labels";

const TYPES = Object.keys(RECORD_TYPE_LABEL) as RecordType[];

/**
 * Intervenciones del historial (E3‑3): de la más reciente a la más antigua, **agrupadas por año**, con filtros por
 * tipo, zona y año y buscador. Una fila por intervención (fecha · título · km · importe); el detalle se despliega al
 * pulsarla y "Editar" y "Archivar" van en el menú de la fila (5.2 del informe de UX).
 */
export function RecordsView({ vehicle }: { vehicle: Vehicle }) {
  const ctx = useWorkspace();
  const [q, setQ] = useSearchParam("q");
  const [type, setType] = useSearchParam("tipo");
  const [zone, setZone] = useSearchParam("zona");
  const [year, setYear] = useSearchParam("anio");
  const [archivedParam, setArchived] = useSearchParam("archivadas", "0");
  const archived = archivedParam === "1";
  const [term, setTerm] = useState(q);
  const debounced = useDebouncedValue(term);
  useEffect(() => {
    if (debounced !== q) setQ(debounced);
  }, [debounced, q, setQ]);

  const list = useMaintenanceList(vehicle.id, {
    search: q,
    type,
    zone,
    year,
    archived: archived ? 1 : 0,
    per_page: 20,
  });
  const records = flattenPages(list.data);
  const groups = groupByYear(records, (r) => r.service_date);
  const filtering = !!(q || type || zone || year);
  const canOperate = ctx.can("operate") && !vehicle.archived_at;
  const showMoney = ctx.canExpenses || ctx.isPersonal;
  const base = `${ctx.base}/vehiculos/${vehicle.id}`;
  const thisYear = new Date().getFullYear();
  const firstYear = Math.max(
    1990,
    Math.min(vehicle.year ?? thisYear - 10, thisYear),
  );
  const years = Array.from(
    { length: thisYear - firstYear + 1 },
    (_, i) => thisYear - i,
  );

  // Enlaces del tipo #intervencion-12 (gastos, documentos, lecturas de km): se piden páginas hasta encontrarla;
  // si no está en la lista (archivada o fuera de los filtros), se pide sola y se muestra encima
  const hashId = useHashTarget("intervencion");
  const inList = !!hashId && records.some((r) => String(r.id) === hashId);
  const exhausted = !!hashId && !list.isPending && !inList && !list.hasNextPage;
  const linked = useRecord(exhausted ? Number(hashId) : undefined);
  const pinned =
    exhausted && linked.data?.vehicle_id === vehicle.id ? linked.data : null;
  useRevealHashTarget({
    id: hashId,
    prefix: "intervencion",
    ready: !list.isPending,
    found: inList || !!pinned,
    hasNextPage: list.hasNextPage,
    isFetchingNextPage: list.isFetchingNextPage,
    fetchNextPage: list.fetchNextPage,
  });

  const reset = () => {
    setTerm("");
    setQ(null);
    setType(null);
    setZone(null);
    setYear(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <SearchInput
          value={term}
          onValueChange={setTerm}
          aria-label="Buscar en el historial por título, taller o descripción"
          placeholder="Buscar…"
          className="lg:w-60"
        />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex">
          <Select
            aria-label="Filtrar por tipo"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="lg:w-36"
          >
            <option value="">Todos los tipos</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {RECORD_TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Filtrar por zona"
            value={zone}
            onChange={(e) => setZone(e.target.value)}
            className="lg:w-40"
          >
            <option value="">Todas las zonas</option>
            {ZONES.map((z) => (
              <option key={z} value={z}>
                {ZONE_LABEL[z]}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Filtrar por año"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="lg:w-32"
          >
            <option value="">Todos los años</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Mostrar archivadas o activas"
            value={archived ? "1" : "0"}
            onChange={(e) => setArchived(e.target.value)}
            className="lg:w-32"
          >
            <option value="0">Activas</option>
            <option value="1">Archivadas</option>
          </Select>
        </div>
        {canOperate && (
          <ButtonLink
            to={`${base}/intervenciones/nueva`}
            icon={<Plus aria-hidden />}
            className="lg:ml-auto"
          >
            Nueva intervención
          </ButtonLink>
        )}
      </div>

      {pinned && (
        <section aria-labelledby="intervencion-enlazada">
          <h2
            id="intervencion-enlazada"
            className="mb-2 text-sm font-medium text-fg-muted"
          >
            {pinned.archived_at
              ? "La intervención enlazada está archivada"
              : "La intervención enlazada no está en esta lista"}
          </h2>
          <ul className="border-y border-line">
            <RecordRow
              record={pinned}
              base={base}
              canOperate={canOperate}
              showMoney={showMoney}
              vehicleId={vehicle.id}
              highlighted
            />
          </ul>
        </section>
      )}

      {list.isPending ? (
        <div role="status" aria-live="polite" className="space-y-2">
          <span className="sr-only">Cargando historial…</span>
          <Skeleton aria-hidden className="h-6 w-16" />
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} aria-hidden className="h-14 w-full" />
          ))}
        </div>
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : records.length === 0 ? (
        filtering ? (
          <NoResults what="intervenciones" onReset={reset} />
        ) : archived ? (
          <EmptyState
            compact
            icon={<Archive />}
            title="No hay intervenciones archivadas"
          />
        ) : (
          <EmptyState
            icon={<History />}
            title="Todavía no hay intervenciones"
            description="Registra mantenimientos, reparaciones, averías o la ITV: con piezas, mano de obra y facturas."
            action={
              canOperate && (
                <ButtonLink
                  to={`${base}/intervenciones/nueva`}
                  icon={<Plus aria-hidden />}
                >
                  Nueva intervención
                </ButtonLink>
              )
            }
          />
        )
      ) : (
        <>
          {groups.map((g) => (
            <section key={g.year} aria-labelledby={`historial-${g.year}`}>
              <h2
                id={`historial-${g.year}`}
                className="mb-1 font-display text-lg font-semibold tracking-tight text-fg-warm tabular"
              >
                {g.year}
              </h2>
              <ul
                className="divide-y divide-line border-y border-line"
                aria-label={`Intervenciones de ${g.year}, de la más reciente a la más antigua`}
              >
                {g.items.map((r) => (
                  <RecordRow
                    key={r.id}
                    record={r}
                    base={base}
                    canOperate={canOperate}
                    showMoney={showMoney}
                    vehicleId={vehicle.id}
                    highlighted={hashId === String(r.id)}
                  />
                ))}
              </ul>
            </section>
          ))}
          <LoadMore
            hasNextPage={!!list.hasNextPage}
            isFetchingNextPage={list.isFetchingNextPage}
            fetchNextPage={list.fetchNextPage}
            shown={records.length}
            total={totalFromPages(list.data)}
            what="intervenciones"
          />
        </>
      )}
    </div>
  );
}

function RecordRow({
  record: r,
  base,
  canOperate,
  showMoney,
  vehicleId,
  highlighted,
}: {
  record: MaintenanceRecord;
  base: string;
  canOperate: boolean;
  showMoney: boolean;
  vehicleId: number;
  highlighted: boolean;
}) {
  const ctx = useWorkspace();
  const navigate = useNavigate();
  const [open, setOpen] = useState(highlighted);
  const archive = useArchiveRecord(vehicleId);
  const archived = !!r.archived_at;
  const detailId = `intervencion-${r.id}-detalle`;
  const canEdit = canOperate && !archived && !r.work_order_id;
  const meta = [
    RECORD_TYPE_LABEL[r.type],
    ZONE_LABEL[r.zone],
    r.mileage !== null ? formatKm(r.mileage) : null,
    r.workshop_name,
  ]
    .filter(Boolean)
    .join(" · ");

  const toggleArchive = () =>
    archive.mutate(
      { id: r.id, restore: archived },
      {
        onSuccess: () =>
          toast.success(
            archived
              ? "Intervención restaurada"
              : "Intervención archivada: deja de contar en zonas y gastos",
          ),
        onError: (err) => toast.error(errorMessage(err)),
      },
    );

  return (
    <li
      id={`intervencion-${r.id}`}
      tabIndex={highlighted ? -1 : undefined}
      className={cn(
        "scroll-mt-32 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
        highlighted && "bg-surface-2",
      )}
    >
      <div className="flex items-start gap-2 py-1">
        <h3 className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls={detailId}
            className="flex min-h-12 w-full min-w-0 items-start gap-3 rounded-control px-1 py-1.5 text-left transition-colors hover:bg-surface-2"
          >
            <span className="w-14 shrink-0 pt-0.5 text-sm text-fg-muted tabular sm:w-16">
              {formatDate(r.service_date, "dayMonth")}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="font-medium text-fg">{r.title}</span>
                {archived && <Badge size="sm">Archivada</Badge>}
              </span>
              <span className="block text-sm text-fg-muted tabular">
                {meta}
              </span>
            </span>
            {showMoney && (
              <span className="shrink-0 pt-0.5 text-sm font-medium text-fg tabular">
                {r.total_cost ? formatMoney(r.total_cost) : "—"}
              </span>
            )}
            <ChevronDown
              aria-hidden
              className={cn(
                "mt-1 size-4 shrink-0 text-fg-subtle transition-transform duration-150",
                open && "rotate-180",
              )}
            />
          </button>
        </h3>
        {canOperate && (
          <DropdownMenu>
            <DropdownMenuTrigger
              className="mt-1 grid size-11 shrink-0 place-items-center rounded-control text-fg-muted hover:bg-surface-2 hover:text-fg md:size-9"
              aria-label={`Acciones de ${r.title}`}
            >
              <EllipsisVertical aria-hidden className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canEdit && (
                <DropdownMenuItem
                  icon={<Pencil aria-hidden />}
                  onSelect={() =>
                    navigate(`${base}/intervenciones/${r.id}/editar`)
                  }
                >
                  Editar
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                icon={
                  archived ? (
                    <ArchiveRestore aria-hidden />
                  ) : (
                    <Archive aria-hidden />
                  )
                }
                onSelect={toggleArchive}
                disabled={archive.isPending}
              >
                {archived ? "Restaurar" : "Archivar"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {open && (
        <div
          id={detailId}
          className="space-y-4 pb-4 pl-1 text-sm animate-fade-in sm:pl-[4.75rem]"
        >
          {r.description ? (
            <p className="whitespace-pre-line text-fg-muted">{r.description}</p>
          ) : (
            <p className="text-fg-subtle">Sin descripción.</p>
          )}
          {r.service_kind && r.service_kind !== "other" && (
            <p className="text-fg-muted">
              Servicio: {SERVICE_KIND_LABEL[r.service_kind]}
            </p>
          )}
          {r.items.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[440px] text-sm">
                <caption className="sr-only">Líneas de {r.title}</caption>
                <thead className="border-b border-line text-left text-xs text-fg-subtle">
                  <tr>
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Concepto
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Tipo
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-right font-medium"
                    >
                      Cant.
                    </th>
                    {showMoney && (
                      <>
                        <th
                          scope="col"
                          className="px-3 py-2 text-right font-medium"
                        >
                          Precio/u
                        </th>
                        <th
                          scope="col"
                          className="py-2 pl-3 text-right font-medium"
                        >
                          Total
                        </th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {r.items.map((it, i) => (
                    <tr key={it.id ?? i}>
                      <td className="py-2 pr-3 text-fg">
                        {it.name}
                        {it.part_number && (
                          <span className="block text-xs text-fg-subtle">
                            Ref. {it.part_number}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-fg-muted">
                        {ITEM_KIND_LABEL[it.kind]}
                      </td>
                      <td className="px-3 py-2 text-right tabular">
                        {formatNumber(it.quantity, 2)}
                      </td>
                      {showMoney && (
                        <>
                          <td className="px-3 py-2 text-right tabular">
                            {formatMoney(it.unit_price)}
                          </td>
                          <td className="py-2 pl-3 text-right font-medium tabular">
                            {formatMoney(it.total)}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-fg-subtle">
              Sin líneas de piezas o mano de obra.
            </p>
          )}
          {showMoney && (r.parts_cost || r.labor_cost) && (
            <p className="text-fg-muted tabular">
              {[
                r.parts_cost ? `Piezas: ${formatMoney(r.parts_cost)}` : null,
                r.labor_cost
                  ? `Mano de obra: ${formatMoney(r.labor_cost)}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          <p className="flex flex-wrap gap-x-4 gap-y-2">
            {r.documents_count > 0 && (
              <Link
                to={`${base}/datos?intervencion=${r.id}#documentos`}
                className="font-medium text-accent-ink underline-offset-4 hover:underline"
              >
                {r.documents_count === 1
                  ? "Ver su documento"
                  : `Ver sus ${r.documents_count} documentos`}
              </Link>
            )}
            {r.expense_id && ctx.canExpenses && (
              <Link
                to={`${base}/gastos?periodo=${r.service_date.slice(0, 4)}#gasto-${r.expense_id}`}
                className="font-medium text-accent-ink underline-offset-4 hover:underline"
              >
                Cuenta como gasto: verlo
              </Link>
            )}
            {r.work_order_id && ctx.isWorkshop && (
              <Link
                to={`${ctx.base}/ordenes/${r.work_order_id}`}
                className="font-medium text-accent-ink underline-offset-4 hover:underline"
              >
                Viene de una orden de trabajo: verla
              </Link>
            )}
            {canOperate && !archived && r.work_order_id && (
              <span className="text-fg-subtle">
                Se edita desde su orden de trabajo.
              </span>
            )}
          </p>
        </div>
      )}
    </li>
  );
}
