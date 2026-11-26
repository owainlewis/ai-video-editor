// Project export lock (build/export.lock): prevents two exports of the same project from
// overwriting each other's build files, while never deadlocking on empty, corrupt or stale locks.
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const exportLockPath = (dir: string) => join(dir, "build/export.lock");

export function parseLockPid(raw: string): number | null {
  const text = raw.trim();
  if (!/^\d+$/.test(text)) return null;
  const pid = Number(text);
  return Number.isInteger(pid) && pid > 0 ? pid : null;
}

export function isPidAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

export function readExportLock(lock: string): number | null {
  try {
    return parseLockPid(readFileSync(lock, "utf8"));
  } catch {
    return null;
  }
}

// Whether a live export process currently holds build/export.lock.
export function isExportLocked(dir: string): boolean {
  const lock = exportLockPath(dir);
  if (!existsSync(lock)) return false;
  const pid = readExportLock(lock);
  return pid !== null && isPidAlive(pid);
}

// Acquire build/export.lock atomically via openSync("wx"). Retries once after removing a
// proven-stale (dead pid, empty, or corrupt) lock, and cleans up on SIGINT/SIGTERM.
export function acquireExportLock(dir: string, slug: string): () => void {
  const lock = exportLockPath(dir);
  mkdirSync(dirname(lock), { recursive: true });

  const create = () => {
    const fd = openSync(lock, "wx");
    try {
      writeFileSync(fd, `${process.pid}\n`);
    } catch (e) {
      try { closeSync(fd); } catch {}
      try { rmSync(lock, { force: true }); } catch {}
      throw e;
    }
    closeSync(fd);
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      create();
      break;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      let raw: string;
      try {
        raw = readFileSync(lock, "utf8");
      } catch (readErr) {
        if ((readErr as NodeJS.ErrnoException).code === "ENOENT" && attempt === 0) continue;
        throw readErr;
      }
      const pid = parseLockPid(raw);
      if (pid !== null && isPidAlive(pid)) {
        throw new Error(`an export of ${slug} is already running (pid ${pid}); wait for it or stop it first`);
      }
      if (attempt === 1) {
        throw new Error(`an export of ${slug} is already running; wait for it or stop it first`);
      }
      rmSync(lock, { force: true });
    }
  }

  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    process.off("SIGINT", onSigInt);
    process.off("SIGTERM", onSigTerm);
    try {
      if (readExportLock(lock) === process.pid) rmSync(lock, { force: true });
    } catch {}
  };
  const onSignal = (sig: NodeJS.Signals) => {
    release();
    process.kill(process.pid, sig);
  };
  const onSigInt = () => onSignal("SIGINT");
  const onSigTerm = () => onSignal("SIGTERM");
  process.once("SIGINT", onSigInt);
  process.once("SIGTERM", onSigTerm);

  return release;
}
