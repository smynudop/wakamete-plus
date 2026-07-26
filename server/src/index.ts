import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { attachGameSocketServer } from "./game-socket-server.js";
import { createHttpApp } from "./http-app.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.resolve(__dirname, "../../frontend/dist");
const httpServer = createServer(createHttpApp(frontendDist));

attachGameSocketServer(httpServer);

const port = Number(process.env.PORT ?? 3000);
httpServer.listen(port, () => {
  console.log(`Wakamete Plus server listening on http://localhost:${port}`);
});
