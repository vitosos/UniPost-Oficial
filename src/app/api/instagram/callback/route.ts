// src/app/api/instagram/callback/route.ts

// El callback lo utiliza Meta para enviarnos los datos correspondientes (principalmente el Token)
// que utilizaremos para todo lo que buscamos (Ver perfil, enviar publicaciones, pedir métricas, etc)

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { verifyOAuthState } from "@/lib/oauthState";
import { getCurrentUser } from "@/lib/session";

const FB_VERSION = process.env.FACEBOOK_API_VERSION ?? "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${FB_VERSION}`;
const APP_ID = process.env.INSTAGRAM_APP_ID;
const APP_SECRET = process.env.INSTAGRAM_APP_SECRET;
const REDIRECT_URI = process.env.INSTAGRAM_REDIRECT_URI;

// 1) Intercambia el "code" por un token de usuario de corta duración (Facebook user access token)
async function exchangeCodeForShortLivedToken(code: string) {
  if (!APP_ID || !APP_SECRET || !REDIRECT_URI) {
    throw new Error(
      `Faltan variables de entorno para Instagram: ` +
        `APP_ID=${!!APP_ID}, APP_SECRET=${!!APP_SECRET}, REDIRECT_URI=${!!REDIRECT_URI}`
    );
  }

  // Endpoint correcto para Facebook Login / Instagram Graph
  const url = new URL(`${GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set("client_id", APP_ID);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("client_secret", APP_SECRET);
  url.searchParams.set("code", code);

  const res = await fetch(url.toString(), { method: "GET" });
  const text = await res.text();

  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `Respuesta inesperada de Facebook al intercambiar code por token: ${text}`
    );
  }

  if (!res.ok) {
    const msg = data.error?.message || text;
    throw new Error(`Error al obtener short-lived token (Graph): ${msg}`);
  }

  // Aquí Facebook devuelve un access_token de usuario y expires_in
  const accessToken = data.access_token as string | undefined;
  const expiresIn = data.expires_in as number | undefined;

  if (!accessToken) {
    throw new Error(
      "Facebook no devolvió un access_token en la respuesta del short-lived token."
    );
  }

  // En este flujo NO te devuelve user_id directamente. No es problema:
  // luego usamos /me y /me/accounts para obtener páginas, etc.
  return {
    accessToken,
    expiresIn,
  };
}

// 2) Intercambia el token corto por uno de larga duración
async function exchangeShortForLongLived(shortLivedToken: string) {
  if (!APP_ID || !APP_SECRET) {
    throw new Error(
      `Faltan APP_ID o APP_SECRET para generar long-lived token.`
    );
  }

  const url = new URL(`${GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", APP_ID);
  url.searchParams.set("client_secret", APP_SECRET);
  url.searchParams.set("fb_exchange_token", shortLivedToken);

  const res = await fetch(url.toString(), { method: "GET" });
  const text = await res.text();

  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `Respuesta inesperada de Facebook al obtener long-lived token: ${text}`
    );
  }

  if (!res.ok) {
    const msg = data.error?.message || text;
    throw new Error(`Error al obtener long-lived token (Graph): ${msg}`);
  }

  const longLivedToken = data.access_token as string | undefined;

  if (!longLivedToken) {
    throw new Error(
      "Facebook no devolvió un long-lived access_token en la respuesta."
    );
  }

  return {
    accessToken: longLivedToken,
    expiresIn: data.expires_in as number | undefined,
  };
}

