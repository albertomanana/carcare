import { Car, ChevronRight, ClipboardList, Mail, Phone, UserPlus, UsersRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { flattenPages, totalFromPages } from '@/api/hooks/shared'
import { useCustomers } from '@/api/hooks/workshop'
import type { Customer } from '@/api/types'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { SearchInput } from '@/components/ui/inputs'
import { LoadMore } from '@/components/ui/LoadMore'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState, NoResults } from '@/components/ui/States'
import { useWorkspace } from '@/features/workspace/workspace-context'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useSearchParam } from '@/hooks/useSearchParam'
import { plural } from '@/lib/text'
import { CustomerDialog } from './components/CustomerDialog'
import { mailHref } from './components/customerForm'
import { telHref } from './components/floor'

/** Clientes del taller: búsqueda por nombre, teléfono, email o NIF, con sus vehículos y órdenes abiertas. */
export default function CustomersPage() {
  const ctx = useWorkspace()
  const navigate = useNavigate()
  useDocumentTitle('Clientes')
  const [q, setQ] = useSearchParam('q')
  const [nuevo, setNuevo] = useSearchParam('nuevo')
  const [term, setTerm] = useState(q)
  const debounced = useDebouncedValue(term)
  const list = useCustomers(ctx.id, { search: q || undefined, per_page: 25 })
  const customers = flattenPages(list.data)
  const total = totalFromPages(list.data)
  const canOperate = ctx.can('operate')

  useEffect(() => {
    if (debounced !== q) setQ(debounced.trim() || null)
  }, [debounced, q, setQ])

  if (!ctx.isWorkshop)
    return (
      <>
        <PageHeader title="Clientes" />
        <EmptyState icon={<UsersRound />} title="Los clientes son del modo taller" description="Cambia a un espacio de taller para gestionar clientes." />
      </>
    )

  const openCreate = () => setNuevo('1')
  const createAction = canOperate && (
    <Button variant="primary" icon={<UserPlus aria-hidden />} onClick={openCreate}>
      Nuevo cliente
    </Button>
  )

  return (
    <>
      <PageHeader
        title="Clientes"
        description={total !== null && !q ? `${plural(total, 'cliente', 'clientes')} en ${ctx.workspace.name}.` : 'Personas y empresas que traen sus coches al taller.'}
        actions={createAction}
      />

      <SearchInput
        value={term}
        onValueChange={setTerm}
        aria-label="Buscar cliente por nombre, teléfono, email o NIF"
        placeholder="Nombre, teléfono, email o NIF…"
        className="mb-5 max-w-md"
      />

      {list.isPending ? (
        <CustomersSkeleton />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : customers.length === 0 ? (
        q ? (
          <NoResults
            what="clientes"
            onReset={() => {
              setTerm('')
              setQ(null)
            }}
          />
        ) : (
          <EmptyState
            icon={<UsersRound />}
            title="Aún no hay clientes"
            description="Da de alta a quien te trae el coche: así cada vehículo y cada orden quedan a su nombre y tienes su teléfono a mano para avisarle."
            action={createAction}
          />
        )
      ) : (
        <>
          {q && total !== null && (
            <p className="mb-3 text-sm text-fg-muted" aria-live="polite">
              {plural(total, 'cliente coincide', 'clientes coinciden')} con «{q}».
            </p>
          )}
          <CustomerList customers={customers} />
          <LoadMore hasNextPage={!!list.hasNextPage} isFetchingNextPage={list.isFetchingNextPage} fetchNextPage={list.fetchNextPage} shown={customers.length} total={total} what="clientes" />
        </>
      )}

      <CustomerDialog
        open={nuevo === '1' && canOperate}
        onOpenChange={(o) => !o && setNuevo(null)}
        customer={null}
        onSaved={(c) => navigate(`${ctx.base}/clientes/${c.id}`)}
      />
    </>
  )
}

function Counts({ customer }: { customer: Customer }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <Badge tone="neutral" size="sm" icon={<Car aria-hidden />}>
        {plural(customer.vehicles_count, 'vehículo', 'vehículos')}
      </Badge>
      {customer.open_orders_count > 0 && (
        <Badge tone="info" size="sm" icon={<ClipboardList aria-hidden />}>
          {plural(customer.open_orders_count, 'orden abierta', 'órdenes abiertas')}
        </Badge>
      )}
    </span>
  )
}

