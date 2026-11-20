import { NextResponse } from "next/server";
import { resolveTargetUser } from "@/lib/session";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";

const GRAPH_BASE_URL = "https://graph.facebook.com/v21.0";

export async function GET(req: Request) {
  // Solo el propio usuario, un super admin o un Manager de su organización pueden ver estos datos.
  const target = await resolveTargetUser(req);
  if ("error" in target) return target.error;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

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

    // 2. Obtener Credenciales usando targetUserId
    const igAccess = await prisma.instagram_Access.findFirst({
      where: { userId: targetUserId, redSocial: 2 },
    });

    if (!igAccess || !igAccess.accessToken) {
      return NextResponse.json({ ok: false, error: "Instagram no conectado" }); // Return soft error
    }

    const userToken = decrypt(igAccess.accessToken);

    // 3. Obtener cuenta de Instagram Business
    const accountsRes = await fetch(
      `${GRAPH_BASE_URL}/me/accounts?fields=name,access_token,instagram_business_account{id}&access_token=${userToken}`
    );
    const accounts = await accountsRes.json();
    const pageWithIg = accounts.data?.find((p: any) => p.instagram_business_account?.id);

    if (!pageWithIg) {
      return NextResponse.json({ ok: false, error: "No IG Business account linked." });
    }

    const igUserId = pageWithIg.instagram_business_account.id;
    const pageAccessToken = pageWithIg.access_token;

    // 4. Obtener Feed
    const fields = "id,caption,permalink,timestamp,like_count,comments_count,media_type,media_product_type";
    const mediaUrl = `${GRAPH_BASE_URL}/${igUserId}/media?fields=${fields}&limit=100&access_token=${pageAccessToken}`;
    
    const mediaRes = await fetch(mediaUrl);
    const mediaData = await mediaRes.json();

    if (mediaData.error) throw new Error(mediaData.error.message);

    const posts = (mediaData.data || []).map((p: any) => ({
        id: p.id,
        permalink: p.permalink,
        caption: p.caption || "",
        createdAt: p.timestamp,
        likes: p.like_count || 0,
        comments: p.comments_count || 0,
        shares: 0, 
        views: 0
    }));

    return NextResponse.json({ ok: true, posts });

  } catch (e: any) {
    console.error("IG Metrics Error:", e.message);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}