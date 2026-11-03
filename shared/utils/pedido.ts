import {
  TRANSICIONES_PEDIDO,
  type EstadoPago,
  type EstadoPedido,
  type MetodoPago,
} from './bolivia'

/**
 * Reglas de negocio de los estados de un pedido, sin acceso a base de datos (se prueban con
 * Vitest y las aplica `cambiarEstadoPedido` en el servidor).
 *
 *  · Prepago (QR / transferencia): hay que confirmar el pago antes de enviar o entregar.
 *    Confirmar el pago de un pedido «pendiente» lo pasa a «procesando».
 *  · Contra entrega: se cobra al entregar, así que «entregado» registra el pago como «pagado».
 *  · Cancelar (solo antes del envío) devuelve el stock al inventario.
 *  · «entregado» y «cancelado» son estados finales.
 */
export interface EstadoActualPedido {
  metodoPago: MetodoPago
  estadoPedido: EstadoPedido
  estadoPago: EstadoPago
}

export interface CambioSolicitado {
  estadoPedido?: EstadoPedido
  estadoPago?: EstadoPago
  nota?: string
}

export interface MovimientoEstado {
  tipo: 'pedido' | 'pago'
  de: string
  a: string
  nota?: string
}

export type ResultadoCambio =
  | {
      ok: true
      estadoPedido: EstadoPedido
      estadoPago: EstadoPago
      /** Registrar `pagadoEn = ahora`. */
      marcarPagado: boolean
      /** Borrar `pagadoEn` (se revirtió la confirmación). */
      limpiarPagadoEn: boolean
      devolverStock: boolean
      movimientos: MovimientoEstado[]
    }
  | { ok: false; status: number; mensaje: string }

const error = (status: number, mensaje: string): ResultadoCambio => ({ ok: false, status, mensaje })

export function evaluarCambioPedido(actual: EstadoActualPedido, cambio: CambioSolicitado): ResultadoCambio {
  const prepago = actual.metodoPago !== 'contra_entrega'
  const nota = cambio.nota?.trim() || undefined
  let pedido = actual.estadoPedido
  let pago = actual.estadoPago
  let marcarPagado = false
  let limpiarPagadoEn = false
  let devolverStock = false
  const movimientos: MovimientoEstado[] = []

  const cambiaPago = cambio.estadoPago !== undefined && cambio.estadoPago !== actual.estadoPago
  const cambiaPedido = cambio.estadoPedido !== undefined && cambio.estadoPedido !== actual.estadoPedido

  // «entregado» y «cancelado» son finales: tampoco se toca su pago.
  if (cambiaPago && TRANSICIONES_PEDIDO[pedido].length === 0) {
    return error(409, `El pedido está ${pedido} y ya no admite cambios de pago.`)
  }

  // 1) Pago (solo prepago)
  if (cambiaPago) {
    if (!prepago) {
      return error(422, 'Los pedidos contra entrega se cobran al entregar: no tienen comprobante que confirmar o rechazar.')
    }
    const destino = cambio.estadoPago!
    if (destino === 'rechazado' && pago === 'pagado') {
      return error(409, 'El pago ya está confirmado: revierta la confirmación antes de rechazar el comprobante.')
    }
    if (destino === 'pendiente' && pedido === 'enviado') {
      return error(409, 'No se puede revertir el pago de un pedido que ya fue enviado.')
    }
    if (destino === 'pagado') marcarPagado = true
    if (pago === 'pagado' && destino !== 'pagado') limpiarPagadoEn = true
    movimientos.push({ tipo: 'pago', de: pago, a: destino, nota })
    pago = destino

    // Confirmar el pago de un pedido nuevo lo manda a preparación (salvo que se pida otro estado).
    if (destino === 'pagado' && pedido === 'pendiente' && cambio.estadoPedido === undefined) {
      movimientos.push({ tipo: 'pedido', de: 'pendiente', a: 'procesando', nota: 'Pago confirmado' })
      pedido = 'procesando'
    }
  }

  // 2) Estado del pedido
  if (cambio.estadoPedido !== undefined && cambio.estadoPedido !== pedido) {
    const destino = cambio.estadoPedido
    if (!TRANSICIONES_PEDIDO[pedido].includes(destino)) {
      return error(409, `No se puede pasar un pedido de «${pedido}» a «${destino}».`)
    }
    if ((destino === 'enviado' || destino === 'entregado') && prepago && pago !== 'pagado') {
      return error(409, 'Confirme el pago antes de enviar o entregar un pedido prepagado.')
    }
    if (destino === 'entregado' && !prepago && pago !== 'pagado') {
      movimientos.push({ tipo: 'pago', de: pago, a: 'pagado', nota: 'Cobrado contra entrega' })
      pago = 'pagado'
      marcarPagado = true
    }
    if (destino === 'cancelado') devolverStock = true
    const avisoReembolso = destino === 'cancelado' && prepago && pago === 'pagado' ? 'Pago ya recibido: gestionar el reembolso' : undefined
    movimientos.push({ tipo: 'pedido', de: pedido, a: destino, nota: cambiaPago ? avisoReembolso : (nota ?? avisoReembolso) })
    pedido = destino
  }

  return { ok: true, estadoPedido: pedido, estadoPago: pago, marcarPagado, limpiarPagadoEn, devolverStock, movimientos }
}
