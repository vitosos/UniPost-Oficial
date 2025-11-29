import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { AtpAgent } from "@atproto/api";
import { decryptBlueskySecret } from "@/lib/cryptoBluesky"; // O tu utilidad de desencriptar
import fs from "fs/promises";
import path from "path";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// Helper para guardar avatar localmente
async function saveAvatarLocally(url: string, userId: number, handle: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    
    const buffer = Buffer.from(await res.arrayBuffer());
    
    // Carpeta específica
    const uploadDir = path.join(process.cwd(), "public", "uploads", "bsky_avatar");
    await fs.mkdir(uploadDir, { recursive: true });
    
    // Limpiamos el handle para que sea un nombre de archivo válido
    const cleanHandle = handle.replace(/[^a-zA-Z0-9]/g, "_");
    const filename = `bsky_${userId}_${cleanHandle}.jpg`;
    const filePath = path.join(uploadDir, filename);
    
    await fs.writeFile(filePath, buffer);
    return `/uploads/bsky_avatar/${filename}`;
  } catch (e) {
    console.error("Error guardando avatar Bsky:", e);
    return null;
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });

    const access = await prisma.blueSky_Access.findFirst({
      where: { usuarioId: user.id }, // Asegúrate de usar userId o usuarioId según tu schema final
    });

    if (!access) return NextResponse.json({ ok: false, error: "No Bluesky access found" });

    // 🕒 1. LÓGICA DE CACHÉ (24 Horas)
    const now = new Date();
    const lastUpdate = new Date(access.updatedAt);
    const hoursDiff = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);

    const hasData = access.avatar && access.displayName && access.follows !== null && access.metricaB !== null;
    const isFresh = hoursDiff < 24;

    // ✅ CAMINO RÁPIDO: Cache
    if (hasData && isFresh) {
        return NextResponse.json({
            ok: true,
            profile: {
                avatar: access.avatar,
                displayName: access.displayName,
                handle: access.nombreUsuario,
                followers: access.follows,
                posts: access.metricaB,
            },
        });
    }

    // 🔄 CAMINO LENTO: API
    console.log("🔄 Actualizando perfil de Bluesky desde API...");

    const decryptedPassword = decryptBlueskySecret(access.appPassword);
    const agent = new AtpAgent({ service: "https://bsky.social" });

    await agent.login({
      identifier: access.nombreUsuario,
      password: decryptedPassword,
    });

    const response = await agent.app.bsky.actor.getProfile({
      actor: agent.session?.did!,
    });

    const data = response.data;

    // Guardar Avatar Local
    const remoteUrl = data.avatar;
    let localAvatarUrl = access.avatar;

    if (remoteUrl) {
        const savedPath = await saveAvatarLocally(remoteUrl, user.id, access.nombreUsuario);
        if (savedPath) localAvatarUrl = savedPath;
    }

    // Actualizar BD
    await prisma.blueSky_Access.update({
        where: { id: access.id },
        data: {
            displayName: data.displayName,
            follows: data.followersCount || 0,
            metricaB: data.postsCount || 0,
            avatar: localAvatarUrl,
            updatedAt: new Date(),
        }
    });

    return NextResponse.json({
      ok: true,
      profile: {
        avatar: localAvatarUrl,
        displayName: data.displayName,
        handle: data.handle,
        followers: data.followersCount,
        posts: data.postsCount,
      },
    });

  } catch (err: any) {
    console.error("Bluesky Profile Error:", err);
    // Fallback de caché si la API falla
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}