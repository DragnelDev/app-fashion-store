import { z } from 'zod'
import { CIUDADES_BOLIVIA, REGEX_TELEFONO_BO, TIPOS_DOCUMENTO, normalizarTelefono } from '../utils/bolivia'
import { facturacionSchema } from './order'

const texto = (etiqueta: string, min: number, max: number) =>
  z.string({ error: `${etiqueta} es obligatorio` }).trim().min(min, `${etiqueta} es muy corto`).max(max, `${etiqueta} es muy largo`)

/** Política de contraseñas: 8–72 caracteres con al menos una letra y un número. */
export const passwordSchema = z
  .string({ error: 'La contraseña es obligatoria' })
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(72, 'La contraseña es demasiado larga (máx. 72)')
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'Use al menos una letra y un número')

export const telefonoSchema = z
  .string({ error: 'El teléfono es obligatorio' })
  .transform(normalizarTelefono)
  .refine((v) => REGEX_TELEFONO_BO.test(v), 'Ingrese un teléfono boliviano válido (8 dígitos)')

export const registroSchema = z.object({
  nombre: texto('El nombre', 2, 80),
  apellido: texto('El apellido', 2, 80),
  email: z.email('Ingrese un correo válido').max(120).transform((v) => v.trim().toLowerCase()),
  password: passwordSchema,
  telefono: telefonoSchema.optional().or(z.literal('').transform(() => undefined)),
})
export type RegistroInput = z.input<typeof registroSchema>

export const loginSchema = z.object({
  email: z.email('Ingrese un correo válido').max(120).transform((v) => v.trim().toLowerCase()),
  password: z.string({ error: 'La contraseña es obligatoria' }).min(1, 'La contraseña es obligatoria').max(200),
})
export type LoginInput = z.input<typeof loginSchema>

export const direccionSchema = z.object({
  alias: texto('El alias', 1, 40),
  ciudad: z.enum(CIUDADES_BOLIVIA, { error: 'Seleccione la ciudad' }),
  zona: texto('La zona o barrio', 1, 100),
  direccion: texto('La dirección', 5, 200),
  referencia: z.string().trim().max(200).optional().default(''),
  esPrincipal: z.boolean().default(false),
})
export type DireccionInput = z.input<typeof direccionSchema>

/** Datos de facturación por defecto del usuario (NIT/CI + Razón Social). */
export const documentoDefectoSchema = z
  .object({
    tipo: z.enum(TIPOS_DOCUMENTO, { error: 'Seleccione el tipo de documento' }),
    numero: z.string().trim().max(20),
    complemento: z.string().trim().toUpperCase().optional().default(''),
    razonSocial: z.string().trim().max(150),
  })
  .transform((d) => ({ tipoDocumento: d.tipo, numeroDocumento: d.numero, complemento: d.complemento, razonSocial: d.razonSocial }))
  .pipe(facturacionSchema)

export const perfilSchema = z.object({
  nombre: texto('El nombre', 2, 80),
  apellido: texto('El apellido', 2, 80),
  telefono: telefonoSchema.optional().or(z.literal('').transform(() => undefined)),
  direcciones: z.array(direccionSchema).max(10, 'Máximo 10 direcciones').default([])
    .refine((d) => d.filter((x) => x.esPrincipal).length <= 1, 'Solo una dirección puede ser la principal'),
  /** `null` borra el documento por defecto. */
  documento: documentoDefectoSchema.nullable().optional(),
})
export type PerfilInput = z.input<typeof perfilSchema>

export const cambiarPasswordSchema = z.object({
  actual: z.string().min(1, 'Ingrese su contraseña actual').max(200),
  nueva: passwordSchema,
})
