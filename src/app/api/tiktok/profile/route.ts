import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { decrypt } from "@/lib/crypto";
import fs from "fs/promises";
import path from "path";

async function saveAvatarLocally(url: string, userId: number, openId: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const uploadDir = path.join(process.cwd(), "public", "uploads", "tt_avatar");
    await fs.mkdir(uploadDir, { recursive: true });
    const filename = `tt_${userId}_${openId}.jpg`;
    const filePath = path.join(uploadDir, filename);
    await fs.writeFile(filePath, buffer);
    return `/uploads/tt_avatar/${filename}`;
  } catch (e) { return null; }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ ok: false }, { status: 401 });

    // 1. Determinar Usuario
    let targetUserId: number;
    const { searchParams } = new URL(req.url);
    const queryId = searchParams.get("userId");

    if (queryId) {
        targetUserId = Number(queryId);
    } else {
        const currentUser = await prisma.user.findUnique({ where: { email: session.user.email } });
        if (!currentUser) return NextResponse.json({ ok: false }, { status: 404 });
        targetUserId = currentUser.id;
    }

    const ttAccess = await prisma.tikTok_Access.findFirst({
      where: { userId: targetUserId, redSocial: 4 },
    });

    if (!ttAccess || !ttAccess.accessToken) {
      return NextResponse.json({ ok: false, error: "TikTok no conectado" });
    }

    const now = new Date();
    const lastUpdate = new Date(ttAccess.updatedAt);
    const hoursDiff = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
    const hasData = ttAccess.avatar && ttAccess.usuarioRed;
    
    if (hasData && hoursDiff < 24) {
      return NextResponse.json({
        ok: true,
        profile: {
          username: ttAccess.usuarioRed,
          display_name: ttAccess.usuarioRed,
          avatar_url: ttAccess.avatar,
          follower_count: ttAccess.follows,
          likes_count: ttAccess.metricaB,
        },
      });
    }

    // Actualizar desde API
    const token = decrypt(ttAccess.accessToken);
    const fields = "avatar_url,display_name,follower_count,likes_count";
    const url = `https://open.tiktokapis.com/v2/user/info/?fields=${fields}`;

    const res = await fetch(url, {
      headers: { "Authorization": `Bearer ${token}` },
    });

    const json = await res.json();

    if (json.error && json.error.code !== "ok") {
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
         });
       }
       throw new Error(json.error.message || "Error al obtener perfil");
    }

    const data = json.data?.user || {};
    const remoteUrl = data.avatar_url;
    let localAvatarUrl = ttAccess.avatar;

    if (remoteUrl) {
        const savedPath = await saveAvatarLocally(remoteUrl, targetUserId, ttAccess.openId);
        if (savedPath) localAvatarUrl = savedPath;
    }

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
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}