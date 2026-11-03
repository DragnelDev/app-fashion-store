import { getValidatedQuery } from 'h3'
import { adminListadoQuerySchema } from '../../../../shared/schemas/product'
import type { Paginado, ProductoDTO } from '../../../../shared/types'
import { Product } from '../../../models'
import { requireAdmin } from '../../../utils/auth'
import { defineApiHandler } from '../../../utils/handler'
import { escaparRegex } from '../../../utils/sku'

/** GET /api/admin/products — listado de administración (incluye productos inactivos). */
export default defineApiHandler(async (event): Promise<Paginado<ProductoDTO>> => {
  await requireAdmin(event)
  const { q, estado, page, limit } = await getValidatedQuery(event, adminListadoQuerySchema.parse)

  const filtro: Record<string, unknown> = {}
  if (estado) filtro.estadoRegistro = estado
  if (q) {
    const rx = new RegExp(escaparRegex(q), 'i')
    filtro.$or = [{ nombre: rx }, { 'variantes.sku': rx }]
  }
  const [total, items] = await Promise.all([
    Product.countDocuments(filtro),
    Product.find(filtro).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('categoria', 'nombre slug'),
  ])
  return { items: items as unknown as ProductoDTO[], total, page, limit, pages: Math.ceil(total / limit) }
})
