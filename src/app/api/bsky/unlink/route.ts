import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

// Busca credenciales del usuario y las quita de la BD, desenlazando cuenta

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user?.email ?? "" },
  });

  if (!user) return Response.json({ ok: false, error: "User not found" });

  await prisma.blueSky_Access.deleteMany({
    where: { usuarioId: user.id },
  });

  return Response.json({ ok: true });
}