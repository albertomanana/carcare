import { ChevronRight, Phone, ShieldOff, UserPlus, UsersRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { flattenPages, totalFromPages } from '@/api/hooks/shared'
import { useCustomers } from '@/api/hooks/workshop'
import type { Customer } from '@/api/types'
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

function AnonymizedBadge() {
  return (
    <Badge tone="neutral" size="sm" icon={<ShieldOff aria-hidden />}>
      Anonimizado
    </Badge>
  )
}

/** Tabla en escritorio (R4: Cliente · Teléfono · Email · NIF · Vehículos · Órdenes abiertas) y lista de 2 líneas en móvil. */
function CustomerList({ customers }: { customers: Customer[] }) {
  const ctx = useWorkspace()
  const href = (c: Customer) => `${ctx.base}/clientes/${c.id}`
  const counts = (c: Customer) =>
    [plural(c.vehicles_count, 'vehículo', 'vehículos'), c.open_orders_count > 0 ? plural(c.open_orders_count, 'orden abierta', 'órdenes abiertas') : null].filter(Boolean).join(' · ')
  return (
    <>
      <ul className="border-t border-line lg:hidden" aria-label="Clientes">
        {customers.map((c) => (
          <li
            key={c.id}
            className="relative flex items-center gap-3 border-b border-line px-1 py-2.5 transition-colors hover:bg-surface-2/60 has-[a.stretched:focus-visible]:outline-2 has-[a.stretched:focus-visible]:outline-accent"
          >
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <Link to={href(c)} className="stretched min-w-0 truncate font-medium text-fg outline-none after:absolute after:inset-0 after:content-['']">
                  {c.name}
                </Link>
                {c.anonymized_at && <AnonymizedBadge />}
              </div>
              <p className="truncate text-xs text-fg-muted">
                <span className="tabular">{[c.phone, counts(c)].filter(Boolean).join(' · ')}</span>
              </p>
            </div>
            {c.phone ? (
              <a href={telHref(c.phone)} className="relative z-10 grid size-11 shrink-0 place-items-center rounded-control text-fg-muted hover:bg-surface-2 hover:text-fg" aria-label={`Llamar a ${c.name}`}>
                <Phone aria-hidden className="size-4" />
              </a>
            ) : (
              <ChevronRight aria-hidden className="size-4 shrink-0 text-fg-subtle" />
            )}
          </li>
        ))}
      </ul>

      <table className="hidden w-full table-fixed border-y border-line text-sm lg:table">
        <caption className="sr-only">Clientes del taller</caption>
        <thead className="border-b border-line text-left text-xs text-fg-muted">
          <tr>
            <th scope="col" className="w-[27%] py-2.5 pr-3 font-medium">
              Cliente
            </th>
            <th scope="col" className="w-[15%] px-3 py-2.5 font-medium">
              Teléfono
            </th>
            <th scope="col" className="w-[25%] px-3 py-2.5 font-medium">
              Email
            </th>
            <th scope="col" className="w-[12%] px-3 py-2.5 font-medium">
              NIF / CIF
            </th>
            <th scope="col" className="w-[10%] px-3 py-2.5 text-right font-medium">
              Vehículos
            </th>
            <th scope="col" className="w-[11%] py-2.5 pl-3 text-right font-medium">
              Órdenes abiertas
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {customers.map((c) => (
            <tr key={c.id} className="transition-colors hover:bg-surface-2/50">
              <td className="py-2.5 pr-3">
                <span className="flex min-w-0 items-center gap-2">
                  <Link to={href(c)} className="min-w-0 truncate font-medium text-fg hover:underline">
                    {c.name}
                  </Link>
                  {c.anonymized_at && <AnonymizedBadge />}
                </span>
              </td>
              <td className="truncate px-3 py-2.5">
                {c.phone ? (
                  <a href={telHref(c.phone)} className="text-fg-muted hover:text-fg hover:underline tabular">
                    <span className="sr-only">Llamar al </span>
                    {c.phone}
                  </a>
                ) : (
                  <span className="text-fg-subtle">—</span>
                )}
              </td>
              <td className="truncate px-3 py-2.5">
                {c.email ? (
                  <a href={mailHref(c.email)} className="text-fg-muted hover:text-fg hover:underline">
                    <span className="sr-only">Escribir a </span>
                    {c.email}
                  </a>
                ) : (
                  <span className="text-fg-subtle">—</span>
                )}
              </td>
              <td className="truncate px-3 py-2.5 text-fg-muted">{c.tax_id ?? <span className="text-fg-subtle">—</span>}</td>
              <td className="px-3 py-2.5 text-right text-fg tabular">{c.vehicles_count}</td>
              <td className="py-2.5 pl-3 text-right tabular">{c.open_orders_count > 0 ? <span className="text-fg">{c.open_orders_count}</span> : <span className="text-fg-subtle">0</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

function CustomersSkeleton() {
  return (
    <div role="status" aria-live="polite" className="border-t border-line">
      <span className="sr-only">Cargando clientes…</span>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} aria-hidden className="space-y-2 border-b border-line px-1 py-3">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-64 max-w-full" />
        </div>
      ))}
    </div>
  )
}
