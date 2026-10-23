import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'motion/react'
import { useState } from 'react'
import { RouterProvider } from 'react-router/dom'
import { isApiError } from '@/api/client'
import { Toaster } from '@/components/ui/Toaster'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { createAppRouter } from './router'
import { ThemeProvider } from './ThemeProvider'

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // No reintentar errores que no se arreglan solos (sin sesión, permisos, no existe, validación)
        retry: (count, error) => {
          if (isApiError(error) && [401, 403, 404, 409, 422].includes(error.status)) return false
          return count < 2
        },
        refetchOnWindowFocus: true,
      },
      mutations: { retry: false },
    },
  })
}

const router = createAppRouter()

export default function App() {
  const [queryClient] = useState(createQueryClient)
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <MotionConfig reducedMotion="user">
          <TooltipProvider delayDuration={300}>
            <AuthProvider>
              <RouterProvider router={router} />
            </AuthProvider>
            <Toaster />
          </TooltipProvider>
        </MotionConfig>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
