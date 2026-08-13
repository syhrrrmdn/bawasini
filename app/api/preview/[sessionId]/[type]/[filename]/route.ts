import fs from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { getSessionFilePath } from "@/lib/storage";

export const runtime = "nodejs";

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  avif: "image/avif",
  tiff: "image/tiff",
  tif: "image/tiff",
  heic: "image/heic",
  heif: "image/heif",
};

function contentTypeOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  const ext = dot >= 0 ? filename.slice(dot + 1).toLowerCase() : "";
  return CONTENT_TYPES[ext] || "application/octet-stream";
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string; type: string; filename: string }> }
) {
  const { sessionId, type, filename } = await params;

  if (type !== "input" && type !== "output") {
    return NextResponse.json({ error: "Type tidak valid." }, { status: 400 });
  }

  const safeType = type as "input" | "output";
  const filePath = getSessionFilePath(sessionId, safeType, filename);

  if (!filePath) {
    return NextResponse.json({ error: "File tidak ditemukan." }, { status: 404 });
  }

  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.size === 0) {
      return NextResponse.json({ error: "File tidak valid." }, { status: 404 });
    }

    const buffer = fs.readFileSync(filePath);
    const ct = contentTypeOf(filename);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": ct,
        "Content-Length": String(stat.size),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    console.error("preview error:", err);
    return NextResponse.json(
      { error: "Terjadi kesalahan saat membaca file." },
      { status: 500 }
    );
  }
}
