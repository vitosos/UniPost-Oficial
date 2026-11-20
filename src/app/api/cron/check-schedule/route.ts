import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import type { NetworkKey } from "@/lib/networks";
import { runPublish } from "@/lib/publishing";
import { publishToBlueskyInternal } from "@/app/api/publish/bluesky/route";
import { publishToInstagramInternal } from "@/app/api/publish/instagram/route";
import { publishToFacebookInternal } from "@/app/api/publish/facebook/route";
import { publishToTikTokInternal } from "@/app/api/publish/tiktok/route";
import { publishToXInternal } from "@/app/api/publish/x_twitter/route";

// Evita que Vercel cachee la respuesta, asegurando que el cron ejecute lógica real cada vez
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PUBLISHERS: Record<NetworkKey, (userId: number, postId: number, variantId: number) => Promise<unknown>> = {
  BLUESKY: publishToBlueskyInternal,
  INSTAGRAM: publishToInstagramInternal,
  FACEBOOK: publishToFacebookInternal,
  TIKTOK: publishToTikTokInternal,
  TWITTER: publishToXInternal,
};

function isAuthorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  // Sin secreto configurado el endpoint queda cerrado (antes quedaba público).
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(req.headers.get("authorization") ?? "");
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Buscar posts agendados que ya vencieron (runAt <= ahora)
    const dueSchedules = await prisma.schedule.findMany({
      where: { runAt: { lte: new Date() } },
      select: { id: true, postId: true },
      take: 20,
    });

    if (dueSchedules.length === 0) {
      return NextResponse.json({ ok: true, message: "No hay publicaciones pendientes." });
    }

    let processedCount = 0;
    let errorsCount = 0;

    for (const schedule of dueSchedules) {
      // 2. "Reclamar" la agenda borrándola: si otra ejecución ya la tomó, count será 0.
      const claimed = await prisma.schedule.deleteMany({ where: { id: schedule.id } });
      if (claimed.count === 0) continue;

      const post = await prisma.post.findUnique({
        where: { id: schedule.postId },
        select: { id: true, authorId: true, variants: { select: { id: true, network: true, status: true } } },
      });
      if (!post) continue;

      console.log(`⏰ Procesando agenda ID ${schedule.id} para post ${post.id}`);
      let postHadErrors = false;

      // 3. Publicar cada variante pendiente
      for (const variant of post.variants) {
        if (variant.status === "PUBLISHED") continue;
        const publisher = PUBLISHERS[variant.network as NetworkKey];

        try {
          if (!publisher) throw new Error(`Red no soportada: ${variant.network}`);
          await runPublish({ userId: post.authorId, postId: post.id, variantId: variant.id, network: variant.network as NetworkKey }, (ctx) =>
            publisher(post.authorId, ctx.postId, ctx.variantId)
          );
          console.log(`✅ ${variant.network} publicado auto: Post ${post.id}`);
        } catch (e) {
          console.error(`❌ Error publicando variante ${variant.id} en Cron:`, e);
          postHadErrors = true;
          errorsCount++;
        }
      }

      // 4. Si alguna red falló, el post queda marcado para que el usuario lo reintente manualmente.
      if (postHadErrors) {
        await prisma.post.update({ where: { id: post.id }, data: { status: "FAILED" } });
      }
      processedCount++;
    }

    return NextResponse.json({
      ok: true,
      processed: processedCount,
      errors: errorsCount,
      message: `Procesados ${processedCount} posts con ${errorsCount} errores.`,
    });
  } catch (error) {
    console.error("🔥 Cron Fatal Error:", error);
    return NextResponse.json({ ok: false, error: "CRON_FAILED" }, { status: 500 });
  }
}
