// Códigos de un solo uso (verificación de correo y recuperación de contraseña).
//
// Se reutiliza la tabla VerificationToken sin cambiar el esquema:
//   identifier = "<propósito>:<email>"   → los códigos de verificación y de reset no son intercambiables
//   token      = "<hmac>.<intentos>"     → el código nunca se guarda en texto plano y se cuentan los intentos fallidos
//   expires    = fecha de expiración

import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export type OtpPurpose = "verify" | "reset";

const TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

function secret() {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET is not set");
  return s;
}

function identifierFor(purpose: OtpPurpose, email: string) {
  return `${purpose}:${email.toLowerCase()}`;
}

function hashCode(identifier: string, code: string) {
  return crypto.createHmac("sha256", secret()).update(`${identifier}:${code}`).digest("hex");
}

/**
 * Crea un nuevo código y reemplaza cualquier código previo del mismo propósito.
 * Devuelve null si se pidió otro código hace menos de RESEND_COOLDOWN_MS.
 */
export async function issueOtp(purpose: OtpPurpose, email: string): Promise<string | null> {
  const identifier = identifierFor(purpose, email);

  const existing = await prisma.verificationToken.findFirst({ where: { identifier } });
  if (existing) {
    const issuedAt = existing.expires.getTime() - TTL_MS;
    if (Date.now() - issuedAt < RESEND_COOLDOWN_MS) return null;
  }

  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { identifier } }),
    prisma.verificationToken.create({
      data: { identifier, token: `${hashCode(identifier, code)}.0`, expires: new Date(Date.now() + TTL_MS) },
    }),
  ]);
  return code;
}

/**
 * Valida un código. Si es correcto lo consume (un solo uso).
 * Tras MAX_ATTEMPTS intentos fallidos el código se invalida.
 */
export async function consumeOtp(purpose: OtpPurpose, email: string, code: string): Promise<boolean> {
  const identifier = identifierFor(purpose, email);
  const record = await prisma.verificationToken.findFirst({ where: { identifier } });
  if (!record) return false;

  if (record.expires.getTime() < Date.now()) {
    await prisma.verificationToken.delete({ where: { id: record.id } }).catch(() => {});
    return false;
  }

  const [storedHash, attemptsStr] = record.token.split(".");
  const attempts = Number(attemptsStr) || 0;
  const expected = Buffer.from(storedHash, "hex");
  const actual = Buffer.from(hashCode(identifier, code), "hex");
  const valid = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);

  if (valid) {
    await prisma.verificationToken.delete({ where: { id: record.id } }).catch(() => {});
    return true;
  }

  if (attempts + 1 >= MAX_ATTEMPTS) {
    await prisma.verificationToken.delete({ where: { id: record.id } }).catch(() => {});
  } else {
    await prisma.verificationToken.update({ where: { id: record.id }, data: { token: `${storedHash}.${attempts + 1}` } });
  }
  return false;
}

export function isOtpFormat(code: unknown): code is string {
  return typeof code === "string" && /^\d{6}$/.test(code);
}
