import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import fs from "fs/promises";
import path from "path";

const GRAPH_VERSION = process.env.FACEBOOK_API_VERSION ?? "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

// Helper para guardar avatar localmente
async function saveAvatarLocally(url: string, userId: number, igUserId: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    
    const buffer = Buffer.from(await res.arrayBuffer());
    
    const uploadDir = path.join(process.cwd(), "public", "uploads", "ig_avatar");
    await fs.mkdir(uploadDir, { recursive: true });
    
    const filename = `ig_${userId}_${igUserId}.jpg`;
    const filePath = path.join(uploadDir, filename);
    
    await fs.writeFile(filePath, buffer);
    return `/uploads/ig_avatar/${filename}`;
  } catch (e) {
    console.error("Error guardando avatar IG:", e);
    return null;
  }
}

// Helper para obtener credenciales frescas desde Meta (Lógica compleja de IG)
async function getInstagramAccountFromMeta(accessToken: string) {
  // 1. Buscar páginas
  const mePages = await fetch(`${GRAPH_BASE}/me/accounts?access_token=${accessToken}`);
  const pagesJson = await mePages.json();
  let page = pagesJson.data?.[0];

  // 2. Si no hay páginas directas, intentar Business Manager (fallback)
  if (!page) {
     const businesses = await fetch(`${GRAPH_BASE}/me/businesses?access_token=${accessToken}`);
     const bizJson = await businesses.json();
     const business = bizJson.data?.[0];
     if (business) {
        const ownedPages = await fetch(`${GRAPH_BASE}/${business.id}/owned_pages?access_token=${accessToken}`);
        const ownedJson = await ownedPages.json();
        page = ownedJson.data?.[0];
     }
  }

  if (!page) throw new Error("No se encontraron páginas de Facebook asociadas.");

  // 3. Obtener ID de Instagram Business vinculado a la página
  const pageDataRes = await fetch(`${GRAPH_BASE}/${page.id}?fields=instagram_business_account&access_token=${accessToken}`);
  const pageData = await pageDataRes.json();

  if (!pageData.instagram_business_account?.id) {
      throw new Error("La página no tiene una cuenta de Instagram Business vinculada.");
  }

  return pageData.instagram_business_account.id;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });

  const igAccess = await prisma.instagram_Access.findFirst({
    where: { userId: user.id, redSocial: 2 },
  });

  if (!igAccess || !igAccess.accessToken) {
    return NextResponse.json({ ok: false, error: "Instagram no conectado" }, { status: 404 });
  }

  // 🕒 1. LÓGICA DE CACHÉ (24 Horas)
  const now = new Date();
  const lastUpdate = new Date(igAccess.updatedAt);
  const hoursDiff = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
  
  const hasData = igAccess.avatar && igAccess.usuarioRed && igAccess.follows !== null && igAccess.metricaB !== null;
  const isFresh = hoursDiff < 24;

  // ✅ CAMINO RÁPIDO: Devolver datos de BD
  if (hasData && isFresh) {
    return NextResponse.json({
      ok: true,
      profile: {
        username: igAccess.usuarioRed,
        followers: igAccess.follows,
        posts: igAccess.metricaB, // Mapeamos metricaB a posts/mediaCount
        profilePictureUrl: igAccess.avatar, // Usamos la ruta local
      },
    });
  }

  // 🔄 CAMINO LENTO: Actualizar desde API
  console.log("🔄 Actualizando perfil de Instagram desde Meta...");

  try {
    const userToken = decrypt(igAccess.accessToken);
    
    // A. Obtener ID de Instagram (puede ser costoso, idealmente lo guardaríamos también)
    const igUserId = await getInstagramAccountFromMeta(userToken);

    // B. Obtener Datos del Perfil
    const fields = "username,profile_picture_url,followers_count,media_count";
    const igUserRes = await fetch(`${GRAPH_BASE}/${igUserId}?fields=${fields}&access_token=${userToken}`);
    const igUser = await igUserRes.json();

    if (igUser.error) throw new Error(igUser.error.message);

    // C. Guardar Avatar Local
    const remoteUrl = igUser.profile_picture_url;
    let localAvatarUrl = igAccess.avatar;

    if (remoteUrl) {
        const savedPath = await saveAvatarLocally(remoteUrl, user.id, igUserId);
        if (savedPath) localAvatarUrl = savedPath;
    }

    // D. Actualizar BD
    await prisma.instagram_Access.update({
        where: { id: igAccess.id },
        data: {
            usuarioRed: igUser.username,
            follows: igUser.followers_count,
            metricaB: igUser.media_count,
            avatar: localAvatarUrl,
            updatedAt: new Date(),
        }
    });

    return NextResponse.json({
      ok: true,
      profile: {
        username: igUser.username,
        followers: igUser.followers_count,
        posts: igUser.media_count,
        profilePictureUrl: localAvatarUrl,
      },
    });

  } catch (error: any) {
    console.error("Instagram Profile Update Error:", error);
    // Fallback: Si falla la API, devolvemos caché viejo si existe
    if (hasData) {
        return NextResponse.json({
            ok: true,
            profile: {
                username: igAccess.usuarioRed,
                followers: igAccess.follows,
                posts: igAccess.metricaB,
                profilePictureUrl: igAccess.avatar,
            },
            warning: "Could not refresh data, showing cached version."
        });
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}