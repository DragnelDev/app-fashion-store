import { readBody, setResponseStatus } from 'h3'
import { categoriaCrearSchema } from '../../../shared/schemas/product'
import { Category } from '../../models'
import { requireAdmin } from '../../utils/auth'
import { apiError } from '../../utils/errors'
import { defineApiHandler } from '../../utils/handler'
import { slugify } from '../../utils/slug'
import { getStorage } from '../../utils/storage'

/** POST /api/categories — crea una categoría (admin). */
export default defineApiHandler(async (event) => {
  requireAdmin(event)
  const datos = categoriaCrearSchema.parse(await readBody(event))

  if (datos.imagenUrl && !getStorage(event).esUrlPropia(datos.imagenUrl, 'categoria')) {
    throw apiError(422, 'La imagen debe subirse primero con POST /api/upload?scope=categoria.')
  }

  // Una categoría repetida es casi siempre un error: se rechaza en lugar de renombrarla.
  const slug = slugify(datos.nombre)
  if (!slug) throw apiError(422, 'El nombre de la categoría no es válido.')
  const repetida = await Category.exists({ slug }).setOptions({ incluirEliminados: true } as never)
  if (repetida) throw apiError(409, 'Ya existe una categoría con ese nombre.', { code: 'duplicado', campo: 'nombre' })
  const categoria = await Category.create({ nombre: datos.nombre, slug, imagenUrl: datos.imagenUrl })
  setResponseStatus(event, 201)
  return categoria
})
