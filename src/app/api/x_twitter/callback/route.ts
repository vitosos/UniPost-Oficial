import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { encrypt } from "@/lib/crypto";
import { TwitterApi } from "twitter-api-v2";
import path from "path";
import fs from "fs/promises";

// Helper Avatar (Igual que antes)
async function saveAvatarLocally(url: string, userId: number, twitterId: string): Promise<string | null> {
    try {
      const res = await fetch(url.replace("_normal", "")); // Truco: quitar _normal para mejor calidad
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

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.unipost.cl";

  if (!session?.user?.email) return NextResponse.redirect(new URL("/login", baseUrl));

  const { searchParams } = new URL(req.url);
  const oauth_token = searchParams.get("oauth_token");
  const oauth_verifier = searchParams.get("oauth_verifier");
  const denied = searchParams.get("denied");

  // Recuperar secreto temporal
  const oauth_token_secret = req.cookies.get("twitter_oauth_secret")?.value;

  if (denied) return NextResponse.redirect(new URL("/perfil?error=twitter_denied", baseUrl));
  if (!oauth_token || !oauth_verifier || !oauth_token_secret) {
    return NextResponse.redirect(new URL("/perfil?error=twitter_invalid_state", baseUrl));
  }

  try {
    // Instancia temporal para verificar
    const client = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY!,
      appSecret: process.env.TWITTER_API_SECRET!,
      accessToken: oauth_token,
      accessSecret: oauth_token_secret,
    });

    // Login definitivo
    const { client: loggedClient, accessToken, accessSecret, userId, screenName } = await client.login(oauth_verifier);

    // Obtener datos extra del perfil (foto)
    const me = await loggedClient.v1.verifyCredentials();
    
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) throw new Error("User missing");

    // Guardar Avatar
    let avatarPath = null;
    if (me.profile_image_url_https) {
        avatarPath = await saveAvatarLocally(me.profile_image_url_https, user.id, userId);
    }

    // Guardar en BD
    const existing = await prisma.x_Access.findFirst({ where: { userId: user.id, redSocial: 5 } });

    const data = {
        userId: user.id,
        redSocial: 5,
        accessToken: encrypt(accessToken),
        accessSecret: encrypt(accessSecret),
        twitterId: userId,
        screenName: screenName,
        avatar: avatarPath || me.profile_image_url_https,
        updatedAt: new Date(), 
    };

    if (existing) {
        await prisma.x_Access.update({ where: { id: existing.id }, data });
    } else {
        await prisma.x_Access.create({ data });
    }

    const res = NextResponse.redirect(new URL("/perfil?twitter=linked", baseUrl));
    res.cookies.delete("twitter_oauth_secret");
    return res;

  } catch (e) {
    console.error("X OAuth 1.0a Error:", e);
    return NextResponse.redirect(new URL("/perfil?error=twitter_failed", baseUrl));
  }
}