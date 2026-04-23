import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI!

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI não definida nas variáveis de ambiente.')
}

interface MongooseCache {
  conn: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined
}

const cache: MongooseCache = global.mongooseCache ?? { conn: null, promise: null }
global.mongooseCache = cache

export async function connectDB(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn

  if (!cache.promise) {
    const opts = {
      bufferCommands: false,
    }
    cache.promise = mongoose.connect(MONGODB_URI, opts)
  }

  try {
    cache.conn = await cache.promise
  } catch (e) {
    cache.promise = null
    throw e
  }

  return cache.conn
}
