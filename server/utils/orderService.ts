import { createHash, randomBytes } from 'node:crypto'
import type { PedidoInput } from '../../shared/schemas/order'
import type { MetodoPago } from '../../shared/utils/bolivia'
import { calcularEnvioBs } from '../../shared/utils/bolivia'
import { aBs, aCentavos, calcularTotales } from '../../shared/utils/money'
import { Order, Product, siguienteSecuencia, type IItemPedido } from '../models'
import { apiError } from './errors'
import type { StorageDriver } from './storage/types'

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

interface ItemReservado { productoId: string; sku: string; cantidad: number }
interface ProblemaStock { sku: string; nombre: string; disponible: number }

/** Descuenta stock de una variante de forma atómica (solo si alcanza). Sin transacciones: funciona en MongoDB standalone. */
async function reservar(item: ItemReservado): Promise<boolean> {
  const res = await Product.updateOne(
    {
      _id: item.productoId,
      estadoRegistro: 'activo',
      variantes: { $elemMatch: { sku: item.sku, stock: { $gte: item.cantidad } } },
    },
    { $inc: { 'variantes.$.stock': -item.cantidad } },
  )
  return res.modifiedCount === 1
}

/** Devuelve stock reservado (compensación si algo falla después). */
export async function liberarStock(items: ItemReservado[]): Promise<void> {
  await Promise.all(
    items.map((i) =>
      Product.updateOne({ _id: i.productoId, 'variantes.sku': i.sku }, { $inc: { 'variantes.$.stock': i.cantidad } }).setOptions({
        incluirEliminados: true,
      } as never),
    ),
  )
}

/**
 * Crea un pedido: valida productos/variantes/stock, toma el PRECIO de la base de datos (nunca
 * del cliente), calcula envío e IVA 13% (incluido en el precio), reserva el stock de forma
 * atómica y guarda el pedido con una instantánea de cada ítem.
 */
export async function crearPedido(input: PedidoInput, storage: StorageDriver) {
  // 1) Unificar líneas repetidas (mismo producto + sku)
  const pedidos = new Map<string, ItemReservado>()
  for (const i of input.items) {
    const clave = `${i.productoId}:${i.sku.toUpperCase()}`
    const previo = pedidos.get(clave)
    pedidos.set(clave, { productoId: i.productoId, sku: i.sku.toUpperCase(), cantidad: (previo?.cantidad ?? 0) + i.cantidad })
  }
  const solicitados = [...pedidos.values()]
  if (solicitados.some((i) => i.cantidad > 50)) throw apiError(422, 'Máximo 50 unidades por ítem.')

  // 2) Comprobante adjunto (opcional): solo para QR/transferencia y solo URLs de nuestro almacenamiento
  if (input.comprobantePagoUrl) {
    if (input.metodoPago === 'contra_entrega') throw apiError(422, 'El pago contra entrega no lleva comprobante.')
    if (!storage.esUrlPropia(input.comprobantePagoUrl, 'comprobante')) {
      throw apiError(422, 'El comprobante debe subirse con POST /api/upload?scope=comprobante.')
    }
  }

  // 3) Cargar productos y validar disponibilidad (precio autoritativo)
  const productos = await Product.find({ _id: { $in: [...new Set(solicitados.map((i) => i.productoId))] }, estadoRegistro: 'activo' })
  const porId = new Map(productos.map((p) => [p.id as string, p]))

  const problemas: ProblemaStock[] = []
  const lineas: IItemPedido[] = []
  for (const s of solicitados) {
    const producto = porId.get(s.productoId)
    const variante = producto?.variantes.find((v) => v.sku === s.sku)
    if (!producto || !variante) {
      problemas.push({ sku: s.sku, nombre: producto?.nombre ?? 'Producto no disponible', disponible: 0 })
      continue
    }
    if (variante.stock < s.cantidad) {
      problemas.push({ sku: s.sku, nombre: `${producto.nombre} (${variante.color} / ${variante.talla})`, disponible: variante.stock })
      continue
    }
    lineas.push({
      productoId: producto._id,
      nombre: producto.nombre,
      slug: producto.slug,
      imagen: producto.imagenes[0] ?? '',
      sku: variante.sku,
      color: variante.color,
      talla: variante.talla,
      precioUnitario: producto.precio,
      cantidad: s.cantidad,
      subtotal: aBs(aCentavos(producto.precio) * s.cantidad),
    })
  }
  if (problemas.length) {
    throw apiError(409, 'Algunos productos ya no tienen stock suficiente.', { code: 'stock_insuficiente', items: problemas })
  }

  // 4) Totales (servidor autoritativo): subtotal + envío; IVA = 13% del total
  const subtotal = aBs(lineas.reduce((suma, l) => suma + aCentavos(l.subtotal), 0))
  const totales = calcularTotales(subtotal, calcularEnvioBs(input.envio.ciudad))

  // 5) Reservar stock línea por línea; si alguna falla (carrera), se revierte lo ya reservado
  const reservados: ItemReservado[] = []
  for (const s of solicitados) {
    if (await reservar(s)) {
      reservados.push(s)
      continue
    }
    await liberarStock(reservados)
    const producto = porId.get(s.productoId)
    const actual = await Product.findById(s.productoId)
    const disponible = actual?.variantes.find((v) => v.sku === s.sku)?.stock ?? 0
    throw apiError(409, 'Algunos productos ya no tienen stock suficiente.', {
      code: 'stock_insuficiente',
      items: [{ sku: s.sku, nombre: producto?.nombre ?? s.sku, disponible }],
    })
  }

  // 6) Guardar el pedido
  try {
    const anio = new Date().getFullYear()
    const secuencia = await siguienteSecuencia(`pedidos-${anio}`)
    const numero = `VQ-${anio}-${String(secuencia).padStart(6, '0')}`
    const token = randomBytes(24).toString('hex')

    await Order.create({
      numero,
      tokenAccesoHash: hashToken(token),
      items: lineas,
      totales,
      email: input.email,
      facturacion: {
        tipoDocumento: input.facturacion.tipoDocumento,
        numeroDocumento: input.facturacion.numeroDocumento,
        complemento: input.facturacion.complemento || undefined,
        razonSocial: input.facturacion.razonSocial,
      },
      envio: { ...input.envio, referencia: input.envio.referencia || undefined },
      metodoPago: input.metodoPago as MetodoPago,
      comprobantePagoUrl: input.comprobantePagoUrl,
      notas: input.notas || undefined,
    })

    return { numero, token, totales, metodoPago: input.metodoPago as MetodoPago }
  } catch (error) {
    await liberarStock(reservados)
    throw error
  }
}
