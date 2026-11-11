import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { readStorage, STORAGE_KEYS, writeStorage } from '@/lib/storage'

/** Ocultar la guía de primeros pasos (se guarda en este navegador), con "Deshacer" en el aviso. */
export function useHiddenGuide(scope: string) {
  const key = STORAGE_KEYS.firstStepsHidden(scope)
  const [hidden, setHidden] = useState(() => readStorage(key) === '1')
  const hide = useCallback(() => {
    writeStorage(key, '1')
    setHidden(true)
    toast('Guía de primeros pasos oculta', {
      action: {
        label: 'Deshacer',
        onClick: () => {
          writeStorage(key, null)
          setHidden(false)
        },
      },
    })
  }, [key])
  return { hidden, hide }
}
