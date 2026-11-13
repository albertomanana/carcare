import { CircleCheck, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import type { Vehicle } from "@/api/types";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Progress } from "@/components/ui/Progress";
import { useQuickActions } from "@/features/quick-actions/quick-actions-context";
import { useWorkspace } from "@/features/workspace/workspace-context";
import { cn } from "@/lib/cn";
import type { FirstStepState } from "@/lib/firstSteps";

export interface GuideStep {
  key: string;
  /** Lo que hay que hacer, en imperativo ("Añade tu coche"). */
  title: string;
  /** Por qué importa, en una frase. Solo se lee en el paso que toca. */
  why: string;
  done: boolean;
  /** La acción principal del paso (botón primario). Solo se pinta en el paso que toca. */
  action: ReactNode;
  /** Alternativa en texto, opcional ("o registra la última revisión"). */
  alternative?: ReactNode;
}

/**
 * Guía "Primeros pasos" (rehecha el 10/11/2026): el progreso ("Paso 2 de 3"), los pasos en orden y **una sola acción
 * principal**, la del paso que toca, con una frase de por qué importa. Lo hecho queda marcado con icono y palabra;
 * lo que viene después, solo con su nombre. Se puede ocultar.
 */
export function FirstStepsGuide({
  title = "Primeros pasos",
  steps,
  onHide,
  className,
  id = "primeros-pasos",
}: {
  title?: string;
  steps: GuideStep[];
  onHide?: () => void;
  className?: string;
  id?: string;
}) {
  const currentIndex = steps.findIndex((s) => !s.done);
  if (currentIndex < 0) return null;
  const done = steps.filter((s) => s.done).length;
  return (
    <section
      aria-labelledby={`${id}-title`}
      className={cn("min-w-0", className)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2
            id={`${id}-title`}
            className="font-display text-lg font-bold tracking-tight text-fg-warm"
          >
            {title}
          </h2>
          <p className="mt-0.5 text-sm text-fg-muted" aria-live="polite">
            Paso {currentIndex + 1} de {steps.length}
            {done > 0 && ` · ${done === 1 ? "1 hecho" : `${done} hechos`}`}
          </p>
        </div>
        {onHide && (
          <Button variant="ghost" size="sm" onClick={onHide} className="shrink-0">
            Ocultar guía
          </Button>
        )}
      </div>
      {/* Progreso: una pieza por paso, rellena con los pasos hechos */}
      <Progress value={done / steps.length} segments={steps.length} tone="accent" label="Primeros pasos" valueText={`${done} de ${steps.length} pasos hechos`} className="mt-3" />
      <ol className="mt-3 grid gap-2.5">
        {steps.map((s, i) => {
          const current = i === currentIndex;
          return (
            <li
              key={s.key}
              aria-current={current ? "step" : undefined}
              data-tone={s.done ? "ok" : current ? "accent" : undefined}
              className={cn("mission flex gap-3", !current && !s.done && "opacity-80")}
            >
              <span
                aria-hidden
                className={cn(
                  "grid size-10 shrink-0 place-items-center rounded-xl text-sm font-extrabold tabular",
                  s.done ? "bg-ok-soft text-ok" : current ? "bg-accent text-on-accent" : "bg-surface-3 text-fg-muted",
                )}
              >
                {s.done ? <CircleCheck className="size-5" /> : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className={cn("font-bold", current ? "text-fg-warm" : "text-fg-muted")}>
                  <span className="sr-only">Paso {i + 1}: </span>
                  {s.title}
                  {s.done && <span className="ml-2 text-sm font-normal text-ok">Hecho</span>}
                </h3>
                {current && (
                  <div key={s.key} className="animate-fade-in">
                    <p className="mt-0.5 text-sm text-fg-muted">{s.why}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                      {s.action}
                      {s.alternative}
                    </div>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

const linkClass =
  "inline-flex min-h-12 items-center text-sm font-medium text-accent-ink underline-offset-4 hover:underline lg:min-h-0";

/**
 * Inicio del particular: añadir el coche → anotar sus km → crear el primer recordatorio. Sin vehículo, es lo único de
 * la pantalla; con él, va junto a la placa de muestra.
 */
export function HomeFirstSteps({
  vehicle,
  steps,
  onHide,
  className,
}: {
  vehicle: Pick<Vehicle, "id" | "display_name"> | null;
  steps: FirstStepState[];
  /** Sin vehículo la guía es la pantalla entera y no se ofrece ocultarla (no quedaría nada que hacer). */
  onHide?: () => void;
  className?: string;
}) {
  const ctx = useWorkspace();
  const quick = useQuickActions();
  const done = (key: FirstStepState["key"]) =>
    steps.find((s) => s.key === key)?.done ?? false;
  const items: GuideStep[] = [
    {
      key: "vehicle",
      title: "Añade tu coche",
      why: "Con la marca y el modelo basta. Con él empiezas a llevar sus kilómetros, sus gastos y lo que le toca.",
      done: done("vehicle"),
      action: (
        <ButtonLink
          to={`${ctx.base}/vehiculos/nuevo`}
          variant="primary"
          icon={<Plus aria-hidden />}
        >
          Añadir mi coche
        </ButtonLink>
      ),
    },
    {
      key: "km",
      title: vehicle ? `Anota los kilómetros de ${vehicle.display_name}` : "Anota sus kilómetros",
      why: "Lo que marca hoy el cuentakilómetros. Con dos lecturas calculamos los km del mes y avisamos de lo que vence por kilómetros.",
      done: done("km"),
      action: vehicle && (
        <Button variant="primary" onClick={() => quick.run("mileage", vehicle.id)}>
          Anotar km
        </Button>
      ),
    },
    {
      key: "reminder",
      title: "Crea tu primer recordatorio",
      why: "La ITV, el seguro o el cambio de aceite, por fecha o por kilómetros: te avisamos antes de que venza.",
      done: done("reminder"),
      action: vehicle && (
        <Button variant="primary" onClick={() => quick.run("reminder", vehicle.id)}>
          Crear recordatorio
        </Button>
      ),
      alternative: vehicle && (
        <Link to={`${ctx.base}/vehiculos/${vehicle.id}/intervenciones/nueva`} className={linkClass}>
          o anota la última revisión o reparación
        </Link>
      ),
    },
  ];
  return (
    <FirstStepsGuide steps={items} onHide={onHide} className={className} />
  );
}

/**
 * Resumen de la ficha de un vehículo sin intervenciones: anotar km → la última intervención o un recordatorio → primer
 * repostaje (si puede ver gastos), con su acción real.
 */
export function VehicleFirstSteps({
  vehicle,
  steps,
  onHide,
}: {
  vehicle: Pick<Vehicle, "id" | "display_name">;
  steps: FirstStepState[];
  onHide?: () => void;
}) {
  const ctx = useWorkspace();
  const quick = useQuickActions();
  if (!steps.length) return null;
  // En la ficha, la acción principal es "Registrar ▾" de la cabecera (R1): los pasos van con botón normal
  const base = `${ctx.base}/vehiculos/${vehicle.id}`;
  const items: GuideStep[] = steps.map((s): GuideStep => {
    if (s.key === "km")
      return {
        key: "km",
        title: "Anota los kilómetros de hoy",
        why: "Con dos lecturas calculamos los km del mes y del año y avisamos de lo que vence por kilómetros.",
        done: s.done,
        action: (
          <Button
           
            onClick={() => quick.run("mileage", vehicle.id)}
            aria-label={`Anotar km de ${vehicle.display_name}`}
          >
            Anotar km
          </Button>
        ),
      };
    if (s.key === "fuel")
      return {
        key: "fuel",
        title: "Registra el primer repostaje",
        why: "Con los repostajes de depósito lleno calculamos el consumo y el coste por kilómetro.",
        done: s.done,
        action: (
          <Button onClick={() => quick.run("expense", vehicle.id)}>
            Añadir repostaje
          </Button>
        ),
      };
    return {
      key: s.key,
      title: "Anota la última intervención o crea un recordatorio",
      why: "Una intervención es cualquier revisión o reparación: el último cambio de aceite, la ITV… Así sabremos qué toca y cuándo.",
      done: s.done,
      action: (
        <ButtonLink to={`${base}/intervenciones/nueva`}>
          Anotar intervención
        </ButtonLink>
      ),
      alternative: (
        <button
          type="button"
          onClick={() => quick.run("reminder", vehicle.id)}
          className={linkClass}
        >
          o crea un recordatorio
        </button>
      ),
    };
  });
  return <FirstStepsGuide steps={items} onHide={onHide} />;
}
