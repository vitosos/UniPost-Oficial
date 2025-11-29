import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { NextResponse } from "next/server";
import { sendVerificationEmail } from "@/lib/mailer"; // Asegúrate de tener esta función

export async function POST(req: Request) {
  const { email, password, name } = await req.json();

  // Verificar si el correo ya está registrado
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ ok: false, error: "USER_EXISTS" }, { status: 400 });
  }

  // Hashear la contraseña
  const hashed = await bcrypt.hash(password, 10);

  // Crear el usuario en la base de datos
  const user = await prisma.user.create({
    data: { email, password: hashed, name, emailVerified: null, roleID: 1 },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  // Generar el código de verificación (6 dígitos)
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  // Guardar el código en la base de datos
  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token: code,
      expires: new Date(Date.now() + 10 * 60 * 1000), // 10 minutos de expiración
    },
  });

  return NextResponse.json({ ok: true, user });
}
