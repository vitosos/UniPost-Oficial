import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { decrypt } from "@/lib/crypto";
import { TwitterApi } from "twitter-api-v2";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    // 1. Obtener Target User
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

    // 2. Obtener Credenciales
    const xAccess = await prisma.x_Access.findFirst({
      where: { userId: targetUserId, redSocial: 5 },
    });

    if (!xAccess || !xAccess.accessSecret) {
      return NextResponse.json({ ok: false, error: "X not linked" });
    }

    // 3. Obtener Variantes de Twitter publicadas que tengan ID (uri)
    const variants = await prisma.variant.findMany({
      where: {
        network: "TWITTER",
        status: "PUBLISHED",
        uri: { not: null }, // El uri guarda el Tweet ID (ej: "18523...")
        post: { authorId: targetUserId },
      },
      orderBy: { date_sent: "desc" },
      take: 100 // Límite por lote de la API
    });

    if (variants.length === 0) {
      return NextResponse.json({ ok: true, posts: [] });
    }

    // Extraer IDs limpios
    const tweetIds = variants.map(v => v.uri!).filter(id => /^\d+$/.test(id));

    if (tweetIds.length === 0) return NextResponse.json({ ok: true, posts: [] });

    // 4. Consultar API de X (v2)
    const client = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY!,
      appSecret: process.env.TWITTER_API_SECRET!,
      accessToken: decrypt(xAccess.accessToken),
      accessSecret: decrypt(xAccess.accessSecret),
    });

    // Solicitamos métricas públicas (y non_public si el plan lo permite)
    // El Plan Gratis suele bloquear esto, pero implementamos la lógica correcta.
    const result = await client.v2.tweets(tweetIds, {
      "tweet.fields": ["public_metrics", "created_at"],
    });

    if (result.errors) {
        console.warn("⚠️ Advertencia X Metrics:", result.errors);
    }

    const posts = result.data.map((tweet) => {
      const metrics = tweet.public_metrics;
      
      // Nota: 'impression_count' suele requerir plan Basic/Pro.
      // Si viene undefined, ponemos 0.
      const views = metrics?.impression_count || 0;

      return {
        id: tweet.id,
        text: tweet.text,
        likes: metrics?.like_count || 0,
        comments: metrics?.reply_count || 0,
        shares: (metrics?.retweet_count || 0) + (metrics?.quote_count || 0),
        views: views, 
        createdAt: tweet.created_at,
      };
    });

    return NextResponse.json({ ok: true, posts });

  } catch (e: any) {
    // Manejo específico si el plan no permite lectura
    if (e.code === 403 || (e.message && e.message.includes("aggregated"))) {
        console.error("❌ X API Plan Limit: No se permite lectura de tweets en Free Tier.");
        // Retornamos éxito vacío para no romper el Dashboard de métricas
        return NextResponse.json({ ok: true, posts: [], warning: "Plan Limit" });
    }
    console.error("X Metrics Error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}