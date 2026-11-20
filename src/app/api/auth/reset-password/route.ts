import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { consumeOtp, isOtpFormat } from "@/lib/otp";
import { isStrongPassword } from "@/lib/password";
import { normalizeEmail, readJson } from "@/lib/validation";

export async function POST(req: Request) {
  try {
    const body = await readJson<{ email: string; code: string; newPassword: string }>(req);
    const email = normalizeEmail(body.email);

    if (!isStrongPassword(body.newPassword)) {
      return NextResponse.json({ ok: false, error: "La contraseña no cumple los requisitos de seguridad." }, { status: 400 });
    }
    if (!email || !isOtpFormat(body.code) || !(await consumeOtp("reset", email, body.code))) {
      return NextResponse.json({ ok: false, error: "Código inválido o expirado." }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(body.newPassword, 12);
    await prisma.user.updateMany({
      where: { email: { equals: email, mode: "insensitive" } },
      // Restablecer la contraseña por correo también demuestra la propiedad del correo.
      data: { password: hashedPassword, emailVerified: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("reset-password error:", error);
    return NextResponse.json({ ok: false, error: "No se pudo actualizar la contraseña." }, { status: 500 });
  }
}
