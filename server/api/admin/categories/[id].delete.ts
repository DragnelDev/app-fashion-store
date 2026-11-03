import { getRouterParam } from 'h3'
import { objectIdSchema } from '../../../../shared/schemas/order'
import { Category, Product } from '../../../models'
import { requireAdmin } from '../../../utils/auth'
import { apiError } from '../../../utils/errors'
import { defineApiHandler } from '../../../utils/handler'

/** DELETE /api/admin/categories/:id — eliminación lógica; se rechaza si aún tiene productos. */
export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  const id = objectIdSchema.parse(getRouterParam(event, 'id'))
  if (await Product.exists({ categoriaId: id })) {
    throw apiError(409, 'La categoría tiene productos. Muévalos o elimínelos primero (o desactive la categoría).')
  }
  const res = await Category.updateOne({ _id: id }, { $set: { estadoRegistro: 'eliminado' } })
  if (res.matchedCount !== 1) throw apiError(404, 'Categoría no encontrada.')
  return { ok: true }
})
