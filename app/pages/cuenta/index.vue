<script setup lang="ts">
import { cambiarPasswordSchema, perfilSchema } from '~~/shared/schemas/auth'
import { erroresPorCampo } from '~~/shared/schemas/order'
import { CIUDADES_BOLIVIA, ETIQUETA_DOCUMENTO, TIPOS_DOCUMENTO, type CiudadBolivia, type TipoDocumento } from '~~/shared/utils/bolivia'

definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Mi cuenta · Vestiq', robots: 'noindex' })

const auth = useAuthStore()

interface DireccionForm {
  alias: string
  ciudad: '' | CiudadBolivia
  zona: string
  direccion: string
  referencia: string
  esPrincipal: boolean
}
const direccionVacia = (): DireccionForm => ({ alias: 'Casa', ciudad: '', zona: '', direccion: '', referencia: '', esPrincipal: false })

const form = reactive({
  nombre: '',
  apellido: '',
  /** Solo los 8 dígitos; el prefijo +591 lo agrega el servidor. */
  telefono: '',
  direcciones: [] as DireccionForm[],
  guardarDocumento: false,
  documento: { tipo: 'CI' as TipoDocumento, numero: '', complemento: '', razonSocial: '' },
})

function cargar() {
  const u = auth.usuario
  if (!u) return
  form.nombre = u.nombre
  form.apellido = u.apellido
  form.telefono = (u.telefono ?? '').replace(/^\+591/, '')
  form.direcciones = u.direcciones.map((d) => ({
    alias: d.alias, ciudad: d.ciudad, zona: d.zona, direccion: d.direccion, referencia: d.referencia ?? '', esPrincipal: d.esPrincipal,
  }))
  form.guardarDocumento = !!u.documento
  form.documento = {
    tipo: u.documento?.tipo ?? 'CI',
    numero: u.documento?.numero ?? '',
    complemento: u.documento?.complemento ?? '',
    razonSocial: u.documento?.razonSocial ?? '',
  }
}
cargar()

watch(() => form.documento.tipo, (t) => { if (t !== 'CI') form.documento.complemento = '' })

const agregarDireccion = () => {
  if (form.direcciones.length >= 10) return
  form.direcciones.push({ ...direccionVacia(), esPrincipal: form.direcciones.length === 0 })
}
const quitarDireccion = (i: number) => {
  const eraPrincipal = form.direcciones[i]?.esPrincipal
  form.direcciones.splice(i, 1)
  if (eraPrincipal && form.direcciones[0]) form.direcciones[0].esPrincipal = true
}
const marcarPrincipal = (i: number) => form.direcciones.forEach((d, j) => { d.esPrincipal = i === j })

// --- Guardar perfil -------------------------------------------------------------------
const errores = ref<Record<string, string>>({})
const errorGeneral = ref('')
const mensaje = ref('')
const guardando = ref(false)

function construirPayload() {
  return {
    nombre: form.nombre,
    apellido: form.apellido,
    telefono: form.telefono.trim(),
    direcciones: form.direcciones.map((d) => ({ ...d })),
    documento: form.guardarDocumento ? { ...form.documento } : null,
  }
}

async function guardar() {
  errorGeneral.value = ''
  mensaje.value = ''
  const valida = perfilSchema.safeParse(construirPayload())
  if (!valida.success) {
    errores.value = erroresPorCampo(valida.error)
    errorGeneral.value = 'Revise los campos marcados.'
    return
  }
  errores.value = {}
  guardando.value = true
  try {
    await auth.actualizarPerfil(construirPayload() as Parameters<typeof auth.actualizarPerfil>[0])
    cargar()
    mensaje.value = 'Sus datos fueron guardados.'
  } catch (e) {
    errores.value = erroresDeApi(e)
    errorGeneral.value = mensajeDeError(e)
  } finally {
    guardando.value = false
  }
}

// --- Contraseña -------------------------------------------------------------------------
const pw = reactive({ actual: '', nueva: '' })
const pwErrores = ref<Record<string, string>>({})
const pwError = ref('')
const pwMensaje = ref('')
const pwGuardando = ref(false)

