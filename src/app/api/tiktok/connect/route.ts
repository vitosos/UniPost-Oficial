import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route"; // Asegúrate de que la ruta a authOptions sea correcta

export async function GET() {
  const session = await getServerSession(authOptions);

  // 1. Si no hay sesión en UniPost, mandar al login
  if (!session?.user?.email) {
    // Usamos NEXTAUTH_URL o fallback a localhost
    const baseUrl = process.env.NEXTAUTH_URL || "http://app.unipost.cl";
    return NextResponse.redirect(new URL("/login", baseUrl));
  }

  // 2. Generar estado aleatorio para seguridad CSRF
  const csrfState = Math.random().toString(36).substring(2);

  // 3. Construir la URL de autorización de TikTok
  const url = new URL("https://www.tiktok.com/v2/auth/authorize/");

  url.searchParams.set("client_key", process.env.TIKTOK_CLIENT_KEY!);
  url.searchParams.set("response_type", "code");
  
  url.searchParams.set("scope", "user.info.basic,user.info.stats,video.upload,video.publish");
  
  url.searchParams.set("redirect_uri", process.env.TIKTOK_REDIRECT_URI!);
  url.searchParams.set("state", csrfState);

  return NextResponse.redirect(url.toString());
}