import mongoose, { Schema, type HydratedDocument, type Model, type Types } from 'mongoose'
import {
  CIUDADES_BOLIVIA, ESTADOS_PAGO, ESTADOS_PEDIDO, METODOS_PAGO, REGEX_TELEFONO_BO, TIPOS_DOCUMENTO,
  type CiudadBolivia, type EstadoPago, type EstadoPedido, type EstadoRegistro, type MetodoPago, type TipoDocumento,
} from '../../shared/utils/bolivia'
import type { Totales } from '../../shared/utils/money'
import { limpiarJson, softDeletePlugin } from './plugins/softDelete'

export interface IItemPedido {
  productoId: Types.ObjectId
  // Instantánea (snapshot) al momento de la compra: el pedido no cambia si el producto se edita.
  nombre: string
  slug: string
  imagen: string
  sku: string
  color: string
  talla: string
  precioUnitario: number
  cantidad: number
  subtotal: number
}

export interface IOrder {
  /** Número legible: VQ-2026-000123 */
  numero: string
  usuarioId?: Types.ObjectId
  /** SHA-256 del token que permite consultar el pedido sin iniciar sesión. */
  tokenAccesoHash: string
  items: IItemPedido[]
  totales: Totales
  email: string
  facturacion: { tipoDocumento: TipoDocumento; numeroDocumento: string; complemento?: string; razonSocial: string }
  envio: {
    nombreDestinatario: string
    telefono: string
    ciudad: CiudadBolivia
    zona: string
    direccion: string
    referencia?: string
  }
  metodoPago: MetodoPago
  estadoPedido: EstadoPedido
  estadoPago: EstadoPago
  /** Foto/captura del comprobante de pago QR o transferencia. */
  comprobantePagoUrl?: string
  pagadoEn?: Date
  notas?: string
  estadoRegistro: EstadoRegistro
  createdAt: Date
  updatedAt: Date
}

const money = { type: Number, required: true, min: 0 } as const

const itemSchema = new Schema<IItemPedido>(
  {
    productoId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    nombre: { type: String, required: true },
    slug: { type: String, required: true },
    imagen: { type: String, default: '' },
    sku: { type: String, required: true },
    color: { type: String, required: true },
    talla: { type: String, required: true },
    precioUnitario: money,
    cantidad: { type: Number, required: true, min: 1, validate: { validator: Number.isInteger, message: 'Cantidad entera' } },
    subtotal: money,
  },
  { _id: false },
)

const orderSchema = new Schema<IOrder>(
  {
    numero: { type: String, required: true, unique: true },
    usuarioId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    tokenAccesoHash: { type: String, required: true, select: false },
    items: {
      type: [itemSchema],
      validate: { validator: (v: unknown[]) => v.length > 0, message: 'El pedido necesita al menos un ítem' },
    },
    totales: {
      subtotal: money,
      envio: money,
      total: money,
      /** Tasa aplicada al momento de la venta (0.13). */
      ivaTasa: { type: Number, required: true },
      /** IVA contenido en el total (13% del total facturado). */
      iva: money,
      importeSinIva: money,
    },
    email: { type: String, trim: true, lowercase: true, required: true, maxlength: 120 },
    facturacion: {
      tipoDocumento: { type: String, enum: TIPOS_DOCUMENTO, required: true },
      numeroDocumento: { type: String, trim: true, required: true, maxlength: 20, index: true },
      complemento: { type: String, trim: true, uppercase: true, maxlength: 2 },
      razonSocial: { type: String, trim: true, required: true, maxlength: 150 },
    },
    envio: {
      nombreDestinatario: { type: String, trim: true, required: true, maxlength: 120 },
      telefono: {
        type: String,
        required: true,
        validate: { validator: (v: string) => REGEX_TELEFONO_BO.test(v), message: 'Teléfono boliviano inválido' },
      },
      ciudad: { type: String, enum: CIUDADES_BOLIVIA, required: true },
      zona: { type: String, trim: true, required: true, maxlength: 100 },
      direccion: { type: String, trim: true, required: true, maxlength: 200 },
      referencia: { type: String, trim: true, maxlength: 200 },
    },
    metodoPago: { type: String, enum: METODOS_PAGO, required: true },
    estadoPedido: { type: String, enum: ESTADOS_PEDIDO, default: 'pendiente', index: true },
    estadoPago: { type: String, enum: ESTADOS_PAGO, default: 'pendiente', index: true },
    comprobantePagoUrl: { type: String, trim: true, maxlength: 500 },
    pagadoEn: { type: Date },
    notas: { type: String, trim: true, maxlength: 300 },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transform: (_doc, ret: any) => {
        delete ret.tokenAccesoHash
        return limpiarJson(_doc, ret)
      },
    },
  },
)

orderSchema.plugin(softDeletePlugin)
orderSchema.index({ estadoRegistro: 1, estadoPedido: 1, createdAt: -1 })

export type OrderDocument = HydratedDocument<IOrder>
export const Order: Model<IOrder> =
  (mongoose.models.Order as Model<IOrder>) || mongoose.model<IOrder>('Order', orderSchema)
