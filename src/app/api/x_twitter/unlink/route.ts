import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ ok: false }, { status: 404 });

  try {
    // Borrar el acceso de X (RedSocial 5) para este usuario
    await prisma.x_Access.deleteMany({
      where: { userId: user.id, redSocial: 5 },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Unlink X Error:", error);
    return NextResponse.json({ ok: false, error: "Error al desvincular" }, { status: 500 });
  }
}