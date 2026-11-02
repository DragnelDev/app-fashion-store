import { getQuery, getRequestHeader, getRouterParam } from 'h3'
import { Order } from '../../models'
import { apiError } from '../../utils/errors'
import { defineApiHandler } from '../../utils/handler'
import { secretosIguales } from '../../utils/auth'
import { hashToken } from '../../utils/orderService'
import { limitarPeticiones } from '../../utils/rateLimit'

/** GET /api/orders/:numero?t=<token> — consulta un pedido con su token de acceso. */
export default defineApiHandler(async (event) => {
  limitarPeticiones(event, { clave: 'orders-get', max: 60, ventanaMs: 60_000 })
  const numero = (getRouterParam(event, 'numero') ?? '').toUpperCase()
  const token = String(getQuery(event).t ?? getRequestHeader(event, 'x-order-token') ?? '')

  const pedido = await Order.findOne({ numero }).select('+tokenAccesoHash')
  // Misma respuesta para "no existe" y "token incorrecto": no revela qué pedidos existen.
  if (!pedido || !token || !secretosIguales(hashToken(token), pedido.tokenAccesoHash)) {
    throw apiError(404, 'Pedido no encontrado.')
  }
  return pedido
})
