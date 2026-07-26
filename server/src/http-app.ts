import express, { type Express } from "express";
import path from "node:path";
import { ROLE_SETS } from "./role-sets.js";

export function createHttpApp(frontendDist: string): Express {
  const app = express();

  app.get("/api/role-sets", (_request, response) => {
    response.json(ROLE_SETS);
  });
  app.use(express.static(frontendDist));
  app.get("*", (_request, response) => {
    response.sendFile(path.join(frontendDist, "index.html"));
  });

  return app;
}

