import { readBody, setResponseStatus } from 'h3'
import { pedidoSchema } from '../../../shared/schemas/order'
import type { CrearPedidoRespuesta } from '../../../shared/types'
import { defineApiHandler } from '../../utils/handler'
import { crearPedido } from '../../utils/orderService'
import { limitarPeticiones } from '../../utils/rateLimit'
import { getStorage } from '../../utils/storage'

/**
 * POST /api/orders — registra un pedido (checkout como invitado).
 *
 * Body: { items:[{productoId, sku, cantidad}], email, facturacion:{tipoDocumento, numeroDocumento,
 *         complemento?, razonSocial}, envio:{…}, metodoPago:'qr'|'transferencia'|'contra_entrega',
 *         comprobantePagoUrl?, notas? }
 *
 * Respuestas: 201 { numero, token, totales, metodoPago } · 409 stock insuficiente · 422 validación.
 * El `token` permite consultar el pedido y adjuntar el comprobante sin iniciar sesión.
 */
export default defineApiHandler(async (event): Promise<CrearPedidoRespuesta> => {
  limitarPeticiones(event, { clave: 'orders', max: 15, ventanaMs: 10 * 60_000 })
  const input = pedidoSchema.parse(await readBody(event))
  const resultado = await crearPedido(input, getStorage(event))
  setResponseStatus(event, 201)
  return resultado
})
