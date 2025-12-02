import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { decrypt } from "@/lib/crypto";
import { TwitterApi } from "twitter-api-v2";
import fs from "fs/promises";
import path from "path";

// Helper para guardar avatar localmente (igual que en callback)
async function saveAvatarLocally(url: string, userId: number, twitterId: string): Promise<string | null> {
  try {
    const res = await fetch(url.replace("_normal", "")); // Mejor calidad
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const uploadDir = path.join(process.cwd(), "public", "uploads", "x_avatar");
    await fs.mkdir(uploadDir, { recursive: true });
    const filename = `x_${userId}_${twitterId}.jpg`;
    const filePath = path.join(uploadDir, filename);
    await fs.writeFile(filePath, buffer);
    return `/uploads/x_avatar/${filename}`;
  } catch (e) { return null; }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ ok: false }, { status: 404 });

  const xAccess = await prisma.x_Access.findFirst({
    where: { userId: user.id, redSocial: 5 },
  });

  if (!xAccess) return NextResponse.json({ ok: false, error: "Twitter no conectado" });

  // 1. Validar que tengamos el secret (OAuth 1.0a lo requiere)
  if (!xAccess.accessSecret) {
      return NextResponse.json({ ok: false, error: "Re-link required (OAuth 1.0a update)" });
  }

  // 2. Caché: Si los datos son frescos (< 24h) y tenemos avatar, los devolvemos
  const now = new Date();
  const lastUpdate = new Date(xAccess.updatedAt);
  const hoursDiff = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
  const hasData = xAccess.avatar && xAccess.follows !== null;

  if (hasData && hoursDiff < 24) {
    return NextResponse.json({
      ok: true,
      profile: {
        username: xAccess.usuarioRed,
        name: xAccess.screenName || xAccess.usuarioRed, // screenName es el @handle en v1
        avatar: xAccess.avatar, 
        followers: xAccess.follows,
        tweets: xAccess.metricaB,
      },
    });
  }

  // 3. Actualizar desde API de X (Usando twitter-api-v2)
  try {
    // Instanciamos el cliente con las 4 llaves (Consumer Key/Secret + Access Token/Secret)
    const client = new TwitterApi({
        appKey: process.env.TWITTER_API_KEY!,
        appSecret: process.env.TWITTER_API_SECRET!,
        accessToken: decrypt(xAccess.accessToken),
        accessSecret: decrypt(xAccess.accessSecret),
    });

    // Usamos v2.me() para obtener datos del usuario actual
    const me = await client.v2.me({
        "user.fields": ["profile_image_url", "public_metrics"],
    });

    const data = me.data;
    const metrics = data.public_metrics || {};

    // 4. Procesar y Guardar Avatar Localmente
    const remoteUrl = data.profile_image_url;
    let finalAvatarUrl = xAccess.avatar;

    if (remoteUrl) {
        const savedPath = await saveAvatarLocally(remoteUrl, user.id, xAccess.twitterId);
        if (savedPath) {
            finalAvatarUrl = savedPath;
        } else if (!finalAvatarUrl) {
            finalAvatarUrl = remoteUrl;
        }
    }

    // 5. Actualizar BD
    await prisma.x_Access.update({
        where: { id: xAccess.id },
        data: {
            usuarioRed: data.username, // username es el @handle en v2
            screenName: data.username, 
            avatar: finalAvatarUrl,
            follows: metrics.followers_count || 0,
            metricaB: metrics.tweet_count || 0,
            updatedAt: new Date(),
        }
    });

    return NextResponse.json({
        ok: true,
        profile: {
            username: data.username,
            name: data.name, // name es el nombre visible
            avatar: finalAvatarUrl,
            followers: metrics.followers_count,
            tweets: metrics.tweet_count,
        }
    });

  } catch (error: any) {
    console.error("X Profile Error:", error);
    
    // Fallback a caché si existe
    if (hasData) {
        return NextResponse.json({
            ok: true,
            warning: "Error updating, showing cached data",
            profile: {
                username: xAccess.usuarioRed,
                avatar: xAccess.avatar,
                followers: xAccess.follows,
                tweets: xAccess.metricaB,
            }
        });
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}