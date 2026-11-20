import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { getCurrentUser, unauthorized } from "@/lib/session";
import { isStrongPassword } from "@/lib/password";
import { rateLimit } from "@/lib/rateLimit";
import { readJson } from "@/lib/validation";

export async function POST(req: Request) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) return unauthorized();

    if (!rateLimit(`change-password:${sessionUser.id}`, 10, 15 * 60 * 1000)) {
      return NextResponse.json({ ok: false, error: "Demasiados intentos. Espera unos minutos." }, { status: 429 });
    }

    const { currentPassword, newPassword } = await readJson<{ currentPassword: string; newPassword: string }>(req);
    if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
      return NextResponse.json({ ok: false, error: "Faltan datos" }, { status: 400 });
    }
    if (!isStrongPassword(newPassword)) {
      return NextResponse.json({ ok: false, error: "La nueva contraseña no cumple los requisitos de seguridad." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: sessionUser.id }, select: { id: true, password: true } });
    if (!user?.password || !(await bcrypt.compare(currentPassword, user.password))) {
      return NextResponse.json({ ok: false, error: "La contraseña actual es incorrecta" }, { status: 400 });
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Password change error:", error);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
