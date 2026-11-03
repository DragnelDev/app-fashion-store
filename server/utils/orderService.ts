import { createHash, randomBytes } from 'node:crypto'
import mongoose, { type ClientSession, type UpdateQuery } from 'mongoose'
import type { PedidoEstadoInput, PedidoInput } from '../../shared/schemas/order'
import type { MetodoPago } from '../../shared/utils/bolivia'
import { calcularEnvioBs } from '../../shared/utils/bolivia'
import { aBs, aCentavos, calcularTotales } from '../../shared/utils/money'
import { evaluarCambioPedido } from '../../shared/utils/pedido'
import { Order, Product, siguienteSecuencia, type IHistorial, type IItemPedido, type IOrder, type ProductDocument } from '../models'
import { apiError } from './errors'
import type { StorageDriver } from './storage/types'
import { enTransaccion, soportaTransacciones } from './transaccion'

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

interface ItemReservado { productoId: string; sku: string; cantidad: number }
interface ProblemaStock { sku: string; nombre: string; disponible: number }

/**
 * Descuenta stock de una variante de forma atómica (solo si alcanza). La condición de stock va
 * en el filtro del propio `updateOne`: aun sin transacción dos compradores simultáneos nunca
 * dejan el stock en negativo.
 */
async function reservar(item: ItemReservado, session?: ClientSession): Promise<boolean> {
  const res = await Product.updateOne(
    {
      _id: item.productoId,
      estadoRegistro: 'activo',
      variantes: { $elemMatch: { sku: item.sku, stock: { $gte: item.cantidad } } },
    },
    { $inc: { 'variantes.$.stock': -item.cantidad } },
    { session },
  )
  return res.modifiedCount === 1
}

/**
 * Devuelve stock (cancelación de un pedido o compensación si algo falla sin transacciones).
 * Es secuencial a propósito: una sesión transaccional no admite operaciones en paralelo.
 */
export async function liberarStock(items: ItemReservado[], session?: ClientSession): Promise<void> {
  for (const i of items) {
    await Product.updateOne(
      { _id: i.productoId, 'variantes.sku': i.sku },
      { $inc: { 'variantes.$.stock': i.cantidad } },
      { session },
    ).setOptions({ incluirEliminados: true } as never)
  }
}

/** Valida cada línea contra el producto cargado y arma la instantánea del pedido (precio autoritativo de la BD). */
function prepararLineas(productos: ProductDocument[], solicitados: ItemReservado[]) {
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
  return { lineas, problemas, porId }
}

const stockInsuficiente = (items: ProblemaStock[]) =>
  apiError(409, 'Algunos productos ya no tienen stock suficiente.', { code: 'stock_insuficiente', items })

const ANIO_BOLIVIA = new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'America/La_Paz' })

/**
 * Crea un pedido: valida productos/variantes/stock, toma el PRECIO de la base de datos (nunca
 * del cliente), calcula envío e IVA 13% (incluido en el precio), descuenta el stock y guarda el
 * pedido con una instantánea de cada ítem.
 *
 * Con replica set (Atlas, `docker-compose.yml`) todo ocurre en UNA transacción: o se descuenta
 * el stock y se crea el pedido, o no pasa nada (`enTransaccion` reintenta ante conflictos de
 * escritura entre compras simultáneas, por lo que el bloque es idempotente). En un `mongod`
 * standalone —solo desarrollo— se usa el respaldo: reserva atómica por variante + compensación.
 */
