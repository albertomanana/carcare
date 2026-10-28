import {
  Download,
  ExternalLink,
  EllipsisVertical,
  Eye,
  FileUp,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  type DragEvent,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Link, useLocation } from "react-router";
import { toast } from "sonner";
import { downloadFile, errorMessage } from "@/api/client";
import {
  useDeleteDocument,
  useDocumentFile,
  useDocuments,
  useMaintenanceList,
} from "@/api/hooks/records";
import { flattenPages } from "@/api/hooks/shared";
import type { DocumentType, Vehicle, VehicleDocument } from "@/api/types";
import { StatusPill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
} from "@/components/ui/Dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { Select } from "@/components/ui/inputs";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState, NoResults } from "@/components/ui/States";
import { useWorkspace } from "@/features/workspace/workspace-context";
import { useSearchParam } from "@/hooks/useSearchParam";
import { cn } from "@/lib/cn";
import {
  EXPIRY_SOON_DAYS,
  expiryDescriptor,
  isPreviewable,
} from "@/lib/documents";
import { formatDate, formatFileSize } from "@/lib/format";
import { DOCUMENT_TYPE_LABEL, DOCUMENT_TYPES } from "@/lib/labels";
import { plural } from "@/lib/text";

const DocumentUploadDialog = lazy(
  () => import("./dialogs/DocumentUploadDialog"),
);

/** Asigna un Blob a un <img>/<iframe> con una URL temporal que se libera al desmontar (ref con limpieza, React 19). */
type BlobTarget = HTMLImageElement | HTMLIFrameElement;

function useBlobSrc(
  blob: Blob | undefined,
): (el: BlobTarget | null) => void | (() => void) {
  return useCallback(
    (el: BlobTarget | null) => {
      if (!el || !blob) return;
      const url = URL.createObjectURL(blob);
      el.src = url;
      return () => URL.revokeObjectURL(url);
    },
    [blob],
  );
}

