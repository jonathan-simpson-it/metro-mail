import mongoose from "mongoose";

declare global {
  var mongooseCache:
    | { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null }
    | undefined;
}

function mongoUri(): string {
  const uri = process.env.MONGO_URI ?? process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGO_URI is not defined. Add it to your environment variables.",
    );
  }
  return uri;
}

/**
 * Cached Mongoose connection. Survives HMR in dev, reused across
 * serverless invocations in production.
 */
export async function connectToDatabase() {
  if (!globalThis.mongooseCache) {
    globalThis.mongooseCache = { conn: null, promise: null };
  }

  if (globalThis.mongooseCache.conn) {
    return globalThis.mongooseCache.conn;
  }

  if (!globalThis.mongooseCache.promise) {
    globalThis.mongooseCache.promise = mongoose
      .connect(mongoUri(), {
        serverSelectionTimeoutMS: 10_000,
      })
      .then((m) => m);
  }

  globalThis.mongooseCache.conn = await globalThis.mongooseCache.promise;
  return globalThis.mongooseCache.conn;
}
