import * as Popover from '@radix-ui/react-popover'
import { useQueryClient } from '@tanstack/react-query'
import { Bell, BellOff } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { errorMessage } from '@/api/client'
import { useMarkNotificationsRead, useNotifications, useNotificationsCount } from '@/api/hooks/notifications'
import { flattenPages } from '@/api/hooks/shared'
import type { AppNotification } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/States'
import { iconButtonClasses } from '@/components/ui/variants'
import { cn } from '@/lib/cn'
import { formatRelativeTime } from '@/lib/format'
import { bellLabel, notificationHref, unreadAnnouncement, unreadBadge } from '@/lib/notifications'

/**
 * E16‑10 · Campana de avisos en la cabecera de los dos modos (contrato §3.13.8).
 * - El contador se pide cada 60 s solo con la pestaña visible y se refresca al volver a ella.
 * - El listado solo se pide al abrir. Esc o clic fuera cierran y el foco vuelve a la campana (Radix).
 * - Cuando llega un aviso se refresca lo que puede estar a la vista: las solicitudes abiertas en pantalla.
 */
export function NotificationBell() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const count = useNotificationsCount()
  const unread = count.data?.unread ?? 0
  const badge = unreadBadge(unread)
  const [announcement, setAnnouncement] = useState('')
  const previous = useRef<number | null>(null)

  useEffect(() => {
    if (!count.isSuccess) return
    const before = previous.current
    previous.current = unread
    if (before === null || unread <= before) return
    setAnnouncement(unreadAnnouncement(unread))
    void qc.invalidateQueries({ queryKey: ['notifications', 'list'] })
    void qc.invalidateQueries({ queryKey: ['repair-requests'] })
    void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'workspaces' && q.queryKey[2] === 'repair-requests' })
  }, [count.isSuccess, unread, qc])

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger aria-label={bellLabel(unread)} title={bellLabel(unread)} className={iconButtonClasses({ variant: 'ghost', className: 'data-[state=open]:bg-surface-2 data-[state=open]:text-fg' })}>
        <Bell aria-hidden />
        {badge && (
          <span
            aria-hidden
            className="absolute right-0.5 top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-canvas bg-fg px-1 text-[10px] font-semibold leading-none text-canvas tabular"
          >
            {badge}
          </span>
        )}
      </Popover.Trigger>
      {/* Fuera del botón para que el aviso se anuncie sin mover el foco */}
      <span role="status" className="sr-only">
        {announcement}
      </span>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          collisionPadding={12}
          aria-label="Notificaciones"
          className="z-[60] flex w-[min(24rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-card border border-line bg-surface-2 shadow-2xl shadow-black/30 outline-none data-[state=open]:animate-pop-in"
        >
          <NotificationPanel unread={unread} onClose={() => setOpen(false)} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function NotificationPanel({ unread, onClose }: { unread: number; onClose: () => void }) {
  const list = useNotifications(true)
  const mark = useMarkNotificationsRead()
  const titleId = useId()
  const notifications = flattenPages(list.data)

  const markAll = () => mark.mutate({}, { onError: (error) => toast.error(errorMessage(error)) })
  const markOne = (id: string) => mark.mutate({ ids: [id] }, { onError: (error) => toast.error(errorMessage(error)) })

  return (
    <>
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-line px-4 py-2">
        <h2 id={titleId} className="font-display text-base font-semibold text-fg-warm">
          Notificaciones
        </h2>
        {unread > 0 && (
          <Button variant="ghost" size="sm" className="-mr-2" loading={mark.isPending} onClick={markAll}>
            Marcar todas como leídas
          </Button>
        )}
      </div>

      <div className="max-h-[min(60dvh,26rem)] min-h-0 overflow-y-auto overscroll-contain">
        {list.isPending ? (
          <NotificationsSkeleton />
        ) : list.isError ? (
          <div className="p-3">
            <ErrorState compact error={list.error} onRetry={() => void list.refetch()} />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <BellOff aria-hidden className="size-6 text-fg-subtle" />
            <p className="text-sm font-medium text-fg">No tienes avisos</p>
            <p className="text-sm text-fg-muted">Aquí verás las respuestas a tus solicitudes de reparación.</p>
          </div>
        ) : (
          <ul aria-labelledby={titleId} className="divide-y divide-line">
            {notifications.map((n) => (
              <NotificationRow key={n.id} notification={n} onMarkRead={markOne} onClose={onClose} />
            ))}
          </ul>
        )}
      </div>

      {list.hasNextPage && (
        <div className="border-t border-line p-2">
          <Button variant="ghost" size="sm" block loading={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
            Ver más
          </Button>
        </div>
      )}
    </>
  )
}

/** Sin leer: punto, negrita y texto para lector de pantalla (nunca solo color). */
function NotificationRow({ notification: n, onMarkRead, onClose }: { notification: AppNotification; onMarkRead: (id: string) => void; onClose: () => void }) {
  const isUnread = !n.read_at
  const href = notificationHref(n)
  const body = (
    <>
      <span aria-hidden className={cn('mt-1.5 size-2 shrink-0 rounded-full', isUnread ? 'bg-fg' : 'bg-transparent')} />
      <span className="min-w-0 flex-1">
        {isUnread && <span className="sr-only">Sin leer: </span>}
        <span className={cn('block text-sm', isUnread ? 'font-medium text-fg' : 'text-fg-muted')}>{n.summary}</span>
        <span className="mt-0.5 block text-xs text-fg-subtle tabular">{formatRelativeTime(n.created_at, undefined, { pastOnly: true })}</span>
      </span>
    </>
  )
  const rowClasses = 'flex w-full items-start gap-2.5 px-4 py-3 text-left'
  const interactive = 'transition-[background-color] duration-150 hover:bg-surface-3 focus-visible:bg-surface-3'

  if (href)
    return (
      <li>
        <Link
          to={href}
          className={cn(rowClasses, interactive, '-outline-offset-2')}
          onClick={() => {
            if (isUnread) onMarkRead(n.id)
            onClose()
          }}
        >
          {body}
        </Link>
      </li>
    )
  // Sin solicitud a la que ir (ya no existe): si está sin leer, se puede marcar; si no, es solo texto.
  return (
    <li>
      {isUnread ? (
        <button type="button" className={cn(rowClasses, interactive, '-outline-offset-2')} onClick={() => onMarkRead(n.id)}>
          {body}
        </button>
      ) : (
        <div className={rowClasses}>{body}</div>
      )}
    </li>
  )
}

function NotificationsSkeleton() {
  return (
    <div role="status" aria-live="polite" className="divide-y divide-line">
      <span className="sr-only">Cargando notificaciones…</span>
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} aria-hidden className="space-y-2 px-4 py-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
  )
}
