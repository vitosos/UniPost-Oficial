import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

type RemoteMetric = {
  id: string;       
  permalink?: string; 
  likes: number;
  comments: number;
  shares: number;
  views: number;
  createdAt?: string | Date;
};

// ... (Helpers normalizeUrl y getIGShortcode se mantienen igual) ...
function normalizeUrl(url?: string | null) {
    if (!url) return "";
    try {
        if (!url.includes("http")) return url.trim();
        const urlObj = new URL(url);
        const host = urlObj.hostname.replace(/^www\./, "");
        return (host + urlObj.pathname).replace(/\/$/, "");
    } catch {
        return url.trim().replace(/\/$/, "");
    }
}

function getIGShortcode(url?: string | null) {
    if (!url) return null;
    try {
        const match = url.match(/\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/);
        return match ? match[1] : null;
    } catch { return null; }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) return NextResponse.json({ ok: false }, { status: 401 });

    // 1. Obtener usuario solicitante
    const requester = await prisma.user.findUnique({ 
        where: { email: session.user.email },
        select: { id: true, roleID: true, organizationId: true } 
    });

    if (!requester) return NextResponse.json({ ok: false, error: "Usuario no encontrado" }, { status: 400 });

    // 2. Determinar Target User y Validar Permisos (Lógica intacta)
    let targetUserId = requester.id;
    try {
        const body = await req.json().catch(() => ({})); 
        if (body.targetUserId) {
            const reqTargetId = Number(body.targetUserId);
            const globalRole = Number(requester.roleID || 0);
            
            if (globalRole >= 4) {
                targetUserId = reqTargetId;
            } else if (reqTargetId === requester.id) {
                targetUserId = reqTargetId;
            } else {
                const targetUserCheck = await prisma.user.findUnique({ where: { id: reqTargetId }, select: { organizationId: true } });
                if (!targetUserCheck || !requester.organizationId || targetUserCheck.organizationId !== requester.organizationId) {
                    return NextResponse.json({ ok: false, error: "No puedes gestionar usuarios de otra organización." }, { status: 403 });
                }
                const membership = await prisma.membership.findFirst({ where: { userId: requester.id, organizationId: requester.organizationId } });
                if (membership?.role !== "Manager") {
                    return NextResponse.json({ ok: false, error: "Se requiere rol de Manager para esta acción." }, { status: 403 });
                }
                targetUserId = reqTargetId;
            }
        }
    } catch (e) { /* ignore parse error */ }

    // 3. Obtener Usuario OBJETIVO
    const userToRefresh = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: { id: true, organizationId: true }
    });

    if (!userToRefresh) return NextResponse.json({ ok: false, error: "Usuario objetivo no encontrado" }, { status: 404 });

    const cookie = req.headers.get("cookie") ?? "";
    const baseUrl = process.env.INTERNAL_API_BASE_URL || `http://127.0.0.1:${process.env.PORT || 3000}`;

    console.log(`🔄 Refresh: Usuario Objetivo ID ${userToRefresh.id}. Solicitando datos...`);

    const queryParams = `?userId=${userToRefresh.id}`;

    const [bskyRes, igRes, fbRes, xRes] = await Promise.all([
        fetch(`${baseUrl}/api/bsky/metrics${queryParams}`, { headers: { cookie } }),
        fetch(`${baseUrl}/api/instagram/metrics${queryParams}`, { headers: { cookie } }),
        fetch(`${baseUrl}/api/facebook/metrics${queryParams}`, { headers: { cookie } }),
        fetch(`${baseUrl}/api/x_twitter/metrics${queryParams}`, { headers: { cookie } }),
    ]);

    const bskyData = await bskyRes.json();
    const igData = await igRes.json();
    const fbData = await fbRes.json();
    const xData = await xRes.json();

    // Construir Mapas
    const bskyMap = new Map<string, RemoteMetric>();
    const igMap = new Map<string, RemoteMetric>(); 
    const fbMap = new Map<string, RemoteMetric>();
    const xMap = new Map<string, RemoteMetric>();

    if (bskyData.ok) bskyData.posts?.forEach((p: any) => bskyMap.set(p.uri, { id: p.uri, likes: p.likes, comments: p.comments, shares: p.shares, views: p.views, createdAt: p.createdAt }));
    
    if (igData.ok) igData.posts?.forEach((p: any) => { 
        const m = { id: p.id, permalink: p.permalink, likes: p.likes, comments: p.comments, shares: 0, views: 0, createdAt: p.createdAt }; 
        igMap.set(p.id, m); 
        const sc = getIGShortcode(p.permalink); 
        if (sc) igMap.set(sc, m); 
    });
    
    if (fbData.ok) fbData.posts?.forEach((p: any) => { 
        const m = { id: p.id, likes: p.likes, comments: p.comments, shares: p.shares, views: 0, createdAt: p.createdAt }; 
        fbMap.set(p.id, m); 
        if (p.id.includes("_")) fbMap.set(p.id.split("_")[1], m); 
    });

    // 🆕 Mapeo X (Twitter)
    if (xData.ok && xData.posts) {
        xData.posts.forEach((p: any) => {
             xMap.set(p.id, { 
                id: p.id, 
                likes: p.likes, 
                comments: p.comments, 
                shares: p.shares, 
                views: p.views, 
                createdAt: p.createdAt 
            });
        });
    }

    // 4. Obtener Variantes y Actualizar
    const variants = await prisma.variant.findMany({
        where: {
            OR: [ { uri: { not: null } }, { permalink: { not: null } } ],
            post: { authorId: userToRefresh.id }
        },
        include: { Metric: true }
    });

    let updated = 0;

    for (const v of variants) {
        let remote: RemoteMetric | undefined;
        
        if (v.network === "BLUESKY" && v.uri) remote = bskyMap.get(v.uri);
        else if (v.network === "INSTAGRAM") {
            if (v.uri) remote = igMap.get(v.uri);
            if (!remote && v.permalink) { const sc = getIGShortcode(v.permalink); if (sc) remote = igMap.get(sc); }
        } 
        else if (v.network === "FACEBOOK" && v.uri) {
            remote = fbMap.get(v.uri);
            if (!remote) { for (const [key, val] of fbMap.entries()) { if (key.includes(v.uri) || v.uri.includes(key)) { remote = val; break; } } }
        }
        // 👇 NUEVO: Match Twitter
        else if (v.network === "TWITTER" && v.uri) {
            remote = xMap.get(v.uri);
        }

        if (remote) {
            const payload = { likes: remote.likes, comments: remote.comments, shares: remote.shares, impressions: remote.views || 0, collectedAt: new Date() };
            
            // Solo actualizamos status y fecha si realmente vienen datos frescos
            const updateData: any = { status: "PUBLISHED" };
            if (remote.createdAt) updateData.date_sent = new Date(remote.createdAt);

            await prisma.variant.update({ where: { id: v.id }, data: updateData });

            if (v.Metric.length > 0) {
                await prisma.metric.update({ where: { id: v.Metric[0].id }, data: payload });
            } else {
                await prisma.metric.create({ data: { ...payload, variantId: v.id, postId: v.postId, network: v.network } });
            }
            updated++;
        }
    }

    return NextResponse.json({ ok: true, processed: updated });

  } catch (e: any) {
    console.error("Fatal Error Refresh:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}