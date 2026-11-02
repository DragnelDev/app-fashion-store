import { Category } from '../../models'
import { defineApiHandler } from '../../utils/handler'

/** GET /api/categories — categorías activas ordenadas por nombre. */
export default defineApiHandler(async () => {
  return Category.find({ estadoRegistro: 'activo' }).sort({ nombre: 1 })
})
