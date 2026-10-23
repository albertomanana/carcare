import { Download, ExternalLink, Eye, FileText, FileUp, Paperclip, Trash2, Upload, X } from 'lucide-react'
import { type DragEvent, lazy, type ReactNode, Suspense, useCallback, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { downloadFile, errorMessage } from '@/api/client'
import { useDeleteDocument, useDocumentFile, useDocuments, useMaintenanceList } from '@/api/hooks/records'
import { flattenPages } from '@/api/hooks/shared'
import type { DocumentType, VehicleDocument } from '@/api/types'
import { StatusPill } from '@/components/ui/Badge'
import { Button, IconButton } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Dialog, DialogBody, DialogContent, DialogFooter } from '@/components/ui/Dialog'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState, NoResults } from '@/components/ui/States'
import { useWorkspace } from '@/features/workspace/workspace-context'
import { useSearchParam } from '@/hooks/useSearchParam'
import { EXPIRY_SOON_DAYS, expiryDescriptor, isImage, isPreviewable } from '@/lib/documents'
import { formatDate, formatFileSize } from '@/lib/format'
import { DOCUMENT_TYPE_ICON, DOCUMENT_TYPE_LABEL, DOCUMENT_TYPES } from '@/lib/labels'
import { joinList, plural } from '@/lib/text'
import { useVehicleOutlet } from '../vehicle-outlet'

const DocumentUploadDialog = lazy(() => import('../dialogs/DocumentUploadDialog'))

/** Asigna un Blob a un <img>/<iframe> con una URL temporal que se libera al desmontar (ref con limpieza, React 19). */
type BlobTarget = HTMLImageElement | HTMLIFrameElement

function useBlobSrc(blob: Blob | undefined): (el: BlobTarget | null) => void | (() => void) {
  return useCallback(
    (el: BlobTarget | null) => {
      if (!el || !blob) return
      const url = URL.createObjectURL(blob)
      el.src = url
      return () => URL.revokeObjectURL(url)
    },
    [blob],
  )
}

