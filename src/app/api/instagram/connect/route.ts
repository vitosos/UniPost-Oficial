// src/app/api/instagram/connect/route.ts

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { attachOAuthState, newOAuthState } from "@/lib/oauthState";

const FB_VERSION = process.env.FACEBOOK_API_VERSION ?? "v21.0";
const INSTAGRAM_APP_ID = process.env.INSTAGRAM_APP_ID!;
const INSTAGRAM_REDIRECT_URI = process.env.INSTAGRAM_REDIRECT_URI!;

export async function GET() {
  const session = await auth();

  if (!session?.user?.email) {
    // Si no hay sesión, lo mandamos al login
    const signInUrl = new URL("/api/auth/signin", process.env.NEXTAUTH_URL);
    return NextResponse.redirect(signInUrl.toString());
  }

  // Buscamos el usuario por email para obtener su id numérico
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    const signInUrl = new URL("/api/auth/signin", process.env.NEXTAUTH_URL);
    return NextResponse.redirect(signInUrl.toString());
  }

  // "state" aleatorio (anti-CSRF), verificado en el callback contra una cookie httpOnly
  const state = newOAuthState();

  const url = new URL(`https://www.facebook.com/${FB_VERSION}/dialog/oauth`);
  url.searchParams.set("client_id", INSTAGRAM_APP_ID);
  url.searchParams.set("redirect_uri", INSTAGRAM_REDIRECT_URI);
  url.searchParams.set("scope",
    // Aquí definimos todos los permisos necesarios que solicitaremos a Meta cuando enlazemos cuentas
    // Probablemente se necesite extender para satisfacer otros requisitos. Si se actualiza
    // Es necesario volver a enlazar la cuenta (pues el Token define que permisos tenemos)
  [
    "instagram_basic",
    "instagram_content_publish",
    "pages_show_list",
    "pages_read_engagement",
    "business_management",
  ].join(",")
);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);

  const res = NextResponse.redirect(url.toString());
  attachOAuthState(res, "instagram", state);
  return res;
}