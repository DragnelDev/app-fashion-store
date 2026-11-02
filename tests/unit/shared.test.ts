import { describe, expect, it } from 'vitest'
import { aCentavos, calcularTotales, tieneMaximo2Decimales } from '../../shared/utils/money'
import { calcularEnvioBs, normalizarTelefono, REGEX_TELEFONO_BO } from '../../shared/utils/bolivia'
import { erroresPorCampo, facturacionSchema, pedidoSchema } from '../../shared/schemas/order'

describe('IVA incluido en el precio (13% del total)', () => {
  it('Bs 113 de total => IVA 14,69 y neto 98,31', () => {
    const t = calcularTotales(113, 0)
    expect(t.total).toBe(113)
    expect(t.iva).toBe(14.69)
    expect(t.importeSinIva).toBe(98.31)
    expect(t.iva + t.importeSinIva).toBeCloseTo(t.total, 10)
  })

  it('incluye el envío en el total facturado', () => {
    const t = calcularTotales(200, 20)
    expect(t.subtotal).toBe(200)
    expect(t.envio).toBe(20)
    expect(t.total).toBe(220)
    expect(t.iva).toBe(28.6)
  })

  it('no acumula errores de coma flotante', () => {
    expect(aCentavos(0.1 + 0.2)).toBe(30)
    expect(calcularTotales(0.1 + 0.2, 0).total).toBe(0.3)
    expect(tieneMaximo2Decimales(19.99)).toBe(true)
    expect(tieneMaximo2Decimales(19.999)).toBe(false)
  })

  it('redondea el IVA al centavo (mitad hacia arriba)', () => {
    // 13% de 0.50 = 0.065 -> 0.07
    expect(calcularTotales(0.5, 0).iva).toBe(0.07)
  })
})

describe('envío y teléfono', () => {
  it('tarifa por ciudad y 0 si no se eligió ciudad', () => {
    expect(calcularEnvioBs('La Paz')).toBeGreaterThan(0)
    expect(calcularEnvioBs('')).toBe(0)
    expect(calcularEnvioBs('Narnia')).toBe(0)
  })

  it('normaliza teléfonos bolivianos', () => {
    expect(normalizarTelefono('71234567')).toBe('+59171234567')
    expect(normalizarTelefono('591 71234567')).toBe('+59171234567')
    expect(normalizarTelefono('+591-7123-4567')).toBe('+59171234567')
    expect(REGEX_TELEFONO_BO.test('+59171234567')).toBe(true)
    expect(REGEX_TELEFONO_BO.test('+59121234567')).toBe(true)
    expect(REGEX_TELEFONO_BO.test('+59151234567')).toBe(false)
    expect(REGEX_TELEFONO_BO.test('+5917123456')).toBe(false)
  })
})

describe('validación de facturación (NIT / CI)', () => {
  const base = { razonSocial: 'Juan Pérez' }
  it('acepta un NIT numérico', () => {
    expect(facturacionSchema.safeParse({ ...base, tipoDocumento: 'NIT', numeroDocumento: '1023456028' }).success).toBe(true)
  })
  it('acepta CI con complemento', () => {
    const r = facturacionSchema.safeParse({ ...base, tipoDocumento: 'CI', numeroDocumento: '4567890', complemento: '1a' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.complemento).toBe('1A')
  })
  it('rechaza NIT con letras y complemento en NIT', () => {
    expect(facturacionSchema.safeParse({ ...base, tipoDocumento: 'NIT', numeroDocumento: '12AB' }).success).toBe(false)
    expect(facturacionSchema.safeParse({ ...base, tipoDocumento: 'NIT', numeroDocumento: '1023456028', complemento: '1A' }).success).toBe(false)
  })
})

describe('pedidoSchema', () => {
  const valido = {
    items: [{ productoId: 'a'.repeat(24), sku: 'VQ-1', cantidad: 2 }],
    email: 'cliente@correo.com',
    facturacion: { tipoDocumento: 'CI', numeroDocumento: '4567890', razonSocial: 'Ana Rojas' },
    envio: { nombreDestinatario: 'Ana Rojas', telefono: '71234567', ciudad: 'La Paz', zona: 'Sopocachi', direccion: 'Av. 20 de Octubre 1234' },
    metodoPago: 'qr',
  }
  it('acepta un pedido válido y normaliza el teléfono', () => {
    const r = pedidoSchema.safeParse(valido)
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.envio.telefono).toBe('+59171234567')
  })
  it('reporta errores por campo', () => {
    const r = pedidoSchema.safeParse({ ...valido, items: [], envio: { ...valido.envio, ciudad: 'Marte' } })
    expect(r.success).toBe(false)
    if (!r.success) {
      const e = erroresPorCampo(r.error)
      expect(e['items']).toBeDefined()
      expect(e['envio.ciudad']).toBeDefined()
    }
  })
})
