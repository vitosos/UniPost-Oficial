import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import fs from "fs/promises";
import path from "path";

const GRAPH_VERSION = process.env.FACEBOOK_API_VERSION ?? "v21.0";

// Función auxiliar para guardar imagen localmente
async function saveAvatarLocally(url: string, userId: number, pageId: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    
    const buffer = Buffer.from(await res.arrayBuffer());
    
    // Definir directorio: public/uploads/fb_avatar
    const uploadDir = path.join(process.cwd(), "public", "uploads", "fb_avatar");
    await fs.mkdir(uploadDir, { recursive: true });
    
    const filename = `fb_${userId}_${pageId}.jpg`; // Nombre único por usuario/página
    const filePath = path.join(uploadDir, filename);
    
    await fs.writeFile(filePath, buffer);
    
    return `/uploads/fb_avatar/${filename}`; // URL pública
  } catch (e) {
    console.error("Error guardando avatar FB:", e);
    return null;
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });

  const fbAccess = await prisma.facebook_Access.findFirst({
    where: { userId: user.id, redSocial: 3 },
  });

  if (!fbAccess || !fbAccess.accessToken) {
    return NextResponse.json({ ok: false, error: "No Facebook linked" }, { status: 404 });
  }

  // 🕒 1. LÓGICA DE CACHÉ (Smart Check)
  const now = new Date();
  const lastUpdate = new Date(fbAccess.updatedAt);
  const hoursDiff = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
  
  // ¿Tenemos datos válidos?
  const hasData = fbAccess.avatar && fbAccess.usuarioRed && fbAccess.follows !== null && fbAccess.metricaB !== null;
  
  // ¿Están frescos? (< 24 horas)
  const isFresh = hoursDiff < 24;

  // ✅ CAMINO RÁPIDO: Devolver datos de BD si todo está bien
  if (hasData && isFresh) {
    //console.log("⚡ Usando caché local de Facebook");
    return NextResponse.json({
      ok: true,
      profile: {
        name: fbAccess.usuarioRed,
        followers_count: fbAccess.follows,
        fan_count: fbAccess.metricaB,
        picture: { data: { url: fbAccess.avatar } }, // Mantenemos estructura para el frontend
      },
    });
  }

  // 🔄 CAMINO LENTO: Actualizar desde API (Si falta data o expiró)
  console.log("🔄 Actualizando perfil de Facebook desde Meta...");

  try {
    const userToken = decrypt(fbAccess.accessToken);

    // A. Obtener Página
    const accountsRes = await fetch(
        `https://graph.facebook.com/${GRAPH_VERSION}/me/accounts?access_token=${userToken}`
    );
    const accountsData = await accountsRes.json();
    const page = accountsData.data?.[0]; // O usar lógica de selección si guardaste pageId

    if (!page) {
         return NextResponse.json({ ok: false, error: "Page not found in Meta" });
    }

    // B. Obtener Datos Frescos
    const fields = "id,name,fan_count,followers_count,picture.width(300){url}";
    const pageDetailsRes = await fetch(
        `https://graph.facebook.com/${GRAPH_VERSION}/${page.id}?fields=${fields}&access_token=${page.access_token}`
    );
    const pageDetails = await pageDetailsRes.json();

    if (pageDetails.error) throw new Error(pageDetails.error.message);

    // C. Guardar Avatar Localmente
    const remoteAvatarUrl = pageDetails.picture?.data?.url;
    let localAvatarUrl = fbAccess.avatar; // Mantener el viejo si falla el nuevo

    if (remoteAvatarUrl) {
        const savedPath = await saveAvatarLocally(remoteAvatarUrl, user.id, page.id);
        if (savedPath) localAvatarUrl = savedPath;
    }

    // D. Actualizar Base de Datos
    await prisma.facebook_Access.update({
        where: { id: fbAccess.id },
        data: {
            usuarioRed: pageDetails.name,
            follows: pageDetails.followers_count,
            metricaB: pageDetails.fan_count,
            avatar: localAvatarUrl,
            updatedAt: new Date(), // Reiniciamos el contador de 24h
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
    console.error("Facebook Profile Update Error:", error);
    // Si falla la API pero tenemos datos viejos, devolvemos los viejos como fallback
    if (hasData) {
        return NextResponse.json({
            ok: true,
            profile: {
                name: fbAccess.usuarioRed,
                followers_count: fbAccess.follows,
                fan_count: fbAccess.metricaB,
                picture: { data: { url: fbAccess.avatar } },
            },
            warning: "Could not refresh data, showing cached version."
        });
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}