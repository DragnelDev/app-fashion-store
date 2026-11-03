import mongoose, { type ClientSession } from 'mongoose'

/**
 * Las transacciones de MongoDB requieren un replica set (o cluster con mongos). Atlas y el
 * `docker-compose.yml` incluido lo cumplen; un `mongod` standalone no. Se detecta una vez
 * (`hello`) para poder seguir funcionando —con reservas atómicas por documento y compensación—
 * en entornos de desarrollo sencillos.
 */
let soporte: Promise<boolean> | null = null

export function soportaTransacciones(): Promise<boolean> {
  soporte ??= (async () => {
    try {
      const hello = await mongoose.connection.db!.admin().command({ hello: 1 })
      return Boolean(hello.setName) || hello.msg === 'isdbgrid'
    } catch {
      soporte = null // no cachear un fallo transitorio
      return false
    }
  })()
  return soporte
}

/** Solo para pruebas: olvida la detección. */
export const reiniciarDeteccionTransacciones = () => {
  soporte = null
}

/**
 * Ejecuta `trabajo` dentro de una transacción (`startTransaction` → commit / abort). Se usa
 * `connection.transaction()`, que envuelve `session.withTransaction()` y **reintenta** el bloque
 * automáticamente ante `TransientTransactionError` (p. ej. conflicto de escritura entre dos
 * compras simultáneas del mismo producto). Por eso `trabajo` debe ser idempotente: todo lo que lee
 * y escribe debe pasar por la `session` recibida y no debe tener efectos externos.
 *
 * Si el servidor no soporta transacciones devuelve `undefined` como sesión: el llamador usa su
 * camino de respaldo.
 */
export async function enTransaccion<T>(trabajo: (session: ClientSession) => Promise<T>): Promise<T> {
  return mongoose.connection.transaction(trabajo, {
    readConcern: { level: 'snapshot' },
    writeConcern: { w: 'majority' },
  }) as Promise<T>
}
