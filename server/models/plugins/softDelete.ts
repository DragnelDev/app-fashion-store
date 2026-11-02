import type { Query, Schema } from 'mongoose'
import { ESTADOS_REGISTRO } from '../../../shared/utils/bolivia'

/**
 * Soft-delete: agrega `estadoRegistro` ('activo' | 'inactivo' | 'eliminado') y excluye
 * automáticamente los registros "eliminado" de las consultas (find, findOne, count, update…).
 *
 * - Para incluirlos explícitamente:  Model.find().setOptions({ incluirEliminados: true })
 * - Si la consulta ya filtra por `estadoRegistro`, se respeta ese filtro.
 * - No cubre `aggregate()`: agregue su propio $match allí.
 */
export function softDeletePlugin(schema: Schema): void {
  schema.add({
    estadoRegistro: { type: String, enum: ESTADOS_REGISTRO, default: 'activo', index: true },
  })

  function excluirEliminados(this: Query<unknown, unknown>) {
    const opciones = this.getOptions() as { incluirEliminados?: boolean }
    if (opciones.incluirEliminados) return
    if (this.getFilter().estadoRegistro !== undefined) return
    this.where({ estadoRegistro: { $ne: 'eliminado' } })
  }

  schema.pre(
    ['find', 'findOne', 'findOneAndUpdate', 'countDocuments', 'updateOne', 'updateMany'],
    excluirEliminados,
  )

  schema.method('eliminarLogico', function (this: { estadoRegistro: string; save: () => Promise<unknown> }) {
    this.estadoRegistro = 'eliminado'
    return this.save()
  })
}

/** Transform común de toJSON: expone `id` como string y oculta __v. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const limpiarJson = (_doc: unknown, ret: any) => {
  delete ret.__v
  return ret
}
