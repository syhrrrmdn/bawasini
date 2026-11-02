import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import type { BulkSenderConfig, ImageSendMode } from "@/lib/bulkSender/types";

import { Card } from "@/components/Card";
import { TextInput } from "@/components/Inputs";

const MODES: Array<{ value: ImageSendMode; label: string }> = [
  { value: "multipart", label: "multipart/form-data (file PNG)" },
  { value: "json", label: "JSON + base64 (data URI PNG)" },
];

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function dataUriSize(dataUri: string) {
  const base64 = dataUri.split(",")[1] ?? "";
  return Math.floor((base64.length * 3) / 4);
}

/** Konversi gambar lokal apa pun menjadi PNG agar lolos validasi file PNG di API. */
async function fileToPngDataUri(file: File) {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas tidak tersedia.");
    ctx.drawImage(bitmap, 0, 0);
    return canvas.toDataURL("image/png");
  } finally {
    bitmap.close();
  }
}

export function ImageCard({
  config,
  setConfig,
  disabled,
}: {
  config: BulkSenderConfig;
  setConfig: Dispatch<SetStateAction<BulkSenderConfig>>;
  disabled: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const localImage = config.localImageDataUri ?? "";

  return (
    <Card
      title="Gambar"
      right={
        config.imageEnabled ? (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
            Aktif
          </span>
        ) : null
      }
    >
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-xs text-zinc-600">
          <input
            type="checkbox"
            checked={config.imageEnabled}
            onChange={(e) => setConfig((c) => ({ ...c, imageEnabled: e.target.checked }))}
            disabled={disabled}
            className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
          />
          Kirim gambar pada tiap object
        </label>

        {config.imageEnabled ? (
          <>
            <div className="grid gap-2">
              <div className="text-xs font-medium text-zinc-600">Mode Kirim Gambar</div>
              <select
                value={config.imageMode}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, imageMode: e.target.value as ImageSendMode }))
                }
                disabled={disabled}
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-blue-500 disabled:bg-zinc-100"
              >
                {MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <div className="text-xs font-medium text-zinc-600">
                  Field Gambar di Payload
                </div>
                <TextInput
                  value={config.imageField}
                  onChange={(imageField) => setConfig((c) => ({ ...c, imageField }))}
                  placeholder="image"
                  disabled={disabled}
                />
              </div>

              <div className="grid gap-2">
                <div className="text-xs font-medium text-zinc-600">
                  Field URL Gambar (opsional)
                </div>
                <TextInput
                  value={config.imageUrlField ?? ""}
                  onChange={(imageUrlField) => setConfig((c) => ({ ...c, imageUrlField }))}
                  placeholder="kosong = deteksi otomatis"
                  disabled={disabled}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <div className="text-xs font-medium text-zinc-600">
                Upload Gambar Lokal (fallback, otomatis jadi PNG)
              </div>
              <input
                type="file"
                accept="image/*"
                disabled={disabled}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  setError(null);
                  try {
                    const dataUri = await fileToPngDataUri(file);
                    setConfig((c) => ({ ...c, localImageDataUri: dataUri }));
                  } catch {
                    setError("Gagal membaca gambar. Coba file PNG atau JPG.");
                  }
                }}
                className="block w-full text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-zinc-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-zinc-800 disabled:opacity-50"
              />
            </div>

            {error ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
                {error}
              </div>
            ) : null}

            {localImage ? (
              <div className="flex items-center gap-3 rounded-lg border border-zinc-200 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={localImage}
                  alt="Pratinjau gambar lokal"
                  className="h-14 w-14 rounded object-cover"
                />
                <div className="flex-1 text-xs text-zinc-600">
                  <div className="font-medium text-zinc-800">Gambar lokal siap dipakai (PNG)</div>
                  <div>{formatBytes(dataUriSize(localImage))}</div>
                </div>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => setConfig((c) => ({ ...c, localImageDataUri: "" }))}
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
                >
                  Hapus
                </button>
              </div>
            ) : null}

            <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-900">
              Gambar dari web (URL di payload atau terdeteksi otomatis) diunduh dulu lalu
              dikonversi ke PNG. Mode multipart mengirim file dengan nama field di atas;
              mode JSON menaruh data URI PNG di field tersebut. Bila tidak ada URL gambar,
              gambar lokal dipakai sebagai fallback.
            </div>
          </>
        ) : (
          <div className="text-xs text-zinc-500">
            Aktifkan untuk menyertakan gambar pada setiap request.
          </div>
        )}
      </div>
    </Card>
  );
}
