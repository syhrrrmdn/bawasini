import fs from "node:fs";
import sharp from "sharp";
import {
  initializeImageMagick,
  MagickImage,
  MagickFormat,
  Percentage,
  Quantum,
} from "@imagemagick/magick-wasm";
import type { TargetFormat, ImageEngine } from "./types";

let magickReady: Promise<void> | null = null;
function ensureMagick(): Promise<void> {
  if (!magickReady) {
    magickReady = (initializeImageMagick as () => Promise<void>)();
  }
  return magickReady;
}

export const SHARP_SUPPORTED_INPUT = new Set([
  "jpg", "jpeg", "png", "webp", "gif", "tif", "tiff",
  "bmp", "avif",
]);

export const ALL_IMAGE_EXT = new Set([
  "jpg", "jpeg", "png", "webp", "gif", "bmp", "avif",
  "tiff", "tif", "heic", "heif",
  "svg", "svgz",
  "ico", "cur",
  "tga", "psd", "psb",
  "raw", "cr2", "nef", "orf", "arw", "dng", "rw2",
  "xcf", "pcx", "pgm", "ppm", "pbm", "pnm",
  "exr", "hdr",
  "wbmp", "xbm", "xpm",
]);

function extOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot < 0) return "";
  return filename.slice(dot + 1).toLowerCase();
}

function targetSharpFormat(fmt: TargetFormat) {
  return fmt;
}

function targetMagickFormat(fmt: TargetFormat): MagickFormat {
  switch (fmt) {
    case "jpeg": return MagickFormat.Jpeg;
    case "png": return MagickFormat.Png;
    case "webp": return MagickFormat.WebP;
  }
}

export interface ConvertOptions {
  inputPath: string;
  outputPath: string;
  targetFormat: TargetFormat;
  quality: number;
}

export async function convertImage(opts: ConvertOptions): Promise<ImageEngine> {
  const ext = extOf(opts.inputPath);

  if (SHARP_SUPPORTED_INPUT.has(ext)) {
    try {
      await convertWithSharp(opts);
      if (fs.existsSync(opts.outputPath) && fs.statSync(opts.outputPath).size > 0) {
        return "sharp";
      }
    } catch {
      // fallback ke magick
    }
  }

  await ensureMagick();
  await convertWithMagick(opts);
  return "magick-wasm";
}

async function convertWithSharp({
  inputPath,
  outputPath,
  targetFormat,
  quality,
}: ConvertOptions) {
  const fmt = targetSharpFormat(targetFormat);
  const inputExt = extOf(inputPath);
  const animated = inputExt === "gif" || inputExt === "webp";
  const pipeline = sharp(inputPath, { failOnError: false, animated });

  if (fmt === "jpeg") {
    await pipeline.jpeg({ quality }).toFile(outputPath);
  } else if (fmt === "png") {
    await pipeline.png({ compressionLevel: 9, quality: { compression: quality } } as any).toFile(outputPath);
  } else if (fmt === "webp") {
    await pipeline.webp({ quality, effort: 6 }).toFile(outputPath);
  } else {
    await pipeline.toFormat(fmt as any, { quality }).toFile(outputPath);
  }
}

async function convertWithMagick({
  inputPath,
  outputPath,
  targetFormat,
  quality,
}: ConvertOptions) {
  await ensureMagick();
  const data = fs.readFileSync(inputPath);
  const outFormat = targetMagickFormat(targetFormat);

  const MagickImageAny = MagickImage as any;
  await MagickImageAny.readFrom(data, async (image: any) => {
    if (targetFormat !== "png") {
      image.quality = new Percentage(quality);
    }
    const ext = extOf(inputPath);
    if (ext === "svg" || ext === "svgz") {
      image.density = new Percentage(300);
    }
    const out = await image.write(outFormat);
    fs.writeFileSync(outputPath, Buffer.from(out));
  });
}

export function outputExtensionFor(targetFormat: TargetFormat): string {
  return targetFormat === "jpeg" ? "jpg" : targetFormat;
}
