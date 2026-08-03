import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WORKSPACE_MARKER = "pnpm-workspace.yaml";

export function resolveFrontendDist(
  configuredPath = process.env.FRONTEND_DIST_PATH,
  moduleUrl = import.meta.url
): string {
  if (configuredPath) {
    if (!path.isAbsolute(configuredPath)) {
      throw new Error("FRONTEND_DIST_PATHには絶対パスを設定してください。");
    }
    return configuredPath;
  }

  const workspaceRoot = findWorkspaceRoot(path.dirname(fileURLToPath(moduleUrl)));
  if (!workspaceRoot) {
    throw new Error(
      "フロントエンドの配置先を特定できません。FRONTEND_DIST_PATHに絶対パスを設定してください。"
    );
  }
  return path.join(workspaceRoot, "frontend", "dist");
}

function findWorkspaceRoot(startDirectory: string): string | undefined {
  let directory = startDirectory;
  while (true) {
    if (existsSync(path.join(directory, WORKSPACE_MARKER))) {
      return directory;
    }
    const parent = path.dirname(directory);
    if (parent === directory) {
      return undefined;
    }
    directory = parent;
  }
}
