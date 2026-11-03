import { getQuery, getRequestHeader, getRouterParam } from 'h3'
import { Order } from '../../models'
import { apiError } from '../../utils/errors'
import { defineApiHandler } from '../../utils/handler'
import { getUsuarioActual, secretosIguales } from '../../utils/auth'
import { hashToken } from '../../utils/orderService'
import { limitarPeticiones } from '../../utils/rateLimit'

/**
 * GET /api/orders/:numero?t=<token> — consulta un pedido.
 * Acceso: con el token entregado al crear el pedido (invitados) o con la sesión del cliente que lo hizo.
 */
export default defineApiHandler(async (event) => {
  limitarPeticiones(event, { clave: 'orders-get', max: 60, ventanaMs: 60_000 })
  const numero = (getRouterParam(event, 'numero') ?? '').toUpperCase()
  const token = String(getQuery(event).t ?? getRequestHeader(event, 'x-order-token') ?? '')

  const pedido = await Order.findOne({ numero }).select('+tokenAccesoHash')
  const usuario = await getUsuarioActual(event)
  const esDueno = !!(usuario && pedido?.usuarioId && String(pedido.usuarioId) === String(usuario._id))
  const tokenValido = !!(pedido && token && secretosIguales(hashToken(token), pedido.tokenAccesoHash))

  // Misma respuesta para "no existe" y "sin acceso": no revela qué pedidos existen.
  if (!pedido || !(esDueno || tokenValido)) throw apiError(404, 'Pedido no encontrado.')
  return pedido
})
