import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/mailer";
import { issueOtp } from "@/lib/otp";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { normalizeEmail, readJson } from "@/lib/validation";

// Responde siempre { ok: true } para no revelar qué correos existen.
export async function POST(req: Request) {
  try {
    const { email: rawEmail } = await readJson<{ email: string }>(req);
    const email = normalizeEmail(rawEmail);
    if (!email) return NextResponse.json({ ok: false, error: "INVALID_EMAIL" }, { status: 400 });

    if (!rateLimit(`forgot:${clientIp(req)}`, 10, 60 * 60 * 1000)) {
      return NextResponse.json({ ok: false, error: "TOO_MANY_REQUESTS" }, { status: 429 });
    }

    const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } });
    if (user) {
      const code = await issueOtp("reset", email);
      if (code) await sendPasswordResetEmail(email, code);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("forgot-password error:", error);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
