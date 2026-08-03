import "dotenv/config";
import { createServer } from "node:http";
import { MongoClient } from "mongodb";
import { attachGameSocketServer } from "./game-socket-server.js";
import { resolveFrontendDist } from "./frontend-dist.js";
import { MongoGameLogStore } from "./game-log-store.js";
import { createHttpApp } from "./http-app.js";

const frontendDist = resolveFrontendDist();
const mongodbUri = process.env.MONGODB_URI;
if (!mongodbUri) {
  throw new Error("MONGODB_URIを設定してください。");
}
const mongoClient = new MongoClient(mongodbUri);
await mongoClient.connect();
const gameLogs = new MongoGameLogStore(mongoClient.db());
await gameLogs.createIndexes();
const httpServer = createServer(createHttpApp(frontendDist, gameLogs));

const gameSocketServer = attachGameSocketServer(httpServer, gameLogs);

const port = Number(process.env.PORT ?? 3000);
httpServer.listen(port, () => {
  console.log(`Wakamete Plus server listening on http://localhost:${port}`);
});

async function shutdown(): Promise<void> {
  gameSocketServer.stopMaintenance();
  httpServer.close();
  await mongoClient.close();
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
