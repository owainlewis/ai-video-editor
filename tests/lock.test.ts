import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { acquireExportLock, exportLockPath, isExportLocked, isPidAlive, parseLockPid, readExportLock } from "../media/lock.ts";
import { ROOT } from "../media/tools.ts";

const tempDirs: string[] = [];
const makeTempDir = (prefix: string) => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("export lock helper", () => {
  it("parses only positive integer PIDs and guards isPidAlive", () => {
    expect(parseLockPid("12345")).toBe(12345);
    expect(parseLockPid("  42\n")).toBe(42);
    for (const bad of ["", "  \n", "0", "-1", "-42", "NaN", "abc", "123abc", "12.5", "Infinity"]) {
      expect(parseLockPid(bad), JSON.stringify(bad)).toBeNull();
    }

    expect(isPidAlive(process.pid)).toBe(true);
    for (const bad of [0, -1, NaN, Infinity, 1.5, 99999999]) {
      expect(isPidAlive(bad), String(bad)).toBe(false);
    }
  });

  it("creates build/ if missing, acquires atomically, rejects live contention, and releases cleanly", () => {
    const dir = makeTempDir("studio-lock-");
    expect(existsSync(join(dir, "build"))).toBe(false);
    expect(isExportLocked(dir)).toBe(false);

    const release = acquireExportLock(dir, "demo");
    try {
      const lock = exportLockPath(dir);
      expect(existsSync(lock)).toBe(true);
      expect(readExportLock(lock)).toBe(process.pid);
      expect(isExportLocked(dir)).toBe(true);

      // A second acquisition while live must throw with the running PID.
      expect(() => acquireExportLock(dir, "demo")).toThrow(new RegExp(`already running \\(pid ${process.pid}\\)`));
    } finally {
      release();
    }

    expect(existsSync(exportLockPath(dir))).toBe(false);
    expect(isExportLocked(dir)).toBe(false);
    // Releasing a second time is a safe no-op.
    expect(() => release()).not.toThrow();
  });

  it("replaces empty, corrupt, non-positive, and dead-pid locks instead of deadlocking", () => {
    const dir = makeTempDir("studio-lock-stale-");
    const lock = exportLockPath(dir);
    mkdirSync(join(dir, "build"), { recursive: true });

    for (const stale of ["", "   \n", "corrupt", "0", "-1", "NaN", "99999999"]) {
      writeFileSync(lock, stale);
      expect(isExportLocked(dir), `isExportLocked(${JSON.stringify(stale)})`).toBe(false);
      const release = acquireExportLock(dir, "demo");
      expect(readFileSync(lock, "utf8").trim()).toBe(String(process.pid));
      expect(isExportLocked(dir)).toBe(true);
      release();
      expect(existsSync(lock)).toBe(false);
    }
  });

  it("cleans up build/export.lock when terminated by SIGTERM or SIGINT", async () => {
    for (const signal of ["SIGTERM", "SIGINT"] as const) {
      const dir = makeTempDir(`studio-lock-${signal.toLowerCase()}-`);
      const lock = exportLockPath(dir);
      const child = spawn(
        process.execPath,
        [
          "--input-type=module",
          "-e",
          `import { acquireExportLock } from "./media/lock.ts"; acquireExportLock(${JSON.stringify(dir)}, "demo"); console.log("READY"); setInterval(() => {}, 1000);`,
        ],
        { cwd: ROOT },
      );

      await new Promise<void>((resolve, reject) => {
        let out = "";
        child.stdout.on("data", (c: Buffer) => {
          out += c.toString();
          if (out.includes("READY")) resolve();
        });
        child.on("error", reject);
        child.on("exit", (code, sig) => reject(new Error(`child exited early: code=${code} sig=${sig}`)));
      });

      expect(existsSync(lock)).toBe(true);
      expect(readExportLock(lock)).toBe(child.pid);

      const exit = await new Promise<{ code: number | null; sig: NodeJS.Signals | null }>((resolve) => {
        child.once("exit", (code, sig) => resolve({ code, sig }));
        child.kill(signal);
      });

      expect(exit.sig).toBe(signal);
      expect(existsSync(lock)).toBe(false);
    }
  });
});
