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

export type MultipartFile = {
  field: string;
  filename: string;
  contentType: string;
  dataUri: string;
};

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

/** Unduh gambar dari web, konversi ke PNG, dan ubah menjadi data URI (di-cache per URL). */
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
  | { ok: true; item: Record<string, unknown>; file?: MultipartFile; usedImage: boolean }
  | { ok: false; message: string };

/**
 * Siapkan item payload: jika ada URL gambar dari web, unduh dulu (dikonversi ke PNG),
 * lalu hasilnya dimasukkan sebagai file multipart atau nilai base64 di field JSON.
 */
export async function applyImageToItem(
  item: Record<string, unknown>,
  config: BulkSenderConfig,
): Promise<ResolveImageResult> {
  const targetField = config.imageField?.trim() || "image";
  const source = pickImageSource(item, config.imageUrlField);

  let dataUri: string | null = null;
  if (source) {
    try {
      dataUri = await toImageDataUri(source);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Kesalahan tidak diketahui.";
      return { ok: false, message: `Gagal mengambil gambar dari web: ${detail}` };
    }
  } else {
    const localImage = config.localImageDataUri?.trim();
    if (localImage) dataUri = localImage;
  }

  if (!dataUri) return { ok: true, item, usedImage: false };

  if (config.imageMode === "multipart") {
    return {
      ok: true,
      item,
      file: {
        field: targetField,
        filename: `${targetField}.png`,
        contentType: "image/png",
        dataUri,
      },
      usedImage: true,
    };
  }

  return { ok: true, item: { ...item, [targetField]: dataUri }, usedImage: true };
}

function dataUriToFile(file: MultipartFile) {
  const base64 = file.dataUri.split(",")[1] ?? "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], file.filename, { type: file.contentType });
}

/** Susun FormData untuk pengiriman langsung dari browser (tanpa proxy). */
export function formDataFromItem(item: Record<string, unknown>, file: MultipartFile) {
  const form = new FormData();
  for (const [key, value] of Object.entries(item)) {
    if (key === file.field) continue;
    if (value === undefined || value === null) continue;
    form.append(key, typeof value === "string" ? value : JSON.stringify(value));
  }
  form.append(file.field, dataUriToFile(file), file.filename);
  return form;
}

/** Buang field gambar dari item agar tidak terkirim ganda saat mode multipart. */
export function omitField(item: Record<string, unknown>, field: string) {
  if (!(field in item)) return item;
  const clone = { ...item };
  delete clone[field];
  return clone;
}
