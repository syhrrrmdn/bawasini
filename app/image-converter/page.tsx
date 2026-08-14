"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function ImageConverterPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quality, setQuality] = useState(80);
  const [format, setFormat] = useState<"webp" | "jpeg" | "png">("webp");
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setFileName(f ? f.name : null);
    setError(null);
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Pilih file gambar atau ZIP terlebih dahulu.");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError("File terlalu besar. Maksimal 50 MB.");
      return;
    }

    const fd = new FormData();
    fd.append("file", file);
    fd.append("format", format);
    fd.append("quality", String(quality));

    setIsLoading(true);
    try {
      const res = await fetch("/api/convert", {
        method: "POST",
        body: fd,
      });

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
      const cache = {
        ...data,
        createdAt: Date.now(),
      };
      try {
        window.localStorage.setItem(`icnv:${data.sessionId}`, JSON.stringify(cache));
        const keys = JSON.parse(window.localStorage.getItem("icnv:__keys__") || "[]");
        keys.push(data.sessionId);
        while (keys.length > 10) {
          const old = keys.shift();
          try { window.localStorage.removeItem(`icnv:${old}`); } catch {}
        }
        window.localStorage.setItem("icnv:__keys__", JSON.stringify(keys));
      } catch {}
      router.push(`/image-converter/result/${data.sessionId}`);
    } catch (err: any) {
      setError(err?.message || "Gagal memproses file");
    } finally {
      setIsLoading(false);
    }
  };

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
                onChange={(e) => setFormat(e.target.value as any)}
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
              w-full text-white font-semibold py-4 rounded-3xl text-lg transition-all
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
