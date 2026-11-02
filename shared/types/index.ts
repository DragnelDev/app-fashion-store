import type {
  CiudadBolivia, EstadoPago, EstadoPedido, EstadoRegistro, MetodoPago, TipoDocumento,
} from '../utils/bolivia'
import type { Totales } from '../utils/money'

/** Tipos de las respuestas de la API (lo que viaja por JSON). */
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

export interface ItemPedidoDTO {
  productoId: string; nombre: string; slug: string; imagen: string
  sku: string; color: string; talla: string
  precioUnitario: number; cantidad: number; subtotal: number
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
  notas?: string
  createdAt: string
}
export interface CrearPedidoRespuesta { numero: string; token: string; totales: Totales; metodoPago: MetodoPago }
export interface SubidaRespuesta { url: string; scope: string; bytes: number; width: number; height: number; format: string; provider: string }
