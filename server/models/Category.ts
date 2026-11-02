import mongoose, { Schema, type HydratedDocument, type Model } from 'mongoose'
import type { EstadoRegistro } from '../../shared/utils/bolivia'
import { limpiarJson, softDeletePlugin } from './plugins/softDelete'

export interface ICategory {
  nombre: string
  slug: string
  imagenUrl?: string
  estadoRegistro: EstadoRegistro
  createdAt: Date
  updatedAt: Date
}

const categorySchema = new Schema<ICategory>(
  {
    nombre: { type: String, trim: true, required: true, maxlength: 80 },
    // El slug es minúsculas y sin acentos: garantiza unicidad insensible a mayúsculas/tildes.
    slug: { type: String, trim: true, lowercase: true, required: true, unique: true, maxlength: 100 },
    imagenUrl: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true, toJSON: { virtuals: true, transform: limpiarJson } },
)

categorySchema.plugin(softDeletePlugin)

export type CategoryDocument = HydratedDocument<ICategory>
export const Category: Model<ICategory> =
  (mongoose.models.Category as Model<ICategory>) || mongoose.model<ICategory>('Category', categorySchema)
