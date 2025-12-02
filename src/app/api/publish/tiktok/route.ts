import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { decrypt } from "@/lib/crypto";

// Helper para construir URL absoluta (TikTok necesita descargar el video desde tu servidor)
function buildAbsoluteUrl(pathOrUrl: string): string {
    if (pathOrUrl.startsWith("http")) return pathOrUrl;
    
    const baseEnv = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || "";
    
    if (!baseEnv) {
        throw new Error("Base URL not configured. TikTok requiere una URL pública para descargar el video.");
    }

    const base = baseEnv.startsWith("http") ? baseEnv : `https://${baseEnv}`;
    return `${base.replace(/\/$/, "")}${pathOrUrl}`;
}

// Lógica Interna (Exportada para que el Cron también pueda usarla)
export async function publishToTikTokInternal(userId: number, postId: number, variantId?: number | null) {
    // 1. Obtener Post y sus medios
    const post = await prisma.post.findUnique({
        where: { id: postId },
        include: { variants: true, medias: { orderBy: { mediaOrder: "asc" } } }
    });
    if (!post) throw new Error("POST_NOT_FOUND");

    // 2. Obtener Variante Específica
    const variant = variantId 
        ? post.variants.find(v => v.id === variantId)
        : post.variants.find(v => v.network === "TIKTOK");
    
    if (!variant) throw new Error("TIKTOK_VARIANT_NOT_FOUND");

    // 3. Validaciones de Contenido (Solo Video)
    const medias = post.medias || [];
    const videoMedia = medias.find(m => m.type === "VIDEO" || m.mime.startsWith("video/"));

    if (!videoMedia) {
        throw new Error("TikTok requiere un archivo de video válido.");
    }
    
    // 4. Obtener Credenciales
    const ttAccess = await prisma.tikTok_Access.findFirst({ where: { userId, redSocial: 4 } });
    if (!ttAccess || !ttAccess.accessToken) throw new Error("TIKTOK_NOT_LINKED");
    
    const userToken = decrypt(ttAccess.accessToken);
    const videoUrl = buildAbsoluteUrl(videoMedia.url);
    const caption = variant.text || post.body || "";

    // 5. Llamada a la API de TikTok (V2 Video Publish Init)
    const url = "https://open.tiktokapis.com/v2/post/publish/video/init/";
    
    const body = {
        post_info: {
            title: caption.substring(0, 2200), // Límite de TikTok
            // En modo Sandbox, 'SELF_ONLY' es obligatorio para evitar errores de permisos.
            // Cuando pases a Producción (Live), puedes cambiarlo a 'PUBLIC_TO_EVERYONE'.
            privacy_level: "MUTUAL_FOLLOW_FRIENDS", 
            disable_duet: true,
            disable_comment: false,
            disable_stitch: true,
            video_cover_timestamp_ms: 1000 // Usar el segundo 1 como portada
        },
        source_info: {
            source: "PULL_FROM_URL",
            video_url: videoUrl
        }
    };

    console.log("🎵 Enviando a TikTok:", { videoUrl, privacy: "SELF_ONLY" });

    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${userToken}`,
            "Content-Type": "application/json; charset=UTF-8"
        },
        body: JSON.stringify(body)
    });

    const json = await res.json();

    // TikTok V2 a veces devuelve error dentro del JSON aunque el status sea 200
    if (json.error && json.error.code !== "ok") {
        console.error("❌ TikTok Publish Error:", json);
        throw new Error(`TikTok API: ${json.error.message} (Code: ${json.error.code})`);
    }

    const publishId = json.data?.publish_id;

    if (!publishId) {
        throw new Error("TikTok no devolvió un publish_id válido.");
    }

    // 6. Actualizar BD
    // Guardamos el 'publish_id' en 'uri' temporalmente. TikTok procesa el video asíncronamente.
    await prisma.variant.update({
        where: { id: variant.id },
        data: { 
            status: "PUBLISHED", 
            uri: publishId, // Ojo: Este no es el ID final del post, es el ID de la tarea de publicación
            date_sent: new Date() 
        }
    });

    // Actualizar Post Padre si corresponde
    if (post.status !== "PUBLISHED") {
        await prisma.post.update({ where: { id: post.id }, data: { status: "PUBLISHED" } });
    }

    return { ok: true, id: publishId };
}

// Handler para el Frontend (POST)
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) return NextResponse.json({ ok: false, error: "Auth required" }, { status: 401 });
        
        const user = await prisma.user.findUnique({ where: { email: session.user.email } });
        if (!user) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });

        const { postId, variantId } = await req.json();
        const result = await publishToTikTokInternal(user.id, postId, variantId);
        
        return NextResponse.json(result);
    } catch (err: any) {
        console.error("TikTok Publish Handler Error:", err);
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
}