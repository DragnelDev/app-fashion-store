import { getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { Order } from '../../../models'
import { apiError } from '../../../utils/errors'
import { defineApiHandler } from '../../../utils/handler'
import { secretosIguales } from '../../../utils/auth'
import { hashToken } from '../../../utils/orderService'
import { limitarPeticiones } from '../../../utils/rateLimit'
import { getStorage } from '../../../utils/storage'

const bodySchema = z.object({ token: z.string().min(10).max(100), url: z.string().trim().min(1).max(500) })

/**
 * PATCH /api/orders/:numero/comprobante — adjunta (o reemplaza) la foto del comprobante de pago
 * QR/transferencia. Body: { token, url } con la url devuelta por POST /api/upload?scope=comprobante.
 */
export default defineApiHandler(async (event) => {
  limitarPeticiones(event, { clave: 'orders-comprobante', max: 20, ventanaMs: 10 * 60_000 })
  const numero = (getRouterParam(event, 'numero') ?? '').toUpperCase()
  const { token, url } = bodySchema.parse(await readBody(event))

  const pedido = await Order.findOne({ numero }).select('+tokenAccesoHash')
  if (!pedido || !secretosIguales(hashToken(token), pedido.tokenAccesoHash)) throw apiError(404, 'Pedido no encontrado.')

  if (pedido.metodoPago === 'contra_entrega') throw apiError(409, 'Este pedido es contra entrega: no requiere comprobante.')
  if (pedido.estadoPago === 'pagado') throw apiError(409, 'El pago de este pedido ya fue confirmado.')
  if (!getStorage(event).esUrlPropia(url, 'comprobante')) {
    throw apiError(422, 'El comprobante debe subirse con POST /api/upload?scope=comprobante.')
  }

  pedido.comprobantePagoUrl = url
  await pedido.save()
  return pedido
})