/** Tabla en escritorio, tarjetas en móvil. El nombre enlaza a la ficha; teléfono y email abren la app correspondiente. */
function CustomerList({ customers }: { customers: Customer[] }) {
  const ctx = useWorkspace()
  const href = (c: Customer) => `${ctx.base}/clientes/${c.id}`
  return (
    <>
      <ul className="space-y-2 lg:hidden" aria-label="Clientes">
        {customers.map((c) => (
          <li key={c.id} className="relative rounded-card border border-line bg-surface p-3 transition-colors hover:border-line-strong has-[a.stretched:focus-visible]:outline-2 has-[a.stretched:focus-visible]:outline-accent">
            <div className="flex items-start gap-3">
              <Avatar name={c.name} size="sm" />
              <div className="min-w-0 flex-1">
                <Link to={href(c)} className="stretched block truncate font-medium text-fg outline-none after:absolute after:inset-0 after:content-['']">
                  {c.name}
                </Link>
                {(c.phone || c.email) && <p className="truncate text-xs text-fg-muted">{[c.phone, c.email].filter(Boolean).join(' · ')}</p>}
                <div className="mt-2">
                  <Counts customer={c} />
                </div>
              </div>
              {c.phone ? (
                <a
                  href={telHref(c.phone)}
                  className="relative z-10 grid size-11 shrink-0 place-items-center rounded-control border border-line text-fg-muted hover:text-fg"
                  aria-label={`Llamar a ${c.name}`}
                >
                  <Phone aria-hidden className="size-4" />
                </a>
              ) : (
                <ChevronRight aria-hidden className="mt-2 size-4 shrink-0 text-fg-subtle" />
              )}
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-hidden rounded-card border border-line bg-surface lg:block">
        <table className="w-full table-fixed text-sm">
          <caption className="sr-only">Clientes del taller</caption>
          <thead className="border-b border-line bg-surface-2/60 text-left text-xs text-fg-subtle">
            <tr>
              <th scope="col" className="w-[30%] px-4 py-3 font-medium">
                Cliente
              </th>
              <th scope="col" className="w-[30%] px-3 py-3 font-medium">
                Contacto
              </th>
              <th scope="col" className="w-[14%] px-3 py-3 font-medium">
                NIF / CIF
              </th>
              <th scope="col" className="w-[26%] px-3 py-3 font-medium">
                Vehículos y órdenes
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {customers.map((c) => (
              <tr key={c.id} className="transition-colors hover:bg-surface-2/50">
                <td className="px-4 py-3">
                  <Link to={href(c)} className="flex min-w-0 items-center gap-3 font-medium text-fg hover:underline">
                    <Avatar name={c.name} size="sm" />
                    <span className="truncate">{c.name}</span>
                  </Link>
                </td>
                <td className="px-3 py-3">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    {c.phone && (
                      <a href={telHref(c.phone)} className="inline-flex w-fit items-center gap-1.5 text-fg-muted hover:text-fg">
                        <Phone aria-hidden className="size-3.5 shrink-0" />
                        <span className="sr-only">Llamar al </span>
                        <span className="tabular">{c.phone}</span>
                      </a>
                    )}
                    {c.email && (
                      <a href={mailHref(c.email)} className="inline-flex min-w-0 items-center gap-1.5 text-fg-muted hover:text-fg">
                        <Mail aria-hidden className="size-3.5 shrink-0" />
                        <span className="sr-only">Escribir a </span>
                        <span className="truncate">{c.email}</span>
                      </a>
                    )}
                    {!c.phone && !c.email && <span className="text-fg-subtle">Sin datos de contacto</span>}
                  </div>
                </td>
                <td className="truncate px-3 py-3 font-mono text-xs text-fg-muted">{c.tax_id ?? <span className="font-sans text-fg-subtle">—</span>}</td>
                <td className="px-3 py-3">
                  <Counts customer={c} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function CustomersSkeleton() {
  return (
    <div role="status" aria-live="polite" className="space-y-2">
      <span className="sr-only">Cargando clientes…</span>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} aria-hidden className="flex items-center gap-3 rounded-card border border-line bg-surface p-3">
          <Skeleton className="size-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-64 max-w-full" />
          </div>
        </div>
      ))}
    </div>
  )
}
