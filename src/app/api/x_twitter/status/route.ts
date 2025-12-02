import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ ok: false }, { status: 404 });

  // Buscamos acceso de X (RedSocial 5)
  const xAccess = await prisma.x_Access.findFirst({
    where: { userId: user.id, redSocial: 5 },
  });

  if (!xAccess) {
    return NextResponse.json({ ok: true, linked: false });
  }

  // ✨ OAuth 1.0a: Los tokens NO expiran automáticamente.
  // No necesitamos lógica de refresh_token.
  // Si el usuario revocó el acceso, la publicación fallará en el futuro, 
  // pero el estado "conectado" se mantiene válido localmente.

  return NextResponse.json({
    ok: true,
    linked: true,
    // Usamos screenName (guardado en callback) o usuarioRed como fallback
    username: xAccess.screenName || xAccess.usuarioRed || "Usuario X", 
    expired: false // Siempre falso en OAuth 1.0a
  });
}