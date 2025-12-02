import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { decrypt } from "@/lib/crypto";
import { TwitterApi } from "twitter-api-v2";
import path from "path";

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) return NextResponse.json({ ok: false, error: "Auth required" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });

    const { postId, variantId } = await req.json();

    // 1. Obtener Credenciales
    const access = await prisma.x_Access.findFirst({ where: { userId: user.id, redSocial: 5 } });
    if (!access || !access.accessSecret) throw new Error("X not linked (OAuth 1.0a required)");

    // 2. Cliente Autenticado
    const client = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY!,
      appSecret: process.env.TWITTER_API_SECRET!,
      accessToken: decrypt(access.accessToken),
      accessSecret: decrypt(access.accessSecret),
    });

    const post = await prisma.post.findUnique({ where: { id: postId }, include: { medias: { orderBy: { mediaOrder: 'asc' } } } });
    const variant = await prisma.variant.findUnique({ where: { id: variantId } });

    if (!post || !variant) throw new Error("Post/Variant not found");

    // 3. Subir Medios
    const mediaIds: string[] = [];
    const medias = post.medias || [];
    
    // Filtro X: Máx 4 imágenes O 1 video
    const images = medias.filter(m => m.type === "IMAGE");
    const videos = medias.filter(m => m.type === "VIDEO");
    const targetMedias = videos.length > 0 ? [videos[0]] : images.slice(0, 4);

    for (const m of targetMedias) {
        const localPath = path.join(process.cwd(), "public", m.mediaLocation.replace(/^\//, ""));
        
        // La librería detecta el tipo y lo sube correctamente a v1.1
        const mediaId = await client.v1.uploadMedia(localPath);
        mediaIds.push(mediaId);
    }

    // 4. Publicar Tweet (v2)
    const response = await client.v2.tweet({
        text: variant.text || post.body || "",
        media: mediaIds.length > 0 ? { media_ids: mediaIds as any } : undefined,
    });

    if (response.errors) {
        throw new Error("X API Error: " + JSON.stringify(response.errors));
    }

    // 5. Actualizar BD
    await prisma.variant.update({
        where: { id: variantId },
        data: { status: "PUBLISHED", uri: response.data.id, date_sent: new Date() }
    });

    return NextResponse.json({ ok: true, id: response.data.id });

  } catch (e: any) {
    console.error("X Publish Error:", e);
    return NextResponse.json({ ok: false, error: e.message || "Unknown Error" }, { status: 500 });
  }
}