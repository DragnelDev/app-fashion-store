import { z } from 'zod'
import {
  CIUDADES_BOLIVIA,
  METODOS_PAGO,
  REGEX_TELEFONO_BO,
  TIPOS_DOCUMENTO,
  normalizarTelefono,
} from '../utils/bolivia'

/** Esquemas compartidos: el checkout valida con ellos en el cliente y la API los vuelve a validar. */

const requerido = (etiqueta: string, max = 150) =>
  z
    .string({ error: `${etiqueta} es obligatorio` })
    .trim()
    .min(1, `${etiqueta} es obligatorio`)
    .max(max, `${etiqueta} es demasiado largo`)

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Identificador inválido')

export const facturacionSchema = z
  .object({
    tipoDocumento: z.enum(TIPOS_DOCUMENTO, { error: 'Seleccione el tipo de documento' }),
    numeroDocumento: requerido('El número de documento', 20),
    /** Complemento del CI (ej. "1A"); solo aplica a CI. */
    complemento: z
      .string()
      .trim()
      .toUpperCase()
      .optional()
      .default('')
      .refine((v) => v === '' || /^[0-9][A-Z]$/.test(v), 'El complemento debe ser un dígito y una letra (ej. 1A)'),
    razonSocial: requerido('La razón social', 150).min(2, 'La razón social es muy corta'),
  })
  .superRefine((f, ctx) => {
    const n = f.numeroDocumento
    const reglas: Record<(typeof TIPOS_DOCUMENTO)[number], [RegExp, string]> = {
      NIT: [/^\d{5,13}$/, 'El NIT debe tener entre 5 y 13 dígitos'],
      CI: [/^\d{5,10}$/, 'El CI debe tener entre 5 y 10 dígitos'],
      CEX: [/^\d{5,10}$/, 'La cédula de extranjero debe tener entre 5 y 10 dígitos'],
      PASAPORTE: [/^[A-Za-z0-9]{5,15}$/, 'El pasaporte debe tener entre 5 y 15 caracteres alfanuméricos'],
    }
    const [regex, mensaje] = reglas[f.tipoDocumento]
    if (!regex.test(n)) ctx.addIssue({ code: 'custom', path: ['numeroDocumento'], message: mensaje })
    if (f.complemento && f.tipoDocumento !== 'CI') {
      ctx.addIssue({ code: 'custom', path: ['complemento'], message: 'El complemento solo aplica a la CI' })
    }
  })

export const envioSchema = z.object({
  nombreDestinatario: requerido('El nombre del destinatario', 120).min(3, 'Ingrese nombre y apellido'),
  telefono: z
    .string({ error: 'El teléfono es obligatorio' })
    .transform(normalizarTelefono)
    .refine((v) => REGEX_TELEFONO_BO.test(v), 'Ingrese un teléfono boliviano válido (8 dígitos)'),
  ciudad: z.enum(CIUDADES_BOLIVIA, { error: 'Seleccione la ciudad' }),
  zona: requerido('La zona o barrio', 100),
  direccion: requerido('La dirección', 200).min(5, 'Ingrese una dirección más completa'),
  referencia: z.string().trim().max(200).optional().default(''),
})

export const itemPedidoSchema = z.object({
  productoId: objectIdSchema,
  sku: z.string().trim().min(1).max(40),
  cantidad: z.number({ error: 'Cantidad inválida' }).int().min(1, 'Mínimo 1 unidad').max(50, 'Máximo 50 unidades por ítem'),
})

export const pedidoSchema = z.object({
  items: z.array(itemPedidoSchema).min(1, 'Su carrito está vacío').max(50),
  email: z.email('Ingrese un correo válido').max(120),
  facturacion: facturacionSchema,
  envio: envioSchema,
  metodoPago: z.enum(METODOS_PAGO, { error: 'Seleccione un método de pago' }),
  /** Comprobante adjunto al crear el pedido (opcional; se puede subir después). */
  comprobantePagoUrl: z.string().trim().max(500).optional(),
  notas: z.string().trim().max(300).optional().default(''),
})

export type PedidoInput = z.infer<typeof pedidoSchema>
export type PedidoFormInput = z.input<typeof pedidoSchema>

/** Convierte los issues de Zod en { "envio.ciudad": "mensaje" } para mostrar bajo cada campo. */
export function erroresPorCampo(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const clave = issue.path.join('.')
    if (!(clave in out)) out[clave] = issue.message
  }
  return out
}
