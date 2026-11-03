import { getRouterParam, readBody } from 'h3'
import { pedidoEstadoSchema } from '../../../../shared/schemas/order'
import { requireAdmin } from '../../../utils/auth'
import { defineApiHandler } from '../../../utils/handler'
import { cambiarEstadoPedido } from '../../../utils/orderService'

/**
 * PATCH /api/admin/orders/:numero — cambia el estado del pedido y/o del pago.
 * Body: { estadoPedido?: 'procesando'|'enviado'|'entregado'|'cancelado', estadoPago?: 'pagado'|'rechazado'|'pendiente', nota? }
 * Cancelar devuelve el stock. Reglas completas en utils/orderService.ts (`cambiarEstadoPedido`).
 */
export default defineApiHandler(async (event) => {
  const admin = await requireAdmin(event)
  const cambio = pedidoEstadoSchema.parse(await readBody(event))
  return cambiarEstadoPedido((getRouterParam(event, 'numero') ?? '').toUpperCase(), cambio, admin.id as string)
})
