import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// Helper para serializar BigInt (por si usas BigInt en IDs o Roles)
function serializeBigInt(obj: any) {
  return JSON.parse(
    JSON.stringify(obj, (key, value) =>
      typeof value === "bigint" ? Number(value) : value
    )
  );
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.email) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, roleID: true, organizationId: true },
  });

  if (!user) {
    return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
  }

  const roleId = Number(user.roleID || 0);
  const { searchParams } = new URL(request.url);
  const queryOrgId = searchParams.get("orgId");
  
  // Roles 4 y 5 son Super Admin / Staff
  const isSuperAdmin = roleId >= 4;
  
  let targetOrgId = user.organizationId;
  if (isSuperAdmin && queryOrgId) {
    targetOrgId = parseInt(queryOrgId);
  }

  try {
    let responseData: any = {
      isSuperAdmin,
      userOrgId: user.organizationId,
      currentUserRole: "None", // Rol dentro de la organización (Miembro/Manager)
      members: [],
      orphanedUsers: [],
    };

    if (isSuperAdmin) {
      const allOrgs = await prisma.organization.findMany({ orderBy: { id: 'asc' } });
      responseData.organizations = allOrgs;

      const orphans = await prisma.user.findMany({
        where: { organizationId: null },
        select: { id: true, name: true, email: true, roleID: true },
        orderBy: { id: 'desc' }
      });
      responseData.orphanedUsers = orphans;
    }

    if (targetOrgId) {
        // 1. Obtener el Rol de Membresía del usuario ACTUAL en esta organización
        const currentMembership = await prisma.membership.findFirst({
            where: { userId: user.id, organizationId: targetOrgId },
            select: { role: true }
        });
        responseData.currentUserRole = currentMembership?.role || "None";

        // 2. Métricas Globales
        const metricsAggregate = await prisma.metric.aggregate({
            _sum: { likes: true, comments: true },
            where: { post: { organizationId: targetOrgId } },
        });

        const publishedCount = await prisma.variant.count({
            where: { status: "PUBLISHED", post: { organizationId: targetOrgId } },
        });

        responseData.metrics = {
            likes: metricsAggregate._sum.likes || 0,
            comments: metricsAggregate._sum.comments || 0,
            publishedPosts: publishedCount,
            organizationId: targetOrgId,
        };

        // 3. Obtener Miembros con su Rol de Membresía
        const dbMembers = await prisma.user.findMany({
            where: { organizationId: targetOrgId },
            select: { 
                id: true, 
                name: true, 
                email: true, 
                roleID: true,
                image: true,
                // Obtenemos la membresía específica de esta organización
                memberships: {
                    where: { organizationId: targetOrgId },
                    select: { role: true }
                },
                // Estadísticas simples (agrupadas manual o via query separada)
                posts: {
                    select: {
                        metrics: { select: { likes: true } },
                        variants: { where: { status: "PUBLISHED" }, select: { id: true } }
                    }
                }
            },
        });

        responseData.members = dbMembers.map((member) => {
            // Calcular totales
            let totalPosts = 0;
            let totalLikes = 0;
            member.posts.forEach(p => {
                totalPosts += p.variants.length; // o 1 por post
                totalLikes += p.metrics.reduce((acc, m) => acc + m.likes, 0);
            });

            return {
                id: member.id,
                name: member.name || "Sin nombre",
                email: member.email,
                globalRoleId: member.roleID, // Rol del sistema (1,2,3,4,5)
                membershipRole: member.memberships[0]?.role || "Miembro", // Rol en la org
                image: member.image,
                totalPosts,
                totalLikes,
            };
        });
    }

    return NextResponse.json({ ok: true, data: serializeBigInt(responseData) });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}

// Crear Organización (Solo Super Admin)
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  const roleId = Number(user?.roleID || 0);

  if (roleId < 4) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const { name, plan } = await request.json();

  try {
    const newOrg = await prisma.organization.create({
      data: { name, plan: plan || "FREE" },
    });
    return NextResponse.json({ ok: true, data: newOrg });
  } catch (error) {
    return NextResponse.json({ ok: false, error: "Error creating org" });
  }
}

// DELETE: Borrar Organización
export async function DELETE(request: Request) {
    // ... (Lógica de delete existente o similar a la anterior)
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ ok: false }, { status: 401 });
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (Number(user?.roleID || 0) < 4) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get("id"));
    
    try {
        await prisma.organization.delete({ where: { id } });
        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ ok: false, error: "Error deleting" });
    }
}

// PUT: Asignar Usuario a Organización (Assign/Move)
export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false }, { status: 401 });

  const requester = await prisma.user.findUnique({ where: { email: session.user.email } });
  const requesterRole = Number(requester?.roleID || 0);

  if (requesterRole < 4) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const { userId, newOrgId } = await request.json();

  try {
    const targetUser = await prisma.user.findUnique({ where: { id: Number(userId) } });
    if (!targetUser) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
    
    // Evitar mover a otros super admins si se desea
    if (Number(targetUser.roleID) >= 4) return NextResponse.json({ ok: false, error: "Cannot move admins" }, { status: 403 });

    // TRANSACCIÓN: Actualizar Usuario + Crear Membresía
    await prisma.$transaction(async (tx) => {
        // 1. Actualizar puntero en User
        await tx.user.update({
            where: { id: Number(userId) },
            data: { organizationId: Number(newOrgId) },
        });

        // 2. Eliminar membresía anterior si existe (opcional, para evitar duplicados limpios)
        // Ojo: Si tu lógica permite historial, no borres. Si es "una org a la vez", sí.
        // Asumiendo unicidad por tabla Membership:
        await tx.membership.deleteMany({
            where: { userId: Number(userId) } // Borra de todas las orgs anteriores
        });

        // 3. Crear nueva membresía con rol "Miembro"
        await tx.membership.create({
            data: {
                userId: Number(userId),
                organizationId: Number(newOrgId),
                role: "Miembro" // Default solicitado
            }
        });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Error moving user" }, { status: 500 });
  }
}

// PATCH: Cambiar Rol de Membresía (Miembro <-> Manager)
export async function PATCH(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ ok: false }, { status: 401 });
  
    const requester = await prisma.user.findUnique({ where: { email: session.user.email } });
    const requesterRole = Number(requester?.roleID || 0);
  
    // Solo roles 4 o 5 pueden cambiar roles internos
    if (requesterRole < 4) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  
    const { userId, organizationId, newRole } = await request.json();

    if (!["Miembro", "Manager"].includes(newRole)) {
        return NextResponse.json({ ok: false, error: "Invalid role" }, { status: 400 });
    }
  
    try {
        // Actualizar tabla Membership usando la clave compuesta única (si la tienes configurada en schema)
        // O buscando por userId + orgId
        const membership = await prisma.membership.findFirst({
            where: { userId: Number(userId), organizationId: Number(organizationId) }
        });

        if (!membership) return NextResponse.json({ ok: false, error: "Membership not found" }, { status: 404 });

        await prisma.membership.update({
            where: { id: membership.id },
            data: { role: newRole }
        });
  
      return NextResponse.json({ ok: true });
    } catch (error) {
      console.error(error);
      return NextResponse.json({ ok: false, error: "Error updating role" }, { status: 500 });
    }
  }