import { MongoClient } from "mongodb";
import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function main() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB;

  if (!uri) throw new Error("Missing MONGODB_URI");
  if (!dbName) throw new Error("Missing MONGODB_DB");

  const client = new MongoClient(uri);

  try {
    await client.connect();

    const db = client.db(dbName);
    const collection = db.collection("scenarios");

    const scenariosRoot = path.join(
      process.cwd(),
      "public",
      "data",
      "scenarios"
    );

    const scenarioIds = ["1", "2", "3", "4", "5", "6", "7"];

    for (const scenarioId of scenarioIds) {
      const scenarioDir = path.join(scenariosRoot, scenarioId);

      const modulePath = path.join(scenarioDir, "module.json");
      const plotDataPath = path.join(scenarioDir, "plot-data.json");

      const module = JSON.parse(await fs.readFile(modulePath, "utf-8"));
      const plotData = JSON.parse(await fs.readFile(plotDataPath, "utf-8"));

      delete module.plotDataSrc;

      await collection.updateOne(
        { scenarioId },
        {
          $set: {
            scenarioId,
            module,
            plotData,
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      );

      console.log(`Seeded scenario ${scenarioId}`);
    }

    console.log("All scenarios seeded successfully.");
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});