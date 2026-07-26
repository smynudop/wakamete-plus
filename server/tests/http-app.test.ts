import { createServer } from "node:http";
import { once } from "node:events";
import { afterEach, describe, expect, it } from "vitest";
import { ROLE_SETS } from "../src/role-sets.js";
import { createHttpApp } from "../src/http-app.js";

const servers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map(async (server) => {
    server.close();
    await once(server, "close");
  }));
});

describe("role set API", () => {
  it("returns every public role set as JSON", async () => {
    const server = createServer(createHttpApp("C:\\not-used-by-this-test"));
    servers.push(server);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("テストサーバーのポートを取得できませんでした。");
    }

    const response = await fetch(`http://127.0.0.1:${address.port}/api/role-sets`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual(ROLE_SETS);
  });
});

