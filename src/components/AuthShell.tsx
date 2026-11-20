import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import UniPostLogo from "@/app/assets/UniPost.png";

/** Contenedor común de las pantallas de autenticación (login, registro, verificación, recuperación). */
export default function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <Link href="/" className="mb-8 flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">
        <Image src={UniPostLogo} alt="" width={36} height={36} className="h-9 w-9" priority />
        <span className="text-xl font-bold tracking-tight text-white">UniPost</span>
      </Link>

      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-slate-400">{subtitle}</p>}
        </div>
        {children}
      </div>

      {footer && <div className="mt-6 text-center text-sm text-slate-400">{footer}</div>}
    </main>
  );
}
