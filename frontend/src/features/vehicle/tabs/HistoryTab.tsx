import { useSearchParams } from "react-router";
import { Select } from "@/components/ui/inputs";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useWorkspace } from "@/features/workspace/workspace-context";
import { useHashTarget } from "@/hooks/useHashTarget";
import { useSearchParamsPatch } from "@/hooks/useSearchParam";
import {
  HISTORY_VIEW_LABEL,
  HISTORY_VIEWS,
  type HistoryView,
  parseHistoryView,
} from "@/lib/history";
import { JournalView } from "../history/JournalView";
import { MileageView } from "../history/MileageView";
import { RecordsView } from "../history/RecordsView";
import { useVehicleOutlet } from "../vehicle-outlet";

/** Parámetros propios de cada vista: se limpian al cambiar de vista para no arrastrar filtros que no aplican. */
const VIEW_PARAMS = ["q", "tipo", "zona", "anio", "archivadas", "periodo"];

/**
 * Historial de la ficha (5.2 del informe de UX): Diario e Historial juntos, con un filtro de tipo
 * (Todo · Intervenciones · Gastos · Kilometraje · Documentos) guardado en `?ver=`.
 * Un enlace `#intervencion-12` sin `ver` abre directamente las intervenciones.
 */
export default function HistoryTab() {
  const { vehicle } = useVehicleOutlet();
  const ctx = useWorkspace();
  const [params] = useSearchParams();
  const patch = useSearchParamsPatch();
  const linkedRecord = useHashTarget("intervencion");
  const raw = params.get("ver");
  const view =
    !raw && linkedRecord
      ? "intervenciones"
      : parseHistoryView(raw, ctx.canExpenses);
  const views = HISTORY_VIEWS.filter((v) => v !== "gastos" || ctx.canExpenses);

  const setView = (next: HistoryView) => {
    const updates: Record<string, string | null> = {
      ver: next === "todo" ? null : next,
    };
    for (const key of VIEW_PARAMS) updates[key] = null;
    patch(updates);
  };

  return (
    <div className="space-y-5">
      <div>
        {/* En el móvil no caben las 5 opciones en una fila: selector nativo (nada escondido en un scroll lateral, I4) */}
        <Select
          aria-label="Qué mostrar en el historial"
          value={view}
          onChange={(e) => setView(e.target.value as HistoryView)}
          className="md:hidden"
        >
          {views.map((v) => (
            <option key={v} value={v}>
              {HISTORY_VIEW_LABEL[v]}
            </option>
          ))}
        </Select>
        <SegmentedControl
          label="Qué mostrar en el historial"
          size="sm"
          value={view}
          onValueChange={setView}
          options={views.map((v) => ({
            value: v,
            label: HISTORY_VIEW_LABEL[v],
          }))}
          className="max-md:hidden"
        />
      </div>

      {view === "intervenciones" ? (
        <RecordsView vehicle={vehicle} />
      ) : view === "km" ? (
        <MileageView vehicle={vehicle} />
      ) : (
        <JournalView vehicle={vehicle} view={view} />
      )}
    </div>
  );
}
