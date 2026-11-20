import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { NextResponse } from "next/server";
import { sendVerificationEmail } from "@/lib/mailer";
import { issueOtp } from "@/lib/otp";
import { isStrongPassword } from "@/lib/password";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { normalizeEmail, readJson } from "@/lib/validation";

export async function POST(req: Request) {
  if (!rateLimit(`register:${clientIp(req)}`, 5, 60 * 60 * 1000)) {
    return NextResponse.json({ ok: false, error: "TOO_MANY_REQUESTS" }, { status: 429 });
  }

  const body = await readJson<{ email: string; password: string; name: string; termsAccepted: boolean }>(req);
  const email = normalizeEmail(body.email);
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 60) : "";

  if (!email || name.length < 2) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }
  if (!isStrongPassword(body.password)) {
    return NextResponse.json({ ok: false, error: "WEAK_PASSWORD" }, { status: 400 });
  }
  if (body.termsAccepted !== true) {
    return NextResponse.json({ ok: false, error: "TERMS_NOT_ACCEPTED" }, { status: 400 });
  }

  const existing = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } });
  if (existing) {
    return NextResponse.json({ ok: false, error: "USER_EXISTS" }, { status: 400 });
  }

  const hashed = await bcrypt.hash(body.password, 12);
  await prisma.user.create({
    data: { email, password: hashed, name, emailVerified: null, roleID: 1 },
  });

  const code = await issueOtp("verify", email);
  if (code) {
    try {
      await sendVerificationEmail(email, code);
    } catch (err) {
      // El usuario puede pedir reenvío desde /verificar.
      console.error("No se pudo enviar el correo de verificación:", err);
    }
  }

  return NextResponse.json({ ok: true });
}
