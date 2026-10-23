import { zodResolver } from '@hookform/resolvers/zod'
import { FileUp, X } from 'lucide-react'
import { type DragEvent, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { useMaintenanceList, useUploadDocument } from '@/api/hooks/records'
import { flattenPages } from '@/api/hooks/shared'
import type { DocumentType, Vehicle } from '@/api/types'
import { FormErrors } from '@/components/forms/MileageConflictNotice'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogBody, DialogClose, DialogContent, DialogFooter } from '@/components/ui/Dialog'
import { Field } from '@/components/ui/Field'
import { DateInput, Input, Select } from '@/components/ui/inputs'
import { cn } from '@/lib/cn'
import { ACCEPTED_MIME, fileError } from '@/lib/documents'
import { formatDate, formatFileSize } from '@/lib/format'
import { handleFormError } from '@/lib/forms'
import { DOCUMENT_TYPE_LABEL, DOCUMENT_TYPES } from '@/lib/labels'

const schema = z.object({
  title: z.string().trim().min(1, 'Ponle un título.').max(120, 'Máximo 120 caracteres.'),
  document_type: z.enum(DOCUMENT_TYPES as [DocumentType, ...DocumentType[]]),
  maintenance_record_id: z.string(),
  expires_at: z.string(),
})
type Values = z.infer<typeof schema>

function guessType(file: File): DocumentType {
  const name = file.name.toLowerCase()
  if (file.type.startsWith('image/')) return 'photo'
  if (/factura|invoice|ticket/.test(name)) return 'invoice'
  if (/seguro|poliza|póliza|insurance/.test(name)) return 'insurance'
  if (/itv/.test(name)) return 'itv'
  if (/permiso|ficha|circulaci/.test(name)) return 'registration'
  if (/manual/.test(name)) return 'manual'
  return 'other'
}

export interface DocumentUploadDialogProps {
  vehicle: Vehicle
  open: boolean
  onOpenChange: (o: boolean) => void
  defaultRecordId?: number | null
  /** Archivo ya elegido (p. ej. soltado sobre la pestaña de documentos). */
  initialFile?: File | null
}

export function DocumentUploadDialog({ vehicle, open, onOpenChange, defaultRecordId, initialFile }: DocumentUploadDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Subir documento" description={`${vehicle.display_name} · PDF o imagen, máximo 10 MB`} size="md">
        {open && <UploadForm vehicle={vehicle} defaultRecordId={defaultRecordId ?? null} initialFile={initialFile ?? null} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function titleFromFile(f: File): string {
  return f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 120)
}

function UploadForm({ vehicle, defaultRecordId, initialFile, onDone }: { vehicle: Vehicle; defaultRecordId: number | null; initialFile: File | null; onDone: () => void }) {
  const upload = useUploadDocument(vehicle.id)
  const records = useMaintenanceList(vehicle.id, { per_page: 50 })
  const [file, setFile] = useState<File | null>(initialFile)
  const [fileErr, setFileErr] = useState<string | null>(() => (initialFile ? fileError(initialFile) : null))
  const [dragging, setDragging] = useState(false)
  const [orphans, setOrphans] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const { register, handleSubmit, formState, setError, setValue, getValues } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: initialFile ? titleFromFile(initialFile) : '',
      document_type: initialFile ? guessType(initialFile) : 'invoice',
      maintenance_record_id: defaultRecordId ? String(defaultRecordId) : '',
      expires_at: '',
    },
  })

  const pick = (f: File | null) => {
    setFile(f)
    setFileErr(f ? fileError(f) : null)
    if (f) {
      if (!getValues('title').trim()) setValue('title', titleFromFile(f))
      setValue('document_type', guessType(f))
    }
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    pick(e.dataTransfer.files?.[0] ?? null)
  }

  const onSubmit = handleSubmit((v) => {
    const err = fileError(file)
    setFileErr(err)
    if (err || !file) return
    setOrphans([])
    upload.mutate(
      {
        file,
        title: v.title.trim(),
        document_type: v.document_type,
        maintenance_record_id: v.maintenance_record_id ? Number(v.maintenance_record_id) : null,
        expires_at: v.expires_at || null,
      },
      {
        onSuccess: (doc) => {
          toast.success(`«${doc.title}» subido`)
          onDone()
        },
        onError: (e) => {
          handleFormError(e, setError, ['title', 'document_type', 'maintenance_record_id', 'expires_at'], (msgs) => {
            // El error del archivo va junto a la zona de subida
            setOrphans(msgs)
          })
        },
      },
    )
  })

  const recordOptions = flattenPages(records.data)

  return (
    <form onSubmit={onSubmit} noValidate>
      <DialogBody className="space-y-5">
        <div>
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              'flex flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed px-4 py-8 text-center transition-colors',
              dragging ? 'border-accent bg-accent-soft' : fileErr ? 'border-danger/60' : 'border-line-strong',
            )}
          >
            <FileUp aria-hidden className="size-7 text-fg-subtle" />
            {file ? (
              <div className="flex max-w-full items-center gap-2 text-sm">
                <span className="truncate font-medium text-fg">{file.name}</span>
                <span className="shrink-0 text-fg-subtle tabular">{formatFileSize(file.size)}</span>
                <button type="button" onClick={() => pick(null)} className="grid size-9 shrink-0 place-items-center rounded-control text-fg-muted hover:bg-surface-2" aria-label="Quitar archivo">
                  <X aria-hidden className="size-4" />
                </button>
              </div>
            ) : (
              <p className="text-sm text-fg-muted">Arrastra aquí el archivo o</p>
            )}
            <Button size="sm" onClick={() => inputRef.current?.click()}>
              {file ? 'Elegir otro' : 'Elegir archivo'}
            </Button>
            <input
              ref={inputRef}
              id="document-file"
              type="file"
              accept={ACCEPTED_MIME.join(',')}
              className="sr-only"
              aria-label="Archivo del documento"
              aria-invalid={!!fileErr || undefined}
              aria-describedby={fileErr ? 'document-file-error' : undefined}
              onChange={(e) => pick(e.target.files?.[0] ?? null)}
            />
          </div>
          {fileErr && (
            <p id="document-file-error" role="alert" className="mt-1.5 text-xs font-medium text-danger">
              {fileErr}
            </p>
          )}
        </div>

        <Field label="Título" required error={formState.errors.title?.message}>
          <Input maxLength={120} {...register('title')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo" required>
            <Select {...register('document_type')}>
              {DOCUMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {DOCUMENT_TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Caduca el" hint="Opcional: seguro, ITV, garantías…" error={formState.errors.expires_at?.message}>
            <DateInput {...register('expires_at')} />
          </Field>
        </div>
        <Field label="Intervención relacionada" hint="Opcional. P. ej. la factura de un cambio de aceite." error={formState.errors.maintenance_record_id?.message}>
          <Select {...register('maintenance_record_id')} disabled={records.isPending}>
            <option value="">{records.isPending ? 'Cargando historial…' : 'Ninguna'}</option>
            {recordOptions.map((r) => (
              <option key={r.id} value={r.id}>
                {formatDate(r.service_date)} · {r.title}
              </option>
            ))}
          </Select>
        </Field>
        <FormErrors messages={orphans} />
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button>Cancelar</Button>
        </DialogClose>
        <Button type="submit" variant="primary" loading={upload.isPending}>
          Subir documento
        </Button>
      </DialogFooter>
    </form>
  )
}

export default DocumentUploadDialog
