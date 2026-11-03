import { Category, Product } from '../../../models'
import { requireAdmin } from '../../../utils/auth'
import { defineApiHandler } from '../../../utils/handler'

/** GET /api/admin/categories — todas las categorías (activas e inactivas) con su cantidad de productos. */
export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  const [categorias, conteos] = await Promise.all([
    Category.find().sort({ nombre: 1 }),
    Product.aggregate<{ _id: unknown; n: number }>([
      { $match: { estadoRegistro: { $ne: 'eliminado' } } },
      { $group: { _id: '$categoriaId', n: { $sum: 1 } } },
    ]),
  ])
  const porCategoria = new Map(conteos.map((c) => [String(c._id), c.n]))
  return categorias.map((c) => ({ ...c.toJSON(), productos: porCategoria.get(c.id as string) ?? 0 }))
})
