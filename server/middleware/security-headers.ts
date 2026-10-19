interface SecurityEvent {
  req: { method?: string };
}

function withHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  // Allow the Grok preview to embed the app. Do not set X-Frame-Options,
  // which would block that frame, and do not restrict script-src (the
  // platform injects https://grok.com branding).
  const frame = "frame-ancestors 'self' https://grok.com https://*.grok.com";
  const existing = headers.get("Content-Security-Policy");
  headers.set("Content-Security-Policy", existing ? `${existing}; ${frame}` : frame);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default async function securityHeadersMiddleware(
  _event: SecurityEvent,
  next: () => unknown | Promise<unknown>,
): Promise<unknown> {
  const result = await next();
  if (result instanceof Response) return withHeaders(result);
  return result;
}
