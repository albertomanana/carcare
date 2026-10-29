import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'

// La API de Laravel corre en :8000. En desarrollo el navegador solo habla con Vite (:5173)
// y Vite reenvía /api y /sanctum: mismo origen, así las cookies de sesión de Sanctum funcionan sin CORS.
const API_TARGET = process.env.VITE_API_TARGET ?? 'http://127.0.0.1:8000'

// Chunks pesados que solo deben descargar las pantallas que los usan (R11): three.js + R3F + drei, y Recharts + d3.
const isThree = (id: string) => id.includes('node_modules/three') || id.includes('@react-three')
const isCharts = (id: string) => id.includes('node_modules/recharts') || id.includes('node_modules/d3-')
const HEAVY_GROUPS = [
  { name: 'three', test: isThree },
  { name: 'charts', test: isCharts },
]

/**
 * Falla la build si una pantalla fuera a descargar three.js o Recharts sin usarlos (R11).
 * Un grupo de `codeSplitting` se lleva también las dependencias de lo que captura. Si una de ellas la importa además
 * otro chunk (p. ej. `clsx`, que usan Recharts y `cn`), ese chunk importa el grupo entero; si está en el arranque,
 * `index.html` lo precarga en todas las pantallas. Así pasó hasta el 28/10 sin que nada avisara.
 */
function heavyChunkGuard(): Plugin {
  const short = (id: string) => id.replace(/\\/g, '/').replace(/^.*?node_modules\//, '').replace(/^.*?\/src\//, 'src/')
  return {
    name: 'carcare:heavy-chunk-guard',
    apply: 'build',
    generateBundle(_, bundle) {
      const chunks = Object.values(bundle).flatMap((c) => (c.type === 'chunk' ? [c] : []))
      const owner = new Map<string, string>()
      for (const c of chunks) for (const id of c.moduleIds) owner.set(id, c.fileName)
      const problems: string[] = []
      for (const group of HEAVY_GROUPS) {
        for (const chunk of chunks.filter((c) => c.moduleIds.some(group.test))) {
          for (const id of chunk.moduleIds) {
            if (group.test(id)) continue
            const outside = (this.getModuleInfo(id)?.importers ?? []).filter((i) => owner.has(i) && owner.get(i) !== chunk.fileName)
            if (outside.length > 0) problems.push(`- "${short(id)}" ha caído en "${group.name}" y también lo importa ${short(outside[0])} (${owner.get(outside[0])})`)
          }
        }
      }
      if (problems.length > 0) {
        this.error(
          `Dependencias compartidas dentro de un chunk pesado: esas pantallas descargarían three.js o Recharts sin usarlos.\n${problems.join('\n')}\n` +
            'Añade el paquete al grupo "vendor" de build.rolldownOptions.output.codeSplitting en vite.config.ts.',
        )
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), heavyChunkGuard()],
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
        // Cada grupo arrastra también las dependencias de sus módulos, así que lo que comparten con el resto de la app
        // va en un grupo de más prioridad: React y su planificador ("react") y las librerías pequeñas que usan a la vez
        // la app, Recharts y R3F ("vendor": `clsx` lo importan Recharts y `cn`; `use-sync-external-store`, zustand y
        // Recharts). Sin "vendor", la cadena Button → charts → three hacía que index.html precargara 1,4 MB en todas
        // las pantallas. `heavyChunkGuard` falla la build si vuelve a pasar con otra dependencia.
        codeSplitting: {
          groups: [
            { name: 'react', test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 30 },
            { name: 'vendor', test: /[\\/]node_modules[\\/](clsx|tailwind-merge|use-sync-external-store)[\\/]/, priority: 25 },
            { name: 'three', test: isThree, priority: 20 },
            { name: 'charts', test: isCharts, priority: 10 },
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
