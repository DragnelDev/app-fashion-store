import { getRouterParam } from 'h3'
import { objectIdSchema } from '../../../../shared/schemas/order'
import { Product } from '../../../models'
import { requireAdmin } from '../../../utils/auth'
import { apiError } from '../../../utils/errors'
import { defineApiHandler } from '../../../utils/handler'

/**
 * DELETE /api/admin/products/:id — eliminación lógica (`estadoRegistro: 'eliminado'`).
 * Los pedidos existentes conservan su instantánea; los SKU quedan reservados.
 */
export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  const id = objectIdSchema.parse(getRouterParam(event, 'id'))
  const res = await Product.updateOne({ _id: id }, { $set: { estadoRegistro: 'eliminado' } })
  if (res.matchedCount !== 1) throw apiError(404, 'Producto no encontrado.')
  return { ok: true }
})
