import { z } from 'zod'
import { objectIdSchema } from './order'
import { tieneMaximo2Decimales } from '../utils/money'

const texto = (etiqueta: string, min: number, max: number) =>
  z.string({ error: `${etiqueta} es obligatorio` }).trim().min(min, `${etiqueta} es muy corto`).max(max, `${etiqueta} es muy largo`)

export const varianteInputSchema = z.object({
  color: texto('El color', 1, 40),
  talla: texto('La talla', 1, 10),
  stock: z.number({ error: 'Stock inválido' }).int('El stock debe ser entero').min(0, 'El stock no puede ser negativo').max(100_000),
  /** Opcional: si se omite, el servidor genera uno único. */
  sku: z.string().trim().max(40).optional(),
})

export const productoCrearSchema = z.object({
  nombre: texto('El nombre', 3, 150),
  descripcion: z.string().trim().max(3000).optional().default(''),
  /** Precio al público en Bs., IVA incluido. */
  precio: z
    .number({ error: 'Precio inválido' })
    .positive('El precio debe ser mayor que cero')
    .max(1_000_000)
    .refine(tieneMaximo2Decimales, 'El precio admite como máximo 2 decimales'),
  categoriaId: objectIdSchema,
  imagenes: z.array(z.string().trim().min(1).max(500)).min(1, 'Suba al menos una imagen').max(8, 'Máximo 8 imágenes'),
  variantes: z.array(varianteInputSchema).min(1, 'Agregue al menos una variante').max(60),
})
export type ProductoCrearInput = z.input<typeof productoCrearSchema>

const estadoEditable = z.enum(['activo', 'inactivo'], { error: 'Estado inválido' })

/** PUT /api/admin/products/:id — igual que el alta, más el estado y el token de concurrencia. */
export const productoActualizarSchema = productoCrearSchema.extend({
  estadoRegistro: estadoEditable,
  /** `updatedAt` (ISO) del producto tal como lo cargó el administrador: evita pisar ventas recientes. */
  actualizadoEn: z.string().min(1, 'Falta la versión del producto'),
})
export type ProductoActualizarInput = z.input<typeof productoActualizarSchema>

export const adminListadoQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  estado: z.enum(['activo', 'inactivo']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const productoQuerySchema = z.object({
  /** slug de categoría */
  categoria: z.string().trim().max(100).optional(),
  talla: z.string().trim().max(10).optional(),
  color: z.string().trim().max(40).optional(),
  q: z.string().trim().max(80).optional(),
  /** Rango de precios en Bs. (IVA incluido). */
  precioMin: z.coerce.number().min(0).max(1_000_000).optional(),
  precioMax: z.coerce.number().min(0).max(1_000_000).optional(),
  orden: z.enum(['recientes', 'precio_asc', 'precio_desc']).default('recientes'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(12),
})

export const categoriaCrearSchema = z.object({
  nombre: texto('El nombre', 2, 80),
  imagenUrl: z.string().trim().max(500).optional(),
})
export type CategoriaCrearInput = z.input<typeof categoriaCrearSchema>

export const categoriaActualizarSchema = categoriaCrearSchema.extend({ estadoRegistro: estadoEditable })
