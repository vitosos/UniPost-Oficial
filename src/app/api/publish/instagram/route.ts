import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { getCurrentUser, unauthorized } from "@/lib/session";
import { publishErrorResponse, runPublish } from "@/lib/publishing";
import { localUploadPath } from "@/lib/uploads";
import { readJson } from "@/lib/validation";
import fs from "fs/promises";
import sharp from "sharp"; 

// Tipos para Graph API
type GraphError = {
  error: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id: string;
  };
};

type ContainerResponse = { id: string };
type PublishResponse = { id: string };
type PermalinkResponse = { id: string; permalink: string }; // 👈 Tipo nuevo

const GRAPH_VERSION = "v21.0";
const BASE_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

// --- Helper: Optimizar Imagen Localmente ---
async function optimizeLocalImage(urlPath: string) {
    try {
        // Solo se tocan archivos dentro de public/uploads
        const localPath = localUploadPath(urlPath);
        if (!localPath) return;
        
        try {
            const stats = await fs.stat(localPath);
            const sizeMB = stats.size / (1024 * 1024);

            if (sizeMB > 4) {
                console.log(`📉 Optimizando imagen IG (${sizeMB.toFixed(2)}MB) en disco...`);
                const buffer = await fs.readFile(localPath);
                // Se mantiene el formato original para que la extensión del archivo siga siendo correcta
                const image = sharp(buffer).resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true });
                const { format } = await image.metadata();
                const optimizedBuffer = await (format === "png"
                    ? image.png({ compressionLevel: 9, palette: true })
                    : format === "webp"
                        ? image.webp({ quality: 85 })
                        : image.jpeg({ quality: 85, mozjpeg: true })
                ).toBuffer();
                
                await fs.writeFile(localPath, optimizedBuffer);
                console.log(`✅ Archivo optimizado sobrescrito.`);
            }
        } catch (err) {
            console.log("⚠️ Archivo no local o error de lectura:", localPath);
        }
    } catch (e) {
        console.warn("⚠️ No se pudo optimizar imagen local:", e);
    }
}

// Helper: Llamadas a Graph API (POST)
async function graphPost<T>(url: string, body: any, token: string): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const json = await res.json();

  if (!res.ok || (json as any).error) {
    console.error("❌ IG Graph error raw:", JSON.stringify(json));
    const err = json as GraphError;
    const msg = err.error?.message || "Unknown Graph API Error";
    throw new Error(msg);
  }

  return json as T;
}

