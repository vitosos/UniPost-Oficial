// src\app\api\publish\instagram\route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { decrypt } from "@/lib/crypto";

const GRAPH_BASE_URL = "https://graph.facebook.com/v21.0";

type GraphError = {
    error?: {
        message?: string;
        type?: string;
        code?: number;
        error_subcode?: number;
        fbtrace_id?: string;
    };
};

async function graphPost<T = any>(
    path: string,
    params: Record<string, string>
): Promise<T> {
    const url = new URL(`${GRAPH_BASE_URL}${path}`);
    const body = new URLSearchParams(params);

    const res = await fetch(url.toString(), {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
    });

    const text = await res.text();
    let json: any;
    try {
        json = text ? JSON.parse(text) : {};
    } catch {
        json = { raw: text };
    }

    if (!res.ok) {
        console.error("❌ IG Graph error raw:", text);
        console.error("❌ IG Graph parsed:", json);
        const err = json as GraphError;
        throw new Error(err.error?.message ?? text);
    }

    return json as T;
}

function buildAbsoluteUrl(pathOrUrl: string): string {
    if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
        return pathOrUrl;
    }

    const baseEnv =
        process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || "";

    if (!baseEnv) {
        throw new Error(
            "Base URL not configured (NEXT_PUBLIC_APP_URL or VERCEL_URL). Cannot build absolute media URL for Instagram."
        );
    }

    const base =
        baseEnv.startsWith("http://") || baseEnv.startsWith("https://")
            ? baseEnv
            : `https://${baseEnv}`;

    return `${base.replace(/\/$/, "")}${pathOrUrl}`;
}

async function publishWithRetry(
    igUserId: string,
    creationId: string,
    pageAccessToken: string,
    maxAttempts = 5,
    delayMs = 3000
): Promise<{ id: string }> {
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const res = await graphPost<{ id: string }>(`/${igUserId}/media_publish`, {
                creation_id: creationId,
                access_token: pageAccessToken,
            });
            return res;
        } catch (err: any) {
            const msg = err?.message ?? "";
            lastError = err;

            if (msg.includes("Media ID is not available") && attempt < maxAttempts) {
                console.warn(
                    `⏳ Media aún no está listo en IG (intento ${attempt}/${maxAttempts}). Reintentando en ${delayMs / 1000
                    }s...`
                );
                await new Promise((resolve) => setTimeout(resolve, delayMs));
                continue;
            }
            throw err;
        }
    }

    throw lastError ?? new Error(
        "No se pudo publicar el media en Instagram tras varios intentos."
    );
}

async function getInstagramCredentialsForUser(userId: number): Promise<{
    pageAccessToken: string;
    igUserId: string;
}> {
    const igAccess = await prisma.instagram_Access.findFirst({
        where: {
            userId,
            redSocial: 2, 
        },
    });

    if (!igAccess || !igAccess.accessToken) {
        throw new Error(
            "Instagram account not linked o falta accessToken en Instagram_Access."
        );
    }

    // DESENCRIPTAMOS EL TOKEN AQUÍ
    // Si el token en la BD no está encriptado (formato antiguo), esto fallará.
    // Asegúrate de reconectar la cuenta para guardar el token nuevo encriptado.
    const userAccessToken = decrypt(igAccess.accessToken);

    const url = new URL(`${GRAPH_BASE_URL}/me/accounts`);
    url.searchParams.set(
        "fields",
        "id,name,access_token,instagram_business_account{id,username}"
    );
    url.searchParams.set("access_token", userAccessToken);

    const res = await fetch(url.toString(), { method: "GET" });
    const text = await res.text();
    let json: any;
    try {
        json = text ? JSON.parse(text) : {};
    } catch {
        json = { raw: text };
    }

    if (!res.ok) {
        console.error("❌ Error obteniendo páginas de Facebook (/me/accounts):", text);
        const err = json as GraphError;
        throw new Error(
            err.error?.message ??
            "No se pudo obtener las páginas de Facebook con el accessToken almacenado."
        );
    }

    const pages: any[] = json?.data ?? [];
    if (!pages.length) {
        throw new Error(
            "No se encontraron páginas de Facebook asociadas a este usuario."
        );
    }

    const pageWithIg = pages.find(
        (p) => p.instagram_business_account && p.instagram_business_account.id
    );

    if (!pageWithIg) {
        console.error(
            "⚠️ Ninguna página tiene instagram_business_account:",
            JSON.stringify(pages, null, 2)
        );
        throw new Error(
            "Ninguna de las páginas asociadas tiene una cuenta de Instagram vinculada."
        );
    }

    const pageAccessToken = pageWithIg.access_token as string;
    const igUserId = pageWithIg.instagram_business_account.id as string;

    return {
        pageAccessToken,
        igUserId,
    };
}

