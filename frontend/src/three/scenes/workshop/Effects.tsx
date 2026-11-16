/**
 * Posprocesado del taller (solo en el chunk 3D): bloom selectivo por luminancia y viñeta.
 *  - Solo florece lo que supera el umbral: las líneas del suelo, las lámparas de estado, las balizas, la pantalla del
 *    terminal y la luz del almacén, que se pintan sin tone mapping y con intensidad > 1 cuando el bloom está activo.
 *  - El EffectComposer desactiva el tone mapping del renderizador; se aplica al final (Neutral, el mismo del lienzo).
 *  - Funciona con `frameloop="demand"`: el compositor pinta en el mismo fotograma que pide la escena.
 * Se carga aparte (import diferido) y quien lo monta decide si se usa (pantallas pequeñas y movimiento reducido van sin él: quedan los halos de `kit.ts`).
 */
import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'

export function WorkshopEffects({ dark }: { dark: boolean }) {
  return (
    <EffectComposer multisampling={4} enableNormalPass={false}>
      <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.2} intensity={dark ? 0.9 : 0.55} radius={0.62} />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <Vignette eskil={false} offset={0.28} darkness={dark ? 0.55 : 0.32} />
    </EffectComposer>
  )
}
