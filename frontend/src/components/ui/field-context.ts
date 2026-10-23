import { createContext, useContext } from 'react'

export interface FieldContextValue {
  id: string
  describedBy?: string
  invalid: boolean
  required?: boolean
}

export const FieldContext = createContext<FieldContextValue | null>(null)

/** Los controles (Input, Select…) leen de aquí su id, aria-invalid y aria-describedby. */
export function useFieldContext() {
  return useContext(FieldContext)
}
