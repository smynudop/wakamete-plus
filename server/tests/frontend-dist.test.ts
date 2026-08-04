import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveFrontendDist } from "../src/frontend-dist.js";

describe("frontend distribution path", () => {
  it("finds the frontend from both source and compiled module depths", () => {
    const expected = path.resolve("../frontend/dist");

    expect(resolveFrontendDist(undefined, import.meta.url)).toBe(expected);
    expect(
      resolveFrontendDist(undefined, new URL("../dist/src/index.js", import.meta.url).href)
    ).toBe(expected);
  });

  it("uses an explicitly configured absolute path", () => {
    const configured = path.resolve("custom/frontend");

    expect(resolveFrontendDist(configured)).toBe(configured);
  });

  it("rejects a configured relative path", () => {
    expect(() => resolveFrontendDist("frontend/dist")).toThrow(
      "FRONTEND_DIST_PATHには絶対パスを設定してください。"
    );
  });
});
