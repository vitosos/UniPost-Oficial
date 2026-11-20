// src/app/(dashboard)/layout.tsx

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import DashboardSidebar from "@/components/DashboardSidebar";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/login");
  }

  return <DashboardSidebar user={{ name: session.user.name ?? null, email: session.user.email, image: session.user.image ?? null }}>{children}</DashboardSidebar>;
}
