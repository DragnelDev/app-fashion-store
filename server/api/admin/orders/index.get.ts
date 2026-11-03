import { getValidatedQuery } from 'h3'
import { pedidosAdminQuerySchema } from '../../../../shared/schemas/order'
import type { Paginado, PedidoDTO } from '../../../../shared/types'
import { Order } from '../../../models'
import { requireAdmin } from '../../../utils/auth'
import { defineApiHandler } from '../../../utils/handler'
import { escaparRegex } from '../../../utils/sku'

/**
 * GET /api/admin/orders?estadoPedido=&estadoPago=&metodoPago=&q=&page=&limit=
 * `q` busca por número de pedido, correo, nombre del destinatario, documento o razón social.
 */
export default defineApiHandler(async (event): Promise<Paginado<PedidoDTO>> => {
  await requireAdmin(event)
  const { estadoPedido, estadoPago, metodoPago, q, page, limit } = await getValidatedQuery(event, pedidosAdminQuerySchema.parse)

  const filtro: Record<string, unknown> = {}
  if (estadoPedido) filtro.estadoPedido = estadoPedido
  if (estadoPago) filtro.estadoPago = estadoPago
  if (metodoPago) filtro.metodoPago = metodoPago
  if (q) {
    const rx = new RegExp(escaparRegex(q), 'i')
    filtro.$or = [
      { numero: rx },
      { email: rx },
      { 'envio.nombreDestinatario': rx },
      { 'facturacion.numeroDocumento': rx },
      { 'facturacion.razonSocial': rx },
    ]
  }
  const [total, items] = await Promise.all([
    Order.countDocuments(filtro),
    Order.find(filtro).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
  ])
  return { items: items as unknown as PedidoDTO[], total, page, limit, pages: Math.ceil(total / limit) }
})
