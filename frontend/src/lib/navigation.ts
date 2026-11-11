/** Solo rutas internas de la app (evita redirecciones abiertas tras el login). */
export function safeRedirect(value: string | null): string | null {
  if (!value) return null
  if (!value.startsWith('/app')) return null
  if (value.startsWith('//')) return null
  return value
}

/**
 * Destino tras entrar: la ruta pedida solo si es de un espacio de esta cuenta.
 * Tras caducar la sesión y entrar con otra cuenta, `volver` apunta a un espacio ajeno (404).
 */
export function redirectAfterLogin(value: string | null, workspaces: ReadonlyArray<{ id: number }>): string {
  const safe = safeRedirect(value)
  if (!safe) return '/app'
  const ws = /^\/app\/(\d+)(?=[/?#]|$)/.exec(safe)?.[1]
  if (ws && !workspaces.some((w) => String(w.id) === ws)) return '/app'
  return safe
}

/** Estado de navegación que indica «ya se ha guardado»: el aviso de cambios sin guardar no la bloquea. */
export const AFTER_SAVE = { skipUnsavedGuard: true } as const

export function isGuardSkipped(state: unknown): boolean {
  return typeof state === 'object' && state !== null && (state as { skipUnsavedGuard?: unknown }).skipUnsavedGuard === true
}
