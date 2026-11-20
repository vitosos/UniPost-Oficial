// Protección CSRF para flujos OAuth: `state` aleatorio guardado en una cookie httpOnly.
// El callback debe comparar el `state` recibido con la cookie y tomar el usuario de la sesión,
// nunca del parámetro `state`.

import crypto from "crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

const MAX_AGE_SECONDS = 10 * 60;

function cookieName(provider: string) {
  return `oauth_state_${provider}`;
}

/** Genera un `state` y lo guarda en una cookie en la respuesta de redirección. */
export function attachOAuthState(res: NextResponse, provider: string, state = crypto.randomBytes(24).toString("base64url")) {
  res.cookies.set(cookieName(provider), state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
  return state;
}

export function newOAuthState() {
  return crypto.randomBytes(24).toString("base64url");
}

/** Verifica (y consume) el `state` del callback contra la cookie. */
export async function verifyOAuthState(provider: string, received: string | null): Promise<boolean> {
  const store = await cookies();
  const expected = store.get(cookieName(provider))?.value;
  store.delete(cookieName(provider));
  if (!expected || !received) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