function openBlobInNewTab(blob: Blob) {
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

async function download(doc: VehicleDocument) {
  try {
    await downloadFile(doc.download_url, doc.original_filename)
  } catch (err) {
    toast.error(errorMessage(err, 'No se pudo descargar el archivo.'))
  }
}

export default function DocumentsTab() {
  const { vehicle } = useVehicleOutlet()
  const ctx = useWorkspace()
  const [typeParam, setType] = useSearchParam('tipo')
  const [recordParam, setRecord] = useSearchParam('intervencion')
  const [uploadParam, setUploadParam] = useSearchParam('subir')
  const query = useDocuments(vehicle.id)
  const records = useMaintenanceList(vehicle.id, { per_page: 50 })
  const remove = useDeleteDocument(vehicle.id)
  const canOperate = ctx.can('operate') && !vehicle.archived_at
  const [dropped, setDropped] = useState<File | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [preview, setPreview] = useState<VehicleDocument | null>(null)
  const [deleting, setDeleting] = useState<VehicleDocument | null>(null)

  const all = query.data ?? []
  const recordId = recordParam ? Number(recordParam) : null
  const recordTitles = new Map(flattenPages(records.data).map((r) => [r.id, r.title]))
  const byRecord = recordId ? all.filter((d) => d.maintenance_record_id === recordId) : all
  const type = DOCUMENT_TYPES.includes(typeParam as DocumentType) ? (typeParam as DocumentType) : null
  const docs = type ? byRecord.filter((d) => d.document_type === type) : byRecord
  const counts = new Map<DocumentType, number>()
  for (const d of byRecord) counts.set(d.document_type, (counts.get(d.document_type) ?? 0) + 1)
  const presentTypes = DOCUMENT_TYPES.filter((t) => counts.has(t))

  const expiring = all
    .map((d) => ({ doc: d, exp: expiryDescriptor(d.expires_at) }))
    .filter((x) => x.exp && x.exp.days <= EXPIRY_SOON_DAYS)
    .sort((a, b) => (a.exp?.days ?? 0) - (b.exp?.days ?? 0))

  const showUpload = canOperate && (uploadOpen || uploadParam === '1')
  const closeUpload = () => {
    setUploadOpen(false)
    setDropped(null)
    if (uploadParam) setUploadParam(null)
  }

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (!canOperate || !e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    if (!dragging) setDragging(true)
  }
  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false)
  }
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    if (!canOperate) return
    e.preventDefault()
    setDragging(false)
    const files = Array.from(e.dataTransfer.files ?? [])
    if (!files.length) return
    if (files.length > 1) toast(`Los documentos se suben de uno en uno: empezamos por «${files[0].name}».`)
    setDropped(files[0])
    setUploadOpen(true)
  }

  const confirmDelete = () =>
    deleting &&
    remove.mutate(deleting.id, {
      onSuccess: () => {
        toast.success(`«${deleting.title}» eliminado`)
        setDeleting(null)
      },
      onError: (err) => toast.error(errorMessage(err)),
    })

  return (
    <div className="relative space-y-5" onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {presentTypes.length > 1 ? (
          <SegmentedControl
            label="Filtrar por tipo de documento"
            size="sm"
            value={type ?? 'all'}
            onValueChange={(v) => setType(v === 'all' ? null : v)}
            options={[
              { value: 'all', label: `Todos · ${byRecord.length}` },
              ...presentTypes.map((t) => ({ value: t, label: `${DOCUMENT_TYPE_LABEL[t]} · ${counts.get(t)}` })),
            ]}
            className="scrollbar-none max-w-full overflow-x-auto"
          />
        ) : (
          <p className="text-sm text-fg-muted">{query.isSuccess ? plural(byRecord.length, 'documento', 'documentos') : ' '}</p>
        )}
        {canOperate && (
          <Button icon={<Upload aria-hidden />} onClick={() => setUploadOpen(true)} className="sm:ml-auto">
            Subir documento
          </Button>
        )}
      </div>

      {recordId && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-fg-muted">Documentos de la intervención</span>
          <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 py-1 pl-3 pr-1 text-fg">
            <Paperclip aria-hidden className="size-3.5 text-fg-subtle" />
            {recordTitles.get(recordId) ?? `n.º ${recordId}`}
            <button type="button" onClick={() => setRecord(null)} className="grid size-7 place-items-center rounded-full text-fg-muted hover:bg-surface-3 hover:text-fg" aria-label="Quitar el filtro de intervención">
              <X aria-hidden className="size-3.5" />
            </button>
          </span>
        </div>
      )}

      {expiring.length > 0 && !recordId && (
        <div role="status" className="flex items-start gap-3 rounded-card border border-warning/40 bg-warning-soft p-3 text-sm text-fg">
          <FileText aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
          <p>
            {expiring.some((x) => (x.exp?.days ?? 0) < 0) ? 'Revisa tus documentos: ' : 'Caducan pronto: '}
            {joinList(expiring.map((x) => `«${x.doc.title}» (${x.exp?.label.toLowerCase()})`))}.
          </p>
        </div>
      )}

      {query.isPending ? (
        <div role="status" aria-live="polite">
          <span className="sr-only">Cargando documentos…</span>
          <div aria-hidden className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-64 rounded-card" />
            ))}
          </div>
        </div>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : all.length === 0 ? (
        <EmptyState
          icon={<FileUp />}
          title="Sin documentos todavía"
          description="Guarda aquí facturas, la póliza del seguro, la ITV o el permiso de circulación. PDF o imagen, hasta 10 MB."
          action={
            canOperate && (
              <Button icon={<Upload aria-hidden />} onClick={() => setUploadOpen(true)}>
                Subir documento
              </Button>
            )
          }
        >
          {canOperate && <p className="hidden text-xs text-fg-subtle md:block">También puedes arrastrar el archivo hasta aquí.</p>}
        </EmptyState>
      ) : docs.length === 0 ? (
        <NoResults
          what="documentos"
          onReset={() => {
            setType(null)
            setRecord(null)
          }}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Documentos del vehículo">
          {docs.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              recordTitle={doc.maintenance_record_id ? (recordTitles.get(doc.maintenance_record_id) ?? null) : null}
              recordHref={doc.maintenance_record_id ? `${ctx.base}/vehiculos/${vehicle.id}/historial#intervencion-${doc.maintenance_record_id}` : null}
              canDelete={canOperate}
              onPreview={() => setPreview(doc)}
              onDelete={() => setDeleting(doc)}
            />
          ))}
        </ul>
      )}

      {dragging && (
        <div aria-hidden className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-card border-2 border-dashed border-accent bg-canvas/85 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2 text-center">
            <FileUp className="size-8 text-accent-ink" />
            <p className="font-display text-lg font-semibold text-fg-warm">Suelta el archivo para subirlo</p>
            <p className="text-sm text-fg-muted">PDF, JPG, PNG o WebP · máximo 10 MB</p>
          </div>
        </div>
      )}

      <Suspense fallback={null}>
        {showUpload && <DocumentUploadDialog vehicle={vehicle} open onOpenChange={(o) => !o && closeUpload()} defaultRecordId={recordId} initialFile={dropped} />}
      </Suspense>
      <PreviewDialog doc={preview} onOpenChange={(o) => !o && setPreview(null)} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={deleting ? `¿Eliminar «${deleting.title}»?` : ''}
        description="Se borrará el archivo del servidor. Esta acción no se puede deshacer."
        confirmLabel="Eliminar documento"
        loading={remove.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  )
}

