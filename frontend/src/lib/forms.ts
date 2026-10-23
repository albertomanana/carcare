import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { toast } from 'sonner'
import { errorMessage, isApiError } from '@/api/client'

/**
 * Lleva los errores 422 del servidor a los campos del formulario.
 * `map` traduce nombres de campo del API a nombres del formulario (p. ej. 'items.0.name').
 * Devuelve los mensajes que no se pudieron asociar a ningún campo conocido.
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  knownFields: readonly string[],
  map: Record<string, string> = {},
): string[] {
  if (!isApiError(error) || error.status !== 422) return []
  const orphan: string[] = []
  for (const [field, messages] of Object.entries(error.errors)) {
    const target = map[field] ?? field
    const root = target.split('.')[0]
    if (knownFields.includes(target) || knownFields.includes(root)) {
      setError(target as Path<T>, { type: 'server', message: messages[0] })
    } else {
      orphan.push(...messages)
    }
  }
  return orphan
}

/** 422 por retroceso/incoherencia de kilometraje: se confirma con confirm_mileage_drop. */
export function isMileageConflict(error: unknown): string | null {
  if (!isApiError(error) || error.status !== 422) return null
  const msg = error.errors.mileage?.[0] ?? error.errors.mileage_in?.[0] ?? error.errors.completed_mileage?.[0]
  if (!msg) return null
  return /conf[ií]rmalo|no cuadra|anterior|retroce/i.test(msg) ? msg : null
}

/**
 * Tratamiento estándar del error de una mutación de formulario:
 * 422 ⇒ errores junto a cada campo (y el resto como lista); otros ⇒ toast con el mensaje del servidor.
 */
export function handleFormError<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  knownFields: readonly string[],
  setOrphans: (messages: string[]) => void,
  map: Record<string, string> = {},
) {
  if (isApiError(error) && error.status === 422) {
    const rest = applyServerErrors(error, setError, knownFields, map)
    setOrphans(rest.length || Object.keys(error.errors).length ? rest : [error.message])
    return
  }
  toast.error(errorMessage(error))
}
