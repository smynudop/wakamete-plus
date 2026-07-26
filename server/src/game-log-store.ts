import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { ArchivedGameLog } from "@wakamete-plus/shared";

const ROOM_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export class GameLogStore {
  constructor(private readonly directory: string) {}

  async save(log: ArchivedGameLog): Promise<void> {
    const destination = this.logPath(log.roomId);
    await mkdir(this.directory, { recursive: true });
    const temporary = path.join(this.directory, `.${log.roomId}.${randomUUID()}.tmp`);
    await writeFile(temporary, `${JSON.stringify(log, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx"
    });
    await rename(temporary, destination);
  }

  async find(roomId: string): Promise<ArchivedGameLog | null> {
    try {
      const contents = await readFile(this.logPath(roomId), "utf8");
      return JSON.parse(contents) as ArchivedGameLog;
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  private logPath(roomId: string): string {
    if (!ROOM_ID_PATTERN.test(roomId)) {
      throw new Error("不正なルームIDです。");
    }
    return path.join(this.directory, `${roomId}.json`);
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
