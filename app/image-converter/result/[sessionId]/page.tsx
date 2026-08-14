import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionMetaDiagnostic } from "@/lib/storage";
import type { ProcessedItem } from "@/lib/types";

function formatBytes(bytes?: number): string {
  if (!bytes) return "-";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

function sizeSavedPercent(item: ProcessedItem): string {
  if (!item.sizeBefore || !item.sizeAfter) return "-";
  const diff = item.sizeBefore - item.sizeAfter;
  const pct = (diff / item.sizeBefore) * 100;
  if (pct > 0) return `-${pct.toFixed(0)}%`;
  return `+${Math.abs(pct).toFixed(0)}%`;
}

export default async function ResultPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const diag = getSessionMetaDiagnostic(sessionId);

  if (!diag.ok) {
    const detailLines: string[] = [];
    detailLines.push(`Root temp dir: ${diag.root}`);
    detailLines.push(`Session ID valid (UUID v4): ${diag.sessionIdValid ? "✅" : "❌"}`);
    detailLines.push(`Folder sesi ada: ${diag.dirExists ? "✅" : "❌"}`);
    detailLines.push(`meta.json ada: ${diag.metaExists ? "✅" : "❌"}`);
    detailLines.push(`Parse meta OK: ${diag.parseOk ? "✅" : "❌"}`);
    detailLines.push(`Expired: ${diag.expired ? "⚠️" : "Tidak"}`);
    if (diag.error) detailLines.push(`Error: ${diag.error}`);
    detailLines.push(`Platform: ${process.platform} | NODE_ENV: ${process.env.NODE_ENV || "development"}`);
    const isServerless = !!process.env.VERCEL || !!process.env.NEXT_RUNTIME;
    detailLines.push(`Serverless: ${isServerless ? "Ya" : "Tidak"}`);

    return (
      <main className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-3xl mx-auto mb-4">
          <Link
            href="/image-converter"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition font-medium"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Kembali ke Image Converter
          </Link>
        </div>
        <div className="max-w-3xl mx-auto bg-white shadow-xl rounded-3xl p-8">
          <h1 className="text-2xl font-bold text-red-600 mb-2 text-center">
            ⚠️ Sesi Tidak Ditemukan
          </h1>
          <p className="text-center text-sm text-gray-500 mb-6">
            Sesi konversi Anda tidak bisa ditemukan. Coba lakukan konversi ulang.
          </p>
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-6">
            <p className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">
              Diagnostik (Developer Info)
            </p>
            <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono leading-relaxed">
{detailLines.join("\n")}
            </pre>
          </div>
          <div className="flex gap-4 justify-center">
            <Link
              href="/image-converter"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-2xl shadow transition"
            >
              🔄 Konversi Ulang
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold px-6 py-3 rounded-2xl transition"
            >
              🏠 Dashboard
            </Link>
          </div>
          <p className="text-center text-xs text-gray-400 mt-6">
            💡 Jika Anda baru saja klik &quot;Konversi&quot; tapi langsung dapat error ini,<br />
            kemungkinan server Vercel menghapus file /tmp saat cold start. Coba 2x konversi agar server warm.
          </p>
        </div>
      </main>
    );
  }

  const meta = diag.meta!;

  const isMultiple = meta.processed.length > 1;
  const totalBefore = meta.processed.reduce((s, i) => s + (i.sizeBefore || 0), 0);
  const totalAfter = meta.processed.reduce((s, i) => s + (i.sizeAfter || 0), 0);
  const totalSaved = totalBefore - totalAfter;
  const totalSavedPct = totalBefore > 0 ? ((totalSaved / totalBefore) * 100).toFixed(0) : 0;

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto mb-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition font-medium"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Kembali ke Dashboard
        </Link>
      </div>

      <div className="max-w-6xl mx-auto">
        <div className="bg-white shadow-2xl rounded-3xl p-6 md:p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              ✅ Konversi Berhasil!
            </h1>
            <p className="text-sm text-gray-500">
              {meta.processed.length} file berhasil • Format: {meta.targetFormat.toUpperCase()} • Kualitas: {meta.quality}%
            </p>
            {meta.skipped.length > 0 && (
              <p className="text-xs text-amber-600 mt-1">
                ⚠️ {meta.skipped.length} file dilewati (tidak didukung / error)
              </p>
            )}
          </div>

          {isMultiple && totalSaved > 0 && (
            <div className="mb-8 bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
              <p className="text-green-800 font-semibold">
                🎉 Total hemat ukuran: {formatBytes(totalSaved)} ({totalSavedPct}% lebih kecil!)
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
            {meta.processed.map((item, idx) => (
              <div
                key={idx}
                className="border border-gray-200 rounded-3xl p-5 bg-gray-50/50 hover:shadow-lg transition-shadow"
              >
                <p className="font-semibold text-gray-800 mb-4 text-center text-sm truncate">
                  {item.name}
                </p>
                <div className="flex gap-4 items-start">
                  <div className="flex-1 text-center">
                    <p className="text-xs text-gray-500 mb-2 font-semibold uppercase tracking-wide">
                      Sebelum
                    </p>
                    <div className="relative group">
                      <img
                        src={`/api/preview/${sessionId}/input/${item.original}`}
                        alt={`Before - ${item.name}`}
                        className="max-h-52 w-full object-contain mx-auto rounded-2xl shadow-md border border-gray-200 bg-white"
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        {formatBytes(item.sizeBefore)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-center pt-10 text-gray-300">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </div>

                  <div className="flex-1 text-center">
                    <p className="text-xs text-gray-500 mb-2 font-semibold uppercase tracking-wide">
                      Sesudah
                    </p>
                    <div className="relative group">
                      <img
                        src={`/api/preview/${sessionId}/output/${item.converted}`}
                        alt={`After - ${item.name}`}
                        className="max-h-52 w-full object-contain mx-auto rounded-2xl shadow-md border border-green-200 bg-white"
                      />
                      <p className="text-xs mt-2">
                        <span className="text-gray-500">{formatBytes(item.sizeAfter)}</span>
                        <span
                          className={`ml-2 font-bold ${
                            (item.sizeAfter || 0) < (item.sizeBefore || 0)
                              ? "text-green-600"
                              : "text-red-500"
                          }`}
                        >
                          {sizeSavedPercent(item)}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                {!isMultiple && (
                  <div className="mt-4 text-center">
                    <span className="inline-block text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-full">
                      Engine: {item.engine}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              href="/image-converter"
              className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold px-8 py-4 rounded-3xl text-base shadow transition"
            >
              🔄 Konversi Lagi
            </Link>

            <a
              href={`/api/download/${sessionId}`}
              className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold px-10 py-4 rounded-3xl text-lg shadow-lg shadow-green-600/20 transition active:scale-[0.99]"
              style={{ textDecoration: "none" }}
            >
              ⬇️ Download {isMultiple ? "ZIP Hasil" : "File Hasil"}
            </a>
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            ⚠️ File di server akan dihapus otomatis setelah Anda download atau 30 menit
          </p>
        </div>
      </div>
    </main>
  );
}
