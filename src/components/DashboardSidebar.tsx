"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import Image from "next/image";
import UniPostLogo from "@/app/assets/UniPost.png"; 

export default function DashboardSidebar({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  
  const [desktopOpen, setDesktopOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  
  // 1. Estado para el contador de borradores
  const [draftCount, setDraftCount] = useState(0);

  // 2. Efecto para obtener los posts y contar los DRAFT
  useEffect(() => {
    async function fetchDrafts() {
      try {
        const res = await fetch("/api/posts");
        const json = await res.json();
        if (json.ok) {
          // Filtramos solo los que tienen status "DRAFT"
          const drafts = json.data.filter((p: any) => p.status === "DRAFT");
          setDraftCount(drafts.length);
        }
      } catch (error) {
        console.error("Error fetching drafts count:", error);
      }
    }

    fetchDrafts();
    
    // Opcional: Podrías poner un intervalo si quieres que se actualice solo
    // const interval = setInterval(fetchDrafts, 30000);
    // return () => clearInterval(interval);
  }, []); // Se ejecuta al montar el componente

  const menuItems = [
    { href: "/", label: "🏠 Inicio" },
    { href: "/perfil", label: "👤 Perfil" },
    { href: "/composer", label: "✏️ Composer" },
    { href: "/publicaciones", label: "📂 Publicaciones" },
    { href: "/equipos", label: "👥 Equipos" },
    { href: "/metricas", label: "📊 Métricas" },
  ];

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 text-slate-200">
      
      {/* Backdrop Móvil */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={`
          fixed md:relative z-50 h-screen flex flex-col justify-between p-4 
          transition-all duration-300 backdrop-blur-xl bg-slate-950/90 md:bg-white/5 border-r border-white/10 shadow-2xl
          ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
          ${desktopOpen ? "md:w-64" : "md:w-20"}
          w-64
        `}
      >
        
        {/* Botón colapsar (Desktop) */}
        <button
          onClick={() => setDesktopOpen(!desktopOpen)}
          className="hidden md:block absolute -right-3 top-10 bg-slate-800 text-indigo-400 rounded-full p-1 shadow-md hover:bg-slate-700 transition z-50 border border-indigo-500/30"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={`w-4 h-4 transition-transform duration-300 ${!desktopOpen ? "rotate-180" : ""}`}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>

        {/* Botón Cerrar (Móvil) */}
         <button
          onClick={() => setMobileOpen(false)}
          className="md:hidden absolute right-4 top-4 text-slate-400 hover:text-white p-1"
        >
          ✕
        </button>

        {/* Contenido Superior */}
        <div>
          <div className={`flex items-center gap-3 mb-8 mt-2 md:mt-0 transition-all duration-300 ${!desktopOpen ? "md:justify-center" : "px-2"}`}>
            <Image src={UniPostLogo} alt="UniPost Logo" width={40} height={40} className="h-10 w-10 min-w-[40px]" />
            <h1 className={`text-2xl font-bold tracking-wide whitespace-nowrap overflow-hidden transition-all duration-300 ${desktopOpen ? "opacity-100 w-auto" : "md:opacity-0 md:w-0 w-auto opacity-100"}`}>
              UniPost
            </h1>
          </div>

          <nav className="space-y-2 mt-6">
            {menuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)} 
                className={`flex items-center rounded-lg transition-all duration-200 group relative 
                  ${desktopOpen ? "px-4 py-3 gap-3" : "md:justify-center md:py-3 md:px-2 px-4 py-3 gap-3"} 
                  ${pathname === item.href ? "bg-white/10 font-semibold shadow text-white border border-white/5" : "hover:bg-white/5 text-slate-400 hover:text-white"}
                `}
              >
                <span className="text-xl leading-none">{item.label.split(" ")[0]}</span>
                
                <div className={`flex items-center justify-between flex-1 overflow-hidden transition-all duration-300 ${desktopOpen ? "w-auto opacity-100" : "md:w-0 md:opacity-0 w-auto opacity-100"}`}>
                  <span className="whitespace-nowrap">
                    {item.label.split(" ").slice(1).join(" ")}
                  </span>

                  {/* 3. Implementación del Badge de Borradores */}
                  {item.href === "/publicaciones" && draftCount > 0 && desktopOpen && (
                    <span className="ml-2 bg-yellow-500/20 text-yellow-200 text-[10px] font-bold px-2 py-0.5 rounded-full border border-yellow-500/30 animate-in fade-in zoom-in">
                      {draftCount}
                    </span>
                  )}
                </div>
                
                {/* Tooltip para Desktop colapsado */}
                {!desktopOpen && (
                  <div className="hidden md:block absolute left-full ml-2 px-2 py-1 bg-slate-900 border border-white/10 text-xs text-slate-200 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-50 pointer-events-none shadow-xl">
                    {item.label.split(" ").slice(1).join(" ")} 
                    {/* Opcional: Mostrar contador en tooltip también */}
                    {item.href === "/publicaciones" && draftCount > 0 && ` (${draftCount})`}
                  </div>
                )}
              </Link>
            ))}
          </nav>
        </div>

        {/* Footer del Sidebar */}
        <div className="border-t border-white/10 pt-4">
            <div className={`flex justify-center overflow-hidden transition-all duration-300 ${desktopOpen ? "max-h-10 mb-3 opacity-100" : "md:max-h-0 md:mb-0 md:opacity-0 max-h-10 mb-3 opacity-100"}`}>
                <Link href="/terminos" onClick={() => setMobileOpen(false)} className="text-xs text-slate-500 hover:text-slate-300 underline transition-colors decoration-slate-700 hover:decoration-slate-400">
                    Términos de Contenido
                </Link>
            </div>

            <button onClick={() => signOut({ callbackUrl: "/" })} className={`w-full bg-white/5 hover:bg-red-500/20 hover:text-red-200 text-slate-400 rounded-lg transition-all flex items-center group ${desktopOpen ? "px-4 py-2 gap-3" : "md:justify-center md:py-2 px-4 py-2 gap-3"}`} title="Cerrar Sesión">
            <span className="text-xl">🚪</span>
            <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${desktopOpen ? "w-auto opacity-100" : "md:w-0 md:opacity-0 w-auto opacity-100"}`}>Cerrar sesión</span>
            </button>
        </div>
      </aside>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Header Móvil */}
        <div className="md:hidden px-4 py-3 flex items-center justify-between bg-slate-950/50 backdrop-blur-md border-b border-white/10 sticky top-0 z-30">
            <div className="flex items-center gap-3">
                <button onClick={() => setMobileOpen(true)} className="p-2 text-slate-200 hover:bg-white/10 rounded-lg active:scale-95 transition">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-7 h-7">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                    </svg>
                </button>
                <span className="font-bold text-lg text-slate-100 tracking-wide">UniPost</span>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-10 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            {children}
        </div>
      </main>
    </div>
  );
}