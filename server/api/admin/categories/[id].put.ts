import { getRouterParam, readBody } from 'h3'
import { objectIdSchema } from '../../../../shared/schemas/order'
import { categoriaActualizarSchema } from '../../../../shared/schemas/product'
import { Category } from '../../../models'
import { requireAdmin } from '../../../utils/auth'
import { apiError } from '../../../utils/errors'
import { defineApiHandler } from '../../../utils/handler'
import { slugify } from '../../../utils/slug'
import { getStorage } from '../../../utils/storage'

/** PUT /api/admin/categories/:id — renombra / cambia imagen / activa o desactiva una categoría. */
export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  const id = objectIdSchema.parse(getRouterParam(event, 'id'))
  const datos = categoriaActualizarSchema.parse(await readBody(event))

  if (datos.imagenUrl && !getStorage(event).esUrlPropia(datos.imagenUrl, 'categoria')) {
    throw apiError(422, 'La imagen debe subirse primero con POST /api/upload?scope=categoria.')
  }
  const categoria = await Category.findById(id)
  if (!categoria) throw apiError(404, 'Categoría no encontrada.')

  const slug = slugify(datos.nombre)
  if (!slug) throw apiError(422, 'El nombre de la categoría no es válido.')
  const repetida = await Category.exists({ slug, _id: { $ne: id } }).setOptions({ incluirEliminados: true } as never)
  if (repetida) throw apiError(409, 'Ya existe una categoría con ese nombre.', { code: 'duplicado', campo: 'nombre' })

  categoria.nombre = datos.nombre
  categoria.slug = slug
  categoria.imagenUrl = datos.imagenUrl || undefined
  categoria.estadoRegistro = datos.estadoRegistro
  await categoria.save()
  return categoria
})
