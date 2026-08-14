"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import type { ProcessedItem, SkippedItem, TargetFormat } from "@/lib/types";

interface ConvertResultClient {
  sessionId: string;
  processed: ProcessedItem[];
  skipped: SkippedItem[];
  targetFormat: TargetFormat;
  quality: number;
  isMultiple: boolean;
  createdAt: number;
}

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

export default function ImageConverterPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quality, setQuality] = useState(80);
  const [format, setFormat] = useState<TargetFormat>("webp");
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingFileRef = useRef<File | null>(null);

  const [result, setResult] = useState<ConvertResultClient | null>(null);
  const [dlStatus, setDlStatus] = useState<
    { state: "idle" } | { state: "loading"; msg: string } | { state: "error"; msg: string }
  >({ state: "idle" });

  const triggerBrowserDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    pendingFileRef.current = f;
    setFileName(f ? f.name : null);
    setError(null);
  };

  const resetAll = () => {
    setResult(null);
    setFileName(null);
    setError(null);
    setDlStatus({ state: "idle" });
    pendingFileRef.current = null;
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const tryNormalDownload = async (resData: ConvertResultClient): Promise<boolean> => {
    try {
      setDlStatus({ state: "loading", msg: "Mencoba mengambil file dari sesi..." });
      const r = await fetch(`/api/download/${resData.sessionId}`, {
        cache: "no-store",
        headers: { "X-ICNV-Direct": "1" },
      });
      if (!r.ok) return false;
      const blob = await r.blob();
      if (!blob || blob.size === 0) return false;
      const cd = r.headers.get("content-disposition") || "";
      let fn = `converted.${resData.targetFormat === "jpeg" ? "jpg" : resData.targetFormat}`;
      const matchUtf8 = cd.match(/filename\*=UTF-8''([^;]+)/);
      if (matchUtf8 && matchUtf8[1]) fn = decodeURIComponent(matchUtf8[1]);
      else {
        const matchSimple = cd.match(/filename="([^"]+)"/);
        if (matchSimple?.[1]) fn = matchSimple[1];
      }
      if (resData.isMultiple && !fn.toLowerCase().endsWith(".zip")) fn += ".zip";
      triggerBrowserDownload(blob, fn);
      return true;
    } catch {
      return false;
    }
  };

  const tryDirectDownload = async (): Promise<boolean> => {
    const file = pendingFileRef.current;
    if (!file) return false;
    try {
      setDlStatus({ state: "loading", msg: "Menyiapkan download langsung (convert ulang in-memory)..." });
      const fd = new FormData();
      fd.append("file", file);
      fd.append("format", format);
      fd.append("quality", String(quality));
      const r = await fetch("/api/download-direct", {
        method: "POST",
        body: fd,
        cache: "no-store",
      });
      if (!r.ok) {
        const ct = r.headers.get("content-type") || "";
        if (ct.includes("application/json")) {
          const data = await r.json().catch(() => ({}));
          if (data?.error) throw new Error(data.error);
        }
        throw new Error(`HTTP ${r.status}`);
      }
      const blob = await r.blob();
      if (!blob || blob.size === 0) throw new Error("Response kosong");
      const cd = r.headers.get("content-disposition") || "";
      let fn = `converted.${format === "jpeg" ? "jpg" : format}`;
      const m1 = cd.match(/filename\*=UTF-8''([^;]+)/);
      if (m1?.[1]) fn = decodeURIComponent(m1[1]);
      else {
        const m2 = cd.match(/filename="([^"]+)"/);
        if (m2?.[1]) fn = m2[1];
      }
      triggerBrowserDownload(blob, fn);
      return true;
    } catch (err: any) {
      throw err;
    }
  };

  const handleDownload = async () => {
    if (!result) return;
    setDlStatus({ state: "loading", msg: "Menyiapkan file..." });
    try {
      const ok = await tryNormalDownload(result);
      if (ok) {
        setDlStatus({ state: "idle" });
        return;
      }
      const ok2 = await tryDirectDownload();
      if (ok2) {
        setDlStatus({ state: "idle" });
        return;
      }
      setDlStatus({ state: "error", msg: "Gagal mendownload. Silakan coba konversi ulang." });
    } catch (err: any) {
      setDlStatus({
        state: "error",
        msg: err?.message || "Gagal mendownload. Silakan coba konversi ulang.",
      });
    }
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setDlStatus({ state: "idle" });

    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Pilih file gambar atau ZIP terlebih dahulu.");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError("File terlalu besar. Maksimal 50 MB.");
      return;
    }
    pendingFileRef.current = file;

    const fd = new FormData();
    fd.append("file", file);
    fd.append("format", format);
    fd.append("quality", String(quality));

    setIsLoading(true);
    try {
      const res = await fetch("/api/convert", { method: "POST", body: fd });
      if (!res.ok) {
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("application/json")) {
          const data = await res.json();
          throw new Error(data.error || `Error ${res.status}`);
        }
        throw new Error(`Terjadi kesalahan (${res.status})`);
      }
      const data = await res.json();
      if (!data?.sessionId) throw new Error("Response tidak valid");
      const clientResult: ConvertResultClient = {
        ...data,
        createdAt: Date.now(),
      };
      try {
        window.localStorage.setItem(`icnv:${data.sessionId}`, JSON.stringify(clientResult));
        const keys = JSON.parse(window.localStorage.getItem("icnv:__keys__") || "[]");
        keys.push(data.sessionId);
        while (keys.length > 10) {
          const old = keys.shift();
          try { window.localStorage.removeItem(`icnv:${old}`); } catch {}
        }
        window.localStorage.setItem("icnv:__keys__", JSON.stringify(keys));
      } catch {}
      setResult(clientResult);
    } catch (err: any) {
      setError(err?.message || "Gagal memproses file");
    } finally {
      setIsLoading(false);
    }
  };

  if (result) {
    const meta = result;
    const isMultiple = meta.processed.length > 1;
    const totalBefore = meta.processed.reduce((s, i) => s + (i.sizeBefore || 0), 0);
    const totalAfter = meta.processed.reduce((s, i) => s + (i.sizeAfter || 0), 0);
    const totalSaved = totalBefore - totalAfter;
    const totalSavedPct = totalBefore > 0 ? ((totalSaved / totalBefore) * 100).toFixed(0) : 0;

    return (
      <main className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-6xl mx-auto mb-4">
          <button
            onClick={resetAll}
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition font-medium bg-transparent border-none cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Kembali & Konversi Lagi
          </button>
        </div>

        <div className="max-w-6xl mx-auto">
          <div className="bg-white shadow-2xl rounded-3xl p-6 md:p-8">
            <div className="bg-blue-50 border border-blue-200 text-blue-800 text-xs px-4 py-2 rounded-2xl mb-6 text-center">
              💡 Download 2 lapis: dicoba dari sesi terlebih dahulu. Jika sesi hilang (beda server), otomatis convert ulang in-memory.
            </div>

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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                      <div>
                        <img
                          src={item.thumbBefore || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><rect width='100%25' height='100%25' fill='%23f3f4f6'/><text x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='14' fill='%239ca3af'>Preview tidak tersedia</text></svg>"}
                          alt={`Before - ${item.name}`}
                          className="max-h-52 w-full object-contain mx-auto rounded-2xl shadow-md border border-gray-200 bg-white"
                        />
                        <p className="text-xs text-gray-500 mt-2">
                          {formatBytes(item.sizeBefore)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-center pt-10 text-gray-300">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </div>

                    <div className="flex-1 text-center">
                      <p className="text-xs text-gray-500 mb-2 font-semibold uppercase tracking-wide">
                        Sesudah
                      </p>
                      <div>
                        <img
                          src={item.thumbAfter || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><rect width='100%25' height='100%25' fill='%23ecfdf5'/><text x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='14' fill='%236b7280'>Preview tidak tersedia</text></svg>"}
                          alt={`After - ${item.name}`}
                          className="max-h-52 w-full object-contain mx-auto rounded-2xl shadow-md border border-green-200 bg-white"
                        />
                        <p className="text-xs mt-2">
                          <span className="text-gray-500">{formatBytes(item.sizeAfter)}</span>
                          <span
                            className={`ml-2 font-bold ${
                              (item.sizeAfter || 0) < (item.sizeBefore || 0) ? "text-green-600" : "text-red-500"
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

            <div className="mt-10 flex flex-col gap-3">
              {dlStatus.state === "error" && (
                <div className="max-w-2xl mx-auto w-full bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm text-center">
                  ⚠️ {dlStatus.msg}
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <button
                  onClick={resetAll}
                  disabled={dlStatus.state === "loading"}
                  className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed text-gray-800 font-semibold px-8 py-4 rounded-3xl text-base shadow transition border-none cursor-pointer"
                >
                  🔄 Konversi File Baru
                </button>
                <button
                  onClick={handleDownload}
                  disabled={dlStatus.state === "loading"}
                  className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed text-white font-semibold px-10 py-4 rounded-3xl text-lg shadow-lg shadow-green-600/20 transition active:scale-[0.99] border-none cursor-pointer"
                >
                  {dlStatus.state === "loading" ? (
                    <span className="inline-flex items-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                      {dlStatus.msg}
                    </span>
                  ) : (
                    <>⬇️ Download {isMultiple ? "ZIP Hasil" : "File Hasil"}</>
                  )}
                </button>
              </div>
              <p className="text-center text-xs text-gray-400 max-w-2xl mx-auto mt-2">
                💡 Jika sesi terhapus (batasan serverless), sistem otomatis convert ulang in-memory secara diam-diam lalu download — file Anda tetap dijamin bisa didapat.
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto mb-4">
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

      <div className="max-w-2xl mx-auto bg-white shadow-xl rounded-3xl p-8">
        <h1 className="text-3xl font-bold text-center mb-2 text-gray-900">
          🖼️ Image Converter
        </h1>
        <p className="text-center text-sm text-gray-500 mb-8">
          Convert gambar ke JPG / PNG / WebP • Support ZIP untuk bulk
        </p>

        <form onSubmit={onSubmit} className="space-y-6" encType="multipart/form-data">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Pilih File Gambar atau ZIP
            </label>
            <label className="block cursor-pointer">
              <div className={`
                w-full border-2 border-dashed rounded-2xl px-6 py-8 text-center
                transition hover:border-blue-500 hover:bg-blue-50/40
                ${error ? "border-red-400 bg-red-50/40" : "border-gray-300 bg-gray-50"}
              `}>
                <div className="text-5xl mb-3">📁</div>
                {fileName ? (
                  <p className="font-semibold text-gray-800 truncate">{fileName}</p>
                ) : (
                  <>
                    <p className="text-gray-600 font-medium">
                      Klik atau drop file disini
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Max 50 MB • Image (JPG, PNG, WebP, HEIC, SVG, dll) atau ZIP
                    </p>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  name="file"
                  accept="image/*,.zip"
                  onChange={onFileChange}
                  className="hidden"
                />
              </div>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Format Tujuan
              </label>
              <select
                name="format"
                value={format}
                onChange={(e) => setFormat(e.target.value as TargetFormat)}
                className="w-full border border-gray-300 rounded-2xl px-4 py-3 bg-white
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="webp">WebP (Rekomendasi, ukuran kecil)</option>
                <option value="jpeg">JPEG (Universal)</option>
                <option value="png">PNG (Transparan)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Kualitas <span className="text-blue-600 font-bold">{quality}%</span>
              </label>
              <input
                type="range"
                name="quality"
                min={10}
                max={100}
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600 mt-3"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>Kecil</span>
                <span>Bagus</span>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm">
              ⚠️ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className={`
              w-full text-white font-semibold py-4 rounded-3xl text-lg transition-all border-none cursor-pointer
              ${isLoading
                ? "bg-blue-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 active:scale-[0.99] shadow-lg shadow-blue-600/20"
              }
            `}
          >
            {isLoading ? (
              <span className="inline-flex items-center gap-2 justify-center">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>
                Memproses...
              </span>
            ) : (
              "🚀 Konversi Sekarang"
            )}
          </button>
        </form>
      </div>

      <footer className="max-w-2xl mx-auto text-center text-xs text-gray-400 mt-6">
        File auto-hapus setelah 30 menit
      </footer>
    </main>
  );
}
