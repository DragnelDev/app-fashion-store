import { IVA_TASA } from './bolivia'

/**
 * Aritmética monetaria en centavos enteros para evitar errores de coma flotante.
 * Los precios en BD y API se expresan en Bs. con 2 decimales.
 */
export const aCentavos = (bs: number): number => Math.round((bs + Number.EPSILON) * 100)
export const aBs = (centavos: number): number => centavos / 100

/** true si el monto tiene como máximo 2 decimales. */
export const tieneMaximo2Decimales = (bs: number): boolean => Math.abs(bs * 100 - Math.round(bs * 100)) < 1e-6

export interface Totales {
  /** Suma de ítems, IVA incluido. */
  subtotal: number
  envio: number
  /** Total a pagar (subtotal + envío), IVA incluido. */
  total: number
  ivaTasa: number
  /** IVA contenido en el total: 13% del total facturado (débito fiscal). */
  iva: number
  /** Total menos IVA (importe neto). */
  importeSinIva: number
}

/**
 * En Bolivia el precio al público incluye el IVA: el débito fiscal es el 13% del importe
 * total facturado (no se suma encima del precio). Redondeo al centavo.
 */
export function calcularTotales(subtotalBs: number, envioBs: number): Totales {
  const subtotalC = aCentavos(subtotalBs)
  const envioC = aCentavos(envioBs)
  const totalC = subtotalC + envioC
  const ivaC = Math.round(totalC * IVA_TASA)
  return {
    subtotal: aBs(subtotalC),
    envio: aBs(envioC),
    total: aBs(totalC),
    ivaTasa: IVA_TASA,
    iva: aBs(ivaC),
    importeSinIva: aBs(totalC - ivaC),
  }
}

const formatoBs = new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' })
/** 1234.5 -> "Bs 1.234,50" */
export const formatearBs = (valor: number): string => formatoBs.format(valor)
