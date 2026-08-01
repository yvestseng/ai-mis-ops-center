const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const MAX_API_BODY_BYTES = 256 * 1024;

function isLocalDevelopment(url: URL) {
  const host = url.hostname.toLowerCase();
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.startsWith("169.254.") ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  );
}

export function securityHeaders(request: Request, response: Response) {
  const headers = new Headers(response.headers);
  const url = new URL(request.url);
  const localDevelopment = isLocalDevelopment(url);

  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set(
    "permissions-policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  );
  headers.set("x-frame-options", "DENY");
  headers.set("cross-origin-opener-policy", "same-origin");
  headers.set("cross-origin-resource-policy", "same-origin");
  headers.set("x-robots-tag", "noindex, nofollow, noarchive");

  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "object-src 'none'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    // Vinext/React currently emits inline bootstrap scripts.
    "script-src 'self' 'unsafe-inline'",
    localDevelopment
      ? "connect-src 'self' ws: wss:"
      : "connect-src 'self' wss:",
  ];

  // HSTS is safe only on HTTPS. Do not add upgrade-insecure-requests here,
  // because it breaks Vite assets when the development site is opened by LAN IP.
  if (url.protocol === "https:") {
    headers.set(
      "strict-transport-security",
      "max-age=31536000; includeSubDomains",
    );
  }

  headers.set("content-security-policy", csp.join("; "));

  if (url.pathname.startsWith("/api/")) {
    headers.set("cache-control", "no-store, max-age=0");
    headers.set("pragma", "no-cache");
    headers.set("expires", "0");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function apiError(status: number, error: string, message: string) {
  return Response.json({ error, message }, { status });
}

export async function validateApiRequest(
  request: Request,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) return null;

  if (request.method === "OPTIONS") {
    const origin = request.headers.get("origin");
    if (origin && origin !== url.origin) {
      return apiError(403, "INVALID_ORIGIN", "系統拒絕跨來源請求。");
    }
    return new Response(null, {
      status: 204,
      headers: { allow: "GET,HEAD,POST,PATCH,PUT,DELETE,OPTIONS" },
    });
  }

  const contentLengthHeader = request.headers.get("content-length");
  const contentLength = contentLengthHeader
    ? Number(contentLengthHeader)
    : null;
  if (
    contentLength !== null &&
    Number.isFinite(contentLength) &&
    contentLength > MAX_API_BODY_BYTES
  ) {
    return apiError(
      413,
      "PAYLOAD_TOO_LARGE",
      "送出的資料超過系統允許大小。",
    );
  }

  if (!SAFE_METHODS.has(request.method)) {
    const origin = request.headers.get("origin");
    const fetchSite = request.headers.get("sec-fetch-site");
    if (
      (origin && origin !== url.origin) ||
      fetchSite === "cross-site"
    ) {
      return apiError(
        403,
        "INVALID_ORIGIN",
        "系統拒絕跨來源資料異動請求。",
      );
    }

    const contentType = request.headers.get("content-type") || "";
    const hasDeclaredBody =
      (contentLength !== null && contentLength > 0) ||
      request.headers.has("transfer-encoding");

    if (
      hasDeclaredBody &&
      !contentType.toLowerCase().startsWith("application/json")
    ) {
      return apiError(
        415,
        "UNSUPPORTED_MEDIA_TYPE",
        "API 僅接受 application/json 格式。",
      );
    }

    // Content-Length can be absent with streamed/chunked requests. Read a clone
    // so the original request body remains available to the route handler.
    if (request.body) {
      try {
        const bytes = await request.clone().arrayBuffer();
        if (bytes.byteLength > MAX_API_BODY_BYTES) {
          return apiError(
            413,
            "PAYLOAD_TOO_LARGE",
            "送出的資料超過系統允許大小。",
          );
        }
      } catch {
        return apiError(400, "INVALID_BODY", "無法讀取送出的資料。");
      }
    }
  }

  return null;
}
