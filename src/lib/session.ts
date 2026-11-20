// Helpers de sesión y autorización para route handlers.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export type SessionUser = {
  id: number;
  email: string;
  name: string | null;
  roleID: bigint | null;
  organizationId: number | null;
};

/** Rol global >= 4 = administrador de la plataforma. */
export function isSuperAdmin(user: Pick<SessionUser, "roleID">) {
  return Number(user.roleID ?? 0) >= 4;
}

/** Devuelve el usuario autenticado (desde la BD) o null. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return null;
  return prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, roleID: true, organizationId: true },
  });
}

export function unauthorized() {
  return NextResponse.json({ ok: false, error: "NOT_AUTHENTICATED" }, { status: 401 });
}

export function forbidden() {
  return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
}

/**
 * ¿Puede `requester` ver los datos (perfiles/métricas) de `targetUserId`?
 * Permitido para: el propio usuario, super admins, o Managers de la misma organización.
 */
export async function canAccessUserData(requester: SessionUser, targetUserId: number): Promise<boolean> {
  if (!Number.isInteger(targetUserId) || targetUserId <= 0) return false;
  if (requester.id === targetUserId) return true;
  if (isSuperAdmin(requester)) return true;

  const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: { organizationId: true } });
  if (!target?.organizationId || target.organizationId !== requester.organizationId) return false;

  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId: requester.id, organizationId: target.organizationId } },
    select: { role: true },
  });
  return membership?.role === "Manager";
}

/**
 * Resuelve el userId objetivo de una petición con `?userId=` opcional.
 * Devuelve el id permitido, o una respuesta de error lista para retornar.
 */
export async function resolveTargetUser(req: Request): Promise<{ user: SessionUser; targetUserId: number } | { error: NextResponse }> {
  const user = await getCurrentUser();
  if (!user) return { error: unauthorized() };

  const param = new URL(req.url).searchParams.get("userId");
  if (!param) return { user, targetUserId: user.id };

  const targetUserId = Number(param);
  if (!(await canAccessUserData(user, targetUserId))) return { error: forbidden() };
  return { user, targetUserId };
}
