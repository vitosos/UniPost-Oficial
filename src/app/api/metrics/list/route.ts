import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getServerSession();
    if (!session || !session.user?.email) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    // Obtenemos el usuario de la sesión (para validar permisos si quisieras)
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    if (!currentUser) return NextResponse.json({ ok: false }, { status: 404 });

    // Verificar si se pidió un usuario específico por query param
    const { searchParams } = new URL(request.url);
    const targetUserIdStr = searchParams.get("userId");
    
    // Si hay targetUserId, usamos ese. Si no, usamos el del usuario actual.
    const targetUserId = targetUserIdStr ? Number(targetUserIdStr) : currentUser.id;

    const metrics = await prisma.metric.findMany({
      where: {
        post: {
          authorId: targetUserId,
        },
      },
      include: {
        post: { select: { title: true, body: true } },
        Variant: { select: { date_sent: true, text: true } }
      },
      orderBy: { collectedAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ ok: true, metrics });

  } catch (error) {
    console.error("Error fetching metrics list:", error);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}