// Lógica de publicación interna
export async function publishToInstagramInternal(userId: number, postId: number, variantId: number) {
  // 1. Obtener datos
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  const access = await prisma.instagram_Access.findFirst({ where: { userId: user.id, redSocial: 2 } });
  if (!access || !access.accessToken) throw new Error("Instagram not linked");

  const userToken = decrypt(access.accessToken);

  // 2. Obtener IG User ID
  const accountsUrl = `${BASE_URL}/me/accounts?fields=name,access_token,instagram_business_account{id}`;
  const accountsRes = await fetch(accountsUrl, { headers: { Authorization: `Bearer ${userToken}` } });
  const accountsData = await accountsRes.json();
  const pageWithIg = accountsData.data?.find((p: any) => p.instagram_business_account?.id);

  if (!pageWithIg) throw new Error("No linked Instagram Business account found.");

  const igUserId = pageWithIg.instagram_business_account.id;
  const pageAccessToken = pageWithIg.access_token; 

  // 3. Obtener Post y Variante
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { medias: { orderBy: { mediaOrder: "asc" } } },
  });
  if (!post) throw new Error("Post not found");

  const variant = await prisma.variant.findUnique({ where: { id: variantId } });
  if (!variant) throw new Error("Variant not found");

  // 4. Preparar Payload
  const medias = post.medias || [];
  const caption = variant.text || post.body || "";
  const containerIds: string[] = [];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.unipost.cl";

  let publishId = "";

  // --- SINGLE MEDIA ---
  if (medias.length === 1) {
    const m = medias[0];
    const isVideo = m.type === "VIDEO" || m.mime.startsWith("video");
    const mediaUrl = m.url.startsWith("http") ? m.url : `${appUrl}${m.url}`;

    if (!isVideo) await optimizeLocalImage(m.url);

    const endpoint = isVideo ? "media" : "media"; 
    const typeParam = isVideo ? { media_type: "VIDEO", video_url: mediaUrl } : { image_url: mediaUrl };

    console.log(`📸 Publicando IG single media: ${mediaUrl}`);

    const container = await graphPost<ContainerResponse>(
      `${BASE_URL}/${igUserId}/${endpoint}`,
      { ...typeParam, caption, access_token: pageAccessToken },
      pageAccessToken
    );

    const publish = await graphPost<PublishResponse>(
      `${BASE_URL}/${igUserId}/media_publish`,
      { creation_id: container.id, access_token: pageAccessToken },
      pageAccessToken
    );
    
    publishId = publish.id;
  }

  // --- CAROUSEL (ALBUM) ---
  else if (medias.length > 1) {
    for (const m of medias) {
      const isVideo = m.type === "VIDEO" || m.mime.startsWith("video");
      const mediaUrl = m.url.startsWith("http") ? m.url : `${appUrl}${m.url}`;

      if (!isVideo) await optimizeLocalImage(m.url);

      const typeParam = isVideo ? { media_type: "VIDEO", video_url: mediaUrl } : { image_url: mediaUrl };

      const itemContainer = await graphPost<ContainerResponse>(
        `${BASE_URL}/${igUserId}/media`,
        { ...typeParam, is_carousel_item: true, access_token: pageAccessToken },
        pageAccessToken
      );
      containerIds.push(itemContainer.id);
    }

    console.log(`📸 Creando Carrusel IG con ${containerIds.length} items`);
    const carouselContainer = await graphPost<ContainerResponse>(
      `${BASE_URL}/${igUserId}/media`,
      { media_type: "CAROUSEL", children: containerIds, caption, access_token: pageAccessToken },
      pageAccessToken
    );

    const publish = await graphPost<PublishResponse>(
      `${BASE_URL}/${igUserId}/media_publish`,
      { creation_id: carouselContainer.id, access_token: pageAccessToken },
      pageAccessToken
    );
    
    publishId = publish.id;
  } else {
      throw new Error("No media provided for Instagram");
  }

  // 5. 🟢 RECUPERAR PERMALINK (Paso Nuevo)
  // Hacemos una llamada GET extra para obtener la URL pública
  let permalink = null;
  try {
      const permalinkRes = await fetch(`${BASE_URL}/${publishId}?fields=permalink`, {
          headers: { Authorization: `Bearer ${pageAccessToken}` },
      });
      const permalinkData = await permalinkRes.json();
      if (permalinkData.permalink) {
          permalink = permalinkData.permalink;
      }
  } catch (e) {
      console.warn("⚠️ No se pudo obtener permalink de IG:", e);
  }

  // 6. Actualizar BD con URI y PERMALINK
  await prisma.variant.update({
      where: { id: variantId },
      data: { 
          status: "PUBLISHED", 
          uri: publishId, 
          permalink: permalink,
          date_sent: new Date() 
      }
  });

  return { ok: true, id: publishId, permalink };
}

// Handler POST
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    const { postId, variantId } = await readJson<{ postId: number; variantId: number }>(req);
    const result = await runPublish({ userId: user.id, postId, variantId, network: "INSTAGRAM" }, (ctx) =>
      publishToInstagramInternal(user.id, ctx.postId, ctx.variantId)
    );
    return NextResponse.json(result);
  } catch (e) {
    console.error("❌ Error en /api/publish/instagram:", e);
    return publishErrorResponse(e);
  }
}