export async function crearPedido(input: PedidoInput, storage: StorageDriver, usuarioId?: string) {
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

  const ids = [...new Set(solicitados.map((i) => i.productoId))]
  const token = randomBytes(24).toString('hex')
  // El número se asigna una sola vez aunque la transacción se reintente.
  let numero: string | undefined

  const ejecutar = async (session?: ClientSession) => {
    // 3) Cargar productos y validar disponibilidad (precio autoritativo)
    const productos = await Product.find({ _id: { $in: ids }, estadoRegistro: 'activo' }).session(session ?? null)
    const { lineas, problemas } = prepararLineas(productos, solicitados)
    if (problemas.length) throw stockInsuficiente(problemas)

    // 4) Totales (servidor autoritativo): subtotal + envío; IVA = 13% del total
    const subtotal = aBs(lineas.reduce((suma, l) => suma + aCentavos(l.subtotal), 0))
    const totales = calcularTotales(subtotal, calcularEnvioBs(input.envio.ciudad))

    // 5) Descontar stock línea por línea (condicionado a que alcance)
    const reservados: ItemReservado[] = []
    for (const s of solicitados) {
      if (await reservar(s, session)) {
        reservados.push(s)
        continue
      }
      // Otro comprador se llevó las unidades entre la lectura y el descuento.
      if (!session) await liberarStock(reservados)
      const actual = await Product.findById(s.productoId).session(session ?? null)
      throw stockInsuficiente([
        {
          sku: s.sku,
          nombre: lineas.find((l) => l.sku === s.sku)?.nombre ?? s.sku,
          disponible: actual?.variantes.find((v) => v.sku === s.sku)?.stock ?? 0,
        },
      ])
    }

    // 6) Guardar el pedido
    try {
      numero ??= await generarNumeroPedido()
      await Order.create(
        [
          {
            numero,
            usuarioId,
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
            historial: [{ tipo: 'pedido', de: '-', a: 'pendiente', fecha: new Date() }],
          },
        ],
        { session },
      )
    } catch (error) {
      if (!session) await liberarStock(reservados) // con transacción, abortar ya deshace el descuento
      throw error
    }
    return { numero: numero!, token, totales, metodoPago: input.metodoPago as MetodoPago }
  }

  return (await soportaTransacciones()) ? enTransaccion((session) => ejecutar(session)) : ejecutar()
}

/** Número legible por año calendario de Bolivia: VQ-2026-000123. */
async function generarNumeroPedido(): Promise<string> {
  const anio = ANIO_BOLIVIA.format(new Date())
  const secuencia = await siguienteSecuencia(`pedidos-${anio}`)
  return `VQ-${anio}-${String(secuencia).padStart(6, '0')}`
}

/**
 * Cambia el estado del pedido y/o del pago aplicando las reglas de `evaluarCambioPedido`
 * (shared/utils/pedido.ts). Cancelar devuelve el stock. La escritura está condicionada a los
 * estados leídos: si otro administrador cambió el pedido en paralelo se responde 409 en lugar de
 * pisar su cambio. Con replica set el cambio de estado y la devolución de stock son atómicos.
 */
export async function cambiarEstadoPedido(numero: string, cambio: PedidoEstadoInput, adminId?: string) {
  const ejecutar = async (session?: ClientSession) => {
    const pedido = await Order.findOne({ numero }).session(session ?? null)
    if (!pedido) throw apiError(404, 'Pedido no encontrado.')

    const r = evaluarCambioPedido(
      { metodoPago: pedido.metodoPago, estadoPedido: pedido.estadoPedido, estadoPago: pedido.estadoPago },
      cambio,
    )
    if (!r.ok) throw apiError(r.status, r.mensaje)
    if (!r.movimientos.length) return pedido // nada que cambiar

    const ahora = new Date()
    const historial: IHistorial[] = r.movimientos.map((m) => ({
      ...m,
      fecha: ahora,
      porUsuarioId: adminId ? new mongoose.Types.ObjectId(adminId) : undefined,
    }))
    const actualizacion: UpdateQuery<IOrder> = {
      $set: { estadoPedido: r.estadoPedido, estadoPago: r.estadoPago, ...(r.marcarPagado ? { pagadoEn: ahora } : {}) },
      $push: { historial: { $each: historial } },
      ...(r.limpiarPagadoEn ? { $unset: { pagadoEn: '' } } : {}),
    }
    // Condicionada a los estados leídos (control optimista de concurrencia).
    const res = await Order.updateOne(
      { _id: pedido._id, estadoPedido: pedido.estadoPedido, estadoPago: pedido.estadoPago },
      actualizacion,
      { session },
    )
    if (res.modifiedCount !== 1) {
      throw apiError(409, 'El pedido cambió mientras lo revisaba. Recargue la página e intente de nuevo.', { code: 'conflicto_version' })
    }
    if (r.devolverStock) {
      await liberarStock(pedido.items.map((i) => ({ productoId: String(i.productoId), sku: i.sku, cantidad: i.cantidad })), session)
    }
    return Order.findById(pedido._id).session(session ?? null)
  }

  return (await soportaTransacciones()) ? enTransaccion((session) => ejecutar(session)) : ejecutar()
}
