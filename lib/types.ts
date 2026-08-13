export type TargetFormat = "jpeg" | "png" | "webp";

export type ImageEngine = "sharp" | "magick-wasm";

export interface ProcessedItem {
  name: string;
  original: string;
  converted: string;
  engine: ImageEngine;
  sizeBefore?: number;
  sizeAfter?: number;
}

export interface SkippedItem {
  name: string;
  reason: string;
}

export interface ConvertResult {
  sessionId: string;
  processed: ProcessedItem[];
  skipped: SkippedItem[];
  targetFormat: TargetFormat;
  quality: number;
  isMultiple: boolean;
  createdAt: number;
}

export interface SessionMeta {
  id: string;
  targetFormat: TargetFormat;
  quality: number;
  processed: ProcessedItem[];
  skipped: SkippedItem[];
  createdAt: number;
  expiresAt: number;
}
