import { NextResponse } from "next/server";
import sharp from "sharp";

import { guardUrl } from "@/lib/server/hostGuard";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024;

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

  let pngBuffer: Buffer;
  try {
    pngBuffer = await sharp(buffer).png().toBuffer();
  } catch {
    return NextResponse.json(
      { message: "Gambar tidak dapat dikonversi ke PNG." },
      { status: 422 },
    );
  }

  if (pngBuffer.byteLength > MAX_BYTES) {
    return NextResponse.json(
      { message: `Ukuran gambar setelah dikonversi melebihi batas ${Math.round(MAX_BYTES / 1024 / 1024)} MB.` },
      { status: 413 },
    );
  }

  return NextResponse.json({
    dataUri: `data:image/png;base64,${pngBuffer.toString("base64")}`,
    contentType: "image/png",
    bytes: pngBuffer.byteLength,
  });
}
