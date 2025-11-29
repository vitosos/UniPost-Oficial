import MetricsDashboard from "@/components/MetricsDashboard";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

// ✅ CAMBIO: params es una Promesa ahora
export default async function MemberMetricsPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params;
  const userId = Number(id);

  if (isNaN(userId)) return notFound();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true }
  });

  if (!user) return notFound();

  return (
    <div>
      <div className="max-w-6xl mx-auto mb-6">
        <a href="/equipos" className="text-sm text-white/60 hover:text-white transition">← Volver a Equipos</a>
      </div>
      
      {/* Pasamos el userId para que el dashboard sepa a quién buscar */}
      <MetricsDashboard targetUserId={userId} userName={user.name || "Usuario"} />
    </div>
  );
}