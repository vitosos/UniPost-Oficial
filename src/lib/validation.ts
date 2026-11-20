// Validaciones de entrada compartidas por las rutas de API.
// Importante: nunca pasar valores del body directo a `where` de Prisma sin validar su tipo,
// ya que un objeto como { "not": "" } se interpreta como un filtro.

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && EMAIL_REGEX.test(email) ? email : null;
}

export function toPositiveInt(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isInteger(n) && n > 0 ? n : null;
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<Partial<T>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? body : {};
  } catch {
    return {};
  }
}
