import type { ReactNode } from "react";
import type { Vehicle } from "@/api/types";
import { Button, ButtonLink } from "@/components/ui/Button";
import { useQuickActions } from "@/features/quick-actions/quick-actions-context";
import { useWorkspace } from "@/features/workspace/workspace-context";
import { cn } from "@/lib/cn";
import type { FirstStepKey } from "@/lib/firstSteps";

export interface FirstStep {
  key: string;
  title: string;
  description: string;
  /** Botón o enlace que hace el paso (nunca decorativo). */
  action: ReactNode;
}

/**
 * Guía "Primeros pasos" para un vehículo sin datos (E5‑7, tarea 26): una sola sección en lugar de varios estados
 * vacíos. Solo recibe los pasos que faltan; cada uno desaparece al hacerlo. Sin números grandes ni acento (5.1).
 */
export function FirstSteps({
  steps,
  vehicleName,
  className,
  id = "primeros-pasos",
}: {
  steps: FirstStep[];
  vehicleName?: string;
  className?: string;
  id?: string;
}) {
  if (!steps.length) return null;
  return (
    <section
      aria-labelledby={`${id}-title`}
      className={cn("min-w-0", className)}
    >
      <h2
        id={`${id}-title`}
        className="font-display text-lg font-semibold tracking-tight text-fg-warm"
      >
        Primeros pasos{vehicleName ? ` con ${vehicleName}` : ""}
      </h2>
      <p className="mt-0.5 text-sm text-fg-muted">
        Con estos datos CarCare empieza a calcular tus avisos, tus kilómetros y
        tus gastos.
      </p>
      <ol className="mt-3 divide-y divide-line border-y border-line">
        {steps.map((s) => (
          <li
            key={s.key}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3"
          >
            <div className="min-w-0 flex-1 basis-56">
              <h3 className="font-medium text-fg">{s.title}</h3>
              <p className="text-sm text-fg-muted">{s.description}</p>
            </div>
            <div className="shrink-0">{s.action}</div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * Los 3 primeros pasos de un vehículo (anotar km, primer repostaje si puede ver gastos, primera intervención o
 * recordatorio), con su acción real. Lo usan el Resumen de la ficha y el Inicio.
 */
export function VehicleFirstSteps({
  vehicle,
  steps,
  showName,
}: {
  vehicle: Pick<Vehicle, "id" | "display_name">;
  steps: FirstStepKey[];
  showName?: boolean;
}) {
  const ctx = useWorkspace();
  const quick = useQuickActions();
  const base = `${ctx.base}/vehiculos/${vehicle.id}`;
  const items: FirstStep[] = [];
  if (steps.includes("km"))
    items.push({
      key: "km",
      title: "Anota los kilómetros de hoy",
      description:
        "Con dos lecturas calculamos los km del mes y del año y avisamos de lo que vence por kilómetros.",
      action: (
        <Button
          onClick={() => quick.run("mileage", vehicle.id)}
          aria-label={`Anotar km de ${vehicle.display_name}`}
        >
          Anotar km
        </Button>
      ),
    });
  if (steps.includes("fuel") && ctx.canExpenses)
    items.push({
      key: "fuel",
      title: "Registra el primer repostaje",
      description:
        "Con los repostajes de depósito lleno calculamos el consumo y el coste por kilómetro.",
      action: (
        <Button onClick={() => quick.run("expense", vehicle.id)}>
          Añadir repostaje
        </Button>
      ),
    });
  if (steps.includes("record"))
    items.push({
      key: "record",
      title: "Registra la última intervención o crea un recordatorio",
      description:
        "El último cambio de aceite, la ITV o el seguro: así sabremos qué toca y cuándo.",
      action: (
        <div className="flex flex-wrap gap-2">
          <ButtonLink to={`${base}/intervenciones/nueva`}>
            Nueva intervención
          </ButtonLink>
          <Button
            variant="ghost"
            onClick={() => quick.run("reminder", vehicle.id)}
          >
            Nuevo recordatorio
          </Button>
        </div>
      ),
    });
  return (
    <FirstSteps
      steps={items}
      vehicleName={showName ? vehicle.display_name : undefined}
    />
  );
}
