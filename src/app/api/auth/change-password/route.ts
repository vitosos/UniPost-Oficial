import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    }

    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ ok: false, error: "Faltan datos" }, { status: 400 });
    }

    // 1. Obtener usuario
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user || !user.password) {
      return NextResponse.json({ ok: false, error: "Usuario no encontrado" }, { status: 404 });
    }

    // 2. Verificar contraseña actual
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return NextResponse.json({ ok: false, error: "La contraseña actual es incorrecta" }, { status: 400 });
    }

    // 3. Validar seguridad básica (backup del frontend)
    if (newPassword.length < 8) {
       return NextResponse.json({ ok: false, error: "La nueva contraseña es muy corta" }, { status: 400 });
    }

    // 4. Actualizar
    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed },
    });

    return NextResponse.json({ ok: true });

  } catch (error) {
    console.error("Password change error:", error);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}