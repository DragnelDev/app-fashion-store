import { describe, expect, it } from 'vitest'
import { evaluarCambioPedido, type EstadoActualPedido } from '../../shared/utils/pedido'

const qr = (o: Partial<EstadoActualPedido> = {}): EstadoActualPedido => ({ metodoPago: 'qr', estadoPedido: 'pendiente', estadoPago: 'pendiente', ...o })
const cod = (o: Partial<EstadoActualPedido> = {}): EstadoActualPedido => ({ metodoPago: 'contra_entrega', estadoPedido: 'pendiente', estadoPago: 'pendiente', ...o })

describe('evaluarCambioPedido', () => {
  it('confirmar el pago de un pedido pendiente lo pasa a procesando', () => {
    const r = evaluarCambioPedido(qr(), { estadoPago: 'pagado' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.estadoPago).toBe('pagado')
      expect(r.estadoPedido).toBe('procesando')
      expect(r.marcarPagado).toBe(true)
      expect(r.movimientos.length).toBe(2)
    }
  })

  it('prepago: no se envía ni entrega sin pago confirmado', () => {
    const r = evaluarCambioPedido(qr({ estadoPedido: 'procesando' }), { estadoPedido: 'enviado' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.status).toBe(409)
  })

  it('prepago pagado: procesando → enviado → entregado', () => {
    const a = evaluarCambioPedido(qr({ estadoPedido: 'procesando', estadoPago: 'pagado' }), { estadoPedido: 'enviado' })
    expect(a.ok).toBe(true)
    const b = evaluarCambioPedido(qr({ estadoPedido: 'enviado', estadoPago: 'pagado' }), { estadoPedido: 'entregado' })
    expect(b.ok).toBe(true)
  })

  it('contra entrega: entregar registra el cobro', () => {
    const r = evaluarCambioPedido(cod({ estadoPedido: 'enviado' }), { estadoPedido: 'entregado' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.estadoPago).toBe('pagado')
      expect(r.marcarPagado).toBe(true)
    }
  })

  it('contra entrega: no admite confirmar/rechazar comprobantes', () => {
    const r = evaluarCambioPedido(cod(), { estadoPago: 'pagado' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.status).toBe(422)
  })

  it('cancelar solo antes del envío y devuelve el stock', () => {
    const ok = evaluarCambioPedido(qr({ estadoPedido: 'procesando' }), { estadoPedido: 'cancelado' })
    expect(ok.ok && ok.devolverStock).toBe(true)
    expect(evaluarCambioPedido(qr({ estadoPedido: 'enviado', estadoPago: 'pagado' }), { estadoPedido: 'cancelado' }).ok).toBe(false)
  })

  it('cancelar un pedido ya pagado avisa del reembolso', () => {
    const r = evaluarCambioPedido(qr({ estadoPedido: 'procesando', estadoPago: 'pagado' }), { estadoPedido: 'cancelado' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.movimientos[0]!.nota).toMatch(/reembolso/)
  })

  it('estados finales no admiten cambios', () => {
    expect(evaluarCambioPedido(qr({ estadoPedido: 'cancelado' }), { estadoPedido: 'procesando' }).ok).toBe(false)
    expect(evaluarCambioPedido(qr({ estadoPedido: 'entregado', estadoPago: 'pagado' }), { estadoPago: 'pendiente' }).ok).toBe(false)
  })

  it('rechazar comprobante y revertir confirmación', () => {
    const rech = evaluarCambioPedido(qr(), { estadoPago: 'rechazado', nota: 'Monto incorrecto' })
    expect(rech.ok && rech.estadoPago).toBe('rechazado')
    expect(evaluarCambioPedido(qr({ estadoPago: 'pagado' }), { estadoPago: 'rechazado' }).ok).toBe(false)
    const rev = evaluarCambioPedido(qr({ estadoPedido: 'procesando', estadoPago: 'pagado' }), { estadoPago: 'pendiente' })
    expect(rev.ok && rev.limpiarPagadoEn).toBe(true)
  })

  it('sin cambios devuelve ok sin movimientos', () => {
    const r = evaluarCambioPedido(qr(), { estadoPedido: 'pendiente' as never })
    expect(r.ok && r.movimientos.length).toBe(0)
  })
})