function openBlobInNewTab(blob: Blob) {
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function download(doc: VehicleDocument) {
  try {
    await downloadFile(doc.download_url, doc.original_filename);
  } catch (err) {
    toast.error(errorMessage(err, "No se pudo descargar el archivo."));
  }
}

/**
 * Documentos del vehículo dentro de la pestaña Datos (5.2: "Documentos + Datos → Datos"). Lista con
 * nombre · tipo · fecha · tamaño y las acciones; sin tarjetas ni miniaturas (cada miniatura era una descarga).
 * Admite `?tipo=`, `?intervencion=` (documentos de una intervención), `?subir=1` (abre la subida) y `#documentos`.
 * Se puede soltar un archivo encima para subirlo.
 */
export function DocumentsSection({ vehicle }: { vehicle: Vehicle }) {
  const ctx = useWorkspace();
  const location = useLocation();
  const sectionRef = useRef<HTMLElement>(null);
  const [typeParam, setType] = useSearchParam("tipo");
  const [recordParam, setRecord] = useSearchParam("intervencion");
  const [uploadParam, setUploadParam] = useSearchParam("subir");
  const query = useDocuments(vehicle.id);
  const recordId = recordParam ? Number(recordParam) : null;
  const all = query.data ?? [];
  // Los títulos de las intervenciones solo hacen falta si algún documento está vinculado a una
  const needsTitles = all.some((d) => d.maintenance_record_id !== null);
  const records = useMaintenanceList(
    vehicle.id,
    { per_page: 50 },
    needsTitles || !!recordId,
  );
  const remove = useDeleteDocument(vehicle.id);
  const canOperate = ctx.can("operate") && !vehicle.archived_at;
  const [dropped, setDropped] = useState<File | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<VehicleDocument | null>(null);
  const [deleting, setDeleting] = useState<VehicleDocument | null>(null);

  const recordTitles = new Map(
    flattenPages(records.data).map((r) => [r.id, r.title]),
  );
  const byRecord = recordId
    ? all.filter((d) => d.maintenance_record_id === recordId)
    : all;
  const type = DOCUMENT_TYPES.includes(typeParam as DocumentType)
    ? (typeParam as DocumentType)
    : null;
  const docs = type
    ? byRecord.filter((d) => d.document_type === type)
    : byRecord;
  const counts = new Map<DocumentType, number>();
  for (const d of byRecord)
    counts.set(d.document_type, (counts.get(d.document_type) ?? 0) + 1);
  const presentTypes = DOCUMENT_TYPES.filter((t) => counts.has(t));
  const expiring = all.filter((d) => {
    const exp = expiryDescriptor(d.expires_at);
    return exp && exp.days <= EXPIRY_SOON_DAYS;
  }).length;

  // `#documentos` (desde "Registrar ▾ → Documento", el historial o un enlace antiguo): lleva hasta la sección
  useEffect(() => {
    if (location.hash === "#documentos" && query.isSuccess)
      sectionRef.current?.scrollIntoView({ block: "start" });
  }, [location.hash, query.isSuccess]);

  const showUpload = canOperate && (uploadOpen || uploadParam === "1");
  const closeUpload = () => {
    setUploadOpen(false);
    setDropped(null);
    if (uploadParam) setUploadParam(null);
  };

  const onDragOver = (e: DragEvent<HTMLElement>) => {
    if (!canOperate || !e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (!dragging) setDragging(true);
  };
  const onDragLeave = (e: DragEvent<HTMLElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null))
      setDragging(false);
  };
  const onDrop = (e: DragEvent<HTMLElement>) => {
    if (!canOperate) return;
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    if (!files.length) return;
    if (files.length > 1)
      toast(
        `Los documentos se suben de uno en uno: empezamos por «${files[0].name}».`,
      );
    setDropped(files[0]);
    setUploadOpen(true);
  };

  const confirmDelete = () =>
    deleting &&
    remove.mutate(deleting.id, {
      onSuccess: () => {
        toast.success(`«${deleting.title}» eliminado`);
        setDeleting(null);
      },
      onError: (err) => toast.error(errorMessage(err)),
    });

  return (
    <section
      ref={sectionRef}
      id="documentos"
      aria-labelledby="documentos-title"
      className="relative min-w-0 scroll-mt-32"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2
            id="documentos-title"
            className="font-display text-lg font-semibold tracking-tight text-fg-warm"
          >
            Documentos
          </h2>
          <p className="mt-0.5 text-sm text-fg-muted">
            {query.isSuccess
              ? all.length
                ? plural(all.length, "documento", "documentos")
                : "PDF o imagen, hasta 10 MB."
              : " "}
            {expiring > 0 &&
              ` · ${plural(expiring, "caduca pronto o ya caducó", "caducan pronto o ya caducaron")}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {presentTypes.length > 1 && (
            <Select
              aria-label="Filtrar por tipo de documento"
              value={type ?? ""}
              onChange={(e) => setType(e.target.value || null)}
              className="w-auto"
            >
              <option value="">Todos los tipos ({byRecord.length})</option>
              {presentTypes.map((t) => (
                <option key={t} value={t}>
                  {DOCUMENT_TYPE_LABEL[t]} ({counts.get(t)})
                </option>
              ))}
            </Select>
          )}
          {canOperate && all.length > 0 && (
            <Button
              icon={<Upload aria-hidden />}
              onClick={() => setUploadOpen(true)}
            >
              Subir documento
            </Button>
          )}
        </div>
      </div>

      {recordId && (
        <p className="mb-3 flex flex-wrap items-center gap-2 text-sm text-fg-muted">
          Documentos de la intervención «
          {recordTitles.get(recordId) ?? `n.º ${recordId}`}»
          <button
            type="button"
            onClick={() => setRecord(null)}
            className="inline-flex min-h-10 items-center gap-1 rounded-control px-2 font-medium text-accent-ink hover:bg-surface-2"
          >
            <X aria-hidden className="size-4" />
            Ver todos
          </button>
        </p>
      )}

      {query.isPending ? (
        <div role="status" aria-live="polite" className="space-y-2">
          <span className="sr-only">Cargando documentos…</span>
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} aria-hidden className="h-12 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : all.length === 0 ? (
        <EmptyState
          compact
          icon={<FileUp />}
          title="Sin documentos todavía"
          description="Guarda aquí facturas, la póliza del seguro, la ITV o el permiso de circulación."
          action={
            canOperate && (
              <Button
                icon={<Upload aria-hidden />}
                onClick={() => setUploadOpen(true)}
              >
                Subir documento
              </Button>
            )
          }
        >
          {canOperate && (
            <p className="hidden text-xs text-fg-subtle md:block">
              También puedes arrastrar el archivo hasta aquí.
            </p>
          )}
        </EmptyState>
      ) : docs.length === 0 ? (
        <NoResults
          what="documentos"
          onReset={() => {
            setType(null);
            setRecord(null);
          }}
        />
      ) : (
        <ul
          className="divide-y divide-line border-y border-line"
          aria-label="Documentos del vehículo"
        >
          {docs.map((doc) => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              recordTitle={
                doc.maintenance_record_id
                  ? (recordTitles.get(doc.maintenance_record_id) ?? null)
                  : null
              }
              recordHref={
                doc.maintenance_record_id
                  ? `${ctx.base}/vehiculos/${vehicle.id}/historial?ver=intervenciones#intervencion-${doc.maintenance_record_id}`
                  : null
              }
              canDelete={canOperate}
              onPreview={() => setPreview(doc)}
              onDelete={() => setDeleting(doc)}
            />
          ))}
        </ul>
      )}

      {dragging && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-card border-2 border-dashed border-accent bg-canvas"
        >
          <div className="flex flex-col items-center gap-2 text-center">
            <FileUp className="size-8 text-accent-ink" />
            <p className="font-display text-lg font-semibold text-fg-warm">
              Suelta el archivo para subirlo
            </p>
            <p className="text-sm text-fg-muted">
              PDF, JPG, PNG o WebP · máximo 10 MB
            </p>
          </div>
        </div>
      )}

      <Suspense fallback={null}>
        {showUpload && (
          <DocumentUploadDialog
            vehicle={vehicle}
            open
            onOpenChange={(o) => !o && closeUpload()}
            defaultRecordId={recordId}
            initialFile={dropped}
          />
        )}
      </Suspense>
      <PreviewDialog
        doc={preview}
        onOpenChange={(o) => !o && setPreview(null)}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={deleting ? `¿Eliminar «${deleting.title}»?` : ""}
        description="Se borrará el archivo del servidor. Esta acción no se puede deshacer."
        confirmLabel="Eliminar documento"
        loading={remove.isPending}
        onConfirm={confirmDelete}
      />
    </section>
  );
}

