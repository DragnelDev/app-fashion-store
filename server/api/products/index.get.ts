import { getValidatedQuery } from 'h3'
import { productoQuerySchema } from '../../../shared/schemas/product'
import type { Paginado, ProductoDTO } from '../../../shared/types'
import { Category, Product } from '../../models'
import { defineApiHandler } from '../../utils/handler'
import { escaparRegex } from '../../utils/sku'

const ORDEN = {
  recientes: { createdAt: -1 },
  precio_asc: { precio: 1, _id: 1 },
  precio_desc: { precio: -1, _id: 1 },
} as const

/**
 * GET /api/products?categoria=<slug>&talla=M&color=Negro&q=camisa&orden=precio_asc&page=1&limit=12
 * `talla` y `color` solo devuelven productos con stock > 0 en esa variante.
 */
export default defineApiHandler(async (event): Promise<Paginado<ProductoDTO>> => {
  const { categoria, talla, color, q, orden, page, limit } = await getValidatedQuery(event, productoQuerySchema.parse)

  const filtro: Record<string, unknown> = { estadoRegistro: 'activo' }

  if (categoria) {
    const cat = await Category.findOne({ slug: categoria, estadoRegistro: 'activo' }).select('_id')
    if (!cat) return { items: [], total: 0, page, limit, pages: 0 }
    filtro.categoriaId = cat._id
  }
  if (talla || color) {
    const variante: Record<string, unknown> = { stock: { $gt: 0 } }
    if (talla) variante.talla = talla.toUpperCase()
    if (color) variante.color = new RegExp(`^${escaparRegex(color)}$`, 'i')
    filtro.variantes = { $elemMatch: variante }
  }
  if (q) filtro.nombre = new RegExp(escaparRegex(q), 'i')

  const [total, items] = await Promise.all([
    Product.countDocuments(filtro),
    Product.find(filtro)
      .sort(ORDEN[orden])
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('categoria', 'nombre slug'),
  ])

  return { items: items as unknown as ProductoDTO[], total, page, limit, pages: Math.ceil(total / limit) }
})
