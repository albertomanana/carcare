import { LogOut, Moon, Settings, Sun, SunMoon } from 'lucide-react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useLogout } from '@/api/hooks/auth'
import { nextThemeMode, THEME_MODE_ACTION, type ThemeMode, useTheme } from '@/app/theme-context'
import { initials } from '@/lib/text'
import { Avatar } from '@/components/ui/Avatar'
import { IconButton } from '@/components/ui/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { useAuth } from '@/features/auth/auth-context'
import { STORAGE_KEYS, writeStorage } from '@/lib/storage'

const MODE_ICON = { sun: SunMoon, light: Sun, dark: Moon } as const

/** Icono de un modo de tema (según el sol, claro u oscuro). */
export function ThemeModeIcon({ mode }: { mode: ThemeMode }) {
  const Icon = MODE_ICON[mode]
  return <Icon aria-hidden />
}

export function ThemeToggle() {
  const { mode, cycleMode } = useTheme()
  const next = nextThemeMode(mode)
  return (
    <IconButton label={THEME_MODE_ACTION[next]} onClick={cycleMode}>
      <ThemeModeIcon mode={next} />
    </IconButton>
  )
}

/** Menú del avatar: ajustes, tema y salir. El tema ya no está en la barra superior (5.6). */
export function UserMenu() {
  const { user } = useAuth()
  const { mode, cycleMode } = useTheme()
  const nextMode = nextThemeMode(mode)
  const logout = useLogout()
  const navigate = useNavigate()

  const handleLogout = () => {
    writeStorage(STORAGE_KEYS.lastWorkspace, null)
    logout.mutate(undefined, {
      onSuccess: () => toast.success('Sesión cerrada. ¡Hasta pronto!'),
      onSettled: () => navigate('/', { replace: true }),
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="grid size-12 shrink-0 place-items-center rounded-full transition-[background-color,scale] duration-150 hover:bg-accent-soft active:scale-90 data-[state=open]:bg-accent-soft lg:size-10"
        aria-label={`${initials(user?.name)} · Menú de usuario de ${user?.name ?? ''}`}
      >
        <Avatar name={user?.name} size="sm" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64">
        <div className="flex items-center gap-3 px-2.5 py-2">
          <Avatar name={user?.name} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-fg">{user?.name}</p>
            <p className="truncate text-xs text-fg-subtle">{user?.email}</p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={<Settings aria-hidden />} onSelect={() => navigate('/app/ajustes')}>
          Ajustes de la cuenta
        </DropdownMenuItem>
        <DropdownMenuItem icon={<ThemeModeIcon mode={nextMode} />} onSelect={cycleMode}>
          {THEME_MODE_ACTION[nextMode]}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={<LogOut aria-hidden />} onSelect={handleLogout} disabled={logout.isPending}>
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
