import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { normalizeEmail, readJson } from "@/lib/validation";

// Indica si un correo ya fue verificado. Para correos inexistentes responde "no verificado"
// (en vez de 404) para no revelar qué cuentas existen.
export async function POST(req: Request) {
  const { email: rawEmail } = await readJson<{ email: string }>(req);
  const email = normalizeEmail(rawEmail);
  if (!email) return NextResponse.json({ ok: false, error: "INVALID_EMAIL" }, { status: 400 });

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { emailVerified: true },
  });

  return NextResponse.json({ ok: true, isVerified: Boolean(user?.emailVerified) });
}
