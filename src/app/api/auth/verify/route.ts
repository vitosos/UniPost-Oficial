import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { consumeOtp, isOtpFormat } from "@/lib/otp";
import { normalizeEmail, readJson } from "@/lib/validation";

export async function POST(req: Request) {
  const body = await readJson<{ email: string; code: string }>(req);
  const email = normalizeEmail(body.email);

  if (!email || !isOtpFormat(body.code) || !(await consumeOtp("verify", email, body.code))) {
    return NextResponse.json({ ok: false, error: "INVALID_OR_EXPIRED" }, { status: 400 });
  }

  await prisma.user.updateMany({
    where: { email: { equals: email, mode: "insensitive" } },
    data: { emailVerified: new Date() },
  });

  return NextResponse.json({ ok: true });
}
