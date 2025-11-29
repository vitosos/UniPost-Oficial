import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import fs from "fs/promises";
import path from "path";

const GRAPH_VERSION = process.env.FACEBOOK_API_VERSION ?? "v21.0";

async function saveAvatarLocally(url: string, userId: number, pageId: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const uploadDir = path.join(process.cwd(), "public", "uploads", "fb_avatar");
    await fs.mkdir(uploadDir, { recursive: true });
    const filename = `fb_${userId}_${pageId}.jpg`; 
    const filePath = path.join(uploadDir, filename);
    await fs.writeFile(filePath, buffer);
    return `/uploads/fb_avatar/${filename}`; 
  } catch (e) {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  // 1. Determinar Usuario
  let targetUserId: number;
  const { searchParams } = new URL(req.url);
  const queryId = searchParams.get("userId");

  if (queryId) {
      targetUserId = Number(queryId);
  } else {
      const currentUser = await prisma.user.findUnique({ where: { email: session.user.email } });
      if (!currentUser) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
      targetUserId = currentUser.id;
  }

  // 2. Buscar Credenciales
  const fbAccess = await prisma.facebook_Access.findFirst({
    where: { userId: targetUserId, redSocial: 3 },
  });

  if (!fbAccess || !fbAccess.accessToken) {
    return NextResponse.json({ ok: false, error: "No Facebook linked" }); // 200 OK con error lógico para que el front lo maneje suave
  }

  // Caché
  const now = new Date();
  const lastUpdate = new Date(fbAccess.updatedAt);
  const hoursDiff = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
  const hasData = fbAccess.avatar && fbAccess.usuarioRed && fbAccess.follows !== null;
  
  if (hasData && hoursDiff < 24) {
    return NextResponse.json({
      ok: true,
      profile: {
        name: fbAccess.usuarioRed,
        followers_count: fbAccess.follows,
        fan_count: fbAccess.metricaB,
        picture: { data: { url: fbAccess.avatar } }, 
      },
    });
  }

  try {
    const userToken = decrypt(fbAccess.accessToken);

    const accountsRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/me/accounts?access_token=${userToken}`);
    const accountsData = await accountsRes.json();
    const page = accountsData.data?.[0];

    if (!page) return NextResponse.json({ ok: false, error: "Page not found" });

    const fields = "id,name,fan_count,followers_count,picture.width(300){url}";
    const pageDetailsRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${page.id}?fields=${fields}&access_token=${page.access_token}`);
    const pageDetails = await pageDetailsRes.json();

    if (pageDetails.error) throw new Error(pageDetails.error.message);

    const remoteAvatarUrl = pageDetails.picture?.data?.url;
    let localAvatarUrl = fbAccess.avatar;

    if (remoteAvatarUrl) {
        const savedPath = await saveAvatarLocally(remoteAvatarUrl, targetUserId, page.id);
        if (savedPath) localAvatarUrl = savedPath;
    }

    await prisma.facebook_Access.update({
        where: { id: fbAccess.id },
        data: {
            usuarioRed: pageDetails.name,
            follows: pageDetails.followers_count,
            metricaB: pageDetails.fan_count,
            avatar: localAvatarUrl,
            updatedAt: new Date(),
        }
    });

    return NextResponse.json({
      ok: true,
      profile: {
        name: pageDetails.name,
        followers_count: pageDetails.followers_count,
        fan_count: pageDetails.fan_count,
        picture: { data: { url: localAvatarUrl } },
      },
    });

  } catch (error: any) {
    if (hasData) {
        return NextResponse.json({
            ok: true,
            profile: {
                name: fbAccess.usuarioRed,
                followers_count: fbAccess.follows,
                fan_count: fbAccess.metricaB,
                picture: { data: { url: fbAccess.avatar } },
            },
        });
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}