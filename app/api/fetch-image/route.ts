import { NextResponse } from "next/server";

import { guardUrl } from "@/lib/server/hostGuard";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024;

const EXTENSION_CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  jpe: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  avif: "image/avif",
  ico: "image/x-icon",
  tif: "image/tiff",
  tiff: "image/tiff",
};

function guessContentType(targetUrl: URL, headerValue: string | null) {
  const fromHeader = (headerValue ?? "").split(";")[0].trim().toLowerCase();
  if (fromHeader.startsWith("image/")) return fromHeader;

  const ext = targetUrl.pathname.split(".").pop()?.toLowerCase() ?? "";
  const fromExt = EXTENSION_CONTENT_TYPES[ext];
  if (fromExt) return fromExt;

  return fromHeader || "application/octet-stream";
}

export async function POST(req: Request) {
  let body: { url?: unknown };
  try {
    body = (await req.json()) as { url?: unknown };
  } catch {
    return NextResponse.json({ message: "Body JSON tidak valid." }, { status: 400 });
  }

  const rawUrl = typeof body?.url === "string" ? body.url.trim() : "";
  if (!rawUrl) {
    return NextResponse.json({ message: "Field url wajib." }, { status: 400 });
  }

  const guarded = guardUrl(rawUrl);
  if (!guarded.ok) {
    return NextResponse.json({ message: guarded.message }, { status: guarded.status });
  }

  let upstream: Response;
  try {
    upstream = await fetch(guarded.url.toString(), { redirect: "follow", cache: "no-store" });
  } catch {
    return NextResponse.json({ message: "Gagal mengunduh gambar." }, { status: 502 });
  }

  if (!upstream.ok) {
    return NextResponse.json(
      { message: `Gagal mengunduh gambar (HTTP ${upstream.status}).` },
      { status: 502 },
    );
  }

  const contentLength = Number(upstream.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BYTES) {
    return NextResponse.json(
      { message: `Ukuran gambar melebihi batas ${Math.round(MAX_BYTES / 1024 / 1024)} MB.` },
      { status: 413 },
    );
  }

  const buffer = Buffer.from(await upstream.arrayBuffer());
  if (buffer.byteLength > MAX_BYTES) {
    return NextResponse.json(
      { message: `Ukuran gambar melebihi batas ${Math.round(MAX_BYTES / 1024 / 1024)} MB.` },
      { status: 413 },
    );
  }

  const contentType = guessContentType(guarded.url, upstream.headers.get("content-type"));
  const dataUri = `data:${contentType};base64,${buffer.toString("base64")}`;

  return NextResponse.json({ dataUri, contentType, bytes: buffer.byteLength });
}
