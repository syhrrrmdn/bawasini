import type { Dispatch, SetStateAction } from "react";

import type { BulkSenderConfig, HttpMethod } from "@/lib/bulkSender/types";

import { Card } from "@/components/Card";
import { NumberInput, TextInput } from "@/components/Inputs";

const METHODS: HttpMethod[] = ["POST", "PUT", "PATCH", "DELETE", "GET"];

export function EndpointCard({
  config,
  setConfig,
  disabled,
}: {
  config: BulkSenderConfig;
  setConfig: Dispatch<SetStateAction<BulkSenderConfig>>;
  disabled: boolean;
}) {
  return (
    <Card title="Endpoint">
      <div className="grid gap-3">
        <div className="grid gap-2">
          <div className="text-xs font-medium text-zinc-600">API Endpoint</div>
          <TextInput
            value={config.endpoint}
            onChange={(endpoint) => setConfig((c) => ({ ...c, endpoint }))}
            placeholder="https://localhost:3000/api/users"
            disabled={disabled}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <div className="text-xs font-medium text-zinc-600">HTTP Method</div>
            <select
              value={config.method}
              onChange={(e) =>
                setConfig((c) => ({ ...c, method: e.target.value as HttpMethod }))
              }
              disabled={disabled}
              className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-blue-500 disabled:bg-zinc-100"
            >
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <div className="text-xs font-medium text-zinc-600">Delay (ms)</div>
            <NumberInput
              value={config.delayMs}
              min={0}
              step={50}
              onChange={(delayMs) => setConfig((c) => ({ ...c, delayMs }))}
              disabled={disabled}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <div className="text-xs font-medium text-zinc-600">Timeout (ms)</div>
            <NumberInput
              value={config.timeoutMs}
              min={0}
              step={500}
              onChange={(timeoutMs) => setConfig((c) => ({ ...c, timeoutMs }))}
              disabled={disabled}
            />
          </div>

          <div className="grid gap-2">
            <div className="text-xs font-medium text-zinc-600">
              Authorization (opsional)
            </div>
            <TextInput
              value={config.authorization ?? ""}
              onChange={(authorization) =>
                setConfig((c) => ({ ...c, authorization }))
              }
              placeholder="Bearer <token> / Basic ..."
              disabled={disabled}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-zinc-600">
          <input
            type="checkbox"
            checked={config.useProxy}
            onChange={(e) => setConfig((c) => ({ ...c, useProxy: e.target.checked }))}
            disabled={disabled}
            className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
          />
          Use server proxy (bypass CORS)
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <div className="text-xs font-medium text-zinc-600">
              Custom Header Key (opsional)
            </div>
            <TextInput
              value={config.headerKey ?? ""}
              onChange={(headerKey) => setConfig((c) => ({ ...c, headerKey }))}
              placeholder="X-API-KEY"
              disabled={disabled}
            />
          </div>
          <div className="grid gap-2">
            <div className="text-xs font-medium text-zinc-600">
              Custom Header Value
            </div>
            <TextInput
              value={config.headerValue ?? ""}
              onChange={(headerValue) =>
                setConfig((c) => ({ ...c, headerValue }))
              }
              placeholder="..."
              disabled={disabled}
            />
          </div>
        </div>

        <div className="text-xs text-zinc-500">
          Catatan: jika proxy mati, request berjalan dari browser, jadi endpoint harus
          mengizinkan CORS.
        </div>
      </div>
    </Card>
  );
}
