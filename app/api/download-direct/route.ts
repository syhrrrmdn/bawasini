import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import archiver from "archiver";
import JSZip from "jszip";
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import {
  convertImage,
  ALL_IMAGE_EXT,
  outputExtensionFor,
} from "@/lib/imageEngine";
import type { TargetFormat } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const VALID_FORMATS: TargetFormat[] = ["jpeg", "png", "webp"];

interface WalkEntry { name: string; data: Uint8Array; }

async function walkZip(zip: JSZip, prefix = ""): Promise<WalkEntry[]> {
  const out: WalkEntry[] = [];
  for (const entry of Object.values(zip.files)) {
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

function contentTypeOf(ext: string): string {
  switch (ext) {
    case "jpg": case "jpeg": return "image/jpeg";
    case "png": return "image/png";
    case "webp": return "image/webp";
    default: return "application/octet-stream";
  }
}

export async function POST(req: NextRequest) {
  const scratchRoot = fs.mkdtempSync(path.join(os.tmpdir(), "icnv-direct-"));
  const cleanup = () => { try { fs.rmSync(scratchRoot, { recursive: true, force: true }); } catch {} };

  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const formatRaw = form.get("format") as string | null;
    const qualityRaw = form.get("quality") as string | null;

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "File tidak ditemukan." }, { status: 400 });
    }
    if (!formatRaw || !VALID_FORMATS.includes(formatRaw as TargetFormat)) {
      return NextResponse.json({ error: "Format tidak valid." }, { status: 400 });
    }
    const targetFormat = formatRaw as TargetFormat;
    const quality = Number(qualityRaw);
    if (!Number.isFinite(quality) || quality < 10 || quality > 100) {
      return NextResponse.json({ error: "Quality harus 10-100." }, { status: 400 });
    }

    const fileExt = extOf(file.name);
    const isZip = fileExt === "zip";
    const fileBytes = Buffer.from(await file.arrayBuffer());

    const inputImages: { safeName: string; data: Uint8Array }[] = [];

    if (isZip) {
      const zip = await JSZip.loadAsync(fileBytes);
      const extracted = await walkZip(zip);
      if (extracted.length === 0) return NextResponse.json({ error: "ZIP tidak ada gambar." }, { status: 400 });
      for (const e of extracted) {
        const ext = extOf(e.name);
        inputImages.push({ safeName: `${uuidv4()}.${ext}`, data: e.data });
      }
    } else {
      if (!fileExt || !ALL_IMAGE_EXT.has(fileExt)) {
        return NextResponse.json({ error: "Format file tidak didukung." }, { status: 400 });
      }
      inputImages.push({ safeName: `${uuidv4()}.${fileExt}`, data: fileBytes });
    }

    const targetExt = outputExtensionFor(targetFormat);
    const inputDir = path.join(scratchRoot, "in");
    const outputDir = path.join(scratchRoot, "out");
    fs.mkdirSync(inputDir, { recursive: true });
    fs.mkdirSync(outputDir, { recursive: true });

    type Converted = { outPath: string; outName: string; };
    const converted: Converted[] = [];

    for (const img of inputImages) {
      const inputPath = path.join(inputDir, img.safeName);
      fs.writeFileSync(inputPath, Buffer.from(img.data));
      const baseName = path.parse(img.safeName).name;
      const convertedName = `${baseName}.${targetExt}`;
      const outputPath = path.join(outputDir, convertedName);
      try {
        await convertImage({ inputPath, outputPath, targetFormat, quality });
        if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
          converted.push({ outPath: outputPath, outName: convertedName });
        }
      } catch {}
    }

    if (converted.length === 0) {
      cleanup();
      return NextResponse.json({ error: "Semua file gagal dikonversi." }, { status: 500 });
    }

    if (converted.length === 1) {
      const item = converted[0];
      const buffer = fs.readFileSync(item.outPath);
      const ct = contentTypeOf(targetExt);
      const safeName = encodeURIComponent(item.outName);
      const res = new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": ct,
          "Content-Disposition": `attachment; filename*=UTF-8''${safeName}; filename="${item.outName}"`,
          "Content-Length": String(buffer.length),
          "Cache-Control": "no-store, must-revalidate",
          "X-Accel-Buffering": "no",
        },
      });
      setTimeout(cleanup, 2000).unref?.();
      return res;
    }

    const zipName = `converted_${Date.now().toString(36)}.zip`;
    const chunks: Buffer[] = [];
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    for (const item of converted) {
      archive.append(fs.createReadStream(item.outPath), { name: item.outName });
    }
    await archive.finalize();
    const zipBuffer = Buffer.concat(chunks);
    const safeZipName = encodeURIComponent(zipName);
    const res = new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename*=UTF-8''${safeZipName}; filename="${zipName}"`,
        "Content-Length": String(zipBuffer.length),
        "Cache-Control": "no-store, must-revalidate",
        "X-Accel-Buffering": "no",
      },
    });
    setTimeout(cleanup, 2000).unref?.();
    return res;
  } catch (err: any) {
    cleanup();
    console.error("download-direct error:", err);
    return NextResponse.json({ error: err?.message || "Kesalahan internal." }, { status: 500 });
  }
}
