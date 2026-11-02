export type HttpMethod = "POST" | "PUT" | "PATCH" | "DELETE" | "GET";

export type ImageSendMode = "multipart" | "json";

export type BulkSenderConfig = {
  endpoint: string;
  method: HttpMethod;
  delayMs: number;
  timeoutMs: number;
  useProxy: boolean;
  authorization?: string;
  headerKey?: string;
  headerValue?: string;
  imageEnabled: boolean;
  /** Cara gambar dikirim: multipart/form-data (file) atau base64 di field JSON. */
  imageMode: ImageSendMode;
  /** Nama field gambar di payload (nama field file saat mode multipart). */
  imageField: string;
  /** Nama field di payload yang berisi URL gambar sumber (opsional; jika kosong akan dideteksi otomatis). */
  imageUrlField?: string;
  /** Gambar lokal (data URI PNG) sebagai fallback bila payload tidak punya URL gambar. */
  localImageDataUri?: string;
};

export type ParsedDataResult =
  | { ok: true; items: Array<Record<string, unknown>>; normalizedText: string }
  | { ok: false; message: string; errorIndex?: number };

export type LogItem = {
  id: string;
  index: number;
  ok: boolean;
  status?: number;
  label?: string;
  message: string;
  timestamp: number;
};

export type FailedItem = {
  index: number;
  item: Record<string, unknown>;
};

export type SenderStatus = "idle" | "running" | "stopping" | "done";
