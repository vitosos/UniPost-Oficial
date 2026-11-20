import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

// Checkeo rápido de estado de cuenta (enlazado o no)

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user?.email ?? "" },
  });

  if (!user) return Response.json({ ok: false, error: "User not found" });

  const access = await prisma.blueSky_Access.findFirst({
    where: { usuarioId: user.id },
  });

  if (!access) {
    return Response.json({ ok: true, linked: false });
  }

  return Response.json({
    ok: true,
    linked: true,
    nombreUsuario: access.nombreUsuario,
  });
}