export type HttpMethod = "POST" | "PUT" | "PATCH" | "DELETE" | "GET";

export type BulkSenderConfig = {
  endpoint: string;
  method: HttpMethod;
  delayMs: number;
  timeoutMs: number;
  useProxy: boolean;
  authorization?: string;
  headerKey?: string;
  headerValue?: string;
};

export type ParsedDataResult =
  | { ok: true; items: Array<Record<string, unknown>>; normalizedText: string }
  | { ok: false; message: string; errorIndex?: number };

export type LogItem = {
  id: string;
  index: number;
  ok: boolean;
  status?: number;
  label?: string;
  message: string;
  timestamp: number;
};

export type FailedItem = {
  index: number;
  item: Record<string, unknown>;
};

export type SenderStatus = "idle" | "running" | "stopping" | "done";
