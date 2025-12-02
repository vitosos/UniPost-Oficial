import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/mailer";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    // 1. Verificar si el usuario existe
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Por seguridad, respondemos OK aunque no exista para no revelar usuarios
      return NextResponse.json({ ok: true }); 
    }

    // 2. Generar código
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // 3. Guardar token (Reutilizamos la tabla VerificationToken)
    // Borramos tokens anteriores de este email para evitar duplicados
    await prisma.verificationToken.deleteMany({ where: { identifier: email } });

    await prisma.verificationToken.create({
      data: {
        identifier: email,
        token: code,
        expires: new Date(Date.now() + 10 * 60 * 1000), // 10 min
      },
    });

    // 4. Enviar correo
    await sendPasswordResetEmail(email, code);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}