function DocumentCard({
  doc,
  recordTitle,
  recordHref,
  canDelete,
  onPreview,
  onDelete,
}: {
  doc: VehicleDocument
  recordTitle: string | null
  recordHref: string | null
  canDelete: boolean
  onPreview: () => void
  onDelete: () => void
}) {
  const Icon = DOCUMENT_TYPE_ICON[doc.document_type]
  const exp = expiryDescriptor(doc.expires_at)
  const previewable = isPreviewable(doc.mime_type)
  return (
    <li className="flex min-w-0 flex-col overflow-hidden rounded-card border border-line bg-surface">
      <button
        type="button"
        onClick={onPreview}
        disabled={!previewable}
        className="group relative grid h-36 place-items-center overflow-hidden border-b border-line bg-surface-2/60 transition-colors hover:bg-surface-2"
        aria-label={`Ver «${doc.title}»`}
      >
        {isImage(doc.mime_type) ? <Thumbnail doc={doc} /> : <FileGlyph icon={<Icon aria-hidden className="size-7" />} ext={doc.mime_type === 'application/pdf' ? 'PDF' : (doc.original_filename.split('.').pop() ?? '').toUpperCase()} />}
        {previewable && (
          <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-surface/90 px-2 py-1 text-xs font-medium text-fg opacity-0 shadow transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            <Eye aria-hidden className="size-3.5" />
            Ver
          </span>
        )}
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-4">
        <div className="flex items-start gap-2">
          <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
          <h3 className="min-w-0 flex-1 truncate font-medium text-fg" title={doc.title}>
            {doc.title}
          </h3>
        </div>
        <p className="truncate text-xs text-fg-muted tabular" title={doc.original_filename}>
          {DOCUMENT_TYPE_LABEL[doc.document_type]} · {formatFileSize(doc.size)} · subido el {formatDate(doc.created_at)}
        </p>
        {recordHref && (
          <Link to={recordHref} className="inline-flex min-w-0 items-center gap-1.5 text-xs text-fg-muted hover:text-fg hover:underline">
            <Paperclip aria-hidden className="size-3.5 shrink-0" />
            <span className="truncate">{recordTitle ? `Intervención: ${recordTitle}` : 'Ver la intervención relacionada'}</span>
          </Link>
        )}
        {exp && <StatusPill status={exp} size="sm" className="mt-1 w-fit" />}
      </div>
      <div className="flex items-center gap-1 border-t border-line px-2 py-1.5">
        {previewable && (
          <Button variant="ghost" size="sm" icon={<Eye aria-hidden />} onClick={onPreview}>
            Ver
          </Button>
        )}
        <Button variant="ghost" size="sm" icon={<Download aria-hidden />} onClick={() => void download(doc)} aria-label={`Descargar «${doc.title}»`}>
          Descargar
        </Button>
        <div className="flex-1" />
        {canDelete && (
          <IconButton label={`Eliminar «${doc.title}»`} size="sm" onClick={onDelete} className="hover:text-danger">
            <Trash2 aria-hidden />
          </IconButton>
        )}
      </div>
    </li>
  )
}

