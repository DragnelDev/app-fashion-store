import { getRouterParam } from 'h3'
import { Order } from '../../../models'
import { requireAdmin } from '../../../utils/auth'
import { apiError } from '../../../utils/errors'
import { defineApiHandler } from '../../../utils/handler'

/** GET /api/admin/orders/:numero — detalle completo (facturación, envío, comprobante, historial). */
export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  const pedido = await Order.findOne({ numero: (getRouterParam(event, 'numero') ?? '').toUpperCase() })
  if (!pedido) throw apiError(404, 'Pedido no encontrado.')
  return pedido
})
