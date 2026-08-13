import axios from "axios";
import { useCallback, useMemo, useRef, useState } from "react";

import type {
  BulkSenderConfig,
  FailedItem,
  LogItem,
  SenderStatus,
} from "@/lib/bulkSender/types";

import { sleep } from "@/utils/sleep";

type SendTarget = {
  index: number;
  item: Record<string, unknown>;
};

type SendAttemptResult = {
  ok: boolean;
  status?: number;
  message: string;
};

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function pickLabel(item: Record<string, unknown>) {
  const email = item.email;
  if (typeof email === "string" && email.trim()) return email;

  const username = item.username;
  if (typeof username === "string" && username.trim()) return username;

  const name = item.name;
  if (typeof name === "string" && name.trim()) return name;

  return undefined;
}

function toMessage(data: unknown, fallback?: string) {
  if (typeof data === "string" && data.trim()) return data;
  if (!data || typeof data !== "object") return fallback ?? "Unknown error";

  const maybeMessage = (data as Record<string, unknown>).message;
  if (typeof maybeMessage === "string" && maybeMessage.trim()) return maybeMessage;

  const maybeError = (data as Record<string, unknown>).error;
  if (typeof maybeError === "string" && maybeError.trim()) return maybeError;

  try {
    return JSON.stringify(data);
  } catch {
    return fallback ?? "Unknown error";
  }
}

function normalizeEndpoint(input: string) {
  let v = input.trim();
  for (let i = 0; i < 3; i++) {
    const first = v[0];
    const last = v[v.length - 1];
    const wrappedBySame =
      (first === "'" && last === "'") ||
      (first === '"' && last === '"') ||
      (first === "`" && last === "`");
    if (!wrappedBySame) break;
    v = v.slice(1, -1).trim();
  }
  return v;
}

async function sendOne(
  target: SendTarget,
  config: BulkSenderConfig,
): Promise<SendAttemptResult> {
  const endpoint = normalizeEndpoint(config.endpoint);
  const method = config.method;
  const timeout = Number.isFinite(config.timeoutMs) ? config.timeoutMs : 0;

  const upstreamHeaders: Record<string, string> = {};
  if (config.authorization?.trim()) upstreamHeaders.Authorization = config.authorization.trim();
  if (config.headerKey?.trim() && config.headerValue?.trim()) {
    upstreamHeaders[config.headerKey.trim()] = config.headerValue.trim();
  }

  try {
    const useProxy = config.useProxy;
    const response = await axios.request({
      url: useProxy ? "/api/proxy" : endpoint,
      method: useProxy ? "POST" : method,
      timeout: timeout > 0 ? timeout : undefined,
      headers: useProxy ? undefined : upstreamHeaders,
      data: useProxy
        ? {
            url: endpoint,
            method,
            headers: upstreamHeaders,
            data: method === "GET" ? undefined : target.item,
            params: method === "GET" ? target.item : undefined,
          }
        : method === "GET"
          ? undefined
          : target.item,
      params: useProxy ? undefined : method === "GET" ? target.item : undefined,
      validateStatus: () => true,
    });

    const ok = response.status >= 200 && response.status < 300;
    const message = toMessage(response.data, response.statusText);
    return { ok, status: response.status, message };
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      const message = toMessage(err.response?.data, err.message);
      return { ok: false, status, message };
    }
    return { ok: false, message: "Request gagal." };
  }
}

export function useBulkSender() {
  const [status, setStatus] = useState<SenderStatus>("idle");
  const [total, setTotal] = useState(0);
  const [success, setSuccess] = useState(0);
  const [failed, setFailed] = useState(0);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [failedItems, setFailedItems] = useState<FailedItem[]>([]);

  const stopRequestedRef = useRef(false);

  const processed = success + failed;
  const remaining = Math.max(0, total - processed);

  const progressPercent = useMemo(() => {
    if (!total) return 0;
    return Math.min(100, Math.round((processed / total) * 100));
  }, [processed, total]);

  const reset = useCallback(() => {
    stopRequestedRef.current = false;
    setStatus("idle");
    setTotal(0);
    setSuccess(0);
    setFailed(0);
    setLogs([]);
    setFailedItems([]);
  }, []);

  const stop = useCallback(() => {
    if (status !== "running") return;
    stopRequestedRef.current = true;
    setStatus("stopping");
  }, [status]);

  const start = useCallback(
    async (targets: SendTarget[], config: BulkSenderConfig) => {
      if (!targets.length) return;

      stopRequestedRef.current = false;
      setStatus("running");
      setTotal(targets.length);
      setSuccess(0);
      setFailed(0);
      setFailedItems([]);

      const nextFailedItems: FailedItem[] = [];

      for (let i = 0; i < targets.length; i++) {
        const target = targets[i];
        const label = pickLabel(target.item);
        const result = await sendOne(target, config);

        if (result.ok) {
          setSuccess((v) => v + 1);
        } else {
          setFailed((v) => v + 1);
          nextFailedItems.push({ index: target.index, item: target.item });
        }

        const logItem: LogItem = {
          id: createId(),
          index: target.index,
          ok: result.ok,
          status: result.status,
          label,
          message: result.message,
          timestamp: Date.now(),
        };
        setLogs((prev) => [logItem, ...prev]);

        if (stopRequestedRef.current) {
          setFailedItems(nextFailedItems);
          setStatus("idle");
          return;
        }

        if (i < targets.length - 1) {
          const delayMs = Math.max(0, Math.floor(config.delayMs));
          if (delayMs > 0) await sleep(delayMs);
        }
      }

      setFailedItems(nextFailedItems);
      setStatus("done");
    },
    [],
  );

  const retryFailed = useCallback(
    async (config: BulkSenderConfig) => {
      if (!failedItems.length) return;
      const targets: SendTarget[] = failedItems.map((x) => ({
        index: x.index,
        item: x.item,
      }));
      await start(targets, config);
    },
    [failedItems, start],
  );

  return {
    status,
    total,
    success,
    failed,
    processed,
    remaining,
    progressPercent,
    logs,
    failedItems,
    start,
    stop,
    retryFailed,
    reset,
  };
}

export type BulkSenderController = ReturnType<typeof useBulkSender>;
