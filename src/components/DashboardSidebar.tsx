"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useState, type ReactNode } from "react";
import UniPostLogo from "@/app/assets/UniPost.png";
import { Avatar } from "@/components/ui";

type NavItem = { href: string; label: string; icon: ReactNode };

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0" aria-hidden="true">
    <path d={d} />
  </svg>
);

const NAV: NavItem[] = [
  { href: "/composer", label: "Crear publicación", icon: icon("M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z") },
  { href: "/publicaciones", label: "Publicaciones", icon: icon("M4 5h16M4 12h16M4 19h10") },
  { href: "/metricas", label: "Métricas", icon: icon("M4 20V10M10 20V4M16 20v-7M22 20H2") },
  { href: "/equipos", label: "Equipo", icon: icon("M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM22 19v-1a4 4 0 0 0-3-3.87M16 3.13a3.5 3.5 0 0 1 0 6.75") },
  { href: "/perfil", label: "Cuentas y perfil", icon: icon("M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7") },
];

const COLLAPSE_KEY = "unipost:sidebar-collapsed";

export default function DashboardSidebar({ children, user }: { children: ReactNode; user: { name: string | null; email: string; image: string | null } }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    try { setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1"); } catch {}
  }, []);

  function toggleCollapsed() {
    setCollapsed((c) => {
      try { localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1"); } catch {}
      return !c;
    });
  }

  // Publicaciones que requieren acción (borradores o con error)
  useEffect(() => {
    fetch("/api/posts")
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) setPendingCount(json.data.filter((p: { status: string }) => p.status === "DRAFT" || p.status === "FAILED").length);
      })
      .catch(() => {});
  }, [pathname]);

  // Cerrar el menú móvil con Escape y al navegar
  useEffect(() => setMobileOpen(false), [pathname]);
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const showLabels = !collapsed || mobileOpen;

  return (
    <div className="flex min-h-screen">
      {/* Fondo del menú móvil */}
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden" onClick={() => setMobileOpen(false)} aria-hidden="true" />}

      <aside
        id="app-sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-white/10 bg-slate-950/95 backdrop-blur-xl transition-[width,transform] duration-200 md:sticky md:top-0 md:h-screen md:translate-x-0 md:bg-slate-950/60
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"} w-64 ${collapsed ? "md:w-[72px]" : "md:w-64"}`}
        aria-label="Navegación principal"
      >
        {/* Marca */}
        <div className={`flex h-16 items-center gap-3 border-b border-white/5 px-4 ${!showLabels ? "md:justify-center md:px-0" : ""}`}>
          <Image src={UniPostLogo} alt="" width={32} height={32} className="h-8 w-8 shrink-0" />
          {showLabels && <span className="text-lg font-bold tracking-tight text-white">UniPost</span>}
          <button onClick={() => setMobileOpen(false)} className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white md:hidden" aria-label="Cerrar menú">✕</button>
        </div>

        {/* Navegación */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                title={!showLabels ? item.label : undefined}
                className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400
                  ${active ? "bg-indigo-500/15 text-white" : "text-slate-400 hover:bg-white/5 hover:text-slate-100"}
                  ${!showLabels ? "md:justify-center md:px-0" : ""}`}
              >
                {active && <span className="absolute inset-y-2 left-0 w-1 rounded-r bg-indigo-400" aria-hidden="true" />}
                <span className={active ? "text-indigo-300" : ""}>{item.icon}</span>
                {showLabels && <span className="flex-1 truncate">{item.label}</span>}
                {item.href === "/publicaciones" && pendingCount > 0 && (
                  <span
                    className={`rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-200 ${!showLabels ? "md:absolute md:right-2 md:top-1 md:px-1.5" : ""}`}
                    aria-label={`${pendingCount} pendientes`}
                  >
                    {pendingCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Usuario */}
        <div className="border-t border-white/5 p-3">
          <div className={`flex items-center gap-3 rounded-xl px-2 py-2 ${!showLabels ? "md:justify-center md:px-0" : ""}`}>
            <Avatar src={user.image} name={user.name || user.email} size={34} />
            {showLabels && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-100">{user.name || "Mi cuenta"}</p>
                <p className="truncate text-xs text-slate-500">{user.email}</p>
              </div>
            )}
          </div>
          <div className={`mt-1 flex gap-1 ${!showLabels ? "md:flex-col" : ""}`}>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-400 transition hover:bg-red-500/10 hover:text-red-200"
              title="Cerrar sesión"
            >
              {icon("M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9")}
              {showLabels && "Cerrar sesión"}
            </button>
            <button
              onClick={toggleCollapsed}
              className="hidden items-center justify-center rounded-lg px-3 py-2 text-slate-400 transition hover:bg-white/5 hover:text-white md:flex"
              aria-label={collapsed ? "Expandir menú" : "Contraer menú"}
              title={collapsed ? "Expandir menú" : "Contraer menú"}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`} aria-hidden="true">
                <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          {showLabels && (
            <div className="mt-2 flex justify-center gap-3 text-[11px] text-slate-500">
              <Link href="/" className="hover:text-slate-300">Sitio público</Link>
              <span aria-hidden="true">·</span>
              <Link href="/terminos" className="hover:text-slate-300">Términos</Link>
            </div>
          )}
        </div>
      </aside>

      {/* Contenido */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-white/10 bg-slate-950/80 px-4 backdrop-blur-md md:hidden">
          <button onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-slate-200 hover:bg-white/10" aria-label="Abrir menú" aria-expanded={mobileOpen} aria-controls="app-sidebar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" /></svg>
          </button>
          <Image src={UniPostLogo} alt="" width={24} height={24} className="h-6 w-6" />
          <span className="font-semibold text-white">UniPost</span>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 md:px-10 md:py-10">{children}</main>
      </div>
    </div>
  );
}
