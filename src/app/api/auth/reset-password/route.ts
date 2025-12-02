import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";

export async function POST(req: Request) {
  try {
    const { email, code, newPassword } = await req.json();

    // 1. Verificar Token
    const tokenRecord = await prisma.verificationToken.findFirst({
      where: {
        identifier: email,
        token: code,
        expires: { gt: new Date() }, // Que no haya expirado
      },
    });

    if (!tokenRecord) {
      return NextResponse.json({ ok: false, error: "Código inválido o expirado" }, { status: 400 });
    }

    // 2. Hashear nueva contraseña
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 3. Actualizar usuario
    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword },
    });

    // 4. Borrar el token usado
    await prisma.verificationToken.delete({ where: { id: tokenRecord.id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Error al actualizar password" }, { status: 500 });
  }
}