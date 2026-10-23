/** Acceso a localStorage tolerante a fallos (modo privado, cookies bloqueadas…). */
export function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    /* sin almacenamiento: la preferencia solo dura la sesión */
  }
}

export const STORAGE_KEYS = {
  theme: 'carcare.theme',
  lastWorkspace: 'carcare.lastWorkspace',
  sidebarCollapsed: 'carcare.sidebarCollapsed',
  zoneView: 'carcare.zoneView',
  ordersView: 'carcare.ordersView',
  lastVehicle: (ws: number) => `carcare.lastVehicle.${ws}`,
} as const
