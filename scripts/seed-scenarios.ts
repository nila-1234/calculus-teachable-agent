import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import getFirestore from "../lib/firestore";

async function main() {
  const collection = getFirestore().collection("scenarios");

  const scenariosRoot = path.join(
    process.cwd(),
    "public",
    "data",
    "scenarios"
  );

  const scenarioIds = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

  for (const scenarioId of scenarioIds) {
    const scenarioDir = path.join(scenariosRoot, scenarioId);

    const modulePath = path.join(scenarioDir, "module.json");
    const plotDataPath = path.join(scenarioDir, "plot-data.json");

    const moduleData = JSON.parse(await fs.readFile(modulePath, "utf-8"));
    const plotData = await fs
      .readFile(plotDataPath, "utf-8")
      .then(JSON.parse)
      .catch(() => null);

    delete moduleData.plotDataSrc;

    await collection.doc(scenarioId).set({
      scenarioId,
      module: moduleData,
      plotData,
      updatedAt: new Date(),
    });

    console.log(`Seeded scenario ${scenarioId}`);
  }

  console.log("All scenarios seeded successfully.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
