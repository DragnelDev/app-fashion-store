<script setup lang="ts">
import { erroresPorCampo } from '~~/shared/schemas/order'
import { registroSchema } from '~~/shared/schemas/auth'

definePageMeta({ middleware: 'guest' })
useSeoMeta({ title: 'Crear cuenta · Vestiq', robots: 'noindex' })

const route = useRoute()
const auth = useAuthStore()

const form = reactive({ nombre: '', apellido: '', email: '', telefono: '', password: '' })
const errores = ref<Record<string, string>>({})
const errorGeneral = ref('')
const enviando = ref(false)

async function enviar() {
  errorGeneral.value = ''
  const valida = registroSchema.safeParse(form)
  if (!valida.success) {
    errores.value = erroresPorCampo(valida.error)
    return
  }
  errores.value = {}
  enviando.value = true
  try {
    await auth.registrar(form)
    await navigateTo(rutaInternaSegura(route.query.redirect, '/cuenta'))
  } catch (e) {
    errores.value = erroresDeApi(e)
    const duplicado = (e as { data?: { data?: { code?: string } } })?.data?.data?.code === 'duplicado'
    if (duplicado) errores.value = { email: 'Ya existe una cuenta con ese correo.' }
    errorGeneral.value = mensajeDeError(e)
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-lg">
    <div class="tarjeta space-y-5">
      <div>
        <h1 class="text-2xl font-extrabold text-stone-900">Crear cuenta</h1>
        <p class="mt-1 text-sm text-stone-500">Guarde sus direcciones y sus datos de facturación (NIT/CI) para comprar más rápido.</p>
      </div>

      <form class="grid gap-4 sm:grid-cols-2" novalidate @submit.prevent="enviar">
        <CampoForm v-slot="{ id, describedby }" label="Nombre" :error="errores.nombre" requerido>
          <input :id="id" v-model="form.nombre" class="campo" autocomplete="given-name" :aria-describedby="describedby" />
        </CampoForm>
        <CampoForm v-slot="{ id, describedby }" label="Apellido" :error="errores.apellido" requerido>
          <input :id="id" v-model="form.apellido" class="campo" autocomplete="family-name" :aria-describedby="describedby" />
        </CampoForm>
        <CampoForm v-slot="{ id, describedby }" label="Correo electrónico" :error="errores.email" requerido class="sm:col-span-2">
          <input :id="id" v-model="form.email" type="email" class="campo" autocomplete="email" :aria-describedby="describedby" />
        </CampoForm>
        <CampoForm v-slot="{ id, describedby }" label="Celular (opcional)" :error="errores.telefono" class="sm:col-span-2">
          <div class="flex">
            <span class="inline-flex items-center rounded-l-lg border border-r-0 border-stone-300 bg-stone-100 px-3 text-sm text-stone-600">+591</span>
            <input :id="id" v-model="form.telefono" class="campo rounded-l-none" inputmode="numeric" autocomplete="tel-national" maxlength="12" placeholder="71234567" :aria-describedby="describedby" />
          </div>
        </CampoForm>
        <CampoForm v-slot="{ id, describedby }" label="Contraseña" :error="errores.password" ayuda="Mínimo 8 caracteres, con al menos una letra y un número." requerido class="sm:col-span-2">
          <input :id="id" v-model="form.password" type="password" class="campo" autocomplete="new-password" :aria-describedby="describedby" />
        </CampoForm>

        <p v-if="errorGeneral && !Object.keys(errores).length" class="aviso-error sm:col-span-2" role="alert">{{ errorGeneral }}</p>

        <button type="submit" class="btn-primario sm:col-span-2" :disabled="enviando">{{ enviando ? 'Creando cuenta…' : 'Crear cuenta' }}</button>
      </form>

      <p class="text-center text-sm text-stone-600">
        ¿Ya tiene cuenta?
        <NuxtLink :to="{ path: '/login', query: route.query.redirect ? { redirect: String(route.query.redirect) } : {} }" class="font-semibold text-brand-800 underline">Ingresar</NuxtLink>
      </p>
    </div>
  </div>
</template>
