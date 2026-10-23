/** Solo rutas internas de la app (evita redirecciones abiertas tras el login). */
export function safeRedirect(value: string | null): string | null {
  if (!value) return null
  if (!value.startsWith('/app')) return null
  if (value.startsWith('//')) return null
  return value
}

/** Estado de navegación que indica «ya se ha guardado»: el aviso de cambios sin guardar no la bloquea. */
export const AFTER_SAVE = { skipUnsavedGuard: true } as const

export function isGuardSkipped(state: unknown): boolean {
  return typeof state === 'object' && state !== null && (state as { skipUnsavedGuard?: unknown }).skipUnsavedGuard === true
}
