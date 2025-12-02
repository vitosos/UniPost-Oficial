// src/app/api/facebook/callback/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";

const FB_VERSION = process.env.FACEBOOK_API_VERSION ?? "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${FB_VERSION}`;

// Reutilizamos las credenciales de la App de Meta
const APP_ID = process.env.INSTAGRAM_APP_ID;
const APP_SECRET = process.env.INSTAGRAM_APP_SECRET;
// Ojo: asegúrate de agregar esta URL en la configuración de la App en Meta Developers
const REDIRECT_URI = process.env.FACEBOOK_REDIRECT_URI; 

// 1) Intercambio de Code -> Token (Idéntico a Instagram)
async function exchangeCodeForShortLivedToken(code: string) {
  if (!APP_ID || !APP_SECRET || !REDIRECT_URI) {
    throw new Error("Faltan variables de entorno para Facebook Callback");
  }

  const url = new URL(`${GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set("client_id", APP_ID);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("client_secret", APP_SECRET);
  url.searchParams.set("code", code);

  const res = await fetch(url.toString(), { method: "GET" });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(`Error short-lived token: ${data.error?.message}`);
  }

  return {
    accessToken: data.access_token as string,
    expiresIn: data.expires_in as number,
  };
}

// 2) Intercambio Token Corto -> Token Largo (Idéntico a Instagram)
async function exchangeShortForLongLived(shortLivedToken: string) {
  const url = new URL(`${GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", APP_ID!);
  url.searchParams.set("client_secret", APP_SECRET!);
  url.searchParams.set("fb_exchange_token", shortLivedToken);

  const res = await fetch(url.toString(), { method: "GET" });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(`Error long-lived token: ${data.error?.message}`);
  }

  return {
    accessToken: data.access_token as string,
    expiresIn: data.expires_in as number,
  };
}

async function getFacebookPage(longLivedUserToken: string) {
  // Obtenemos las páginas donde el usuario tiene rol (CREATE_CONTENT, MANAGE, etc.)
  // Solicitamos el access_token de la página directamente por si lo necesitamos guardar,
  // aunque guardando el User Token podemos generar Page Tokens dinámicamente.
  const pagesRes = await fetch(
    `${GRAPH_BASE}/me/accounts?fields=id,name,access_token&access_token=${encodeURIComponent(longLivedUserToken)}`
  );

  const rawText = await pagesRes.text();
  if (!pagesRes.ok) {
    throw new Error(`Error al obtener páginas de FB: ${rawText}`);
  }

  const pagesData = JSON.parse(rawText) as {
    data?: Array<{ id: string; name: string; access_token: string }>;
  };

  if (!pagesData.data || pagesData.data.length === 0) {
    throw new Error("El usuario no administra ninguna Página de Facebook.");
  }

  // LÓGICA DE SELECCIÓN:
  // Aquí tomamos la primera página encontrada. 
  // En un sistema multi-página, deberías mostrar una UI para que el usuario elija.
  const page = pagesData.data[0];
  
  console.log("✅ Página de Facebook seleccionada:", page.name);

  return {
    pageId: page.id,
    pageName: page.name,
    pageAccessToken: page.access_token, // Token específico para actuar como la página
  };
}

// Export nombrado GET
export async function GET(req: NextRequest) {
  const incomingUrl = new URL(req.url);
  const baseOrigin = process.env.NEXT_PUBLIC_APP_URL ?? incomingUrl.origin;
  const code = incomingUrl.searchParams.get("code");
  const error = incomingUrl.searchParams.get("error");
  const stateParam = incomingUrl.searchParams.get("state");

  if (error) {
    return NextResponse.redirect(new URL(`/perfil?fb_error=${encodeURIComponent(error)}`, baseOrigin));
  }
  if (!code || !stateParam) {
    return NextResponse.redirect(new URL("/perfil?fb_error=missing_params", baseOrigin));
  }

  let appUserId: number | null = null;
  try {
    appUserId = parseInt(decodeURIComponent(stateParam), 10);
  } catch {}

  if (!appUserId) {
    return NextResponse.redirect(new URL("/perfil?fb_error=invalid_state", baseOrigin));
  }

  try {
    // 1. Obtener Token Usuario (Short)
    const { accessToken: shortToken } = await exchangeCodeForShortLivedToken(code);

    // 2. Obtener Token Usuario (Long)
    const { accessToken: longToken } = await exchangeShortForLongLived(shortToken);

    // 3. Obtener Datos de la Página
    const { pageId, pageName } = await getFacebookPage(longToken);

    // 4. Guardar en Prisma (Tabla Facebook_Access)
    // Asumimos RedSocial ID = 3 para Facebook
    // Guardamos el User Token (longToken) porque permite administrar cualquier página del usuario
    // y obtener el Page Token cuando sea necesario publicar.
    
    // NOTA: Asegúrate de haber creado el modelo Facebook_Access en tu schema.prisma
    // Si no existe, typescript se quejará aquí.
    const existing = await prisma.facebook_Access.findFirst({
      where: { userId: appUserId, redSocial: 3 },
    });

    if (existing) {
      await prisma.facebook_Access.update({
        where: { id: existing.id },
        data: {
          usuarioRed: pageName, // Guardamos el nombre de la página como referencia visual
          accessToken: longToken,
          // Podrías guardar pageId en una columna extra si quieres fijar una página específica
        },
      });
    } else {
      await prisma.facebook_Access.create({
        data: {
          userId: appUserId,
          redSocial: 3,
          usuarioRed: pageName,
          accessToken: encrypt(longToken),
        },
      });
    }

    return NextResponse.redirect(new URL("/perfil?facebook=linked", baseOrigin));

  } catch (err: any) {
    console.error("Error en callback de Facebook:", err);
    const msg = err instanceof Error ? err.message : "unknown_error";
    return NextResponse.redirect(new URL(`/perfil?fb_error=${encodeURIComponent(msg)}`, baseOrigin));
  }
}