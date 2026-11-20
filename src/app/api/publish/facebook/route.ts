import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, unauthorized } from "@/lib/session";
import { publishErrorResponse, runPublish } from "@/lib/publishing";
import { readJson } from "@/lib/validation";
import { decrypt } from "@/lib/crypto";

// Helper para llamadas a Graph API
async function graphPost(url: string, params: any) {
  const searchParams = new URLSearchParams(params);
  const res = await fetch(`${url}?${searchParams.toString()}`, { method: "POST" });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error?.message || "Facebook API Error");
  return data;
}

// Helper para construir URL absoluta de media
function buildAbsoluteUrl(pathOrUrl: string): string {
    if (pathOrUrl.startsWith("http")) return pathOrUrl;
    const baseEnv = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || "";
    const base = baseEnv.startsWith("http") ? baseEnv : `https://${baseEnv}`;
    return `${base.replace(/\/$/, "")}${pathOrUrl}`;
}

// Lógica Interna (Reutilizable por Cron)
export async function publishToFacebookInternal(userId: number, postId: number, variantId?: number | null) {
    // 1. Obtener Post
    const post = await prisma.post.findUnique({
        where: { id: postId },
        include: { variants: true, medias: { orderBy: { mediaOrder: "asc" } } }
    });
    if (!post) throw new Error("POST_NOT_FOUND");

    // 2. Obtener Variante
    const variant = variantId 
        ? post.variants.find(v => v.id === variantId)
        : post.variants.find(v => v.network === "FACEBOOK");
    if (!variant) throw new Error("FACEBOOK_VARIANT_NOT_FOUND");

    // 3. Obtener Credenciales (Desencriptar Token)
    const fbAccess = await prisma.facebook_Access.findFirst({ where: { userId, redSocial: 3 } });
    if (!fbAccess || !fbAccess.accessToken) throw new Error("FACEBOOK_NOT_LINKED");
    
    const userToken = decrypt(fbAccess.accessToken);

    // 4. Obtener ID y Token de la Página (Asumimos la primera página o la guardada)
    // Si guardaste el Page ID en la BD úsalo, si no, búscalo de nuevo:
    const accountsRes = await fetch("https://graph.facebook.com/v21.0/me/accounts", { headers: { Authorization: `Bearer ${userToken}` } });
    const accountsData = await accountsRes.json();
    const page = accountsData.data?.[0]; // Usamos la primera página encontrada
    if (!page) throw new Error("NO_FACEBOOK_PAGE_FOUND");

    const pageId = page.id;
    const pageAccessToken = page.access_token; // Token específico de la página

    // 5. Publicar
    const message = variant.text || post.body || "";
    const medias = post.medias || [];
    let finalId = "";

    if (medias.length === 0) {
        // Solo Texto
        const res = await graphPost(`https://graph.facebook.com/v21.0/${pageId}/feed`, {
            message, access_token: pageAccessToken
        });
        finalId = res.id;
    } else if (medias.length === 1) {
        // 1 Foto o Video
        const media = medias[0];
        const url = buildAbsoluteUrl(media.url);
        const isVideo = media.type === "VIDEO" || media.mime.startsWith("video");
        
        if (isVideo) {
            // Video (Simple Upload - para videos grandes se requiere chunked upload)
            const res = await graphPost(`https://graph.facebook.com/v21.0/${pageId}/videos`, {
                file_url: url, description: message, access_token: pageAccessToken
            });
            finalId = res.id;
        } else {
            // Foto
            const res = await graphPost(`https://graph.facebook.com/v21.0/${pageId}/photos`, {
                url: url, caption: message, access_token: pageAccessToken
            });
            finalId = res.post_id || res.id;
        }
    } else {
        // Álbum (Múltiples fotos) - Facebook no soporta carrusel mixto fácil por API, haremos álbum de fotos
        // 1. Subir fotos sin publicar (published=false)
        const attachedMedia = [];
        for (const m of medias) {
            if (m.type === "VIDEO") continue; // Saltamos videos en álbum mixto por simplicidad
            const url = buildAbsoluteUrl(m.url);
            const res = await graphPost(`https://graph.facebook.com/v21.0/${pageId}/photos`, {
                url: url, published: "false", access_token: pageAccessToken
            });
            attachedMedia.push({ media_fbid: res.id });
        }
        // 2. Publicar Feed con las fotos adjuntas
        if (attachedMedia.length > 0) {
            const res = await graphPost(`https://graph.facebook.com/v21.0/${pageId}/feed`, {
                message, 
                attached_media: JSON.stringify(attachedMedia),
                access_token: pageAccessToken
            });
            finalId = res.id;
        } else {
            throw new Error("NO_SUPPORTED_MEDIA_FOR_ALBUM");
        }
    }

    // 6. Actualizar BD
    await prisma.variant.update({
        where: { id: variant.id },
        data: { status: "PUBLISHED", uri: finalId, date_sent: new Date() }
    });

    return { ok: true, id: finalId };
}

export async function POST(req: Request) {
    const user = await getCurrentUser();
    if (!user) return unauthorized();

    try {
        const { postId, variantId } = await readJson<{ postId: number; variantId: number }>(req);
        const result = await runPublish({ userId: user.id, postId, variantId, network: "FACEBOOK" }, (ctx) =>
            publishToFacebookInternal(user.id, ctx.postId, ctx.variantId)
        );
        return NextResponse.json(result);
    } catch (err) {
        console.error("FB Publish Error:", err);
        return publishErrorResponse(err);
    }
}
