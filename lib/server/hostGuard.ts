export function getAllowlist() {
  const raw = process.env.BULK_SENDER_PROXY_ALLOWLIST ?? "";
  return raw
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export function isAllowedHost(hostname: string, allowlist: string[]) {
  return allowlist.some((allowed) => allowed === hostname);
}

export function isBlockedHost(hostname: string) {
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

export type UrlGuardResult =
  | { ok: true; url: URL }
  | { ok: false; status: number; message: string };

/**
 * Validasi URL tujuan keluar: format, protocol, host terblokir, dan allowlist.
 */
export function guardUrl(rawUrl: string): UrlGuardResult {
  let targetUrl: URL;
  try {
    targetUrl = new URL(rawUrl);
  } catch {
    return {
      ok: false,
      status: 400,
      message: "URL tidak valid. Pastikan formatnya seperti https://domain.com/path",
    };
  }

  if (targetUrl.protocol !== "https:" && targetUrl.protocol !== "http:") {
    return { ok: false, status: 400, message: "Protocol URL harus http/https." };
  }

  if (isBlockedHost(targetUrl.hostname)) {
    return {
      ok: false,
      status: 403,
      message: `Host diblokir demi keamanan: ${targetUrl.hostname}`,
    };
  }

  const allowlist = getAllowlist();
  if (allowlist.length > 0 && !isAllowedHost(targetUrl.hostname, allowlist)) {
    return {
      ok: false,
      status: 403,
      message: `Host tidak diizinkan: ${targetUrl.hostname}`,
    };
  }

  return { ok: true, url: targetUrl };
}
