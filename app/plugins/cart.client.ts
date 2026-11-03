import { CLAVE_CARRITO } from '~/stores/cart'

/** Hidrata el carrito desde localStorage tras montar la app, lo guarda en cada cambio y lo sincroniza entre pestañas. */
export default defineNuxtPlugin((nuxtApp) => {
  const cart = useCartStore(nuxtApp.$pinia)

  nuxtApp.hook('app:mounted', () => {
    cart.hidratar()
    watch(() => cart.items, () => cart.persistir(), { deep: true })
    window.addEventListener('storage', (e) => {
      if (e.key === CLAVE_CARRITO) cart.hidratar()
    })
  })
})
