/**
 * Constantes de dominio de Bolivia compartidas entre cliente (app/) y servidor (server/).
 */
export const CIUDADES_BOLIVIA = [
  'La Paz',
  'El Alto',
  'Santa Cruz de la Sierra',
  'Cochabamba',
  'Sucre',
  'Oruro',
  'Potosí',
  'Tarija',
  'Trinidad',
  'Cobija',
] as const
export type CiudadBolivia = (typeof CIUDADES_BOLIVIA)[number]

/** Documentos de identificación admitidos en facturación (SIN). */
export const TIPOS_DOCUMENTO = ['NIT', 'CI', 'CEX', 'PASAPORTE'] as const
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number]

export const ETIQUETA_DOCUMENTO: Record<TipoDocumento, string> = {
  NIT: 'NIT',
  CI: 'Cédula de identidad (CI)',
  CEX: 'Cédula de extranjero',
  PASAPORTE: 'Pasaporte',
}

export const METODOS_PAGO = ['qr', 'transferencia', 'contra_entrega'] as const
export type MetodoPago = (typeof METODOS_PAGO)[number]

export const ESTADOS_PEDIDO = ['pendiente', 'procesando', 'enviado', 'entregado'] as const
export type EstadoPedido = (typeof ESTADOS_PEDIDO)[number]

export const ESTADOS_PAGO = ['pendiente', 'pagado'] as const
export type EstadoPago = (typeof ESTADOS_PAGO)[number]

/** Soft-delete: nada se borra físicamente; "eliminado" oculta el registro. */
export const ESTADOS_REGISTRO = ['activo', 'inactivo', 'eliminado'] as const
export type EstadoRegistro = (typeof ESTADOS_REGISTRO)[number]

export const ROLES = ['admin', 'client'] as const
export type Rol = (typeof ROLES)[number]

export const TALLAS_SUGERIDAS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'ÚNICA'] as const

export const SCOPES_UPLOAD = ['producto', 'categoria', 'comprobante'] as const
export type ScopeUpload = (typeof SCOPES_UPLOAD)[number]

/** Tasa de IVA vigente en Bolivia. */
export const IVA_TASA = 0.13

/**
 * Tarifa de envío por ciudad, en Bs.
 * ⚠️ Valores de ejemplo: ajústelos a su operador logístico real.
 */
export const TARIFAS_ENVIO_BS: Record<CiudadBolivia, number> = {
  'La Paz': 20,
  'El Alto': 20,
  'Santa Cruz de la Sierra': 20,
  Cochabamba: 20,
  Sucre: 30,
  Oruro: 30,
  Potosí: 30,
  Tarija: 30,
  Trinidad: 45,
  Cobija: 45,
}

export function calcularEnvioBs(ciudad: string | null | undefined): number {
  if (!ciudad) return 0
  return TARIFAS_ENVIO_BS[ciudad as CiudadBolivia] ?? 0
}

/** Celular o fijo boliviano: +591 seguido de 8 dígitos que empiezan por 2, 3, 4, 6 o 7. */
export const REGEX_TELEFONO_BO = /^\+591[2-467]\d{7}$/

/** Acepta "71234567", "591 71234567", "+591-71234567" y devuelve "+59171234567". */
export function normalizarTelefono(valor: string | null | undefined): string {
  const digitos = (valor ?? '').replace(/\D/g, '')
  if (!digitos) return ''
  const local = digitos.startsWith('591') && digitos.length > 8 ? digitos.slice(3) : digitos
  return `+591${local}`
}
