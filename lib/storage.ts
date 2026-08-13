import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { v4 as uuidv4 } from "uuid";
import type { SessionMeta, TargetFormat, ProcessedItem, SkippedItem } from "./types";

const ROOT_TEMP_DIR = path.join(os.tmpdir(), "ic-nextjs-sessions");
const TTL_MS = 30 * 60 * 1000;

if (!fs.existsSync(ROOT_TEMP_DIR)) {
  fs.mkdirSync(ROOT_TEMP_DIR, { recursive: true });
}

let cleanupRanOnce = false;
function runCleanup() {
  try {
    const now = Date.now();
    const entries = fs.readdirSync(ROOT_TEMP_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dirPath = path.join(ROOT_TEMP_DIR, entry.name);
      const metaPath = path.join(dirPath, "meta.json");
      if (!fs.existsSync(metaPath)) {
        try { rmrf(dirPath); } catch {}
        continue;
      }
      try {
        const raw = fs.readFileSync(metaPath, "utf8");
        if (!raw || raw.trim().length < 10) {
          rmrf(dirPath);
          continue;
        }
        const meta: SessionMeta = JSON.parse(raw);
        if (!meta.id || !meta.expiresAt || now > meta.expiresAt) {
          rmrf(dirPath);
        }
      } catch {
        try { rmrf(dirPath); } catch {}
      }
    }
  } catch {
    // ignore
  }
}

let cleanupTimer: NodeJS.Timeout | null = null;
function ensureCleanupLoop() {
  if (!cleanupRanOnce) {
    cleanupRanOnce = true;
    try { runCleanup(); } catch {}
  }
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    try { runCleanup(); } catch {}
  }, 60 * 1000);
  if (typeof cleanupTimer.unref === "function") cleanupTimer.unref();
}
ensureCleanupLoop();

export function rmrf(target: string) {
  if (!fs.existsSync(target)) return;
  const stat = fs.lstatSync(target);
  if (stat.isDirectory()) {
    for (const child of fs.readdirSync(target)) {
      rmrf(path.join(target, child));
    }
    fs.rmdirSync(target);
  } else {
    fs.unlinkSync(target);
  }
}

export interface CreatedSession {
  id: string;
  inputDir: string;
  outputDir: string;
  rootDir: string;
}

export function createSession(): CreatedSession {
  const id = uuidv4();
  const rootDir = path.join(ROOT_TEMP_DIR, id);
  const inputDir = path.join(rootDir, "input");
  const outputDir = path.join(rootDir, "output");
  fs.mkdirSync(inputDir, { recursive: true });
  fs.mkdirSync(outputDir, { recursive: true });
  return { id, rootDir, inputDir, outputDir };
}

export function saveSessionMeta(params: {
  id: string;
  targetFormat: TargetFormat;
  quality: number;
  processed: ProcessedItem[];
  skipped: SkippedItem[];
}): SessionMeta {
  const now = Date.now();
  const meta: SessionMeta = {
    id: params.id,
    targetFormat: params.targetFormat,
    quality: params.quality,
    processed: params.processed,
    skipped: params.skipped,
    createdAt: now,
    expiresAt: now + TTL_MS,
  };
  const sessionDir = path.join(ROOT_TEMP_DIR, params.id);
  const metaPath = path.join(sessionDir, "meta.json");
  const tmpPath = path.join(sessionDir, `meta-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.tmp`);
  const content = JSON.stringify(meta, null, 2);
  fs.writeFileSync(tmpPath, content, "utf8");
  fs.renameSync(tmpPath, metaPath);
  if (!fs.existsSync(metaPath) || fs.readFileSync(metaPath, "utf8") !== content) {
    fs.writeFileSync(metaPath, content, "utf8");
  }
  return meta;
}

export function getSessionDir(sessionId: string): string | null {
  if (!sessionId || typeof sessionId !== "string") return null;
  if (!/^[a-fA-F0-9-]{8,}$/.test(sessionId)) return null;
  const dir = path.join(ROOT_TEMP_DIR, sessionId);
  if (!fs.existsSync(dir)) return null;
  return dir;
}

export function getSessionMeta(sessionId: string): SessionMeta | null {
  const dir = getSessionDir(sessionId);
  if (!dir) return null;
  const metaPath = path.join(dir, "meta.json");
  if (!fs.existsSync(metaPath)) return null;
  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8")) as SessionMeta;
    if (Date.now() > meta.expiresAt) {
      rmrf(dir);
      return null;
    }
    return meta;
  } catch {
    return null;
  }
}

export function getSessionFilePath(
  sessionId: string,
  type: "input" | "output",
  filename: string
): string | null {
  const dir = getSessionDir(sessionId);
  if (!dir) return null;
  const sub = type === "input" ? "input" : "output";
  const fp = path.join(dir, sub, filename);
  if (!fs.existsSync(fp)) return null;
  return fp;
}

export function deleteSession(sessionId: string) {
  const dir = getSessionDir(sessionId);
  if (dir) rmrf(dir);
}

export const SESSION_MAX_SIZE_MB = 50;
