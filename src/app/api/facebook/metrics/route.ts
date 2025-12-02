import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";

const GRAPH_BASE_URL = "https://graph.facebook.com/v21.0";

export async function GET(req: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) return NextResponse.json({ ok: false }, { status: 401 });

    // 1. Determinar ID del usuario (Prioridad: Query Param > Sesión)
    const { searchParams } = new URL(req.url);
    const queryId = searchParams.get("userId");
    let targetUserId: number;

    if (queryId) {
      targetUserId = Number(queryId);
    } else {
      const currentUser = await prisma.user.findUnique({ where: { email: session.user.email } });
      if (!currentUser) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
      targetUserId = currentUser.id;
    }

    // 2. Credenciales
    const fbAccess = await prisma.facebook_Access.findFirst({ where: { userId: targetUserId, redSocial: 3 } });
    if (!fbAccess) return NextResponse.json({ ok: false, error: "Facebook no conectado" });

    const userToken = decrypt(fbAccess.accessToken!);

    // 3. Obtener Página
    const accountsRes = await fetch(`${GRAPH_BASE_URL}/me/accounts?access_token=${userToken}`);
    const accounts = await accountsRes.json();
    const page = accounts.data?.[0]; // Usamos la primera página (igual que en publish)

    if (!page) throw new Error("No Facebook Page found");

    // 4. Obtener Feed
    const fields = "id,created_time,shares,likes.summary(true).limit(0),comments.summary(true).limit(0)";
    const feedUrl = `${GRAPH_BASE_URL}/${page.id}/feed?fields=${fields}&limit=100&access_token=${page.access_token}`;

    const res = await fetch(feedUrl);
    const data = await res.json();

    if (data.error) throw new Error(data.error.message);

    const posts = (data.data || []).map((p: any) => ({
        id: p.id,
        likes: p.likes?.summary?.total_count || 0,
        comments: p.comments?.summary?.total_count || 0,
        shares: p.shares?.count || 0,
        views: 0,
        createdAt: p.created_time
    }));

    return NextResponse.json({ ok: true, posts });

  } catch (e: any) {
    console.error("FB Metrics Error:", e.message);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}