import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { NextResponse } from "next/server";
import { sendVerificationEmail } from "@/lib/mailer";

export async function POST(req: Request) {
  const { email, password, name } = await req.json();

  // Verificar si el correo ya está registrado
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ ok: false, error: "USER_EXISTS" }, { status: 400 });
  }

  // Hashear la contraseña
  const hashed = await bcrypt.hash(password, 10);

  // Crear el usuario
  const user = await prisma.user.create({
    data: { email, password: hashed, name, emailVerified: null, roleID: 1 },
    select: { id: true, name: true, email: true },
  });

  // Generar código
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  // 🧹 LIMPIEZA: Borrar tokens anteriores de este email si existieran (ej: registros fallidos previos)
  await prisma.verificationToken.deleteMany({
    where: { identifier: email },
  });

  // Guardar el nuevo código
  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token: code,
      expires: new Date(Date.now() + 10 * 60 * 1000), // 10 min
    },
  });

  // Enviar correo (puede ser asíncrono para no bloquear la respuesta)
  await sendVerificationEmail(email, code);

  return NextResponse.json({ ok: true, user });
}