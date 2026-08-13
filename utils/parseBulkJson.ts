import type { ParsedDataResult } from "@/lib/bulkSender/types";

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function normalizeTrailingComma(text: string) {
  const trimmed = text.trimEnd();
  if (trimmed.endsWith(",")) return trimmed.slice(0, -1);
  return trimmed;
}

function splitTopLevelObjects(text: string) {
  const parts: string[] = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
      continue;
    }

    if (ch === "}") {
      if (depth > 0) depth--;
      if (depth === 0 && start !== -1) {
        const raw = text.slice(start, i + 1).trim();
        if (raw) parts.push(raw);
        start = -1;
      }
    }
  }

  return parts;
}

export function parseBulkJson(rawText: string): ParsedDataResult {
  const text = rawText.trim();
  if (!text) return { ok: false, message: "Input data masih kosong." };

  try {
    const parsed = JSON.parse(text) as unknown;
    if (Array.isArray(parsed)) {
      const items: Array<Record<string, unknown>> = [];
      for (let i = 0; i < parsed.length; i++) {
        const rec = toRecord(parsed[i]);
        if (!rec) return { ok: false, message: "Data harus berisi object JSON.", errorIndex: i + 1 };
        items.push(rec);
      }
      return { ok: true, items, normalizedText: text };
    }

    const single = toRecord(parsed);
    if (!single) return { ok: false, message: "Data harus berupa object JSON atau array object." };
    return {
      ok: true,
      items: [single],
      normalizedText: JSON.stringify([single], null, 2),
    };
  } catch {
    const withoutTrailingComma = normalizeTrailingComma(text);
    const wrapped = `[${withoutTrailingComma}]`;
    try {
      const parsedWrapped = JSON.parse(wrapped) as unknown;
      if (!Array.isArray(parsedWrapped)) {
        return { ok: false, message: "Data harus berupa object JSON atau array object." };
      }

      const items: Array<Record<string, unknown>> = [];
      for (let i = 0; i < parsedWrapped.length; i++) {
        const rec = toRecord(parsedWrapped[i]);
        if (!rec) return { ok: false, message: "Data harus berisi object JSON.", errorIndex: i + 1 };
        items.push(rec);
      }

      return { ok: true, items, normalizedText: JSON.stringify(items, null, 2) };
    } catch {
      const parts = splitTopLevelObjects(withoutTrailingComma);
      if (parts.length > 0) {
        for (let i = 0; i < parts.length; i++) {
          try {
            const parsedPart = JSON.parse(parts[i]) as unknown;
            const rec = toRecord(parsedPart);
            if (!rec) {
              return { ok: false, message: "Data harus berisi object JSON.", errorIndex: i + 1 };
            }
          } catch {
            return { ok: false, message: "Parsing JSON gagal pada salah satu object.", errorIndex: i + 1 };
          }
        }
      }

      return { ok: false, message: "Parsing JSON gagal. Pastikan format JSON valid." };
    }
  }
}
