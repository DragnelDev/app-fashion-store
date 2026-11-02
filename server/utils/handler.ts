import mongoose from 'mongoose'
import { ZodError } from 'zod'
import { defineEventHandler, isError, type H3Event } from 'h3'
import { erroresPorCampo } from '../../shared/schemas/order'
import { apiError } from './errors'

/** Traduce cualquier excepción a una respuesta HTTP coherente (sin filtrar detalles internos). */
function normalizarError(error: unknown) {
  if (isError(error)) return error

  if (error instanceof ZodError) {
    return apiError(422, 'Revise los datos enviados.', { code: 'validacion', errores: erroresPorCampo(error) })
  }
  if (error instanceof mongoose.Error.ValidationError) {
    const errores = Object.fromEntries(Object.entries(error.errors).map(([campo, e]) => [campo, (e as { message: string }).message]))
    return apiError(422, 'Revise los datos enviados.', { code: 'validacion', errores })
  }
  if (error instanceof mongoose.Error.CastError) {
    return apiError(400, `Valor inválido para "${error.path}".`)
  }
  if ((error as { code?: number })?.code === 11000) {
    const campo = Object.keys((error as { keyPattern?: Record<string, unknown> }).keyPattern ?? {})[0] ?? 'registro'
    return apiError(409, `Ya existe un registro con el mismo valor de "${campo}".`, { code: 'duplicado', campo })
  }

  console.error('[api] Error no controlado:', error)
  return apiError(500, 'Ocurrió un error interno. Intente nuevamente.')
}

/** defineEventHandler con manejo centralizado de errores. */
export function defineApiHandler<T>(
  handler: (event: H3Event) => T | Promise<T>,
  { requiresMongo = true }: { requiresMongo?: boolean } = {},
) {
  return defineEventHandler(async (event) => {
    try {
      if (requiresMongo && mongoose.connection.readyState !== mongoose.ConnectionStates.connected) {
        throw apiError(503, 'Base de datos no disponible. Verifique la conexión a MongoDB.')
      }
      return await handler(event)
    } catch (error) {
      throw normalizarError(error)
    }
  })
}
