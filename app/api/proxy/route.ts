import { NextResponse } from "next/server";

import { guardUrl } from "@/lib/server/hostGuard";

type ProxyFile = {
  field: string;
  filename?: string;
  contentType?: string;
  dataUri: string;
};

type ProxyRequest = {
  url: string;
  method: string;
  headers?: Record<string, string>;
  data?: unknown;
  params?: Record<string, unknown>;
  files?: ProxyFile[];
};

const DATA_URI_RE = /^data:([^;,]*)?(;base64)?,([\s\S]*)$/;

function parseDataUri(dataUri: string) {
  const match = DATA_URI_RE.exec(dataUri.trim());
  if (!match) return null;
  const contentType = match[1] || "application/octet-stream";
  const isBase64 = Boolean(match[2]);
  const raw = match[3];
  const bytes = isBase64
    ? Buffer.from(raw, "base64")
    : Buffer.from(decodeURIComponent(raw), "binary");
  return { contentType, bytes };
}

function buildFormData(data: unknown, files: ProxyFile[]) {
  const form = new FormData();
  const fields =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    form.append(key, typeof value === "string" ? value : JSON.stringify(value));
  }

  for (const file of files) {
    if (!file?.field) continue;
    const parsed = parseDataUri(file.dataUri ?? "");
    if (!parsed) continue;
    form.append(
      file.field,
      new Blob([new Uint8Array(parsed.bytes)], {
        type: file.contentType || parsed.contentType,
      }),
      file.filename || `${file.field}.png`,
    );
  }

  return form;
}

function toSearchParams(params: Record<string, unknown>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      sp.set(k, String(v));
      continue;
    }
    sp.set(k, JSON.stringify(v));
  }
  return sp;
}

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  let payload: ProxyRequest;
  try {
    payload = (await req.json()) as ProxyRequest;
  } catch {
    return NextResponse.json({ message: "Body JSON tidak valid." }, { status: 400 });
  }

  if (!payload?.url || typeof payload.url !== "string") {
    return NextResponse.json({ message: "Field url wajib." }, { status: 400 });
  }

  const rawUrl = payload.url.trim();
  if (!rawUrl) {
    return NextResponse.json({ message: "Field url wajib." }, { status: 400 });
  }

  const guarded = guardUrl(rawUrl);
  if (!guarded.ok) {
    return NextResponse.json({ message: guarded.message }, { status: guarded.status });
  }

  const targetUrl = guarded.url;

  const method = String(payload.method ?? "GET").toUpperCase();
  const headers = new Headers(payload.headers ?? {});

  if (payload.params && typeof payload.params === "object") {
    const sp = toSearchParams(payload.params as Record<string, unknown>);
    for (const [k, v] of sp.entries()) targetUrl.searchParams.set(k, v);
  }

  const files = Array.isArray(payload.files) ? payload.files : [];

  let body: BodyInit | undefined;
  if (method !== "GET" && method !== "HEAD") {
    if (files.length > 0) {
      // Biarkan fetch menetapkan content-type + boundary multipart secara otomatis.
      body = buildFormData(payload.data, files);
    } else {
      if (!headers.has("content-type")) headers.set("content-type", "application/json");
      body = JSON.stringify(payload.data ?? {});
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl.toString(), {
      method,
      headers,
      body,
      redirect: "follow",
    });
  } catch {
    return NextResponse.json({ message: "Gagal menghubungi server target." }, { status: 502 });
  }

  const contentType = upstream.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    let json: unknown;
    try {
      json = await upstream.json();
    } catch {
      json = null;
    }
    return NextResponse.json(json, { status: upstream.status });
  }

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: contentType ? { "content-type": contentType } : undefined,
  });
}
