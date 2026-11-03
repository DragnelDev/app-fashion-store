<script setup lang="ts">
import { erroresPorCampo } from '~~/shared/schemas/order'
import { loginSchema } from '~~/shared/schemas/auth'

definePageMeta({ middleware: 'guest' })
useSeoMeta({ title: 'Ingresar · Vestiq', robots: 'noindex' })

const route = useRoute()
const auth = useAuthStore()

const form = reactive({ email: '', password: '' })
const errores = ref<Record<string, string>>({})
const errorGeneral = ref('')
const enviando = ref(false)

async function enviar() {
  errorGeneral.value = ''
  const valida = loginSchema.safeParse(form)
  if (!valida.success) {
    errores.value = erroresPorCampo(valida.error)
    return
  }
  errores.value = {}
  enviando.value = true
  try {
    const usuario = await auth.login(form)
    const destino = rutaInternaSegura(route.query.redirect, usuario.rol === 'admin' ? '/admin' : '/cuenta')
    await navigateTo(destino)
  } catch (e) {
    errorGeneral.value = mensajeDeError(e)
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-md">
    <div class="tarjeta space-y-5">
      <div>
        <h1 class="text-2xl font-extrabold text-stone-900">Ingresar</h1>
        <p class="mt-1 text-sm text-stone-500">Acceda a sus pedidos, direcciones y datos de facturación.</p>
      </div>

      <form class="space-y-4" novalidate @submit.prevent="enviar">
        <CampoForm v-slot="{ id, describedby }" label="Correo electrónico" :error="errores.email" requerido>
          <input :id="id" v-model="form.email" type="email" class="campo" autocomplete="email" :aria-describedby="describedby" />
        </CampoForm>
        <CampoForm v-slot="{ id, describedby }" label="Contraseña" :error="errores.password" requerido>
          <input :id="id" v-model="form.password" type="password" class="campo" autocomplete="current-password" :aria-describedby="describedby" />
        </CampoForm>

        <p v-if="errorGeneral" class="aviso-error" role="alert">{{ errorGeneral }}</p>

        <button type="submit" class="btn-primario w-full" :disabled="enviando">{{ enviando ? 'Ingresando…' : 'Ingresar' }}</button>
      </form>

      <p class="text-center text-sm text-stone-600">
        ¿No tiene cuenta?
        <NuxtLink :to="{ path: '/registro', query: route.query.redirect ? { redirect: String(route.query.redirect) } : {} }" class="font-semibold text-brand-800 underline">Crear una cuenta</NuxtLink>
      </p>
    </div>
  </div>
</template>
