import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { v4 as uuidv4 } from "uuid";
import sharp from "sharp";
import {
  createSession,
  saveSessionMeta,
  deleteSession,
  SESSION_MAX_SIZE_MB,
} from "@/lib/storage";
import {
  convertImage,
  ALL_IMAGE_EXT,
  outputExtensionFor,
} from "@/lib/imageEngine";
import type { TargetFormat, ProcessedItem, SkippedItem } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const VALID_FORMATS: TargetFormat[] = ["jpeg", "png", "webp"];

interface WalkEntry {
  name: string;
  data: Uint8Array;
}

async function walkZip(zip: JSZip, prefix = ""): Promise<WalkEntry[]> {
  const out: WalkEntry[] = [];
  const entries = Object.values(zip.files);
  for (const entry of entries) {
    if (entry.dir) continue;
    const rel = prefix + (entry.name.startsWith("/") ? entry.name.slice(1) : entry.name);
    const dot = rel.lastIndexOf(".");
    const ext = dot >= 0 ? rel.slice(dot + 1).toLowerCase() : "";
    if (!ext || !ALL_IMAGE_EXT.has(ext)) continue;
    const buf = await entry.async("uint8array");
    out.push({ name: path.basename(rel), data: buf });
  }
  return out;
}

function extOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot < 0) return "";
  return filename.slice(dot + 1).toLowerCase();
}

async function makeThumbBase64(imagePath: string): Promise<string | undefined> {
  try {
    if (!fs.existsSync(imagePath)) return undefined;
    const { width = 0, height = 0 } = await sharp(imagePath).metadata().catch(() => ({}));
    if (!width || !height) return undefined;
    const max = 400;
    let w = max;
    let h = Math.round((height / width) * max);
    if (h > max) {
      h = max;
      w = Math.round((width / height) * max);
    }
    const buf = await sharp(imagePath)
      .resize(w, h, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 58, mozjpeg: undefined as any })
      .toBuffer();
    return "data:image/jpeg;base64," + buf.toString("base64");
  } catch (err) {
    console.error("makeThumbBase64 error:", err);
    return undefined;
  }
}

export async function POST(req: NextRequest) {
  let session: ReturnType<typeof createSession> | null = null;
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const formatRaw = form.get("format") as string | null;
    const qualityRaw = form.get("quality") as string | null;

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "File tidak ditemukan." }, { status: 400 });
    }
    if (!formatRaw || !VALID_FORMATS.includes(formatRaw as TargetFormat)) {
      return NextResponse.json(
        { error: "Format tidak valid. Pilih: jpeg, png, webp." },
        { status: 400 }
      );
    }
    const targetFormat = formatRaw as TargetFormat;
    const quality = Number(qualityRaw);
    if (!Number.isFinite(quality) || quality < 10 || quality > 100) {
      return NextResponse.json(
        { error: "Quality harus integer 10-100." },
        { status: 400 }
      );
    }
    if (file.size > SESSION_MAX_SIZE_MB * 1024 * 1024) {
      return NextResponse.json(
        { error: `File terlalu besar. Maks ${SESSION_MAX_SIZE_MB} MB.` },
        { status: 400 }
      );
    }

    session = createSession();

    const fileExt = extOf(file.name);
    const isZip = fileExt === "zip";
    const fileBytes = Buffer.from(await file.arrayBuffer());

    const inputImages: { safeName: string; data: Uint8Array }[] = [];

    if (isZip) {
      const zip = await JSZip.loadAsync(fileBytes);
      const extracted = await walkZip(zip);
      if (extracted.length === 0) {
        deleteSession(session.id);
        return NextResponse.json(
          { error: "Tidak ada file gambar yang ditemukan di dalam ZIP." },
          { status: 400 }
        );
      }
      for (const e of extracted) {
        const ext = extOf(e.name);
        const base = uuidv4();
        const safeName = `${base}.${ext}`;
        inputImages.push({ safeName, data: e.data });
      }
    } else {
      if (!fileExt || !ALL_IMAGE_EXT.has(fileExt)) {
        deleteSession(session.id);
        return NextResponse.json(
          { error: "Format file tidak didukung." },
          { status: 400 }
        );
      }
      const safeName = `${uuidv4()}.${fileExt}`;
      inputImages.push({ safeName, data: fileBytes });
    }

    for (const img of inputImages) {
      fs.writeFileSync(path.join(session.inputDir, img.safeName), Buffer.from(img.data));
    }

    const targetExt = outputExtensionFor(targetFormat);
    const processed: ProcessedItem[] = [];
    const skipped: SkippedItem[] = [];

    for (const img of inputImages) {
      const inputPath = path.join(session.inputDir, img.safeName);
      const baseName = path.parse(img.safeName).name;
      const convertedName = `${baseName}.${targetExt}`;
      const outputPath = path.join(session.outputDir, convertedName);
      const sizeBefore = fs.statSync(inputPath).size;

      try {
        const engine = await convertImage({
          inputPath,
          outputPath,
          targetFormat,
          quality,
        });

        if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
          throw new Error("Output file kosong atau gagal dibuat.");
        }

        const sizeAfter = fs.statSync(outputPath).size;
        const thumbBefore = await makeThumbBase64(inputPath);
        const thumbAfter = await makeThumbBase64(outputPath);
        processed.push({
          name: img.safeName,
          original: img.safeName,
          converted: convertedName,
          engine,
          sizeBefore,
          sizeAfter,
          thumbBefore,
          thumbAfter,
        });
      } catch (err: any) {
        skipped.push({
          name: img.safeName,
          reason: err?.message || "Gagal konversi",
        });
      }
    }

    if (processed.length === 0) {
      deleteSession(session.id);
      const reason = skipped[0]?.reason || "Semua file gagal dikonversi.";
      return NextResponse.json({ error: reason }, { status: 500 });
    }

    const meta = saveSessionMeta({
      id: session.id,
      targetFormat,
      quality,
      processed,
      skipped,
    });

    return NextResponse.json({
      sessionId: meta.id,
      targetFormat: meta.targetFormat,
      quality: meta.quality,
      processed: meta.processed,
      skipped: meta.skipped,
      isMultiple: meta.processed.length > 1,
    });
  } catch (err: any) {
    if (session) deleteSession(session.id);
    console.error("convert error:", err);
    return NextResponse.json(
      { error: err?.message || "Terjadi kesalahan internal." },
      { status: 500 }
    );
  }
}