function FileGlyph({ icon, ext }: { icon: ReactNode; ext: string }) {
  return (
    <span aria-hidden className="relative grid h-20 w-16 place-items-center rounded-control border border-line-strong bg-surface text-fg-subtle shadow-sm">
      {icon}
      {ext && <span className="absolute -bottom-2 rounded bg-surface-3 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-fg-muted">{ext}</span>}
    </span>
  )
}

function Thumbnail({ doc }: { doc: VehicleDocument }) {
  const file = useDocumentFile(doc.id)
  const ref = useBlobSrc(file.data)
  if (file.isPending) return <Skeleton className="h-full w-full rounded-none" />
  if (file.isError) return <FileGlyph icon={<FileText aria-hidden className="size-7" />} ext="IMG" />
  return <img ref={ref} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
}

function PreviewDialog({ doc, onOpenChange }: { doc: VehicleDocument | null; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={!!doc} onOpenChange={onOpenChange}>
      <DialogContent title={doc?.title ?? ''} description={doc ? `${doc.original_filename} · ${formatFileSize(doc.size)}` : undefined} size="xl">
        {doc && <PreviewBody doc={doc} />}
      </DialogContent>
    </Dialog>
  )
}

function PreviewBody({ doc }: { doc: VehicleDocument }) {
  const file = useDocumentFile(doc.id)
  const ref = useBlobSrc(file.data)
  const pdf = doc.mime_type === 'application/pdf'
  return (
    <>
      <DialogBody className="p-3 md:p-4">
        {file.isPending ? (
          <div role="status" className="grid h-[60vh] place-items-center rounded-control bg-surface-2 text-sm text-fg-subtle">
            Cargando vista previa…
          </div>
        ) : file.isError ? (
          <ErrorState compact error={file.error} title="No se pudo cargar el archivo" onRetry={() => void file.refetch()} />
        ) : pdf ? (
          <>
            <iframe ref={ref} title={`Vista previa de ${doc.title}`} className="h-[65vh] w-full rounded-control border border-line bg-white" />
            <p className="mt-2 text-xs text-fg-subtle">¿No se ve? Algunos móviles no muestran PDF incrustados: ábrelo en una pestaña nueva o descárgalo.</p>
          </>
        ) : (
          <img ref={ref} alt={doc.title} className="mx-auto max-h-[70vh] w-auto rounded-control object-contain" />
        )}
      </DialogBody>
      <DialogFooter>
        <Button icon={<ExternalLink aria-hidden />} disabled={!file.data} onClick={() => file.data && openBlobInNewTab(file.data)}>
          Abrir en pestaña nueva
        </Button>
        <Button variant="primary" icon={<Download aria-hidden />} onClick={() => void download(doc)}>
          Descargar
        </Button>
      </DialogFooter>
    </>
  )
}
