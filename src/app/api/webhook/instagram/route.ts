// app/api/webhook/instagram/route.ts

import crypto from "crypto";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const expected = process.env.META_VERIFY_TOKEN;
  if (mode === "subscribe" && expected && token === expected && challenge) {
    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  return new Response("Verification failed", { status: 403 });
}

/** Verifica la firma X-Hub-Signature-256 que Meta agrega a cada evento. */
function isValidSignature(rawBody: string, header: string | null) {
  const secret = process.env.INSTAGRAM_APP_SECRET;
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = Buffer.from(crypto.createHmac("sha256", secret).update(rawBody).digest("hex"));
  const received = Buffer.from(header.slice("sha256=".length));
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  if (!isValidSignature(rawBody, req.headers.get("x-hub-signature-256"))) {
    return new Response("Invalid signature", { status: 401 });
  }

  try {
    const body = JSON.parse(rawBody);
    // Aquí puedes manejar cada evento según lo necesites (comentarios, cambios en medios, etc.)
    console.log("📩 Webhook recibido de Meta:", body?.object, Array.isArray(body?.entry) ? body.entry.length : 0, "entradas");
    return new Response("EVENT_RECEIVED", { status: 200 });
  } catch (error) {
    console.error("❌ Error en webhook:", error);
    return new Response("Error", { status: 400 });
  }
}
