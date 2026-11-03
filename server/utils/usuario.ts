import type { UsuarioDTO } from '../../shared/types'
import type { UserDocument } from '../models'

/** Proyección pública del usuario: nunca incluye el hash de la contraseña. */
export function usuarioDTO(u: UserDocument): UsuarioDTO {
  const json = u.toJSON() as unknown as UsuarioDTO & { id?: string; _id: unknown }
  return { ...json, _id: String(json._id) } as UsuarioDTO
}
