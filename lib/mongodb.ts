import { MongoClient } from "mongodb";

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

/**
 * Resolves a connected client, or rejects with a message that names the missing
 * configuration.
 *
 * This used to be a module-level promise that fell back to
 * `mongodb://127.0.0.1:1` when MONGODB_URI was unset, so a misconfigured
 * deployment surfaced as an opaque ECONNREFUSED / "Topology is closed" from
 * inside a route handler rather than "MONGODB_URI is not set".
 */
export default function getMongoClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    return Promise.reject(new Error("MONGODB_URI is not set"));
  }

  if (global._mongoClientPromise) return global._mongoClientPromise;

  const promise = new MongoClient(uri).connect().catch((err) => {
    // Never cache a failed connection. Previously a first-attempt failure was
    // stored and replayed to every later request until the process restarted.
    if (global._mongoClientPromise === promise) {
      global._mongoClientPromise = undefined;
    }
    throw err;
  });

  global._mongoClientPromise = promise;
  return promise;
}
