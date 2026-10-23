import { LogOut, Moon, Settings, Sun } from 'lucide-react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useLogout } from '@/api/hooks/auth'
import { useTheme } from '@/app/theme-context'
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

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  return (
    <IconButton label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'} onClick={toggleTheme}>
      {theme === 'dark' ? <Sun aria-hidden /> : <Moon aria-hidden />}
    </IconButton>
  )
}

export function UserMenu() {
  const { user } = useAuth()
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
        className="grid size-11 place-items-center rounded-full transition-colors hover:bg-surface-2 data-[state=open]:bg-surface-2 md:size-10"
        aria-label={`Menú de usuario de ${user?.name ?? ''}`}
      >
        <Avatar name={user?.name} size="sm" highlight />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64">
        <div className="flex items-center gap-3 px-2.5 py-2">
          <Avatar name={user?.name} highlight />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-fg">{user?.name}</p>
            <p className="truncate text-xs text-fg-subtle">{user?.email}</p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={<Settings aria-hidden />} onSelect={() => navigate('/app/ajustes')}>
          Ajustes de la cuenta
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={<LogOut aria-hidden />} onSelect={handleLogout} disabled={logout.isPending}>
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
