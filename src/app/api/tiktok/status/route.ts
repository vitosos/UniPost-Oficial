import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { decrypt, encrypt } from "@/lib/crypto";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ ok: false }, { status: 404 });

  const access = await prisma.tikTok_Access.findFirst({
    where: { userId: user.id, redSocial: 4 },
  });

  if (!access) {
    return NextResponse.json({ ok: true, linked: false });
  }

  // VERIFICACIÓN DE CADUCIDAD Y AUTO-REFRESH
  let isExpired = false;
  
  // TikTok tokens duran aprox 86400 segundos (24h). 
  // Calculamos si ya venció o está por vencer (damos 5 min de margen).
  const expiresInMs = (access.expiresIn || 86400) * 1000;
  const expirationDate = new Date(access.updatedAt.getTime() + expiresInMs);
  const now = new Date();
  
  // Si falta menos de 5 minutos para vencer o ya venció...
  if (now.getTime() > (expirationDate.getTime() - 5 * 60 * 1000)) {
    console.log("🔄 Token de TikTok vencido. Intentando auto-refresh...");
    
    try {
        // Intentar renovar credenciales
        const refreshToken = decrypt(access.refreshToken || "");
        
        const params = new URLSearchParams();
        params.append("client_key", process.env.TIKTOK_CLIENT_KEY!);
        params.append("client_secret", process.env.TIKTOK_CLIENT_SECRET!);
        params.append("grant_type", "refresh_token");
        params.append("refresh_token", refreshToken);

        const refreshRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params,
        });

        const refreshData = await refreshRes.json();

        if (refreshData.error || !refreshData.access_token) {
            console.error("❌ Error Auto-Refresh TikTok:", refreshData);
            isExpired = true; // Falló el refresh, marcamos como expirado real
        } else {
            // Guardamos los nuevos tokens
            await prisma.tikTok_Access.update({
                where: { id: access.id },
                data: {
                    accessToken: encrypt(refreshData.access_token),
                    refreshToken: encrypt(refreshData.refresh_token), // TikTok rota el refresh token también
                    expiresIn: refreshData.expires_in,
                    updatedAt: new Date(), // Importante actualizar la fecha base
                }
            });
            console.log("✅ Token de TikTok renovado exitosamente.");
            isExpired = false; // Ya no está expirado
        }

    } catch (e) {
        console.error("Error de conexión al refrescar TikTok:", e);
        isExpired = true;
    }
  }

  return NextResponse.json({
    ok: true,
    linked: true,
    username: "Cuenta de TikTok",
    expired: isExpired,
  });
}