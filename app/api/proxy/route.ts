import { NextResponse } from "next/server";

type ProxyRequest = {
  url: string;
  method: string;
  headers?: Record<string, string>;
  data?: unknown;
  params?: Record<string, unknown>;
};

function getAllowlist() {
  const raw = process.env.BULK_SENDER_PROXY_ALLOWLIST ?? "";
  return raw
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function isAllowedHost(hostname: string, allowlist: string[]) {
  return allowlist.some((allowed) => allowed === hostname);
}

function isBlockedHost(hostname: string) {
  const h = hostname.trim().toLowerCase();
  if (!h) return true;
  if (h === "localhost" || h === "0.0.0.0" || h === "::1") return true;
  if (h.endsWith(".local")) return true;

  const ipv4 = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(h);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (a === 127) return true;
    if (a === 10) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }

  return false;
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

  let targetUrl: URL;
  try {
    targetUrl = new URL(rawUrl);
  } catch {
    return NextResponse.json(
      { message: "URL tidak valid. Pastikan formatnya seperti https://domain.com/path" },
      { status: 400 },
    );
  }

  const allowlist = getAllowlist();
  const hasAllowlist = allowlist.length > 0;

  if (targetUrl.protocol !== "https:" && targetUrl.protocol !== "http:") {
    return NextResponse.json({ message: "Protocol URL harus http/https." }, { status: 400 });
  }

  if (isBlockedHost(targetUrl.hostname)) {
    return NextResponse.json(
      {
        message: `Host diblokir demi keamanan: ${targetUrl.hostname}`,
      },
      { status: 403 },
    );
  }

  if (hasAllowlist && !isAllowedHost(targetUrl.hostname, allowlist)) {
    return NextResponse.json(
      { message: `Host tidak diizinkan: ${targetUrl.hostname}` },
      { status: 403 },
    );
  }

  const method = String(payload.method ?? "GET").toUpperCase();
  const headers = new Headers(payload.headers ?? {});

  if (payload.params && typeof payload.params === "object") {
    const sp = toSearchParams(payload.params as Record<string, unknown>);
    for (const [k, v] of sp.entries()) targetUrl.searchParams.set(k, v);
  }

  let body: string | undefined;
  if (method !== "GET" && method !== "HEAD") {
    if (!headers.has("content-type")) headers.set("content-type", "application/json");
    body = JSON.stringify(payload.data ?? {});
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
