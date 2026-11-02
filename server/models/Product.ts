import mongoose, { Schema, type HydratedDocument, type Model, type Types } from 'mongoose'
import type { EstadoRegistro } from '../../shared/utils/bolivia'
import { tieneMaximo2Decimales } from '../../shared/utils/money'
import { limpiarJson, softDeletePlugin } from './plugins/softDelete'

export interface IVariante {
  color: string
  talla: string
  stock: number
  /** Código único por variante (clave de inventario). */
  sku: string
}

export interface IProduct {
  nombre: string
  slug: string
  descripcion: string
  /** Precio al público en Bs., IVA incluido (2 decimales). */
  precio: number
  categoriaId: Types.ObjectId
  imagenes: string[]
  variantes: IVariante[]
  estadoRegistro: EstadoRegistro
  createdAt: Date
  updatedAt: Date
}

const varianteSchema = new Schema<IVariante>(
  {
    color: { type: String, trim: true, required: true, maxlength: 40 },
    talla: { type: String, trim: true, uppercase: true, required: true, maxlength: 10 },
    stock: {
      type: Number,
      required: true,
      min: [0, 'El stock no puede ser negativo'],
      validate: { validator: Number.isInteger, message: 'El stock debe ser un número entero' },
      default: 0,
    },
    sku: { type: String, trim: true, uppercase: true, required: true, maxlength: 40 },
  },
  { _id: false },
)

const productSchema = new Schema<IProduct>(
  {
    nombre: { type: String, trim: true, required: true, maxlength: 150 },
    slug: { type: String, trim: true, lowercase: true, required: true, unique: true, maxlength: 180 },
    descripcion: { type: String, trim: true, default: '', maxlength: 3000 },
    precio: {
      type: Number,
      required: true,
      min: [0.01, 'El precio debe ser mayor que cero'],
      validate: { validator: tieneMaximo2Decimales, message: 'El precio admite como máximo 2 decimales' },
    },
    categoriaId: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    imagenes: {
      type: [String],
      validate: [
        { validator: (v: string[]) => v.length >= 1, message: 'El producto necesita al menos una imagen' },
        { validator: (v: string[]) => v.length <= 8, message: 'Máximo 8 imágenes por producto' },
      ],
    },
    variantes: {
      type: [varianteSchema],
      validate: { validator: (v: IVariante[]) => v.length >= 1, message: 'El producto necesita al menos una variante' },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, transform: limpiarJson },
  },
)

productSchema.plugin(softDeletePlugin)

// SKU único en todo el catálogo (índice multikey) y consultas del listado.
productSchema.index({ 'variantes.sku': 1 }, { unique: true })
productSchema.index({ estadoRegistro: 1, categoriaId: 1, createdAt: -1 })
productSchema.index({ estadoRegistro: 1, precio: 1 })

// Reglas dentro del mismo producto: SKU y combinación color+talla no repetidos.
productSchema.pre('validate', function () {
  const skus = new Set<string>()
  const combos = new Set<string>()
  for (const v of this.variantes) {
    const sku = (v.sku ?? '').trim().toUpperCase()
    const combo = `${(v.color ?? '').trim().toLowerCase()}|${(v.talla ?? '').trim().toUpperCase()}`
    if (skus.has(sku)) this.invalidate('variantes', `SKU repetido: ${sku}`)
    if (combos.has(combo)) this.invalidate('variantes', `Variante repetida (color/talla): ${v.color} ${v.talla}`)
    skus.add(sku)
    combos.add(combo)
  }
})

productSchema.virtual('stockTotal').get(function () {
  return this.variantes.reduce((suma, v) => suma + v.stock, 0)
})

// Categoría poblable sin alterar `categoriaId`: Product.find().populate('categoria', 'nombre slug')
productSchema.virtual('categoria', {
  ref: 'Category',
  localField: 'categoriaId',
  foreignField: '_id',
  justOne: true,
})

export type ProductDocument = HydratedDocument<IProduct>
export const Product: Model<IProduct> =
  (mongoose.models.Product as Model<IProduct>) || mongoose.model<IProduct>('Product', productSchema)
