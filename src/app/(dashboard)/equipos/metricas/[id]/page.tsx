import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import MetricsDashboard from "@/components/MetricsDashboard";
import { prisma } from "@/lib/prisma";
import { canAccessUserData, getCurrentUser } from "@/lib/session";
import { toPositiveInt } from "@/lib/validation";

export default async function MemberMetricsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = toPositiveInt(id);
  if (!userId) notFound();

  const requester = await getCurrentUser();
  if (!requester) redirect("/login");
  // Solo uno mismo, un Manager de la misma organización o un super admin.
  if (!(await canAccessUserData(requester, userId))) notFound();

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  if (!user) notFound();

  return (
    <div>
      <div className="mx-auto mb-4 max-w-6xl">
        <Link href="/equipos" className="text-sm text-slate-400 transition hover:text-white">← Volver a Equipo</Link>
      </div>
      <MetricsDashboard targetUserId={userId} userName={user.name || "Usuario"} />
    </div>
  );
}
