import type { ReactNode } from "react";
import { Link } from "react-router";
import { Plate } from "@/components/ui/Badge";
import { DataList } from "@/components/ui/Card";
import { Section } from "@/components/ui/Section";
import { useWorkspace } from "@/features/workspace/workspace-context";
import {
  formatDate,
  formatDateTime,
  formatKm,
  formatRelativeDate,
} from "@/lib/format";
import { vehicleColorName } from "@/lib/colors";
import { BODY_LABEL, FUEL_LABEL, TRANSMISSION_LABEL } from "@/lib/labels";
import { plural } from "@/lib/text";
import { DocumentsSection } from "../DocumentsSection";
import { useVehicleOutlet } from "../vehicle-outlet";

const EMPTY = "Sin indicar";

type Row = { label: ReactNode; value: ReactNode; empty?: boolean };

function row(label: string, value: ReactNode | null | undefined): Row {
  const empty = value === null || value === undefined || value === "";
  return { label, value: empty ? EMPTY : value, empty };
}

/** Datos: la ficha técnica (lo que falta se dice, «Sin indicar») y los documentos del vehículo. */
export default function DataTab() {
  const { vehicle: v } = useVehicleOutlet();
  const ctx = useWorkspace();
  const canEdit = ctx.can("operate") && !v.archived_at;
  const driven =
    v.current_mileage !== null &&
    v.purchase_mileage !== null &&
    v.current_mileage >= v.purchase_mileage
      ? v.current_mileage - v.purchase_mileage
      : null;

  const identity: Row[] = [
    row("Marca", v.make),
    row("Modelo", v.model),
    row("Versión", v.version),
    row("Año", v.year),
    row("Apodo", v.nickname),
    row("Matrícula", v.plate ? <Plate value={v.plate} /> : null),
    row(
      "Número de bastidor (VIN)",
      v.vin ? (
        <span className="break-all font-mono text-[13px] tracking-wide">
          {v.vin}
        </span>
      ) : null,
    ),
  ];
  const mechanics: Row[] = [
    row("Combustible", v.fuel_type ? FUEL_LABEL[v.fuel_type] : null),
    row("Cambio", v.transmission ? TRANSMISSION_LABEL[v.transmission] : null),
    row("Motor", v.engine),
    row("Carrocería", v.body_type ? BODY_LABEL[v.body_type] : null),
    row(
      "Color",
      v.color_hex ? (
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden
            className="size-4 rounded-full border border-line-strong"
            style={{ backgroundColor: v.color_hex }}
          />
          <span>{vehicleColorName(v.color_hex) ?? "Personalizado"}</span>
        </span>
      ) : null,
    ),
  ];
  const usage: Row[] = [
    row(
      "Fecha de compra",
      v.purchase_date
        ? `${formatDate(v.purchase_date, "long")} (${formatRelativeDate(v.purchase_date)})`
        : null,
    ),
    row(
      "Kilómetros al comprarlo",
      v.purchase_mileage !== null ? (
        <span className="tabular">{formatKm(v.purchase_mileage)}</span>
      ) : null,
    ),
    row(
      "Kilómetros actuales",
      v.current_mileage !== null ? (
        <span className="tabular">
          {formatKm(v.current_mileage)}
          {v.mileage_updated_at && (
            <span className="text-fg-muted">
              {" "}
              · lectura del {formatDate(v.mileage_updated_at)}
            </span>
          )}
        </span>
      ) : null,
    ),
    {
      label: "Recorridos desde la compra",
      value:
        driven !== null ? (
          <span className="tabular">{formatKm(driven)}</span>
        ) : (
          "Faltan los km de compra o los actuales para calcularlo"
        ),
      empty: driven === null,
    },
  ];
  const record: Row[] = [
    ...(ctx.isWorkshop
      ? [
          row(
            "Cliente",
            v.customer ? (
              <Link
                to={`${ctx.base}/clientes/${v.customer.id}`}
                className="text-accent-ink hover:underline"
              >
                {v.customer.name}
              </Link>
            ) : null,
          ),
        ]
      : []),
    row(
      "Historial",
      plural(v.stats.records_count, "intervención", "intervenciones"),
    ),
    row(
      "Recordatorios pendientes",
      v.stats.pending_reminders
        ? `${plural(v.stats.pending_reminders, "recordatorio", "recordatorios")}${v.stats.overdue_reminders ? ` · ${plural(v.stats.overdue_reminders, "vencido", "vencidos")}` : ""}`
        : "Ninguno",
    ),
    row("Alta en CarCare", formatDateTime(v.created_at)),
    row("Última modificación", formatDateTime(v.updated_at)),
    ...(v.archived_at ? [row("Archivado", formatDateTime(v.archived_at))] : []),
  ];

  const editLink = canEdit && (
    <Link
      to={`${ctx.base}/vehiculos/${v.id}/editar`}
      className="text-sm font-medium text-accent-ink underline-offset-4 hover:underline"
    >
      Editar datos
    </Link>
  );

  // Secciones con título y separador, sin cajas (R3); los documentos, debajo (5.2: Documentos + Datos → Datos)
  return (
    <div className="space-y-10">
      <div className="grid gap-x-10 gap-y-8 lg:grid-cols-2">
        <Section title="Identificación" action={editLink}>
          <DataList items={identity} className="border-y border-line" />
        </Section>
        <Section title="Mecánica y aspecto">
          <DataList items={mechanics} className="border-y border-line" />
        </Section>
        <Section
          title="Compra y kilometraje"
          action={
            <Link
              to={`${ctx.base}/vehiculos/${v.id}/historial?ver=km`}
              className="text-sm font-medium text-accent-ink underline-offset-4 hover:underline"
            >
              Ver lecturas
            </Link>
          }
        >
          <DataList items={usage} className="border-y border-line" />
        </Section>
        <Section title="Registro">
          <DataList items={record} className="border-y border-line" />
        </Section>
      </div>
      <DocumentsSection vehicle={v} />
    </div>
  );
}