// LÓGICA INTERNA REUTILIZABLE (Para Cron y API)
export async function publishToInstagramInternal(userId: number, postId: number, variantId?: number | null) {
    // 1. Obtener Post + Variants + Medias
    const post = await prisma.post.findUnique({
        where: { id: postId },
        include: {
            variants: true,
            medias: {
                orderBy: { mediaOrder: "asc" },
            },
        },
    });

    if (!post) {
        throw new Error("POST_NOT_FOUND");
    }

    const variant =
        variantId != null
            ? post.variants.find((v) => v.id === variantId)
            : post.variants.find((v) => v.network === "INSTAGRAM");

    if (!variant) {
        throw new Error("INSTAGRAM_VARIANT_NOT_FOUND");
    }

    let medias = post.medias;
    if (!medias || medias.length === 0) {
        throw new Error("NO_MEDIA_FOR_POST");
    }

    // Enforce IG limit: max 10 items
    if (medias.length > 10) {
        medias = medias.slice(0, 10);
    }

    // 2. Obtener credenciales usando el ID de usuario
    const { pageAccessToken, igUserId } = await getInstagramCredentialsForUser(userId);

    const caption =
        (variant.text && variant.text.trim().length > 0
            ? variant.text
            : post.body || "") ?? "";

    console.log("📸 IG medias candidate:", {
        postId: post.id,
        medias: medias.map((m) => ({
            id: m.id,
            type: m.type,
            mime: m.mime,
            url: m.url,
            mediaOrder: m.mediaOrder,
        })),
    });

    let finalMediaId: string | null = null;

    // 3. Lógica de publicación (Single vs Carousel)
    if (medias.length === 1) {
        // Single media flow
        const media = medias[0];
        const mediaUrl = buildAbsoluteUrl(media.url);
        const isVideo =
            media.type === "VIDEO" ||
            media.mime.toLowerCase().startsWith("video/");

        console.log("📸 Publicando IG single media:", {
            mediaId: media.id,
            urlSent: mediaUrl,
            isVideo,
        });

        let containerRes: { id: string };

        if (isVideo) {
            containerRes = await graphPost<{ id: string }>(`/${igUserId}/media`, {
                media_type: "VIDEO",
                video_url: mediaUrl,
                caption,
                access_token: pageAccessToken,
            });
        } else {
            containerRes = await graphPost<{ id: string }>(`/${igUserId}/media`, {
                image_url: mediaUrl,
                caption,
                access_token: pageAccessToken,
            });
        }

        const publishRes = await publishWithRetry(
            igUserId,
            containerRes.id,
            pageAccessToken
        );

        finalMediaId = publishRes.id;
        console.log("✅ IG single media published:", publishRes);

    } else {
        // Carousel flow
        const childrenIds: string[] = [];

        for (const media of medias) {
            const mediaUrl = buildAbsoluteUrl(media.url);
            const isVideo =
                media.type === "VIDEO" ||
                media.mime.toLowerCase().startsWith("video/");

            console.log("📸 Creando contenedor de carrusel:", {
                mediaId: media.id,
                urlSent: mediaUrl,
                isVideo,
            });

            let childContainer: { id: string };

            if (isVideo) {
                childContainer = await graphPost<{ id: string }>(
                    `/${igUserId}/media`,
                    {
                        media_type: "VIDEO",
                        video_url: mediaUrl,
                        is_carousel_item: "true",
                        access_token: pageAccessToken,
                    }
                );
            } else {
                childContainer = await graphPost<{ id: string }>(
                    `/${igUserId}/media`,
                    {
                        image_url: mediaUrl,
                        is_carousel_item: "true",
                        access_token: pageAccessToken,
                    }
                );
            }

            childrenIds.push(childContainer.id);
        }

        console.log("📚 IDs de hijos para carrusel:", childrenIds);

        const carouselContainer = await graphPost<{ id: string }>(
            `/${igUserId}/media`,
            {
                media_type: "CAROUSEL",
                children: childrenIds.join(","),
                caption,
                access_token: pageAccessToken,
            }
        );

        console.log("✅ IG carousel container created:", carouselContainer);

        const publishRes = await publishWithRetry(
            igUserId,
            carouselContainer.id,
            pageAccessToken
        );

        finalMediaId = publishRes.id;
        console.log("✅ IG carousel published:", publishRes);
    }

    // 4. Obtener permalink (opcional)
    let permalink: string | null = null;
    if (finalMediaId) {
        try {
            const mediaData = await fetch(
                `${GRAPH_BASE_URL}/${finalMediaId}?fields=permalink&access_token=${encodeURIComponent(
                    pageAccessToken
                )}`
            );
            const json = await mediaData.json();
            if (json?.permalink) {
                permalink = json.permalink as string;
            }
        } catch (e) {
            console.warn("⚠️ Could not fetch IG permalink:", e);
        }
    }

    // 5. Actualizar DB
    await prisma.$transaction(async (tx) => {
        await tx.variant.update({
            where: { id: variant.id },
            data: {
                status: "PUBLISHED",
                uri: finalMediaId ?? undefined,
                permalink: permalink ?? undefined,
            },
        });
        if (post.status !== "PUBLISHED") {
            await tx.post.update({
                where: { id: post.id },
                data: {
                    status: "PUBLISHED",
                },
            });
        }
    });

    return {
        ok: true,
        mediaId: finalMediaId,
        uri: finalMediaId,
        permalink,
    };
}


// HANDLER POST (Para llamadas desde el navegador/frontend)
export async function POST(req: Request) {
    try {
        const session = await getServerSession();
        if (!session || !session.user?.email) {
            return NextResponse.json(
                { ok: false, error: "NOT_AUTHENTICATED" },
                { status: 401 }
            );
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user) {
            return NextResponse.json(
                { ok: false, error: "USER_NOT_FOUND" },
                { status: 404 }
            );
        }

        const body = await req.json();
        const { postId, variantId } = body as {
            postId: number;
            variantId?: number | null;
        };

        if (!postId) {
            return NextResponse.json(
                { ok: false, error: "MISSING_POST_ID" },
                { status: 400 }
            );
        }

        // Llamamos a la función interna
        const result = await publishToInstagramInternal(user.id, postId, variantId);

        return NextResponse.json(result, { status: 200 });

    } catch (err: any) {
        console.error("❌ Error en /api/publish/instagram:", err);
        return NextResponse.json(
            {
                ok: false,
                error: err?.message ?? "INTERNAL_ERROR",
            },
            { status: 500 }
        );
    }
}