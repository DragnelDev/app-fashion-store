import { readBody, setResponseStatus } from 'h3'
import { pedidoSchema } from '../../../shared/schemas/order'
import type { CrearPedidoRespuesta } from '../../../shared/types'
import { getUsuarioActual } from '../../utils/auth'
import { defineApiHandler } from '../../utils/handler'
import { crearPedido } from '../../utils/orderService'
import { limitarPeticiones } from '../../utils/rateLimit'
import { getStorage } from '../../utils/storage'

/**
 * POST /api/orders — registra un pedido (invitado o con sesión iniciada: en ese caso queda en «Mis pedidos»).
 *
 * Body: { items:[{productoId, sku, cantidad}], email, facturacion:{tipoDocumento, numeroDocumento,
 *         complemento?, razonSocial}, envio:{…}, metodoPago:'qr'|'transferencia'|'contra_entrega',
 *         comprobantePagoUrl?, notas? }
 *
 * Respuestas: 201 { numero, token, totales, metodoPago } · 409 stock insuficiente · 422 validación.
 * El `token` permite consultar el pedido y adjuntar el comprobante sin iniciar sesión.
 * El stock se descuenta y el pedido se crea en una transacción de MongoDB (ver utils/orderService.ts).
 */
export default defineApiHandler(async (event): Promise<CrearPedidoRespuesta> => {
  limitarPeticiones(event, { clave: 'orders', max: 15, ventanaMs: 10 * 60_000 })
  const input = pedidoSchema.parse(await readBody(event))
  const usuario = await getUsuarioActual(event)
  const resultado = await crearPedido(input, getStorage(event), usuario?.id as string | undefined)
  setResponseStatus(event, 201)
  return resultado
})
