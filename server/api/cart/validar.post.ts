import { readBody } from 'h3'
import { carritoValidarSchema } from '../../../shared/schemas/order'
import type { CarritoValidacionDTO } from '../../../shared/types'
import { Product } from '../../models'
import { defineApiHandler } from '../../utils/handler'
import { limitarPeticiones } from '../../utils/rateLimit'

/**
 * POST /api/cart/validar — stock y precio vigentes de los ítems del carrito (los de localStorage
 * pueden estar desactualizados). Solo informativo: la compra siempre se revalida en POST /api/orders.
 */
export default defineApiHandler(async (event): Promise<CarritoValidacionDTO> => {
  limitarPeticiones(event, { clave: 'cart-validar', max: 120, ventanaMs: 60_000 })
  const { items } = carritoValidarSchema.parse(await readBody(event))

  const productos = await Product.find({ _id: { $in: [...new Set(items.map((i) => i.productoId))] }, estadoRegistro: 'activo' })
  const porId = new Map(productos.map((p) => [p.id as string, p]))
  return {
    items: items.map((i) => {
      const p = porId.get(i.productoId)
      const v = p?.variantes.find((x) => x.sku === i.sku.toUpperCase())
      return { productoId: i.productoId, sku: i.sku, disponible: v?.stock ?? 0, precio: p?.precio ?? 0, activo: !!(p && v) }
    }),
  }
})
