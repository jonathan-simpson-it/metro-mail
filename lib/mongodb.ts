import { MongoClient } from "mongodb";

declare global {
  var mongoClientCache: {
    client: MongoClient | null;
    promise: Promise<MongoClient> | null;
  } | undefined;
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

export async function getMongoClient() {
  if (!globalThis.mongoClientCache) {
    globalThis.mongoClientCache = { client: null, promise: null };
  }

  if (!globalThis.mongoClientCache.promise) {
    globalThis.mongoClientCache.promise = new MongoClient(mongoUri()).connect();
  }

  globalThis.mongoClientCache.client ??=
    await globalThis.mongoClientCache.promise;
  return globalThis.mongoClientCache.client;
}

/**
 * Native driver client shared with Better Auth's MongoDB adapter.
 * Better Auth manages its own collections (user, session, account, verification)
 * alongside Mongoose's (threads, messages, routingrules) in the same database.
 */
export async function getMongoDb() {
  return (await getMongoClient()).db();
}
