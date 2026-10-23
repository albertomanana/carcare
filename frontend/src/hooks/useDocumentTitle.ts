import { useEffect } from 'react'

/** Fija el título de la pestaña: 'Garaje · CarCare'. */
export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    if (!title) return
    const previous = document.title
    document.title = `${title} · CarCare`
    return () => {
      document.title = previous
    }
  }, [title])
}
