import mongoose, { Schema, type Model } from 'mongoose'

interface ICounter { _id: string; seq: number }

const counterSchema = new Schema<ICounter>({ _id: { type: String, required: true }, seq: { type: Number, default: 0 } })

export const Counter: Model<ICounter> =
  (mongoose.models.Counter as Model<ICounter>) || mongoose.model<ICounter>('Counter', counterSchema)

/** Siguiente valor atómico de una secuencia (p. ej. numeración de pedidos por año). */
export async function siguienteSecuencia(nombre: string): Promise<number> {
  const doc = await Counter.findOneAndUpdate(
    { _id: nombre },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' },
  )
  return doc!.seq
}
