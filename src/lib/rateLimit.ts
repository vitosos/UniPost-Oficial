// Rate limiter simple en memoria (ventana fija).
// Es "best effort": en serverless cada instancia tiene su propio contador.
// Para producción con varias instancias conviene un store compartido (ej: Upstash Redis).

const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 10_000) {
      for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    }
    return true;
  }

  bucket.count += 1;
  return bucket.count <= limit;
}

export function clientIp(req: Request | { headers?: Record<string, string | string[] | undefined> | Headers }): string {
  const headers = req.headers;
  const get = (name: string) =>
    headers instanceof Headers ? headers.get(name) : (headers?.[name] as string | undefined) ?? null;
  return get("x-forwarded-for")?.split(",")[0].trim() || get("x-real-ip") || "unknown";
}
