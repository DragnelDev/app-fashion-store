import { createError } from 'h3'

/** Error HTTP con mensaje en español y datos opcionales para el cliente. */
export const apiError = (statusCode: number, message: string, data?: unknown) =>
  createError({ statusCode, message, data })