// 3) Obtiene la cuenta de Instagram Business y el username, a partir del token de larga duración
async function getInstagramAccount(longLivedToken: string) {
  // 3.1) Listar las páginas asociadas al usuario
  const pagesRes = await fetch(
    `${GRAPH_BASE}/me/accounts?fields=id,name`,
    { headers: { Authorization: `Bearer ${longLivedToken}` } }
  );

  const rawText = await pagesRes.text();

  if (!pagesRes.ok) {
    console.error("Error al obtener páginas de Facebook:", pagesRes.status);
    throw new Error("pages_fetch_failed");
  }

  const pagesData = JSON.parse(rawText) as {
    data?: Array<{ id: string; name: string }>;
  };

  if (!pagesData.data || pagesData.data.length === 0) {
    throw new Error(
      "No se encontraron páginas de Facebook asociadas a este usuario."
    );
  }

  const page = pagesData.data[0];
  console.log("✅ Página seleccionada:", page);

  // 3.2) Obtener el instagram_business_account de esa página
  const pageDetailsRes = await fetch(
    `${GRAPH_BASE}/${page.id}?fields=instagram_business_account&access_token=${encodeURIComponent(
      longLivedToken
    )}`
  );

  if (!pageDetailsRes.ok) {
    const text = await pageDetailsRes.text();
    throw new Error(`Error al obtener instagram_business_account: ${text}`);
  }

  const pageDetails = (await pageDetailsRes.json()) as {
    instagram_business_account?: { id: string };
  };

  if (!pageDetails.instagram_business_account?.id) {
    throw new Error(
      "La página seleccionada no tiene vinculada una cuenta de Instagram Business."
    );
  }

  const igUserId = pageDetails.instagram_business_account.id;

  // 3.3) Obtener datos básicos de la cuenta de Instagram (username)
  const igRes = await fetch(
    `${GRAPH_BASE}/${igUserId}?fields=username&access_token=${encodeURIComponent(
      longLivedToken
    )}`
  );

  if (!igRes.ok) {
    const text = await igRes.text();
    throw new Error(`Error al obtener datos de la cuenta de Instagram: ${text}`);
  }

  const igData = (await igRes.json()) as { username: string };

  return {
    igUserId,
    username: igData.username,
  };
}

// Export nombrado GET
export async function GET(req: NextRequest) {
  const incomingUrl = new URL(req.url);
  const baseOrigin = process.env.NEXT_PUBLIC_APP_URL ?? incomingUrl.origin;

  const code = incomingUrl.searchParams.get("code");
  const error = incomingUrl.searchParams.get("error");
  const stateParam = incomingUrl.searchParams.get("state"); // viene desde /api/instagram/connect

  // Si Instagram devuelve error en el OAuth
  if (error) {
    const redirectUrl = new URL(
      `/perfil?instagram_error=${encodeURIComponent(error)}`,
      incomingUrl.origin
    );
    return NextResponse.redirect(redirectUrl);
  }

  if (!code) {
    const redirectUrl = new URL(
      "/perfil?instagram_error=missing_code",
      incomingUrl.origin
    );
    return NextResponse.redirect(redirectUrl);
  }

  if (!stateParam) {
    const redirectUrl = new URL(
      "/perfil?instagram_error=missing_state",
      incomingUrl.origin
    );
    return NextResponse.redirect(redirectUrl);
  }

  // El usuario se toma de la sesión; "state" solo sirve para validar que el flujo lo inició él.
  const stateValid = await verifyOAuthState("instagram", stateParam);
  const sessionUser = stateValid ? await getCurrentUser() : null;
  const appUserId = sessionUser?.id ?? null;

  if (!appUserId) {
    const redirectUrl = new URL(
      "/perfil?instagram_error=invalid_state",
      incomingUrl.origin
    );
    return NextResponse.redirect(redirectUrl);
  }

  try {
    // 1) Intercambiar el code por un short-lived Facebook user token
    const { accessToken: shortLivedUserToken } =
      await exchangeCodeForShortLivedToken(code);

    // 2) Intercambiar por un long-lived token
    const { accessToken: longLivedUserToken } =
      await exchangeShortForLongLived(shortLivedUserToken);

    // 3) Obtener cuenta de Instagram Business + username
    const { igUserId, username } = await getInstagramAccount(longLivedUserToken);

    console.log("✅ Cuenta de Instagram obtenida:", { igUserId, username });

    // 4) Guardar en Prisma en la tabla Instagram_Access
    //    (userId = nuestro usuario; redSocial = 2; usuarioRed = username; accessToken = longLivedUserToken)
    const existing = await prisma.instagram_Access.findFirst({
      where: { userId: appUserId, redSocial: 2 },
    });

    if (existing) {
      await prisma.instagram_Access.update({
        where: { id: existing.id },
        data: {
          usuarioRed: username,
          accessToken: encrypt(longLivedUserToken),
        },
      });
    } else {
      await prisma.instagram_Access.create({
        data: {
          userId: appUserId,
          redSocial: 2,
          usuarioRed: username,
          accessToken: encrypt(longLivedUserToken),
        },
      });
    }

    // 5) Redirección final correcta
    const redirectOk = new URL("/perfil?instagram=linked", baseOrigin);
    return NextResponse.redirect(redirectOk);
  } catch (err: any) {
    console.error("Error en callback de Instagram:", err);
    // Código fijo: no exponer mensajes internos de la API en la URL.
    const redirectError = new URL("/perfil?instagram_error=link_failed", baseOrigin);
    return NextResponse.redirect(redirectError);
  }
}