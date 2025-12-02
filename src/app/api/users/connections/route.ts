import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ ok: false }, { status: 404 });

  // Consultamos las 5 tablas de acceso
  // Nota: Usamos ID 5 para X (Twitter)
  const [bsky, ig, fb, tt, x] = await prisma.$transaction([
    prisma.blueSky_Access.findFirst({ where: { usuarioId: user.id }, select: { nombreUsuario: true } }),
    prisma.instagram_Access.findFirst({ where: { userId: user.id, redSocial: 2 }, select: { usuarioRed: true } }),
    prisma.facebook_Access.findFirst({ where: { userId: user.id, redSocial: 3 }, select: { usuarioRed: true } }),
    prisma.tikTok_Access.findFirst({ where: { userId: user.id, redSocial: 4 }, select: { usuarioRed: true } }),
    prisma.x_Access.findFirst({ where: { userId: user.id, redSocial: 5 }, select: { usuarioRed: true } }),
  ]);

  return NextResponse.json({
    ok: true,
    connections: {
      BLUESKY: bsky ? { connected: true, username: bsky.nombreUsuario } : { connected: false },
      INSTAGRAM: ig ? { connected: true, username: ig.usuarioRed } : { connected: false },
      FACEBOOK: fb ? { connected: true, username: fb.usuarioRed } : { connected: false },
      TIKTOK: tt ? { connected: true, username: tt.usuarioRed } : { connected: false },
      TWITTER: x ? { connected: true, username: x.usuarioRed } : { connected: false },
    }
  });
}