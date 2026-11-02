import type { BulkSenderConfig } from "@/lib/bulkSender/types";

const DEFAULT_IMAGE_URL_KEYS = [
  "image",
  "imageUrl",
  "image_url",
  "photo",
  "photoUrl",
  "photo_url",
  "avatar",
  "avatarUrl",
  "avatar_url",
  "foto",
  "picture",
  "thumbnail",
  "thumbnailUrl",
  "thumbnail_url",
];

const IMAGE_EXTENSION_RE = /\.(png|jpe?g|gif|webp|bmp|svg|avif|ico|tiff?)(\?.*)?(#.*)?$/i;

export function isImageDataUri(value: string) {
  return /^data:image\//i.test(value.trim());
}

export function isLikelyImageUrl(value: string) {
  const v = value.trim();
  if (!v) return false;
  if (isImageDataUri(v)) return true;
  if (!/^https?:\/\//i.test(v)) return false;
  return IMAGE_EXTENSION_RE.test(v);
}

/**
 * Cari sumber gambar pada sebuah item payload.
 * Bila `imageUrlField` diisi, nilai di field itu dipakai apa adanya.
 * Bila kosong, dideteksi otomatis dari key umum + pola URL gambar.
 */
export function pickImageSource(
  item: Record<string, unknown>,
  imageUrlField?: string,
): string | null {
  const explicitField = imageUrlField?.trim();
  if (explicitField) {
    const value = item[explicitField];
    if (typeof value === "string" && value.trim()) return value.trim();
    return null;
  }

  for (const key of DEFAULT_IMAGE_URL_KEYS) {
    const value = item[key];
    if (typeof value === "string" && isLikelyImageUrl(value)) return value.trim();
  }

  return null;
}

const dataUriCache = new Map<string, Promise<string>>();

async function requestImageDataUri(url: string): Promise<string> {
  const response = await fetch("/api/fetch-image", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url }),
  });

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message =
      data && typeof data === "object" && typeof (data as Record<string, unknown>).message === "string"
        ? String((data as Record<string, unknown>).message)
        : `Gagal mengunduh gambar (HTTP ${response.status}).`;
    throw new Error(message);
  }

  const dataUri =
    data && typeof data === "object" ? (data as Record<string, unknown>).dataUri : null;
  if (typeof dataUri !== "string" || !dataUri) {
    throw new Error("Respons gambar dari server tidak valid.");
  }
  return dataUri;
}

/** Unduh gambar dari web dan ubah menjadi data URI (di-cache per URL). */
export function toImageDataUri(url: string): Promise<string> {
  if (isImageDataUri(url)) return Promise.resolve(url);

  const cached = dataUriCache.get(url);
  if (cached) return cached;

  const pending = requestImageDataUri(url);
  dataUriCache.set(url, pending);
  pending.catch(() => dataUriCache.delete(url));
  return pending;
}

export type ResolveImageResult =
  | { ok: true; item: Record<string, unknown>; usedImage: boolean }
  | { ok: false; message: string };

/**
 * Siapkan item payload: jika ada URL gambar dari web, unduh dulu lalu
 * masukkan hasilnya (base64/data URI) ke field gambar yang dikonfigurasi.
 */
export async function applyImageToItem(
  item: Record<string, unknown>,
  config: BulkSenderConfig,
): Promise<ResolveImageResult> {
  const targetField = config.imageField?.trim() || "image";
  const source = pickImageSource(item, config.imageUrlField);

  if (source) {
    try {
      const dataUri = await toImageDataUri(source);
      return { ok: true, item: { ...item, [targetField]: dataUri }, usedImage: true };
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Kesalahan tidak diketahui.";
      return { ok: false, message: `Gagal mengambil gambar dari web: ${detail}` };
    }
  }

  const localImage = config.localImageDataUri?.trim();
  if (localImage) {
    return { ok: true, item: { ...item, [targetField]: localImage }, usedImage: true };
  }

  return { ok: true, item, usedImage: false };
}
