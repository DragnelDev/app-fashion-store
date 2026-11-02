import mongoose from 'mongoose'

/** Conexión única reutilizable (sobrevive al hot-reload de Nitro en desarrollo). */
const globalConn = globalThis as unknown as { __vestiqMongo?: Promise<typeof mongoose> }

export function conectarMongo(uri: string): Promise<typeof mongoose> {
  if (!globalConn.__vestiqMongo) {
    mongoose.set('strictQuery', true)
    mongoose.set('bufferTimeoutMS', 10000)
    globalConn.__vestiqMongo = mongoose
      .connect(uri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 8000,
      })
      .catch((error) => {
        globalConn.__vestiqMongo = undefined // permite reintentar
        throw error
      })
  }
  return globalConn.__vestiqMongo
}

export async function desconectarMongo(): Promise<void> {
  if (globalConn.__vestiqMongo) {
    await mongoose.disconnect()
    globalConn.__vestiqMongo = undefined
  }
}
