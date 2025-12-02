import { NextResponse } from "next/server"; 
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { AtpAgent } from "@atproto/api";
import { decryptBlueskySecret } from "@/lib/cryptoBluesky";

export async function GET(req: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  try {
    // 1. Determinar ID del usuario (Prioridad: Query Param > Sesión)
    const { searchParams } = new URL(req.url);
    const queryId = searchParams.get("userId");
    let targetUserId: number;

    if (queryId) {
      targetUserId = Number(queryId);
    } else {
      const currentUser = await prisma.user.findUnique({ where: { email: session.user?.email ?? "" } });
      if (!currentUser) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
      targetUserId = currentUser.id;
    }

    // 2. Buscar credenciales usando targetUserId
    const access = await prisma.blueSky_Access.findFirst({
      where: { usuarioId: targetUserId },
    });

    if (!access) {
      return NextResponse.json({ ok: true, posts: [], warning: "No Bluesky account linked" });
    }

    const decryptedPassword = decryptBlueskySecret(access.appPassword);

    // 3. Obtener variantes del usuario objetivo
    const variants = await prisma.variant.findMany({
      where: {
        network: "BLUESKY",
        uri: { not: null },
        post: { authorId: targetUserId },
      },
      include: { post: true },
    });

    if (!variants.length) {
      return NextResponse.json({ ok: true, posts: [] });
    }

    const uris = variants.map((v) => v.uri!) as string[];

    // 4. Conectar y buscar
    const agent = new AtpAgent({ service: "https://bsky.social" });
    await agent.login({
      identifier: access.nombreUsuario,
      password: decryptedPassword,
    });

    const resp = await agent.app.bsky.feed.getPosts({ uris });
    const variantByUri = new Map(variants.map((v) => [v.uri!, v]));

    const posts = resp.data.posts.map((p) => {
      const v = variantByUri.get(p.uri);
      const record: any = p.record || {};
      const createdAt = record?.createdAt ?? (v?.date_sent ? v.date_sent.toISOString() : null);

      return {
        uri: p.uri,
        cid: p.cid,
        text: record?.text ?? v?.text ?? "",
        createdAt,
        likes: p.likeCount ?? 0,
        replies: p.replyCount ?? 0,
        reposts: p.repostCount ?? 0,
        quotes: (p as any).quoteCount ?? 0,
        views: null,
        postTitle: v?.post?.title ?? "",
      };
    });

    return NextResponse.json({ ok: true, posts });

  } catch (err: any) {
    console.error("Bluesky metrics error:", err);
    return NextResponse.json({ ok: false, error: err.message ?? "Unknown error" }, { status: 500 });
  }
}