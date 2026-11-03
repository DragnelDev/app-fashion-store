import type {
  CiudadBolivia, EstadoPago, EstadoPedido, EstadoRegistro, MetodoPago, Rol, TipoDocumento,
} from '../utils/bolivia'
import type { Totales } from '../utils/money'

/** Tipos de las respuestas de la API (lo que viaja por JSON). */

// --- Usuarios ----------------------------------------------------------------------------
export interface DireccionDTO {
  _id: string
  alias: string
  ciudad: CiudadBolivia
  zona: string
  direccion: string
  referencia?: string
  esPrincipal: boolean
}
export interface DocumentoFacturacionDTO {
  tipo: TipoDocumento
  numero: string
  complemento?: string
  razonSocial: string
}
export interface UsuarioDTO {
  _id: string
  nombre: string
  apellido: string
  email: string
  rol: Rol
  /** Formato E.164 boliviano: +591XXXXXXXX */
  telefono?: string
  direcciones: DireccionDTO[]
  /** NIT/CI y razón social por defecto para facturar. */
  documento?: DocumentoFacturacionDTO
  estadoRegistro: EstadoRegistro
  createdAt: string
  updatedAt: string
}

// --- Catálogo ----------------------------------------------------------------------------
export interface VarianteDTO { color: string; talla: string; stock: number; sku: string }
export interface CategoriaDTO { _id: string; nombre: string; slug: string; imagenUrl?: string; estadoRegistro: EstadoRegistro }
export interface ProductoDTO {
  _id: string
  nombre: string
  slug: string
  descripcion: string
  /** Precio al público en Bs., IVA incluido. */
  precio: number
  categoriaId: string
  categoria?: Pick<CategoriaDTO, '_id' | 'nombre' | 'slug'> | null
  imagenes: string[]
  variantes: VarianteDTO[]
  stockTotal: number
  estadoRegistro: EstadoRegistro
  createdAt: string
  updatedAt: string
}
export interface Paginado<T> { items: T[]; total: number; page: number; limit: number; pages: number }

/** Facetas de los filtros del catálogo (solo variantes con stock). */
export interface FiltrosDTO { colores: string[]; tallas: string[]; precioMin: number; precioMax: number }

// --- Carrito -----------------------------------------------------------------------------
export interface CarritoValidacionItemDTO { productoId: string; sku: string; disponible: number; precio: number; activo: boolean }
export interface CarritoValidacionDTO { items: CarritoValidacionItemDTO[] }

// --- Pedidos -----------------------------------------------------------------------------
export interface ItemPedidoDTO {
  productoId: string; nombre: string; slug: string; imagen: string
  sku: string; color: string; talla: string
  precioUnitario: number; cantidad: number; subtotal: number
}
export interface HistorialPedidoDTO {
  tipo: 'pedido' | 'pago'
  /** Estado anterior; `-` en el alta del pedido. */
  de: string
  a: string
  fecha: string
  nota?: string
}
export interface PedidoDTO {
  _id: string
  numero: string
  items: ItemPedidoDTO[]
  totales: Totales
  email: string
  facturacion: { tipoDocumento: TipoDocumento; numeroDocumento: string; complemento?: string; razonSocial: string }
  envio: {
    nombreDestinatario: string; telefono: string; ciudad: CiudadBolivia
    zona: string; direccion: string; referencia?: string
  }
  metodoPago: MetodoPago
  estadoPedido: EstadoPedido
  estadoPago: EstadoPago
  comprobantePagoUrl?: string
  pagadoEn?: string
  notas?: string
  historial: HistorialPedidoDTO[]
  createdAt: string
}
export interface CrearPedidoRespuesta { numero: string; token: string; totales: Totales; metodoPago: MetodoPago }
export interface SubidaRespuesta { url: string; scope: string; bytes: number; width: number; height: number; format: string; provider: string }

// --- Administración ----------------------------------------------------------------------
export interface AdminStatsDTO {
  pedidosPorEstado: Record<EstadoPedido, number>
  /** Pedidos QR/transferencia con comprobante adjunto pendientes de revisión. */
  pagosPorConfirmar: number
  /** «Ventas» = pedidos con pago confirmado y no cancelados (Bs., IVA incluido). */
  ventas: { total: number; iva: number; pedidos: number }
  ventasUltimos30Dias: { fecha: string; total: number; pedidos: number }[]
  productos: { activos: number; inactivos: number }
  stockBajo: { productoId: string; nombre: string; sku: string; color: string; talla: string; stock: number }[]
  recientes: Pick<PedidoDTO, '_id' | 'numero' | 'estadoPedido' | 'estadoPago' | 'metodoPago' | 'totales' | 'createdAt'>[]
}
