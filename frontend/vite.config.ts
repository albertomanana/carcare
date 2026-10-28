import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

// La API de Laravel corre en :8000. En desarrollo el navegador solo habla con Vite (:5173)
// y Vite reenvía /api y /sanctum: mismo origen, así las cookies de sesión de Sanctum funcionan sin CORS.
const API_TARGET = process.env.VITE_API_TARGET ?? 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: false },
      '/sanctum': { target: API_TARGET, changeOrigin: false },
    },
  },
  build: {
    rolldownOptions: {
      output: {
        // El 3D y los gráficos van en su propio chunk: la app arranca sin esperar a three.js ni a Recharts.
        // Cada grupo arrastra también las dependencias de sus módulos, así que lo compartido (React y su planificador)
        // va en un grupo de más prioridad. Con el antiguo `manualChunks`, React acababa dentro de "charts" y
        // `scheduler` dentro de "three", y la entrada importaba los dos: todas las pantallas descargaban three.js.
        codeSplitting: {
          groups: [
            { name: 'react', test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 30 },
            { name: 'three', test: (id) => id.includes('node_modules/three') || id.includes('@react-three'), priority: 20 },
            { name: 'charts', test: (id) => id.includes('node_modules/recharts') || id.includes('node_modules/d3-'), priority: 10 },
          ],
        },
        // La fachada ligera `src/three/index.tsx` (imagen de la portada, siluetas y envoltorios diferidos) no lleva
        // three.js, pero rolldown la nombraría "three-*.js" por su carpeta. Con otro nombre, "ningún three-*.js en la red"
        // significa de verdad "no se ha descargado three.js" (R11).
        chunkFileNames: (chunk) =>
          chunk.name === 'three' && !chunk.moduleIds.some((id) => id.includes('node_modules')) ? 'assets/visor3d-[hash].js' : 'assets/[name]-[hash].js',
      },
    },
  },
})
