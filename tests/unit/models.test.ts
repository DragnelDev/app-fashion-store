import { describe, expect, it } from 'vitest'
import mongoose from 'mongoose'
import { Product } from '../../server/models/Product'
import { Order } from '../../server/models/Order'
import { User } from '../../server/models/User'

const oid = () => new mongoose.Types.ObjectId()
const prodBase = () => ({
  nombre: 'Camisa', slug: 'camisa', precio: 113, categoriaId: oid(), imagenes: ['/uploads/producto/2026/x.webp'],
  variantes: [{ color: 'Azul', talla: 'M', stock: 3, sku: 'A-1' }],
})

describe('Product (validación sin BD)', () => {
  it('acepta un producto válido y calcula stockTotal', () => {
    const p = new Product({ ...prodBase(), variantes: [{ color: 'Azul', talla: 'm', stock: 3, sku: 'a-1' }, { color: 'Azul', talla: 'L', stock: 2, sku: 'A-2' }] })
    expect(p.validateSync()).toBeUndefined()
    expect(p.stockTotal).toBe(5)
    expect(p.variantes[0]!.talla).toBe('M')
    expect(p.variantes[0]!.sku).toBe('A-1')
    expect(p.estadoRegistro).toBe('activo')
  })
  it('rechaza precio con 3 decimales, stock negativo/decimal y sin imágenes', () => {
    expect(new Product({ ...prodBase(), precio: 10.999 }).validateSync()?.errors.precio).toBeDefined()
    expect(new Product({ ...prodBase(), variantes: [{ color: 'A', talla: 'M', stock: -1, sku: 'X' }] }).validateSync()).toBeDefined()
    expect(new Product({ ...prodBase(), variantes: [{ color: 'A', talla: 'M', stock: 1.5, sku: 'X' }] }).validateSync()).toBeDefined()
    expect(new Product({ ...prodBase(), imagenes: [] }).validateSync()?.errors.imagenes).toBeDefined()
  })
  // Estas reglas viven en pre('validate'), que validateSync() no ejecuta: se usa validate().
  it('rechaza SKU o color+talla repetidos dentro del producto', async () => {
    const dupSku = new Product({ ...prodBase(), variantes: [{ color: 'A', talla: 'M', stock: 1, sku: 'S' }, { color: 'B', talla: 'L', stock: 1, sku: 's' }] })
    await expect(dupSku.validate()).rejects.toThrow(/SKU repetido/)
    const dupCombo = new Product({ ...prodBase(), variantes: [{ color: 'Rojo', talla: 'M', stock: 1, sku: 'S1' }, { color: 'rojo', talla: 'm', stock: 1, sku: 'S2' }] })
    await expect(dupCombo.validate()).rejects.toThrow(/Variante repetida/)
  })
})

describe('User (validación sin BD)', () => {
  const base = { nombre: 'Ana', apellido: 'Rojas', email: 'ANA@Correo.com' }
  it('normaliza email y valida teléfono +591', () => {
    const u = new User({ ...base, telefono: '+59171234567' })
    expect(u.validateSync()).toBeUndefined()
    expect(u.email).toBe('ana@correo.com')
    expect(u.rol).toBe('client')
    expect(new User({ ...base, telefono: '71234567' }).validateSync()?.errors.telefono).toBeDefined()
  })
  it('solo admite ciudades de Bolivia y una dirección principal', async () => {
    const dir = { ciudad: 'La Paz', zona: 'Sopocachi', direccion: 'Av. 6 de Agosto 100' }
    expect(new User({ ...base, direcciones: [{ ...dir, ciudad: 'Madrid' }] }).validateSync()).toBeDefined()
    const dos = new User({ ...base, direcciones: [{ ...dir, esPrincipal: true }, { ...dir, esPrincipal: true }] })
    await expect(dos.validate()).rejects.toThrow(/principal/)
  })
  it('no serializa passwordHash', () => {
    const json = new User({ ...base, passwordHash: 'secreto' }).toJSON() as Record<string, unknown>
    expect(json.passwordHash).toBeUndefined()
  })
})

describe('Order (validación sin BD)', () => {
  const pedido = () => ({
    numero: 'VQ-2026-000001', tokenAccesoHash: 'h', email: 'a@b.com', metodoPago: 'qr',
    items: [{ productoId: oid(), nombre: 'Camisa', slug: 'camisa', sku: 'A-1', color: 'Azul', talla: 'M', precioUnitario: 113, cantidad: 1, subtotal: 113 }],
    totales: { subtotal: 113, envio: 20, total: 133, ivaTasa: 0.13, iva: 17.29, importeSinIva: 115.71 },
    facturacion: { tipoDocumento: 'NIT', numeroDocumento: '1023456028', razonSocial: 'Ana S.R.L.' },
    envio: { nombreDestinatario: 'Ana', telefono: '+59171234567', ciudad: 'La Paz', zona: 'Centro', direccion: 'Calle 1 #23' },
  })
  it('acepta un pedido válido con estados por defecto', () => {
    const o = new Order(pedido())
    expect(o.validateSync()).toBeUndefined()
    expect(o.estadoPedido).toBe('pendiente')
    expect(o.estadoPago).toBe('pendiente')
  })
  it('rechaza estados, método de pago y documento inválidos', () => {
    expect(new Order({ ...pedido(), estadoPedido: 'volando' }).validateSync()).toBeDefined()
    expect(new Order({ ...pedido(), metodoPago: 'bitcoin' }).validateSync()).toBeDefined()
    expect(new Order({ ...pedido(), facturacion: { tipoDocumento: 'DNI', numeroDocumento: '1', razonSocial: 'X' } }).validateSync()).toBeDefined()
    expect(new Order({ ...pedido(), items: [] }).validateSync()).toBeDefined()
  })
  it('no serializa el hash del token', () => {
    expect((new Order(pedido()).toJSON() as Record<string, unknown>).tokenAccesoHash).toBeUndefined()
  })
})
