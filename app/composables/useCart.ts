import { aBs, aCentavos } from '~~/shared/utils/money'

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
  /** Stock conocido al agregar (solo para limitar el selector; el servidor valida). */
  stock: number
}

const CLAVE = 'vestiq.carrito.v1'
const MAX_POR_ITEM = 50

export function useCart() {
  const items = useState<CartItem[]>('carrito', () => [])

  const cantidadTotal = computed(() => items.value.reduce((s, i) => s + i.cantidad, 0))
  const subtotal = computed(() => aBs(items.value.reduce((s, i) => s + aCentavos(i.precio) * i.cantidad, 0)))

  const limite = (i: Pick<CartItem, 'stock'>) => Math.max(1, Math.min(i.stock, MAX_POR_ITEM))

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

  const quitar = (sku: string) => {
    items.value = items.value.filter((i) => i.sku !== sku)
  }
  const vaciar = () => {
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

  return { items, cantidadTotal, subtotal, agregar, cambiarCantidad, quitar, vaciar, ajustarAStock }
}

/** Carga/guarda el carrito en localStorage. Se llama una vez desde app.vue (solo cliente). */
export function usePersistenciaCarrito() {
  const { items } = useCart()
  onMounted(() => {
    try {
      const guardado = JSON.parse(localStorage.getItem(CLAVE) ?? '[]') as CartItem[]
      if (Array.isArray(guardado)) items.value = guardado.filter((i) => i?.sku && i.cantidad > 0)
    } catch {
      /* carrito corrupto: se ignora */
    }
    watch(items, (v) => {
      try { localStorage.setItem(CLAVE, JSON.stringify(v)) } catch { /* sin almacenamiento */ }
    }, { deep: true })
  })
}
