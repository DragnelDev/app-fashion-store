import { getRouterParam, readBody } from 'h3'
import { objectIdSchema } from '../../../../shared/schemas/order'
import { productoActualizarSchema } from '../../../../shared/schemas/product'
import { Category, Product } from '../../../models'
import { requireAdmin } from '../../../utils/auth'
import { apiError } from '../../../utils/errors'
import { defineApiHandler } from '../../../utils/handler'
import { generarSku } from '../../../utils/sku'
import { getStorage } from '../../../utils/storage'

/**
 * PUT /api/admin/products/:id — edita un producto (datos, imágenes, variantes y estado).
 *
 * Control de concurrencia: el body incluye `actualizadoEn` (el `updatedAt` que el administrador
 * cargó). Cada venta modifica `updatedAt`, así que si el producto cambió mientras se editaba, la
 * escritura se rechaza con 409 y NO se pisa el stock con valores obsoletos (evita sobreventa).
 */
export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  const id = objectIdSchema.parse(getRouterParam(event, 'id'))
  const datos = productoActualizarSchema.parse(await readBody(event))

  const storage = getStorage(event)
  if (datos.imagenes.some((url) => !storage.esUrlPropia(url, 'producto'))) {
    throw apiError(422, 'Todas las imágenes deben subirse primero con POST /api/upload?scope=producto.')
  }
  if (!(await Category.exists({ _id: datos.categoriaId, estadoRegistro: { $ne: 'eliminado' } }))) {
    throw apiError(422, 'La categoría indicada no existe.')
  }

  const producto = await Product.findById(id)
  if (!producto) throw apiError(404, 'Producto no encontrado.')

  const version = producto.updatedAt
  const esperada = new Date(datos.actualizadoEn)
  const conflicto = () =>
    apiError(409, 'El producto cambió mientras lo editaba (por ejemplo, por una venta). Recargue la página y vuelva a aplicar sus cambios.', {
      code: 'conflicto_version',
    })
  if (Number.isNaN(esperada.getTime()) || esperada.getTime() !== version.getTime()) throw conflicto()

  producto.set({
    nombre: datos.nombre,
    descripcion: datos.descripcion,
    precio: datos.precio,
    categoriaId: datos.categoriaId,
    imagenes: datos.imagenes,
    estadoRegistro: datos.estadoRegistro,
    variantes: datos.variantes.map((v) => ({
      color: v.color,
      talla: v.talla,
      stock: v.stock,
      sku: v.sku?.trim() || generarSku(datos.nombre, v.color, v.talla),
    })),
  })
  await producto.validate() // reglas del modelo: SKU y color+talla únicos dentro del producto, precio, stock…

  const skus = producto.variantes.map((v) => v.sku)
  const otro = await Product.findOne({ _id: { $ne: id }, 'variantes.sku': { $in: skus } })
    .setOptions({ incluirEliminados: true } as never)
    .select('_id')
  if (otro) throw apiError(409, 'Alguno de los SKU ya existe en otro producto.', { code: 'duplicado', campo: 'sku' })

  // Escritura atómica condicionada a la versión leída (el slug se mantiene: no rompe enlaces).
  const res = await Product.updateOne(
    { _id: id, updatedAt: version },
    {
      $set: {
        nombre: producto.nombre,
        descripcion: producto.descripcion,
        precio: producto.precio,
        categoriaId: producto.categoriaId,
        imagenes: producto.imagenes,
        estadoRegistro: producto.estadoRegistro,
        variantes: producto.variantes.map((v) => ({ color: v.color, talla: v.talla, stock: v.stock, sku: v.sku })),
      },
    },
  ).setOptions({ incluirEliminados: true } as never)
  if (res.matchedCount !== 1) throw conflicto()

  return Product.findById(id).populate('categoria', 'nombre slug')
})
