<script setup lang="ts">
import type { MetodoPago } from '~~/shared/utils/bolivia'
import { formatearBs } from '~~/shared/utils/money'

defineProps<{ metodo: MetodoPago; total: number }>()
const { public: publica } = useRuntimeConfig()
const pago = publica.pago
</script>

<template>
  <div class="rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm">
    <template v-if="metodo === 'qr'">
      <div class="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <img :src="pago.qrImageUrl" alt="Código QR de pago" class="h-44 w-44 rounded-lg border border-stone-200 bg-white object-contain p-2" />
        <div class="space-y-2">
          <p class="font-semibold text-stone-900">Pague con QR desde la app de su banco</p>
          <ol class="list-inside list-decimal space-y-1 text-stone-600">
            <li>Abra la app de su banco y escoja «Pagar con QR».</li>
            <li>Escanee el código y pague <strong class="text-stone-900">{{ formatearBs(total) }}</strong>.</li>
            <li>Tome una captura del comprobante y adjúntela abajo (también puede hacerlo después).</li>
          </ol>
          <p class="text-xs text-stone-500">Compatible con {{ pago.qrBancos }}. Titular: {{ pago.titular }}.</p>
        </div>
      </div>
    </template>

    <template v-else-if="metodo === 'transferencia'">
      <p class="font-semibold text-stone-900">Transferencia bancaria</p>
      <dl v-if="pago.transferenciaCuenta" class="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt class="text-stone-500">Banco</dt><dd>{{ pago.transferenciaBanco }}</dd>
        <dt class="text-stone-500">Cuenta</dt><dd class="font-mono">{{ pago.transferenciaCuenta }}</dd>
        <dt class="text-stone-500">Titular</dt><dd>{{ pago.titular }}</dd>
        <dt class="text-stone-500">Monto</dt><dd class="font-semibold">{{ formatearBs(total) }}</dd>
      </dl>
      <p v-else class="mt-1 text-stone-600">Le enviaremos los datos de la cuenta por correo o WhatsApp tras confirmar el pedido.</p>
      <p class="mt-2 text-xs text-stone-500">Adjunte la foto o captura del comprobante abajo (también puede hacerlo después).</p>
    </template>

    <template v-else>
      <p class="font-semibold text-stone-900">Pago contra entrega (efectivo)</p>
      <p class="mt-1 text-stone-600">Pagará <strong class="text-stone-900">{{ formatearBs(total) }}</strong> en efectivo al recibir su pedido. Tenga el monto exacto o cambio a mano.</p>
    </template>
  </div>
</template>
