import { Navigate, useLocation } from 'react-router'

/**
 * Pestañas que se juntaron en la simplificación (5.2 del informe de UX): Diario → Historial y Documentos → Datos.
 * Los enlaces y marcadores antiguos siguen funcionando: se redirige conservando la búsqueda y el ancla.
 *  - `diario?vista=lecturas` → `historial?ver=km`; `diario` → `historial?ver=todo`
 *  - `documentos?…` → `datos?…#documentos`
 */
export function LegacyTabRedirect({ to }: { to: 'historial' | 'datos' }) {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  let hash = location.hash
  if (to === 'historial') {
    params.set('ver', params.get('vista') === 'lecturas' ? 'km' : 'todo')
    params.delete('vista')
  } else if (!hash) {
    hash = '#documentos'
  }
  const search = params.toString()
  return <Navigate to={{ pathname: `../${to}`, search: search ? `?${search}` : '', hash }} relative="path" replace />
}

export default LegacyTabRedirect
