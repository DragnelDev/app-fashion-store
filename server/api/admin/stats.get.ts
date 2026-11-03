import { ESTADOS_PEDIDO, type EstadoPedido } from '../../../shared/utils/bolivia'
import type { AdminStatsDTO } from '../../../shared/types'
import { Order, Product } from '../../models'
import { requireAdmin } from '../../utils/auth'
import { defineApiHandler } from '../../utils/handler'

const ZONA = 'America/La_Paz'
const UMBRAL_STOCK_BAJO = 3

/**
 * GET /api/admin/stats — indicadores del panel. «Ventas» = pedidos con pago confirmado y no cancelados.
 * Nota: aggregate() no pasa por el plugin de soft-delete, por eso cada $match excluye `eliminado`.
 */
export default defineApiHandler(async (event): Promise<AdminStatsDTO> => {
  await requireAdmin(event)
  const noEliminado = { estadoRegistro: { $ne: 'eliminado' } }
  const hace30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const ventasMatch = { ...noEliminado, estadoPago: 'pagado', estadoPedido: { $ne: 'cancelado' } }

  const [porEstado, porConfirmar, ventas, serie, productos, stockBajo, recientes] = await Promise.all([
    Order.aggregate<{ _id: EstadoPedido; n: number }>([{ $match: noEliminado }, { $group: { _id: '$estadoPedido', n: { $sum: 1 } } }]),
    Order.countDocuments({ metodoPago: { $ne: 'contra_entrega' }, estadoPago: 'pendiente', estadoPedido: { $ne: 'cancelado' }, comprobantePagoUrl: { $exists: true } }),
    Order.aggregate<{ total: number; iva: number; pedidos: number }>([
      { $match: ventasMatch },
      { $group: { _id: null, total: { $sum: '$totales.total' }, iva: { $sum: '$totales.iva' }, pedidos: { $sum: 1 } } },
    ]),
    Order.aggregate<{ _id: string; total: number; pedidos: number }>([
      { $match: { ...ventasMatch, createdAt: { $gte: hace30 } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: ZONA } }, total: { $sum: '$totales.total' }, pedidos: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Product.aggregate<{ _id: string; n: number }>([{ $match: { estadoRegistro: { $in: ['activo', 'inactivo'] } } }, { $group: { _id: '$estadoRegistro', n: { $sum: 1 } } }]),
    Product.aggregate([
      { $match: { estadoRegistro: 'activo' } },
      { $unwind: '$variantes' },
      { $match: { 'variantes.stock': { $lte: UMBRAL_STOCK_BAJO } } },
      { $sort: { 'variantes.stock': 1, nombre: 1 } },
      { $limit: 10 },
      { $project: { _id: 0, productoId: { $toString: '$_id' }, nombre: 1, sku: '$variantes.sku', color: '$variantes.color', talla: '$variantes.talla', stock: '$variantes.stock' } },
    ]),
    Order.find().sort({ createdAt: -1 }).limit(8).select('numero estadoPedido estadoPago metodoPago totales createdAt'),
  ])

  const pedidosPorEstado = Object.fromEntries(ESTADOS_PEDIDO.map((e) => [e, porEstado.find((x) => x._id === e)?.n ?? 0])) as Record<EstadoPedido, number>
  return {
    pedidosPorEstado,
    pagosPorConfirmar: porConfirmar,
    ventas: { total: ventas[0]?.total ?? 0, iva: ventas[0]?.iva ?? 0, pedidos: ventas[0]?.pedidos ?? 0 },
    ventasUltimos30Dias: serie.map((s) => ({ fecha: s._id, total: s.total, pedidos: s.pedidos })),
    productos: { activos: productos.find((p) => p._id === 'activo')?.n ?? 0, inactivos: productos.find((p) => p._id === 'inactivo')?.n ?? 0 },
    stockBajo,
    recientes: recientes as unknown as AdminStatsDTO['recientes'],
  }
})
