import { getValidatedQuery } from 'h3'
import { z } from 'zod'
import { TALLAS_SUGERIDAS } from '../../../shared/utils/bolivia'
import type { FiltrosDTO } from '../../../shared/types'
import { Category, Product } from '../../models'
import { defineApiHandler } from '../../utils/handler'

/**
 * GET /api/products/filtros?categoria=<slug> — facetas para los filtros dinámicos del catálogo:
 * colores y tallas con stock disponible y rango de precios (opcionalmente dentro de una categoría).
 */
export default defineApiHandler(async (event): Promise<FiltrosDTO> => {
  const { categoria } = await getValidatedQuery(event, z.object({ categoria: z.string().trim().max(100).optional() }).parse)

  const match: Record<string, unknown> = { estadoRegistro: 'activo' }
  if (categoria) {
    const cat = await Category.findOne({ slug: categoria, estadoRegistro: 'activo' }).select('_id')
    if (!cat) return { colores: [], tallas: [], precioMin: 0, precioMax: 0 }
    match.categoriaId = cat._id
  }

  const [res] = await Product.aggregate<{
    precios: { min: number; max: number }[]
    variantes: { colores: string[]; tallas: string[] }[]
  }>([
    { $match: match }, // aggregate() no pasa por el plugin de soft-delete: el filtro es explícito
    {
      $facet: {
        precios: [{ $group: { _id: null, min: { $min: '$precio' }, max: { $max: '$precio' } } }],
        variantes: [
          { $unwind: '$variantes' },
          { $match: { 'variantes.stock': { $gt: 0 } } },
          { $group: { _id: null, colores: { $addToSet: '$variantes.color' }, tallas: { $addToSet: '$variantes.talla' } } },
        ],
      },
    },
  ])

  const orden = (t: string) => {
    const i = (TALLAS_SUGERIDAS as readonly string[]).indexOf(t)
    return i === -1 ? TALLAS_SUGERIDAS.length : i
  }
  return {
    colores: [...(res?.variantes[0]?.colores ?? [])].sort((a, b) => a.localeCompare(b, 'es')),
    tallas: [...(res?.variantes[0]?.tallas ?? [])].sort((a, b) => orden(a) - orden(b) || a.localeCompare(b, 'es', { numeric: true })),
    precioMin: Math.floor(res?.precios[0]?.min ?? 0),
    precioMax: Math.ceil(res?.precios[0]?.max ?? 0),
  }
})
