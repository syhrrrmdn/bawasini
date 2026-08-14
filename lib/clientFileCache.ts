import type { TargetFormat } from "./types";

const DB_NAME = "icnv-file-cache";
const DB_VERSION = 1;
const STORE_NAME = "files";

interface FileCacheEntry {
  sessionId: string;
  file: File;
  createdAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB tidak tersedia"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "sessionId" });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export async function cacheFileForSession(sessionId: string, file: File): Promise<void> {
  try {
    const db = await openDb();
    const entry: FileCacheEntry = { sessionId, file, createdAt: Date.now() };
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(entry);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Silently ignore — IndexedDB availability is best-effort
  }
}

export async function getCachedFileForSession(sessionId: string): Promise<File | null> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(sessionId);
    return new Promise((resolve, reject) => {
      req.onsuccess = () => {
        const entry = req.result as FileCacheEntry | undefined;
        resolve(entry?.file || null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function clearOldCacheEntries(maxAgeMs = 30 * 60 * 1000, maxEntries = 10): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const allReq = store.getAll();
    const now = Date.now();
    allReq.onsuccess = () => {
      const entries = (allReq.result || []) as FileCacheEntry[];
      const sorted = entries.sort((a, b) => b.createdAt - a.createdAt);
      sorted.forEach((e, i) => {
        if (now - e.createdAt > maxAgeMs || i >= maxEntries) {
          try { store.delete(e.sessionId); } catch {}
        }
      });
    };
  } catch {}
}

export function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function extractFilename(contentDisposition: string, fallback: string): string {
  const m1 = contentDisposition.match(/filename\*=UTF-8''([^;]+)/);
  if (m1?.[1]) return decodeURIComponent(m1[1]);
  const m2 = contentDisposition.match(/filename="([^"]+)"/);
  if (m2?.[1]) return m2[1];
  return fallback;
}

interface TwoLayerDownloadOpts {
  sessionId: string;
  targetFormat: TargetFormat;
  quality: number;
  isMultiple: boolean;
}

export async function trySessionDownload(sessionId: string, opts: TwoLayerDownloadOpts): Promise<Blob | null> {
  try {
    const r = await fetch(`/api/download/${sessionId}`, {
      cache: "no-store",
      headers: { "X-ICNV-Direct": "1" },
    });
    if (!r.ok) return null;
    const blob = await r.blob();
    if (!blob || blob.size === 0) return null;
    const cd = r.headers.get("content-disposition") || "";
    const ext = opts.targetFormat === "jpeg" ? "jpg" : opts.targetFormat;
    const fallback = opts.isMultiple
      ? `converted_${Date.now().toString(36)}.zip`
      : `converted.${ext}`;
    const finalName = extractFilename(cd, fallback);
    triggerBrowserDownload(blob, finalName);
    return blob;
  } catch {
    return null;
  }
}

export async function tryDirectDownload(
  file: File,
  targetFormat: TargetFormat,
  quality: number
): Promise<Blob> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("format", targetFormat);
  fd.append("quality", String(quality));
  const r = await fetch("/api/download-direct", {
    method: "POST",
    body: fd,
    cache: "no-store",
  });
  if (!r.ok) {
    const ct = r.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const data = await r.json().catch(() => ({}));
      if (data?.error) throw new Error(data.error);
    }
    throw new Error(`HTTP ${r.status}`);
  }
  const blob = await r.blob();
  if (!blob || blob.size === 0) throw new Error("Response kosong");
  const cd = r.headers.get("content-disposition") || "";
  const ext = targetFormat === "jpeg" ? "jpg" : targetFormat;
  const fallback = `converted.${ext}`;
  const finalName = extractFilename(cd, fallback);
  triggerBrowserDownload(blob, finalName);
  return blob;
}

export async function downloadTwoLayer(opts: TwoLayerDownloadOpts): Promise<boolean> {
  const ok = await trySessionDownload(opts.sessionId, opts);
  if (ok) return true;
  const file = await getCachedFileForSession(opts.sessionId);
  if (!file) return false;
  try {
    await tryDirectDownload(file, opts.targetFormat, opts.quality);
    return true;
  } catch {
    return false;
  }
}
