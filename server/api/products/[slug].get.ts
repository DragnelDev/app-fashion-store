import { getRouterParam } from 'h3'
import { Product } from '../../models'
import { apiError } from '../../utils/errors'
import { defineApiHandler } from '../../utils/handler'

/** GET /api/products/:slug — detalle de un producto activo. */
export default defineApiHandler(async (event) => {
  const slug = (getRouterParam(event, 'slug') ?? '').toLowerCase()
  const producto = await Product.findOne({ slug, estadoRegistro: 'activo' }).populate('categoria', 'nombre slug')
  if (!producto) throw apiError(404, 'Producto no encontrado.')
  return producto
})
