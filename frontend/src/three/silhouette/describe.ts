import type { BodyType } from '@/api/types'
import { BODY_LABEL } from '@/lib/labels'
import { colorName } from '../color'
import { resolveBody, resolveColor } from '../car/specs'

/** Texto alternativo por defecto: "Compacto gris oscuro". */
export function describeCar(bodyType: BodyType | null, colorHex: string | null) {
  return `${BODY_LABEL[resolveBody(bodyType)]} ${colorName(resolveColor(colorHex))}`
}
