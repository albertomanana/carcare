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
  /** Último tema visto ('light' | 'dark'): index.html lo aplica antes de pintar. */
  theme: 'carcare.theme',
  /** 'light' | 'dark' si el tema está fijado en Ajustes; sin valor, sigue al sol. */
  themeMode: 'carcare.themeMode',
  lastWorkspace: 'carcare.lastWorkspace',
  sidebarCollapsed: 'carcare.sidebarCollapsed',
  zoneView: 'carcare.zoneView',
  ordersView: 'carcare.ordersView',
  /** 'off' si en la portada se pulsó "Detener animación": el coche 3D ya no se monta solo. */
  landing3d: 'carcare.landing3d',
  lastVehicle: (ws: number) => `carcare.lastVehicle.${ws}`,
  /** '1' si se ocultó la guía de primeros pasos de ese espacio (o de ese vehículo: `ws.v12`). */
  firstStepsHidden: (scope: string) => `carcare.firstSteps.hidden.${scope}`,
  /** '1' si el taller confirmó su número de elevadores en la guía de primeros pasos. */
  baysConfirmed: (ws: number) => `carcare.firstSteps.bays.${ws}`,
} as const
