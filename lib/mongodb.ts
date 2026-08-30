import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

const clientPromise = uri
  ? global._mongoClientPromise ?? new MongoClient(uri).connect()
  : Promise.resolve(new MongoClient("mongodb://127.0.0.1:1"));

if (uri && process.env.NODE_ENV === "development") {
  global._mongoClientPromise = clientPromise;
}

export default clientPromise;