"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { Card } from "@/components/Card";
import { DataInputCard } from "@/components/DataInputCard";
import { EndpointCard } from "@/components/EndpointCard";
import { LogPanel } from "@/components/LogPanel";
import { PreviewCard } from "@/components/PreviewCard";
import { RunCard } from "@/components/RunCard";
import { useBulkSender } from "@/hooks/useBulkSender";
import type { BulkSenderConfig } from "@/lib/bulkSender/types";
import { parseBulkJson } from "@/utils/parseBulkJson";

export default function BulkApiSenderPage() {
  const sender = useBulkSender();
  const isBusy = sender.status === "running" || sender.status === "stopping";

  const [config, setConfig] = useState<BulkSenderConfig>({
    endpoint: "",
    method: "POST",
    delayMs: 200,
    timeoutMs: 10000,
    useProxy: false,
    authorization: "",
    headerKey: "",
    headerValue: "",
  });

  const [rawText, setRawText] = useState("");

  const parsed = useMemo(() => parseBulkJson(rawText), [rawText]);

  return (
    <div className="min-h-full flex-1 bg-zinc-50">
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        <div className="mb-5">
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

        <header className="space-y-1 mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            📡 Bulk API Sender
          </h1>
          <p className="text-sm text-zinc-600">
            Kirim ratusan object JSON satu per satu (sequential) untuk testing API
            yang hanya menerima 1 object per request.
          </p>
        </header>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <EndpointCard config={config} setConfig={setConfig} disabled={isBusy} />
            <DataInputCard rawText={rawText} setRawText={setRawText} disabled={isBusy} />
            <PreviewCard parsed={parsed} />
          </div>

          <div className="space-y-4">
            <RunCard sender={sender} config={config} parsed={parsed} isBusy={isBusy} />

            <Card title="Log">
              <LogPanel logs={sender.logs} />
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
