import { readBody, setResponseStatus } from 'h3'
import { productoCrearSchema } from '../../../shared/schemas/product'
import { Category, Product } from '../../models'
import { requireAdmin } from '../../utils/auth'
import { apiError } from '../../utils/errors'
import { defineApiHandler } from '../../utils/handler'
import { generarSku } from '../../utils/sku'
import { slugUnico } from '../../utils/slug'
import { getStorage } from '../../utils/storage'

/**
 * POST /api/products (admin) — crea un producto con varias variantes e imágenes.
 * Las imágenes deben haberse subido antes con POST /api/upload?scope=producto.
 * Precio en Bs. con IVA incluido.
 */
export default defineApiHandler(async (event) => {
  requireAdmin(event)
  const datos = productoCrearSchema.parse(await readBody(event))

  const storage = getStorage(event)
  const ajena = datos.imagenes.find((url) => !storage.esUrlPropia(url, 'producto'))
  if (ajena) throw apiError(422, 'Todas las imágenes deben subirse primero con POST /api/upload?scope=producto.')

  const categoria = await Category.exists({ _id: datos.categoriaId, estadoRegistro: 'activo' })
  if (!categoria) throw apiError(422, 'La categoría indicada no existe o está inactiva.')

  const skusIndicados = datos.variantes.map((v) => v.sku?.trim().toUpperCase()).filter((s): s is string => !!s)
  if (skusIndicados.length) {
    const tomado = await Product.findOne({ 'variantes.sku': { $in: skusIndicados } })
      .setOptions({ incluirEliminados: true } as never)
      .select('variantes.sku')
    if (tomado) throw apiError(409, 'Alguno de los SKU indicados ya existe en otro producto.', { code: 'duplicado', campo: 'sku' })
  }

  const slug = await slugUnico(datos.nombre, async (s) =>
    !!(await Product.exists({ slug: s }).setOptions({ incluirEliminados: true } as never)),
  )

  const producto = await Product.create({
    nombre: datos.nombre,
    slug,
    descripcion: datos.descripcion,
    precio: datos.precio,
    categoriaId: datos.categoriaId,
    imagenes: datos.imagenes,
    variantes: datos.variantes.map((v) => ({
      color: v.color,
      talla: v.talla,
      stock: v.stock,
      sku: v.sku || generarSku(datos.nombre, v.color, v.talla),
    })),
  })

  setResponseStatus(event, 201)
  return producto
})
