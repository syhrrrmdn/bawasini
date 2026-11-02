import type { Dispatch, SetStateAction } from "react";

import type { BulkSenderConfig } from "@/lib/bulkSender/types";

import { Card } from "@/components/Card";
import { TextInput } from "@/components/Inputs";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function dataUriSize(dataUri: string) {
  const base64 = dataUri.split(",")[1] ?? "";
  return Math.floor((base64.length * 3) / 4);
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
                Upload Gambar Lokal (fallback)
              </div>
              <input
                type="file"
                accept="image/*"
                disabled={disabled}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    const result = typeof reader.result === "string" ? reader.result : "";
                    if (result) setConfig((c) => ({ ...c, localImageDataUri: result }));
                  };
                  reader.readAsDataURL(file);
                }}
                className="block w-full text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-zinc-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-zinc-800 disabled:opacity-50"
              />
            </div>

            {localImage ? (
              <div className="flex items-center gap-3 rounded-lg border border-zinc-200 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={localImage}
                  alt="Pratinjau gambar lokal"
                  className="h-14 w-14 rounded object-cover"
                />
                <div className="flex-1 text-xs text-zinc-600">
                  <div className="font-medium text-zinc-800">Gambar lokal siap dipakai</div>
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
              Jika payload berisi URL gambar di field sumber (atau terdeteksi otomatis),
              gambar diunduh dulu dari web lalu hasilnya (base64/data URI) dimasukkan ke
              field gambar sebelum request dikirim. Bila tidak ada URL gambar, gambar
              lokal dipakai sebagai fallback.
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