async function cambiarPassword() {
  pwError.value = ''
  pwMensaje.value = ''
  const valida = cambiarPasswordSchema.safeParse(pw)
  if (!valida.success) {
    pwErrores.value = erroresPorCampo(valida.error)
    return
  }
  pwErrores.value = {}
  pwGuardando.value = true
  try {
    await $fetch('/api/auth/password', { method: 'PATCH', body: { actual: pw.actual, nueva: pw.nueva } })
    pw.actual = ''
    pw.nueva = ''
    pwMensaje.value = 'Contraseña actualizada. Se cerró su sesión en otros dispositivos.'
  } catch (e) {
    pwErrores.value = erroresDeApi(e)
    pwError.value = mensajeDeError(e)
  } finally {
    pwGuardando.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl">
    <h1 class="mb-1 text-2xl font-extrabold text-stone-900">Mi cuenta</h1>
    <p class="mb-5 text-sm text-stone-500">{{ auth.usuario?.email }}</p>
    <CuentaTabs />

    <form class="space-y-6" novalidate @submit.prevent="guardar">
      <section class="tarjeta space-y-4" aria-labelledby="h-datos">
        <h2 id="h-datos" class="text-lg font-bold">Datos personales</h2>
        <div class="grid gap-4 sm:grid-cols-2">
          <CampoForm v-slot="{ id, describedby }" label="Nombre" :error="errores.nombre" requerido>
            <input :id="id" v-model="form.nombre" class="campo" autocomplete="given-name" :aria-describedby="describedby" />
          </CampoForm>
          <CampoForm v-slot="{ id, describedby }" label="Apellido" :error="errores.apellido" requerido>
            <input :id="id" v-model="form.apellido" class="campo" autocomplete="family-name" :aria-describedby="describedby" />
          </CampoForm>
          <CampoForm v-slot="{ id, describedby }" label="Celular / WhatsApp" :error="errores.telefono" class="sm:col-span-2">
            <div class="flex">
              <span class="inline-flex items-center rounded-l-lg border border-r-0 border-stone-300 bg-stone-100 px-3 text-sm text-stone-600">+591</span>
              <input :id="id" v-model="form.telefono" class="campo rounded-l-none" inputmode="numeric" autocomplete="tel-national" maxlength="12" placeholder="71234567" :aria-describedby="describedby" />
            </div>
          </CampoForm>
        </div>
      </section>

      <section class="tarjeta space-y-4" aria-labelledby="h-dir">
        <div class="flex items-center justify-between">
          <h2 id="h-dir" class="text-lg font-bold">Direcciones de envío</h2>
          <button type="button" class="btn-secundario btn-sm" :disabled="form.direcciones.length >= 10" @click="agregarDireccion">+ Agregar dirección</button>
        </div>
        <p v-if="errores.direcciones" class="campo-error" role="alert">{{ errores.direcciones }}</p>
        <p v-if="!form.direcciones.length" class="text-sm text-stone-500">Aún no guardó direcciones. Agregue una para autocompletar el checkout.</p>

        <fieldset v-for="(d, i) in form.direcciones" :key="i" class="space-y-3 rounded-xl border border-stone-200 p-4">
          <legend class="px-1 text-sm font-semibold text-stone-700">Dirección {{ i + 1 }}</legend>
          <div class="grid gap-3 sm:grid-cols-2">
            <CampoForm v-slot="{ id, describedby }" label="Nombre (ej. Casa, Oficina)" :error="errores[`direcciones.${i}.alias`]" requerido>
              <input :id="id" v-model="d.alias" class="campo" :aria-describedby="describedby" />
            </CampoForm>
            <CampoForm v-slot="{ id, describedby }" label="Ciudad" :error="errores[`direcciones.${i}.ciudad`]" requerido>
              <select :id="id" v-model="d.ciudad" class="campo" :aria-describedby="describedby">
                <option value="" disabled>Seleccione…</option>
                <option v-for="c in CIUDADES_BOLIVIA" :key="c" :value="c">{{ c }}</option>
              </select>
            </CampoForm>
            <CampoForm v-slot="{ id, describedby }" label="Zona / barrio" :error="errores[`direcciones.${i}.zona`]" requerido>
              <input :id="id" v-model="d.zona" class="campo" :aria-describedby="describedby" />
            </CampoForm>
            <CampoForm v-slot="{ id, describedby }" label="Dirección (calle y número)" :error="errores[`direcciones.${i}.direccion`]" requerido>
              <input :id="id" v-model="d.direccion" class="campo" :aria-describedby="describedby" />
            </CampoForm>
            <CampoForm v-slot="{ id }" label="Referencia (opcional)" class="sm:col-span-2">
              <input :id="id" v-model="d.referencia" class="campo" placeholder="Edificio, color de puerta, cerca de…" />
            </CampoForm>
          </div>
          <div class="flex items-center justify-between">
            <label class="flex items-center gap-2 text-sm text-stone-700">
              <input type="radio" name="principal" class="accent-brand-800" :checked="d.esPrincipal" @change="marcarPrincipal(i)" /> Dirección principal
            </label>
            <button type="button" class="text-xs font-medium text-red-600 hover:underline" @click="quitarDireccion(i)">Quitar</button>
          </div>
        </fieldset>
      </section>

      <section class="tarjeta space-y-4" aria-labelledby="h-fact">
        <div>
          <h2 id="h-fact" class="text-lg font-bold">Facturación por defecto</h2>
          <p class="mt-1 text-sm text-stone-500">NIT o CI y razón social que se usarán para su recibo en cada compra.</p>
        </div>
        <label class="flex items-center gap-2 text-sm font-medium text-stone-700">
          <input v-model="form.guardarDocumento" type="checkbox" class="accent-brand-800" /> Guardar mis datos de facturación
        </label>
        <div v-if="form.guardarDocumento" class="grid gap-4 sm:grid-cols-6">
          <CampoForm v-slot="{ id, describedby }" label="Tipo de documento" :error="errores['documento.tipoDocumento']" requerido class="sm:col-span-3">
            <select :id="id" v-model="form.documento.tipo" class="campo" :aria-describedby="describedby">
              <option v-for="t in TIPOS_DOCUMENTO" :key="t" :value="t">{{ ETIQUETA_DOCUMENTO[t] }}</option>
            </select>
          </CampoForm>
          <CampoForm v-slot="{ id, describedby }" :label="form.documento.tipo === 'NIT' ? 'Número de NIT' : 'Número de documento'" :error="errores['documento.numeroDocumento']" requerido :class="form.documento.tipo === 'CI' ? 'sm:col-span-2' : 'sm:col-span-3'">
            <input :id="id" v-model="form.documento.numero" class="campo" inputmode="numeric" autocomplete="off" :aria-describedby="describedby" />
          </CampoForm>
          <CampoForm v-if="form.documento.tipo === 'CI'" v-slot="{ id, describedby }" label="Complemento" :error="errores['documento.complemento']" ayuda="Ej. 1A (si tiene)">
            <input :id="id" v-model="form.documento.complemento" class="campo uppercase" maxlength="2" autocomplete="off" :aria-describedby="describedby" />
          </CampoForm>
          <CampoForm v-slot="{ id, describedby }" label="Razón social / Nombre" :error="errores['documento.razonSocial']" requerido class="sm:col-span-6">
            <input :id="id" v-model="form.documento.razonSocial" class="campo" autocomplete="organization" :aria-describedby="describedby" />
          </CampoForm>
        </div>
      </section>

      <p v-if="errorGeneral" class="aviso-error" role="alert">{{ errorGeneral }}</p>
      <p v-if="mensaje" class="aviso-ok" role="status">{{ mensaje }}</p>
      <button type="submit" class="btn-primario" :disabled="guardando">{{ guardando ? 'Guardando…' : 'Guardar cambios' }}</button>
    </form>

    <form class="tarjeta mt-8 space-y-4" novalidate aria-labelledby="h-pw" @submit.prevent="cambiarPassword">
      <h2 id="h-pw" class="text-lg font-bold">Cambiar contraseña</h2>
      <div class="grid gap-4 sm:grid-cols-2">
        <CampoForm v-slot="{ id, describedby }" label="Contraseña actual" :error="pwErrores.actual" requerido>
          <input :id="id" v-model="pw.actual" type="password" class="campo" autocomplete="current-password" :aria-describedby="describedby" />
        </CampoForm>
        <CampoForm v-slot="{ id, describedby }" label="Nueva contraseña" :error="pwErrores.nueva" ayuda="Mínimo 8 caracteres, con una letra y un número." requerido>
          <input :id="id" v-model="pw.nueva" type="password" class="campo" autocomplete="new-password" :aria-describedby="describedby" />
        </CampoForm>
      </div>
      <p v-if="pwError && !Object.keys(pwErrores).length" class="aviso-error" role="alert">{{ pwError }}</p>
      <p v-if="pwMensaje" class="aviso-ok" role="status">{{ pwMensaje }}</p>
      <button type="submit" class="btn-secundario" :disabled="pwGuardando">{{ pwGuardando ? 'Actualizando…' : 'Actualizar contraseña' }}</button>
    </form>
  </div>
</template>
