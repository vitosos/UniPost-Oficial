import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { decrypt } from "@/lib/crypto";
import fs from "fs/promises";
import path from "path";

// Helper para guardar el avatar localmente
async function saveAvatarLocally(url: string, userId: number, openId: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    
    const buffer = Buffer.from(await res.arrayBuffer());
    
    // Carpeta específica para TikTok
    const uploadDir = path.join(process.cwd(), "public", "uploads", "tt_avatar");
    await fs.mkdir(uploadDir, { recursive: true });
    
    const filename = `tt_${userId}_${openId}.jpg`;
    const filePath = path.join(uploadDir, filename);
    
    await fs.writeFile(filePath, buffer);
    return `/uploads/tt_avatar/${filename}`;
  } catch (e) {
    console.error("Error guardando avatar TikTok:", e);
    return null;
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ ok: false }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ ok: false }, { status: 404 });

    const ttAccess = await prisma.tikTok_Access.findFirst({
      where: { userId: user.id, redSocial: 4 },
    });

    if (!ttAccess || !ttAccess.accessToken) {
      return NextResponse.json({ ok: false, error: "TikTok no conectado" });
    }

    // 🕒 1. LÓGICA DE CACHÉ (24 Horas)
    const now = new Date();
    const lastUpdate = new Date(ttAccess.updatedAt);
    const hoursDiff = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);

    const hasData = ttAccess.avatar && ttAccess.usuarioRed && ttAccess.follows !== null && ttAccess.metricaB !== null;
    const isFresh = hoursDiff < 24;

    // ✅ CAMINO RÁPIDO: Devolver datos de BD
    if (hasData && isFresh) {
      return NextResponse.json({
        ok: true,
        profile: {
          username: ttAccess.usuarioRed, // En TikTok API v2 el display_name es lo principal
          display_name: ttAccess.usuarioRed,
          avatar_url: ttAccess.avatar,   // Ruta local
          follower_count: ttAccess.follows,
          likes_count: ttAccess.metricaB,
        },
      });
    }

    // 🔄 CAMINO LENTO: Actualizar desde API
    console.log("🔄 Actualizando perfil de TikTok desde API...");

    const token = decrypt(ttAccess.accessToken);
    const fields = "avatar_url,display_name,follower_count,likes_count";
    const url = `https://open.tiktokapis.com/v2/user/info/?fields=${fields}`;

    const res = await fetch(url, {
      headers: { "Authorization": `Bearer ${token}` },
    });

    const json = await res.json();

    // Manejo de error de API
    if (json.error && json.error.code !== "ok") {
       console.error("TikTok API Error:", json.error);
       // Si falla y tenemos caché viejo, lo devolvemos como fallback
       if (hasData) {
         return NextResponse.json({
            ok: true,
            profile: {
                username: ttAccess.usuarioRed,
                display_name: ttAccess.usuarioRed,
                avatar_url: ttAccess.avatar,
                follower_count: ttAccess.follows,
                likes_count: ttAccess.metricaB,
            },
            warning: "Could not refresh data, showing cached version."
         });
       }
       throw new Error(json.error.message || "Error al obtener perfil");
    }

    const data = json.data?.user || {};

    // C. Guardar Avatar Local
    const remoteUrl = data.avatar_url;
    let localAvatarUrl = ttAccess.avatar;

    if (remoteUrl) {
        const savedPath = await saveAvatarLocally(remoteUrl, user.id, ttAccess.openId);
        if (savedPath) localAvatarUrl = savedPath;
    }

    // D. Actualizar BD
    await prisma.tikTok_Access.update({
        where: { id: ttAccess.id },
        data: {
            usuarioRed: data.display_name,
            follows: data.follower_count || 0,
            metricaB: data.likes_count || 0,
            avatar: localAvatarUrl,
            updatedAt: new Date(),
        }
    });

    return NextResponse.json({
      ok: true,
      profile: {
        username: data.display_name,
        display_name: data.display_name,
        avatar_url: localAvatarUrl,
        follower_count: data.follower_count || 0,
        likes_count: data.likes_count || 0,
      },
    });

  } catch (error: any) {
    console.error("Profile Error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}