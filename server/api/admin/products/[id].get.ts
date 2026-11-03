import { getRouterParam } from 'h3'
import { objectIdSchema } from '../../../../shared/schemas/order'
import { Product } from '../../../models'
import { requireAdmin } from '../../../utils/auth'
import { apiError } from '../../../utils/errors'
import { defineApiHandler } from '../../../utils/handler'

/** GET /api/admin/products/:id — un producto (activo o inactivo) para editarlo. */
export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  const id = objectIdSchema.parse(getRouterParam(event, 'id'))
  const producto = await Product.findById(id).populate('categoria', 'nombre slug')
  if (!producto) throw apiError(404, 'Producto no encontrado.')
  return producto
})
