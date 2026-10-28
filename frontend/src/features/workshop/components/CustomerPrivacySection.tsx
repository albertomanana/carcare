import { Download, ShieldOff, Trash2 } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { errorMessage } from '@/api/client'
import { useDeleteCustomer } from '@/api/hooks/workshop'
import type { Customer } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useWorkspace } from '@/features/workspace/workspace-context'
import { formatDate, todayISO } from '@/lib/format'
import { plural } from '@/lib/text'
import { exportFileName, privacyErrorMessage, saveJson, useAnonymizeCustomer, useExportCustomer } from './customerPrivacy'

/**
 * "Datos personales" de la ficha del cliente (RGPD, contrato §3.10.1): exportar, anonimizar y eliminar.
 * Solo se pinta para owner y manager (`manage`); el servidor lo vuelve a comprobar (403).
 */
export function CustomerPrivacySection({ customer }: { customer: Customer }) {
  const ctx = useWorkspace()
  const navigate = useNavigate()
  const exporter = useExportCustomer()
  const anonymize = useAnonymizeCustomer(ctx.id)
  const remove = useDeleteCustomer(ctx.id)
  const [confirm, setConfirm] = useState<'anonymize' | 'delete' | null>(null)
  const openOrders = customer.open_orders_count
  const openText = plural(openOrders, 'orden abierta', 'órdenes abiertas')

  const doExport = () =>
    exporter.mutate(customer.id, {
      onSuccess: (data) => {
        const filename = exportFileName(customer.id, todayISO())
        saveJson(data, filename)
        toast.success('Datos exportados', { description: `Se ha descargado ${filename}.` })
      },
      onError: (err) => toast.error('No se pudieron exportar los datos', { description: privacyErrorMessage(err) }),
    })

  const doAnonymize = () =>
    anonymize.mutate(customer.id, {
      onSuccess: () => {
        setConfirm(null)
        toast.success('Cliente anonimizado', { description: 'Su nombre y su contacto se han borrado. El historial técnico se conserva.' })
      },
      onError: (err) => {
        setConfirm(null)
        toast.error('No se pudo anonimizar', { description: privacyErrorMessage(err) })
      },
    })

  const doDelete = () =>
    remove.mutate(customer.id, {
      onSuccess: () => {
        toast.success(`${customer.name} eliminado de tus clientes`)
        navigate(`${ctx.base}/clientes`, { replace: true })
      },
      onError: (err) => {
        setConfirm(null)
        toast.error('No se pudo eliminar el cliente', { description: errorMessage(err) })
      },
    })

  return (
    <section aria-labelledby="datos-personales-title" className="min-w-0">
      <h2 id="datos-personales-title" className="font-display text-lg font-semibold tracking-tight text-fg-warm">
        Datos personales
      </h2>
      <p className="mt-0.5 text-sm text-fg-muted">Lo que puedes hacer si el cliente ejerce sus derechos de protección de datos.</p>

      <div className="mt-3 divide-y divide-line border-y border-line">
        <PrivacyRow
          title="Exportar datos"
          text="Descarga un archivo JSON con su contacto, sus vehículos y sus órdenes con las líneas, para entregárselo."
          action={
            <Button icon={<Download aria-hidden />} loading={exporter.isPending} onClick={doExport}>
              Exportar datos
            </Button>
          }
        />

        {customer.anonymized_at ? (
          <PrivacyRow
            title="Anonimizado"
            text={`El ${formatDate(customer.anonymized_at, 'long')} se borraron su nombre, teléfono, email, NIF y notas. El historial técnico se conserva y no se puede deshacer.`}
          />
        ) : (
          <PrivacyRow
            title="Anonimizar"
            text={
              openOrders > 0
                ? `No se puede anonimizar mientras tenga ${openText}. Entrégalas o cancélalas antes.`
                : 'Borra su nombre y su contacto y conserva el historial técnico de sus coches. No se puede deshacer.'
            }
            action={
              openOrders > 0 ? undefined : (
                <Button icon={<ShieldOff aria-hidden />} className="text-danger" onClick={() => setConfirm('anonymize')}>
                  Anonimizar…
                </Button>
              )
            }
          />
        )}

        <PrivacyRow
          title="Eliminar cliente"
          text={
            openOrders > 0
              ? `No se puede eliminar mientras tenga ${openText}.`
              : 'Sus vehículos se quedan en el taller sin cliente y las órdenes cerradas se conservan. No se puede deshacer.'
          }
          action={
            openOrders > 0 ? undefined : (
              <Button icon={<Trash2 aria-hidden />} className="text-danger" onClick={() => setConfirm('delete')}>
                Eliminar…
              </Button>
            )
          }
        />
      </div>

      <ConfirmDialog
        open={confirm === 'anonymize'}
        onOpenChange={(o) => setConfirm(o ? 'anonymize' : null)}
        title={`¿Anonimizar a ${customer.name}?`}
        description="Es irreversible: después no hay forma de recuperar sus datos."
        confirmLabel="Anonimizar definitivamente"
        loading={anonymize.isPending}
        onConfirm={doAnonymize}
      >
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="font-medium text-fg">Se borra</dt>
            <dd className="text-fg-muted">Su nombre (pasa a ser «Cliente anonimizado»), teléfono, email, NIF/CIF y notas.</dd>
          </div>
          <div>
            <dt className="font-medium text-fg">Se conserva</dt>
            <dd className="text-fg-muted">
              {customer.vehicles_count > 0
                ? `Sus ${plural(customer.vehicles_count, 'vehículo', 'vehículos')} con matrícula y bastidor, sus órdenes con líneas e importes, los kilómetros, las intervenciones y los documentos.`
                : 'Sus órdenes con líneas e importes.'}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-fg">No se toca</dt>
            <dd className="text-fg-muted">
              Lo que el taller haya escrito a mano en órdenes o vehículos (título, síntoma, diagnóstico, apodo) ni los archivos adjuntos. Revísalos si mencionan su nombre.
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-sm text-fg-muted">
          Conviene exportar sus datos antes.{' '}
          <button type="button" onClick={doExport} disabled={exporter.isPending} className="font-medium text-accent-ink underline-offset-2 hover:underline disabled:opacity-60">
            {exporter.isPending ? 'Exportando…' : 'Exportar ahora'}
          </button>
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirm === 'delete'}
        onOpenChange={(o) => setConfirm(o ? 'delete' : null)}
        title={`¿Eliminar a ${customer.name}?`}
        description={`${
          customer.vehicles_count ? `Sus ${plural(customer.vehicles_count, 'vehículo', 'vehículos')} seguirán en el taller, pero sin cliente. ` : ''
        }Las órdenes cerradas se conservan. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar cliente"
        loading={remove.isPending}
        onConfirm={doDelete}
      />
    </section>
  )
}

function PrivacyRow({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <h3 className="text-sm font-medium text-fg">{title}</h3>
        <p className="mt-0.5 text-sm text-fg-muted">{text}</p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
