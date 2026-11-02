import mongoose, { Schema, type HydratedDocument, type Model } from 'mongoose'
import {
  CIUDADES_BOLIVIA, REGEX_TELEFONO_BO, ROLES, TIPOS_DOCUMENTO,
  type CiudadBolivia, type EstadoRegistro, type Rol, type TipoDocumento,
} from '../../shared/utils/bolivia'
import { limpiarJson, softDeletePlugin } from './plugins/softDelete'

export interface IDireccion {
  alias: string
  ciudad: CiudadBolivia
  zona: string
  direccion: string
  referencia?: string
  esPrincipal: boolean
}

export interface IDocumentoFacturacion {
  tipo: TipoDocumento
  numero: string
  complemento?: string
  razonSocial: string
}

export interface IUser {
  nombre: string
  apellido: string
  email: string
  /** Hash (bcrypt/argon2) para el login futuro. Nunca se serializa ni se selecciona por defecto. */
  passwordHash?: string
  rol: Rol
  /** Formato E.164 boliviano: +591XXXXXXXX */
  telefono?: string
  direcciones: IDireccion[]
  /** NIT/CI y Razón Social por defecto para facturar. */
  documento?: IDocumentoFacturacion
  estadoRegistro: EstadoRegistro
  createdAt: Date
  updatedAt: Date
}

const direccionSchema = new Schema<IDireccion>(
  {
    alias: { type: String, trim: true, required: true, maxlength: 40, default: 'Casa' },
    ciudad: { type: String, enum: CIUDADES_BOLIVIA, required: true },
    zona: { type: String, trim: true, required: true, maxlength: 100 },
    direccion: { type: String, trim: true, required: true, maxlength: 200 },
    referencia: { type: String, trim: true, maxlength: 200 },
    esPrincipal: { type: Boolean, default: false },
  },
  { _id: true },
)

const documentoSchema = new Schema<IDocumentoFacturacion>(
  {
    tipo: { type: String, enum: TIPOS_DOCUMENTO, required: true },
    numero: { type: String, trim: true, required: true, maxlength: 20 },
    complemento: { type: String, trim: true, uppercase: true, maxlength: 2 },
    razonSocial: { type: String, trim: true, required: true, maxlength: 150 },
  },
  { _id: false },
)

const userSchema = new Schema<IUser>(
  {
    nombre: { type: String, trim: true, required: true, maxlength: 80 },
    apellido: { type: String, trim: true, required: true, maxlength: 80 },
    email: { type: String, trim: true, lowercase: true, required: true, unique: true, maxlength: 120 },
    passwordHash: { type: String, select: false },
    rol: { type: String, enum: ROLES, default: 'client', index: true },
    telefono: {
      type: String,
      trim: true,
      validate: { validator: (v: string) => !v || REGEX_TELEFONO_BO.test(v), message: 'Teléfono boliviano inválido (+591XXXXXXXX)' },
    },
    direcciones: { type: [direccionSchema], default: [] },
    documento: { type: documentoSchema },
  },
  { timestamps: true },
)

userSchema.plugin(softDeletePlugin)

userSchema.pre('validate', function () {
  const principales = this.direcciones.filter((d) => d.esPrincipal).length
  if (principales > 1) this.invalidate('direcciones', 'Solo una dirección puede ser la principal')
  if (this.direcciones.length > 10) this.invalidate('direcciones', 'Máximo 10 direcciones')
})

userSchema.set('toJSON', {
  virtuals: true,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transform: (_doc, ret: any) => {
    delete ret.passwordHash
    return limpiarJson(_doc, ret)
  },
})

export type UserDocument = HydratedDocument<IUser>
export const User: Model<IUser> = (mongoose.models.User as Model<IUser>) || mongoose.model<IUser>('User', userSchema)
