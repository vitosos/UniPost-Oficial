// src/app/api/facebook/connect/route.ts

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth"; // O tu path a auth
import { prisma } from "@/lib/prisma";

const FB_VERSION = process.env.FACEBOOK_API_VERSION ?? "v21.0";
// Puedes usar las mismas credenciales si es la misma App en Meta
const FACEBOOK_APP_ID = process.env.INSTAGRAM_APP_ID!; 
const FACEBOOK_REDIRECT_URI = process.env.FACEBOOK_REDIRECT_URI!;

export async function GET() {
  const session = await auth();

  if (!session?.user?.email) {
    const signInUrl = new URL("/api/auth/signin", process.env.NEXTAUTH_URL);
    return NextResponse.redirect(signInUrl.toString());
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    const signInUrl = new URL("/api/auth/signin", process.env.NEXTAUTH_URL);
    return NextResponse.redirect(signInUrl.toString());
  }

  const state = encodeURIComponent(String(user.id));

  const url = new URL(`https://www.facebook.com/${FB_VERSION}/dialog/oauth`);
  url.searchParams.set("client_id", FACEBOOK_APP_ID);
  url.searchParams.set("redirect_uri", FACEBOOK_REDIRECT_URI);
  
  url.searchParams.set("scope",
    [
      "pages_show_list",       // Ver las páginas del usuario
      "pages_read_engagement", // Leer comentarios/métricas
      "pages_manage_posts",    // Crear publicaciones (posts)
      "pages_manage_metadata", // Necesario para subir videos
      "business_management",   // A veces requerido para cuentas comerciales
    ].join(",")
  );
  
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);

  return NextResponse.redirect(url.toString());
}