import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { attachGameSocketServer } from "./game-socket-server.js";
import { GameLogStore } from "./game-log-store.js";
import { createHttpApp } from "./http-app.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.resolve(__dirname, "../../frontend/dist");
const gameLogs = new GameLogStore(path.resolve(__dirname, "../../data/game-logs"));
const httpServer = createServer(createHttpApp(frontendDist, gameLogs));

attachGameSocketServer(httpServer, gameLogs);

const port = Number(process.env.PORT ?? 3000);
httpServer.listen(port, () => {
  console.log(`Wakamete Plus server listening on http://localhost:${port}`);
});
