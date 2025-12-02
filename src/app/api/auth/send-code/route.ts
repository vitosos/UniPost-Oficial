import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/mailer";

export async function POST(req: Request) {
  const { email } = await req.json();

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return NextResponse.json({ ok: false, error: "USER_NOT_FOUND" }, { status: 404 });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();

  await prisma.verificationToken.deleteMany({
    where: { identifier: email },
  });

  // Crear el nuevo
  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token: code,
      expires: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  await sendVerificationEmail(email, code);

  return NextResponse.json({ ok: true, message: "Código enviado" });
}