import fs from "node:fs";
import path from "node:path";
import archiver from "archiver";
import { NextRequest, NextResponse } from "next/server";
import { getSessionDir, getSessionMeta, deleteSession } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const fetchCache = "force-no-store";

function scheduleDelete(sessionId: string, delayMs = 2000) {
  setTimeout(() => {
    try {
      deleteSession(sessionId);
    } catch {
      // ignore
    }
  }, delayMs).unref?.();
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  const meta = getSessionMeta(sessionId);
  if (!meta) {
    return NextResponse.json(
      { error: "Session tidak ditemukan atau sudah kedaluwarsa." },
      {
        status: 404,
        headers: {
          "Cache-Control": "no-store, must-revalidate",
        },
      }
    );
  }

  const sessionDir = getSessionDir(sessionId);
  if (!sessionDir) {
    return NextResponse.json(
      { error: "Session tidak ditemukan atau sudah kedaluwarsa." },
      { status: 404 }
    );
  }

  const outputDir = path.join(sessionDir, "output");
  const processedFiles = meta.processed;

  if (processedFiles.length === 0) {
    return NextResponse.json(
      { error: "Tidak ada file hasil konversi." },
      { status: 404 }
    );
  }

  try {
    if (processedFiles.length === 1) {
      const item = processedFiles[0];
      const filePath = path.join(outputDir, item.converted);
      if (!fs.existsSync(filePath)) {
        return NextResponse.json(
          { error: "File hasil tidak ditemukan." },
          { status: 404 }
        );
      }

      const buffer = fs.readFileSync(filePath);
      const ext = path.extname(item.converted).slice(1);
      const contentType =
        ext === "jpg" || ext === "jpeg"
          ? "image/jpeg"
          : ext === "png"
          ? "image/png"
          : ext === "webp"
          ? "image/webp"
          : "application/octet-stream";

      const safeFilename = encodeURIComponent(item.converted);
      const response = new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename*=UTF-8''${safeFilename}; filename="${item.converted}"`,
          "Content-Length": String(buffer.length),
          "Cache-Control": "no-store, must-revalidate",
          "X-Accel-Buffering": "no",
        },
      });

      scheduleDelete(sessionId, 3000);
      return response;
    }

    const zipName = `converted_${sessionId.slice(0, 8)}.zip`;
    const chunks: Buffer[] = [];
    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.on("data", (chunk) => chunks.push(Buffer.from(chunk)));

    for (const item of processedFiles) {
      const filePath = path.join(outputDir, item.converted);
      if (fs.existsSync(filePath)) {
        archive.append(fs.createReadStream(filePath), { name: item.converted });
      }
    }

    await archive.finalize();
    const zipBuffer = Buffer.concat(chunks);

    const safeZipName = encodeURIComponent(zipName);
    const response = new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename*=UTF-8''${safeZipName}; filename="${zipName}"`,
        "Content-Length": String(zipBuffer.length),
        "Cache-Control": "no-store, must-revalidate",
        "X-Accel-Buffering": "no",
      },
    });

    scheduleDelete(sessionId, 5000);
    return response;
  } catch (err) {
    console.error("download error:", err);
    return NextResponse.json(
      { error: "Terjadi kesalahan saat menyiapkan download." },
      { status: 500 }
    );
  }
}
