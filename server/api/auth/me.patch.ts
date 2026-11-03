import { readBody } from 'h3'
import { perfilSchema } from '../../../shared/schemas/auth'
import type { UsuarioDTO } from '../../../shared/types'
import { requireUsuario } from '../../utils/auth'
import { defineApiHandler } from '../../utils/handler'
import { usuarioDTO } from '../../utils/usuario'

/**
 * PATCH /api/auth/me — actualiza el perfil: nombre, teléfono (+591), direcciones en ciudades de
 * Bolivia y documento de facturación por defecto (NIT/CI + razón social). `documento: null` lo borra.
 */
export default defineApiHandler(async (event): Promise<UsuarioDTO> => {
  const usuario = await requireUsuario(event)
  const datos = perfilSchema.parse(await readBody(event))

  usuario.nombre = datos.nombre
  usuario.apellido = datos.apellido
  usuario.telefono = datos.telefono
  // Si no marcó ninguna principal, la primera lo es.
  const direcciones = datos.direcciones.map((d) => ({ ...d, referencia: d.referencia || undefined }))
  if (direcciones.length && !direcciones.some((d) => d.esPrincipal)) direcciones[0]!.esPrincipal = true
  usuario.set('direcciones', direcciones)

  if (datos.documento === null) usuario.set('documento', undefined)
  else if (datos.documento) {
    usuario.set('documento', {
      tipo: datos.documento.tipoDocumento,
      numero: datos.documento.numeroDocumento,
      complemento: datos.documento.complemento || undefined,
      razonSocial: datos.documento.razonSocial,
    })
  }
  await usuario.save()
  return usuarioDTO(usuario)
})
