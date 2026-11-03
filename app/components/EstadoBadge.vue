<script setup lang="ts">
import {
  ETIQUETA_ESTADO_PAGO, ETIQUETA_ESTADO_PEDIDO, ETIQUETA_METODO_PAGO,
  type EstadoPago, type EstadoPedido, type MetodoPago,
} from '~~/shared/utils/bolivia'

/** Insignia de color para estados. Uso: <EstadoBadge tipo="pedido" valor="enviado" /> */
const props = defineProps<
  | { tipo: 'pedido'; valor: EstadoPedido }
  | { tipo: 'pago'; valor: EstadoPago }
  | { tipo: 'metodo'; valor: MetodoPago }
  | { tipo: 'registro'; valor: 'activo' | 'inactivo' | 'eliminado' }
>()

const COLOR_PEDIDO: Record<EstadoPedido, string> = {
  pendiente: 'insignia-ambar', procesando: 'insignia-azul', enviado: 'insignia-azul', entregado: 'insignia-verde', cancelado: 'insignia-roja',
}
const COLOR_PAGO: Record<EstadoPago, string> = { pendiente: 'insignia-ambar', pagado: 'insignia-verde', rechazado: 'insignia-roja' }

const info = computed(() => {
  const p = props as { tipo: string; valor: string }
  switch (p.tipo) {
    case 'pedido': return { clase: COLOR_PEDIDO[p.valor as EstadoPedido], texto: ETIQUETA_ESTADO_PEDIDO[p.valor as EstadoPedido] }
    case 'pago': return { clase: COLOR_PAGO[p.valor as EstadoPago], texto: ETIQUETA_ESTADO_PAGO[p.valor as EstadoPago] }
    case 'metodo': return { clase: 'insignia-gris', texto: ETIQUETA_METODO_PAGO[p.valor as MetodoPago] }
    default: return { clase: p.valor === 'activo' ? 'insignia-verde' : 'insignia-gris', texto: p.valor === 'activo' ? 'Activo' : p.valor === 'inactivo' ? 'Inactivo' : 'Eliminado' }
  }
})
</script>

<template>
  <span :class="info.clase">{{ info.texto }}</span>
</template>
