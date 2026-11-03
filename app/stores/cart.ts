import { aBs, aCentavos } from '~~/shared/utils/money'
import type { CarritoValidacionDTO } from '~~/shared/types'

export interface CartItem {
  productoId: string
  slug: string
  nombre: string
  imagen: string
  sku: string
  color: string
  talla: string
  /** Precio al público (Bs., IVA incluido) al agregar; el servidor siempre recalcula con el precio vigente. */
  precio: number
  cantidad: number
  /** Stock conocido (solo limita el selector; el servidor valida al comprar). */
  stock: number
}

export const CLAVE_CARRITO = 'vestiq.carrito.v1'
const MAX_POR_ITEM = 50

const esItemValido = (i: unknown): i is CartItem => {
  const x = i as Partial<CartItem> | null
  return !!x && typeof x.sku === 'string' && typeof x.productoId === 'string' && typeof x.precio === 'number'
    && Number.isInteger(x.cantidad) && (x.cantidad as number) > 0 && typeof x.stock === 'number'
}

/**
 * Carrito global (Pinia). Persiste en `localStorage` (plugins/cart.client.ts lo hidrata tras montar
 * la app —así no hay diferencias entre el HTML del servidor y el del cliente— y lo guarda en cada cambio).
 */
export const useCartStore = defineStore('cart', () => {
  const items = ref<CartItem[]>([])
  /** `true` cuando ya se leyó localStorage (evita mostrar «carrito vacío» por un instante). */
  const hidratado = ref(false)

  const cantidadTotal = computed(() => items.value.reduce((s, i) => s + i.cantidad, 0))
  /** Suma de ítems en Bs., IVA incluido (calculada en centavos). */
  const subtotal = computed(() => aBs(items.value.reduce((s, i) => s + aCentavos(i.precio) * i.cantidad, 0)))

  const limite = (i: Pick<CartItem, 'stock'>) => Math.max(1, Math.min(i.stock, MAX_POR_ITEM))
  const enCarrito = (sku: string) => items.value.find((i) => i.sku === sku)?.cantidad ?? 0

  function agregar(item: Omit<CartItem, 'cantidad'>, cantidad = 1) {
    const existente = items.value.find((i) => i.sku === item.sku)
    if (existente) {
      existente.stock = item.stock
      existente.precio = item.precio
      existente.cantidad = Math.min(existente.cantidad + cantidad, limite(existente))
    } else {
      items.value.push({ ...item, cantidad: Math.min(cantidad, limite(item)) })
    }
  }

  function cambiarCantidad(sku: string, cantidad: number) {
    const item = items.value.find((i) => i.sku === sku)
    if (item) item.cantidad = Math.max(1, Math.min(Math.floor(cantidad) || 1, limite(item)))
  }

  function quitar(sku: string) {
    items.value = items.value.filter((i) => i.sku !== sku)
  }

  function vaciar() {
    items.value = []
  }

  /** Aplica las disponibilidades informadas por el servidor tras un 409 de stock. */
  function ajustarAStock(disponibles: { sku: string; disponible: number }[]) {
    for (const d of disponibles) {
      const item = items.value.find((i) => i.sku === d.sku)
      if (!item) continue
      if (d.disponible <= 0) quitar(d.sku)
      else {
        item.stock = d.disponible
        item.cantidad = Math.min(item.cantidad, d.disponible)
      }
    }
  }

  /**
   * Consulta stock y precio vigentes (POST /api/cart/validar) y los aplica al carrito.
   * Devuelve los avisos para mostrarlos al cliente (producto agotado, cambio de precio…).
   */
  async function sincronizar(): Promise<string[]> {
    if (!items.value.length) return []
    const avisos: string[] = []
    try {
      const res = await $fetch<CarritoValidacionDTO>('/api/cart/validar', {
        method: 'POST',
        body: { items: items.value.map((i) => ({ productoId: i.productoId, sku: i.sku })) },
      })
      for (const r of res.items) {
        const item = items.value.find((i) => i.sku === r.sku)
        if (!item) continue
        if (!r.activo || r.disponible <= 0) {
          avisos.push(`«${item.nombre} (${item.color} / ${item.talla})» ya no está disponible y se quitó del carrito.`)
          quitar(item.sku)
          continue
        }
        if (r.precio !== item.precio) {
          avisos.push(`El precio de «${item.nombre}» cambió.`)
          item.precio = r.precio
        }
        if (item.cantidad > r.disponible) {
          avisos.push(`De «${item.nombre} (${item.color} / ${item.talla})» solo quedan ${r.disponible}.`)
        }
        item.stock = r.disponible
        item.cantidad = Math.min(item.cantidad, limite(item))
      }
    } catch {
      /* sin conexión: se valida igualmente al confirmar el pedido */
    }
    return avisos
  }

  // --- Persistencia (solo cliente) ---------------------------------------------
  function hidratar() {
    try {
      const guardado = JSON.parse(localStorage.getItem(CLAVE_CARRITO) ?? '[]') as unknown
      if (Array.isArray(guardado)) items.value = guardado.filter(esItemValido)
    } catch {
      /* carrito corrupto o sin almacenamiento: se ignora */
    }
    hidratado.value = true
  }

  function persistir() {
    try {
      localStorage.setItem(CLAVE_CARRITO, JSON.stringify(items.value))
    } catch {
      /* sin almacenamiento */
    }
  }

  return { items, hidratado, cantidadTotal, subtotal, enCarrito, agregar, cambiarCantidad, quitar, vaciar, ajustarAStock, sincronizar, hidratar, persistir }
})