function DocumentRow({
  doc,
  recordTitle,
  recordHref,
  canDelete,
  onPreview,
  onDelete,
}: {
  doc: VehicleDocument;
  recordTitle: string | null;
  recordHref: string | null;
  canDelete: boolean;
  onPreview: () => void;
  onDelete: () => void;
}) {
  const exp = expiryDescriptor(doc.expires_at);
  const previewable = isPreviewable(doc.mime_type);
  // Píldora solo si pide atención (caducado o caduca pronto, R5); si no, la caducidad va como texto
  const attention = exp && (exp.tone === "danger" || exp.tone === "warning");
  const meta = [
    DOCUMENT_TYPE_LABEL[doc.document_type],
    formatDate(doc.created_at),
    formatFileSize(doc.size),
    exp && !attention ? exp.label : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <li className="flex items-center gap-2 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {previewable ? (
            <button
              type="button"
              onClick={onPreview}
              className="min-w-0 break-words text-left font-medium text-fg underline-offset-4 hover:underline"
            >
              {doc.title}
            </button>
          ) : (
            <span className="min-w-0 break-words font-medium text-fg">
              {doc.title}
            </span>
          )}
          {attention && exp && <StatusPill status={exp} size="sm" />}
        </p>
        <p className={cn("text-sm text-fg-muted tabular")}>{meta}</p>
        {recordHref && (
          <Link
            to={recordHref}
            className="text-sm text-fg-muted underline-offset-4 hover:text-fg hover:underline"
          >
            {recordTitle
              ? `De la intervención «${recordTitle}»`
              : "Ver la intervención relacionada"}
          </Link>
        )}
      </div>
      <Button
        variant="ghost"
        size="sm"
        icon={<Download aria-hidden />}
        onClick={() => void download(doc)}
        aria-label={`Descargar «${doc.title}»`}
        className="max-sm:hidden"
      >
        Descargar
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="grid size-11 shrink-0 place-items-center rounded-control text-fg-muted hover:bg-surface-2 hover:text-fg md:size-9"
          aria-label={`Acciones de «${doc.title}»`}
        >
          <EllipsisVertical aria-hidden className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {previewable && (
            <DropdownMenuItem icon={<Eye aria-hidden />} onSelect={onPreview}>
              Ver
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            icon={<Download aria-hidden />}
            onSelect={() => void download(doc)}
          >
            Descargar
          </DropdownMenuItem>
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                danger
                icon={<Trash2 aria-hidden />}
                onSelect={onDelete}
              >
                Eliminar
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

function PreviewDialog({
  doc,
  onOpenChange,
}: {
  doc: VehicleDocument | null;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Dialog open={!!doc} onOpenChange={onOpenChange}>
      <DialogContent
        title={doc?.title ?? ""}
        description={
          doc
            ? `${doc.original_filename} · ${formatFileSize(doc.size)}`
            : undefined
        }
        size="xl"
      >
        {doc && <PreviewBody doc={doc} />}
      </DialogContent>
    </Dialog>
  );
}

function PreviewBody({ doc }: { doc: VehicleDocument }) {
  const file = useDocumentFile(doc.id);
  const ref = useBlobSrc(file.data);
  const pdf = doc.mime_type === "application/pdf";
  return (
    <>
      <DialogBody className="p-3 md:p-4">
        {file.isPending ? (
          <div
            role="status"
            className="grid h-[60vh] place-items-center rounded-control bg-surface-2 text-sm text-fg-subtle"
          >
            Cargando vista previa…
          </div>
        ) : file.isError ? (
          <ErrorState
            compact
            error={file.error}
            title="No se pudo cargar el archivo"
            onRetry={() => void file.refetch()}
          />
        ) : pdf ? (
          <>
            <iframe
              ref={ref}
              title={`Vista previa de ${doc.title}`}
              className="h-[65vh] w-full rounded-control border border-line bg-surface"
            />
            <p className="mt-2 text-xs text-fg-subtle">
              ¿No se ve? Algunos móviles no muestran PDF incrustados: ábrelo en
              una pestaña nueva o descárgalo.
            </p>
          </>
        ) : (
          <img
            ref={ref}
            alt={doc.title}
            className="mx-auto max-h-[70vh] w-auto rounded-control object-contain"
          />
        )}
      </DialogBody>
      <DialogFooter>
        <Button
          icon={<ExternalLink aria-hidden />}
          disabled={!file.data}
          onClick={() => file.data && openBlobInNewTab(file.data)}
        >
          Abrir en pestaña nueva
        </Button>
        <Button
          variant="primary"
          icon={<Download aria-hidden />}
          onClick={() => void download(doc)}
        >
          Descargar
        </Button>
      </DialogFooter>
    </>
  );
}
