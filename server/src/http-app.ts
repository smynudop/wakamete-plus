import express, { type Express } from "express";
import path from "node:path";
import { ROLE_SETS } from "./role-sets.js";
import { GameLogStore } from "./game-log-store.js";

export function createHttpApp(
  frontendDist: string,
  gameLogs = new GameLogStore(path.resolve("data/game-logs"))
): Express {
  const app = express();

  app.get("/api/role-sets", (_request, response) => {
    response.json(ROLE_SETS);
  });
  app.get("/api/logs/:roomId", async (request, response, next) => {
    try {
      const log = await gameLogs.find(request.params.roomId);
      if (!log) {
        response.status(404).json({ message: "指定したゲームログが見つかりません。" });
        return;
      }
      response.json(log);
    } catch (error) {
      if (error instanceof Error && error.message === "不正なルームIDです。") {
        response.status(400).json({ message: error.message });
        return;
      }
      next(error);
    }
  });
  app.use(express.static(frontendDist));
  app.get("*", (_request, response) => {
    response.sendFile(path.join(frontendDist, "index.html"));
  });

  return app;
}
