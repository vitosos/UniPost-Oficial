import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/mailer";
import { issueOtp } from "@/lib/otp";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { normalizeEmail, readJson } from "@/lib/validation";

// Reenvía el código de verificación de correo.
// Responde siempre igual para no revelar qué correos están registrados.
export async function POST(req: Request) {
  const { email: rawEmail } = await readJson<{ email: string }>(req);
  const email = normalizeEmail(rawEmail);
  if (!email) return NextResponse.json({ ok: false, error: "INVALID_EMAIL" }, { status: 400 });

  if (!rateLimit(`send-code:${clientIp(req)}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ ok: false, error: "TOO_MANY_REQUESTS" }, { status: 429 });
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { emailVerified: true },
  });

  if (user && !user.emailVerified) {
    const code = await issueOtp("verify", email);
    if (!code) {
      return NextResponse.json({ ok: false, error: "WAIT_BEFORE_RESEND" }, { status: 429 });
    }
    await sendVerificationEmail(email, code);
  }

  return NextResponse.json({ ok: true });
}
