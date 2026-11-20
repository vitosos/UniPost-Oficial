import { NextResponse } from "next/server";
import fs from "fs/promises";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { TwitterApi } from "twitter-api-v2";
import sharp from "sharp";
import { getCurrentUser, unauthorized } from "@/lib/session";
import { publishErrorResponse, runPublish } from "@/lib/publishing";
import { localUploadPath } from "@/lib/uploads";
import { readJson } from "@/lib/validation";

// Lógica interna (reutilizable por el Cron)
export async function publishToXInternal(userId: number, postId: number, variantId: number) {
    // 1. Obtener Credenciales
    const access = await prisma.x_Access.findFirst({ where: { userId, redSocial: 5 } });
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
        // Solo se leen archivos dentro de public/uploads
        const localPath = localUploadPath(m.mediaLocation);
        if (!localPath) throw new Error("Ruta de archivo inválida");

        try {
            const fileBuffer = await fs.readFile(localPath);
            let finalBuffer = fileBuffer;
            let finalType = m.mime;

            // --- COMPRESIÓN (SHARP): solo imágenes de más de 4MB ---
            if (m.type === "IMAGE" && fileBuffer.length > 4 * 1024 * 1024) {
                console.log(`📉 Comprimiendo imagen para X (${(fileBuffer.length / 1024 / 1024).toFixed(2)}MB)...`);
                finalBuffer = await sharp(fileBuffer)
                    .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
                    .jpeg({ quality: 80, mozjpeg: true })
                    .toBuffer();
                finalType = "image/jpeg";
            }

            // Subir usando buffer (v1.1)
            const mediaId = await client.v1.uploadMedia(finalBuffer, { mimeType: finalType });
            mediaIds.push(mediaId);
        } catch (err) {
            console.error("❌ Error procesando archivo local:", err);
            throw new Error(`Error procesando archivo: ${(err as Error).message}`);
        }
    }

    // 4. Publicar Tweet (v2)
    const response = await client.v2.tweet({
        text: variant.text || post.body || "",
        media: mediaIds.length > 0 ? { media_ids: mediaIds as [string] } : undefined,
    });

    if (response.errors) {
        throw new Error("X API Error: " + JSON.stringify(response.errors));
    }

    // 5. Actualizar BD
    await prisma.variant.update({
        where: { id: variantId },
        data: { status: "PUBLISHED", uri: response.data.id, date_sent: new Date() }
    });

    return { ok: true, id: response.data.id };
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    const { postId, variantId } = await readJson<{ postId: number; variantId: number }>(req);
    const result = await runPublish({ userId: user.id, postId, variantId, network: "TWITTER" }, (ctx) =>
      publishToXInternal(user.id, ctx.postId, ctx.variantId)
    );
    return NextResponse.json(result);
  } catch (e) {
    console.error("X Publish Error:", e);
    return publishErrorResponse(e);
  }
}
