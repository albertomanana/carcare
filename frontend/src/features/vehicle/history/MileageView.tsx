import { Gauge, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { errorMessage } from "@/api/client";
import { flattenPages, totalFromPages } from "@/api/hooks/shared";
import { useDeleteMileage, useMileageLogs } from "@/api/hooks/vehicles";
import type { MileageLog, Vehicle } from "@/api/types";
import { Button, IconButton } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LoadMore } from "@/components/ui/LoadMore";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useQuickActions } from "@/features/quick-actions/quick-actions-context";
import { useWorkspace } from "@/features/workspace/workspace-context";
import { formatDate, formatKm } from "@/lib/format";
import { MILEAGE_SOURCE_LABEL } from "@/lib/labels";
import { mileageSourceLink } from "@/lib/mileage";

/** Lecturas de kilometraje (antes "Diario → Lecturas de km"): tabla sin caja, con el origen enlazado (§3.4.1). */
export function MileageView({ vehicle }: { vehicle: Vehicle }) {
  const ctx = useWorkspace();
  const quick = useQuickActions();
  const logs = useMileageLogs(vehicle.id);
  const remove = useDeleteMileage(vehicle.id);
  const [deleting, setDeleting] = useState<MileageLog | null>(null);
  const items = flattenPages(logs.data);
  const canOperate = ctx.can("operate") && !vehicle.archived_at;
  const vehicleBase = `${ctx.base}/vehiculos/${vehicle.id}`;

  if (logs.isPending)
    return (
      <div role="status" aria-live="polite" className="space-y-2">
        <span className="sr-only">Cargando lecturas…</span>
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} aria-hidden className="h-11 w-full" />
        ))}
      </div>
    );
  if (logs.isError)
    return (
      <ErrorState error={logs.error} onRetry={() => void logs.refetch()} />
    );
  if (!items.length)
    return (
      <EmptyState
        compact
        icon={<Gauge />}
        title="Sin lecturas de kilometraje"
        description="Cada vez que anotas los km, o registras una intervención o un repostaje con km, queda aquí."
        action={
          canOperate && (
            <Button onClick={() => quick.run("mileage", vehicle.id)}>
              Anotar km
            </Button>
          )
        }
      />
    );

  return (
    <div>
      <table className="w-full border-y border-line text-sm">
        <caption className="sr-only">
          Lecturas de kilometraje, de la más reciente a la más antigua
        </caption>
        <thead className="border-b border-line text-left text-xs text-fg-subtle">
          <tr>
            <th scope="col" className="py-2 pr-3 font-medium">
              Fecha
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Kilómetros
            </th>
            <th
              scope="col"
              className="hidden px-3 py-2 font-medium sm:table-cell"
            >
              Origen
            </th>
            <th scope="col" className="py-2 pl-2">
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {items.map((log) => (
            <tr key={log.id}>
              <td className="py-2.5 pr-3 tabular">
                <span className="text-fg">{formatDate(log.recorded_at)}</span>
                {log.note && (
                  <span className="block text-xs text-fg-muted">
                    {log.note}
                  </span>
                )}
                <span className="block text-xs sm:hidden">
                  <MileageSource
                    log={log}
                    vehicleBase={vehicleBase}
                    wsBase={ctx.base}
                  />
                </span>
              </td>
              <td className="px-3 py-2.5 text-right font-medium text-fg tabular">
                {formatKm(log.mileage)}
              </td>
              <td className="hidden px-3 py-2.5 sm:table-cell">
                <MileageSource
                  log={log}
                  vehicleBase={vehicleBase}
                  wsBase={ctx.base}
                />
              </td>
              <td className="py-1 pl-2 text-right">
                {canOperate && log.source === "manual" && (
                  <IconButton
                    label={`Borrar la lectura de ${formatKm(log.mileage)} del ${formatDate(log.recorded_at)}`}
                    onClick={() => setDeleting(log)}
                  >
                    <Trash2 aria-hidden />
                  </IconButton>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {canOperate && (
        <p className="mt-2 text-xs text-fg-subtle">
          Solo se borran las lecturas manuales; las demás, desde su
          intervención, gasto u orden.
        </p>
      )}
      <LoadMore
        hasNextPage={!!logs.hasNextPage}
        isFetchingNextPage={logs.isFetchingNextPage}
        fetchNextPage={logs.fetchNextPage}
        shown={items.length}
        total={totalFromPages(logs.data)}
        what="lecturas"
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="¿Borrar esta lectura?"
        description={
          deleting
            ? `${formatKm(deleting.mileage)} el ${formatDate(deleting.recorded_at)}. El kilometraje actual se recalculará con las demás lecturas.`
            : undefined
        }
        confirmLabel="Borrar lectura"
        loading={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success("Lectura borrada");
              setDeleting(null);
            },
            onError: (err) => toast.error(errorMessage(err)),
          })
        }
      />
    </div>
  );
}

/** Origen de la lectura: enlace a su registro cuando lo hay (contrato §3.4.1), si no, texto. */
function MileageSource({
  log,
  vehicleBase,
  wsBase,
}: {
  log: MileageLog;
  vehicleBase: string;
  wsBase: string;
}) {
  const link = mileageSourceLink(log, vehicleBase, wsBase);
  const text = MILEAGE_SOURCE_LABEL[log.source];
  if (!link) return <span className="text-fg-muted">{text}</span>;
  return (
    <Link
      to={link.to}
      aria-label={link.label}
      className="font-medium text-accent-ink underline-offset-4 hover:underline"
    >
      {text}
    </Link>
  );
}
