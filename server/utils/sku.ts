import { randomBytes } from 'node:crypto'

const limpiar = (t: string, n: number) =>
  t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, n) || 'X'

/** SKU legible y único: VQ-CAM-AZU-M-7F3A */
export function generarSku(nombre: string, color: string, talla: string): string {
  const azar = randomBytes(2).toString('hex').toUpperCase()
  return `VQ-${limpiar(nombre, 3)}-${limpiar(color, 3)}-${limpiar(talla, 3)}-${azar}`
}

export const escaparRegex = (texto: string) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
