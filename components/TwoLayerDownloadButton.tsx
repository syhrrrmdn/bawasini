"use client";

import { useState } from "react";
import { downloadTwoLayer } from "@/lib/clientFileCache";
import type { TargetFormat } from "@/lib/types";

interface Props {
  sessionId: string;
  targetFormat: TargetFormat;
  quality: number;
  isMultiple: boolean;
  className?: string;
}

export default function TwoLayerDownloadButton({
  sessionId,
  targetFormat,
  quality,
  isMultiple,
  className = "",
}: Props) {
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "loading"; msg: string }
    | { kind: "error"; msg: string }
  >({ kind: "idle" });

  const label = `⬇️ Download ${isMultiple ? "ZIP Hasil" : "File Hasil"}`;

  const handleClick = async () => {
    if (state.kind === "loading") return;
    setState({ kind: "loading", msg: "Menyiapkan file..." });
    try {
      const ok = await downloadTwoLayer({
        sessionId,
        targetFormat,
        quality,
        isMultiple,
      });
      if (ok) {
        setState({ kind: "idle" });
        return;
      }
      setState({
        kind: "error",
        msg: "Gagal mendownload. Silakan coba konversi ulang.",
      });
    } catch (err: any) {
      setState({
        kind: "error",
        msg: err?.message || "Gagal mendownload. Silakan coba konversi ulang.",
      });
    }
  };

  return (
    <div className="w-full flex flex-col items-center gap-2">
      {state.kind === "error" && (
        <div className="max-w-2xl mx-auto w-full bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm text-center">
          ⚠️ {state.msg}
        </div>
      )}
      <button
        onClick={handleClick}
        disabled={state.kind === "loading"}
        className={`inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed text-white font-semibold px-10 py-4 rounded-3xl text-lg shadow-lg shadow-green-600/20 transition active:scale-[0.99] border-none cursor-pointer ${className}`}
      >
        {state.kind === "loading" ? (
          <span className="inline-flex items-center gap-2">
            <svg
              className="animate-spin h-5 w-5"
              viewBox="0 0 24 24"
            >
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
            {state.msg}
          </span>
        ) : (
          <>{label}</>
        )}
      </button>
    </div>
  );
}
